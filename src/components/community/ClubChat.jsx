import React, { useState, useRef } from 'react';
import {
  Send,
  Users,
  MessageCircle,
  Video,
  Paperclip,
  X,
  Reply,
  Copy,
  Check,
  Pencil,
  Trash2,
} from 'lucide-react';
import { useClubChat } from '../../hooks/useCommunity';
import { useCommunity } from '../../context/CommunityContext';
import EmojiPicker, { insertAtCaret } from './EmojiPicker';
import MediaAttachment from './MediaAttachment';
import ContextMenu from './ContextMenu';
import VoiceNoteButton from './VoiceNoteButton';
import LinkPreviewCard from './LinkPreviewCard';
import useLinkPreview from '../../hooks/useLinkPreview';
import Bubble from './Bubble';
import { uploadCommunityFile } from '../../services/community';

/**
 * The club chat, laid out as a messenger rather than a log.
 *
 * ## What changed from the previous version
 *
 * It was a flat list of `Name: text` lines. Three things make a conversation
 * readable at a glance, and none of them are decoration:
 *
 *  - **Alignment carries authorship.** Left is someone else, right is you. Reading
 *    who said what stops being a name-matching exercise, which matters most in a
 *    club of forty where several people share a first name.
 *  - **Grouping.** Consecutive messages from one person share an avatar column, so
 *    a burst of four short messages reads as one turn rather than four events.
 *  - **Actions behind a tap.** A Reply link on every message is a column of
 *    controls; one tap on the bubble is a menu that costs nothing until wanted.
 *
 * ## Honest about what the server knows
 *
 * The single check on an outgoing message means *the server stored it* — nothing
 * more. There is no per-message delivery state on `CommunityComment`, so drawing a
 * second check or a "read" marker would be inventing a receipt the API cannot
 * back. Read receipts are on the roadmap with the message model that supports them.
 */

const formatTime = (ts) => {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const authorIdOf = (message) => {
  const id = message?.authorId;
  return id && typeof id === 'object' ? String(id._id) : String(id || '');
};

const ClubChat = ({ clubId }) => {
  const { messages, loading, sendMessage, editMessage, deleteMessage } = useClubChat(clubId);
  const { user } = useCommunity();

  const [newMsg, setNewMsg] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [editing, setEditing] = useState(null);
  const [editBody, setEditBody] = useState('');
  const [pendingMedia, setPendingMedia] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  // The open menu, with the viewport position it was opened at. One state rather
  // than an id, because a cursor-positioned menu has to know *where* — and a long
  // press and a right-click on the same message are two different positions.
  const [menu, setMenu] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const inputRef = useRef(null);
  const fileRef = useRef(null);

  const myId = String(user?._id || '');
  const { preview: draftPreview, loading: previewLoading, dismiss: dismissPreview } =
    useLinkPreview(newMsg);

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;

    setUploading(true);
    setError('');
    try {
      const uploaded = [];
      for (const file of files) {
        // Sequential: a phone connection is the bottleneck, and parallel uploads
        // make all of them slower.
        uploaded.push(await uploadCommunityFile(file));
      }
      setPendingMedia((prev) => [...prev, ...uploaded]);
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || 'That file could not be uploaded');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleSend = async () => {
    const body = newMsg.trim();
    if (!body && pendingMedia.length === 0) return;

    setSending(true);
    setError('');
    try {
      await sendMessage(body || null, {
        media: pendingMedia,
        ...(replyTo ? { parentCommentId: replyTo._id } : {}),
      });
      setNewMsg('');
      setReplyTo(null);
      setPendingMedia([]);
    } catch (e) {
      // Kept on screen rather than cleared, so a failed send is recoverable.
      setError(e?.response?.data?.message || e?.message || 'That message did not send');
    } finally {
      setSending(false);
    }
  };

  const copyBody = (message) => {
    const text = [message.body, ...(message.media || []).map((m) => m.url)]
      .filter(Boolean)
      .join('\n');
    if (text && navigator.clipboard) navigator.clipboard.writeText(text);
  };

  /** Mirrors `EDIT_WINDOW_MS` in `services/communityComment.service.js`. */
  const canStillEdit = (message) =>
    message?.createdAt && Date.now() - new Date(message.createdAt).getTime() < 15 * 60 * 1000;

  const saveEdit = async () => {
    if (!editing || !editBody.trim()) return;
    setError('');
    try {
      await editMessage(editing._id, editBody.trim());
      setEditing(null);
      setEditBody('');
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || 'That edit did not save');
    }
  };

  const removeMessage = async () => {
    if (!confirmDelete) return;
    const target = confirmDelete;
    setConfirmDelete(null);
    setError('');
    try {
      await deleteMessage(target._id);
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || 'That message could not be deleted');
    }
  };

  const canSend = Boolean(newMsg.trim()) || pendingMedia.length > 0;

  return (
    <div className="flex h-[32rem] flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-teal-600" />
          <span className="text-[13px] font-extrabold text-ink">Club Chat</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Members"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
          >
            <Users className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Video call"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
          >
            <Video className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto bg-slate-50/60 p-3">
        {loading && <p className="py-4 text-center text-[12px] text-slate-400">Loading...</p>}
        {!loading && messages.length === 0 && (
          <p className="py-4 text-center text-[12px] text-slate-400">No messages yet</p>
        )}

        {messages.map((m, index) => {
          const mine = myId && authorIdOf(m) === myId;
          const previous = messages[index - 1];
          // Group consecutive messages from the same author within five minutes.
          const grouped =
            previous &&
            authorIdOf(previous) === authorIdOf(m) &&
            new Date(m.createdAt) - new Date(previous.createdAt) < 5 * 60 * 1000;

          const media = Array.isArray(m.media) ? m.media.filter((x) => x?.url) : [];
          const parent =
            m.parentCommentId && typeof m.parentCommentId === 'object' ? m.parentCommentId : null;

          return (
            <div
              key={m._id}
              className={`flex ${mine ? 'justify-end' : 'justify-start'} ${grouped ? 'mt-0.5' : 'mt-2'}`}
            >
<div className="max-w-[85%]">
                {editing?._id === m._id ? (
                  // A `<div>`, not a `<button>`: a textarea inside a button is
                  // invalid HTML and the browser reparents it, which loses focus
                  // on the first keystroke.
                  <div className="rounded-2xl bg-teal-600 px-3 py-2 text-left">
                    <textarea
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      rows={2}
                      autoFocus
                      className="w-full resize-none rounded-lg border border-teal-300 bg-white px-2 py-1.5 text-[12.5px] text-ink"
                    />
                    <div className="mt-1 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={saveEdit}
                        disabled={!editBody.trim()}
                        className="rounded-lg bg-white px-2.5 py-1 text-[10.5px] font-bold text-teal-700 disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(null);
                          setEditBody('');
                        }}
                        className="text-[10.5px] font-bold text-teal-50 hover:text-white"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <Bubble
                    message={m}
                    onOpenMenu={(position) => setMenu({ message: m, ...position })}
                  >
                    <div
                      className={`block w-full rounded-2xl px-3 py-2 text-left transition-colors ${
                        mine
                          ? 'bg-teal-600 text-white'
                          : 'border border-slate-200 bg-white text-ink'
                      } ${grouped ? 'rounded-tr-sm' : ''}`}
                    >
                    {!grouped && !mine && (
                      <span className="mb-0.5 block text-[10.5px] font-extrabold text-teal-700">
                        {m.authorName || 'Unknown'}
                      </span>
                    )}

                    {parent && (
                      <span
                        className={`mb-1 block border-l-2 pl-1.5 ${
                          mine ? 'border-teal-200' : 'border-teal-400'
                        }`}
                      >
                        <span
                          className={`block text-[9.5px] font-bold ${
                            mine ? 'text-teal-50' : 'text-teal-700'
                          }`}
                        >
                          {parent.authorName || 'Unknown'}
                        </span>
                        {parent.body && (
                          <span
                            className={`line-clamp-1 block text-[10.5px] ${
                              mine ? 'text-teal-50/90' : 'text-slate-500'
                            }`}
                          >
                            {parent.body}
                          </span>
                        )}
                      </span>
                    )}

                    {m.body && (
                      <span className="block whitespace-pre-wrap text-[12.5px] leading-snug">
                        {m.body}
                      </span>
                    )}

                    {m.linkPreview?.url && (
                      <span className="mt-1 block">
                        <LinkPreviewCard preview={m.linkPreview} compact />
                      </span>
                    )}

                    {media.length > 0 && (
                      <span className="mt-1 block space-y-1">
                        {media.map((x, i) => (
                          <MediaAttachment key={x.publicId || `${x.url}-${i}`} media={x} compact />
                        ))}
                      </span>
                    )}

                    <span
                      className={`mt-0.5 flex items-center justify-end gap-1 text-[9.5px] ${
                        mine ? 'text-teal-50/80' : 'text-slate-400'
                      }`}
                    >
                      {formatTime(m.createdAt)}
                      {m.editedAt && <span className="italic">edited</span>}
                      {mine && <Check className="h-3 w-3" aria-label="Sent" />}
                    </span>
                    </div>
                  </Bubble>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <ContextMenu
        open={Boolean(menu)}
        x={menu?.x}
        y={menu?.y}
        onClose={() => setMenu(null)}
        actions={
          menu
            ? [
                {
                  label: 'Reply',
                  icon: <Reply className="h-3.5 w-3.5" />,
                  onSelect: () => {
                    setReplyTo(menu.message);
                    inputRef.current?.focus();
                  },
                },
                ...(String(menu.message.authorId?._id || menu.message.authorId) === myId &&
                canStillEdit(menu.message)
                  ? [
                      {
                        label: 'Edit',
                        icon: <Pencil className="h-3.5 w-3.5" />,
                        onSelect: () => {
                          setEditing(menu.message);
                          setEditBody(menu.message.body || '');
                        },
                      },
                    ]
                  : []),
                {
                  label: 'Copy',
                  icon: <Copy className="h-3.5 w-3.5" />,
                  onSelect: () => copyBody(menu.message),
                },
                // Delete is for everyone, not just for me: the row is a soft delete
                // on the server, so the message leaves every reader's thread.
                // Offered only to the author — moderating someone else's message
                // is the super_admin's action, not a chat one.
                ...(String(menu.message.authorId?._id || menu.message.authorId) === myId
                  ? [
                      {
                        label: 'Delete',
                        icon: <Trash2 className="h-3.5 w-3.5" />,
                        danger: true,
                        onSelect: () => setConfirmDelete(menu.message),
                      },
                    ]
                  : []),
              ]
            : []
        }
      />

      <div className="border-t border-slate-100 p-2.5">
        {confirmDelete && (
          <div
            role="alertdialog"
            aria-label="Confirm delete"
            className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-2.5 py-2"
          >
            <p className="min-w-0 flex-1 truncate text-[11px] font-semibold text-red-700">
              Delete this message for everyone?
            </p>
            <button
              type="button"
              onClick={removeMessage}
              className="shrink-0 rounded-lg bg-red-600 px-2.5 py-1 text-[10.5px] font-bold text-white hover:bg-red-700"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(null)}
              className="shrink-0 text-[10.5px] font-bold text-slate-500 hover:text-slate-700"
            >
              Cancel
            </button>
          </div>
        )}
        {replyTo && (
          <div className="mb-1.5 flex items-start justify-between gap-2 rounded-lg bg-slate-50 px-2 py-1.5">
            <div className="min-w-0 border-l-2 border-teal-400 pl-2">
              <p className="text-[10px] font-bold text-teal-700">
                Replying to {replyTo.authorName || 'Unknown'}
              </p>
              {replyTo.body && (
                <p className="line-clamp-1 text-[11px] text-slate-500">{replyTo.body}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              aria-label="Cancel reply"
              className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {pendingMedia.length > 0 && (
          <div className="mb-1.5 flex flex-wrap gap-1.5">
            {pendingMedia.map((m, i) => (
              <div
                key={m.publicId || i}
                className="flex items-center gap-1 rounded-lg bg-slate-50 px-2 py-1"
              >
                <span className="max-w-[140px] truncate text-[10.5px] text-slate-600">
                  {m.originalName || 'Attachment'}
                </span>
                <button
                  type="button"
                  onClick={() => setPendingMedia((prev) => prev.filter((_, idx) => idx !== i))}
                  aria-label="Remove attachment"
                  className="text-slate-400 hover:text-red-500"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {error && <p className="mb-1.5 text-[11px] font-semibold text-red-600">{error}</p>}

        {/* Card for a link typed but not yet sent. */}
        {(draftPreview || previewLoading) && (
          <div className="mb-1.5">
            {previewLoading && !draftPreview ? (
              <div className="h-14 animate-pulse rounded-lg border border-slate-200 bg-slate-50" />
            ) : (
              <LinkPreviewCard preview={draftPreview} compact onRemove={dismissPreview} />
            )}
          </div>
        )}

        <div className="flex items-end gap-0.5">
          <EmojiPicker onPick={(e) => setNewMsg((prev) => insertAtCaret(inputRef.current, e))} />

          <input
            type="file"
            ref={fileRef}
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            aria-label="Attach a file"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-teal-600 disabled:opacity-50"
          >
            <Paperclip className="h-4 w-4" />
          </button>

          <VoiceNoteButton onRecorded={(file) => handleFiles([file])} />

          <input
            ref={inputRef}
            value={newMsg}
            onChange={(e) => setNewMsg(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={uploading ? 'Uploading...' : 'Message club...'}
            className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-[12px]"
          />

          <button
            type="button"
            onClick={handleSend}
            disabled={sending || uploading || !canSend}
            aria-label="Send message"
            className="rounded-xl bg-teal-600 px-3 py-2 text-white disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClubChat;