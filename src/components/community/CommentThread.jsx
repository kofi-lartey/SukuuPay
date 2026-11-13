import React, { useState, useRef } from 'react';
import { Send, CheckCircle, Reply, X, Paperclip, Forward, Pencil, Trash2, Copy } from 'lucide-react';
import ReactionPicker from './ReactionPicker';
import EmojiPicker, { insertAtCaret } from './EmojiPicker';
import MediaAttachment from './MediaAttachment';
import LinkPreviewCard from './LinkPreviewCard';
import Bubble from './Bubble';
import ContextMenu from './ContextMenu';
import useLinkPreview from '../../hooks/useLinkPreview';
import { uploadCommunityFile } from '../../services/community';

/** Mirrors `EDIT_WINDOW_MS` in `services/communityComment.service.js`. */
const EDIT_WINDOW_MS = 15 * 60 * 1000;

const canStillEdit = (comment) => {
  if (!comment?.createdAt) return false;
  return Date.now() - new Date(comment.createdAt).getTime() < EDIT_WINDOW_MS;
};

const isOwn = (comment, userId) =>
  Boolean(userId) && String(comment?.authorId?._id || comment?.authorId) === String(userId);

const CommentThread = ({
  postId,
  comments,
  onAddComment,
  onUpdateComment,
  onAcceptAnswer,
  onDeleteComment,
  onReact,
  forwardTargets = [],
  onForward,
  currentUserId,
  reactions = {},
}) => {
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [forwarding, setForwarding] = useState(null);
  const [editing, setEditing] = useState(null);
  const [menu, setMenu] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [editBody, setEditBody] = useState('');
  const [pendingMedia, setPendingMedia] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  const fileRef = useRef(null);

  // The composer's own card, shown before the message exists.
  const { preview: draftPreview, loading: previewLoading, dismiss: dismissPreview } =
    useLinkPreview(newComment);

  const reset = () => {
    setNewComment('');
    setReplyTo(null);
    setPendingMedia([]);
    setError('');
  };

  const startEdit = (comment) => {
    setEditing(comment);
    setEditBody(comment.body || '');
    setError('');
  };

  const saveEdit = async () => {
    if (!editing || !editBody.trim() || !onUpdateComment) return;
    setError('');
    try {
      await onUpdateComment(editing._id, editBody.trim());
      setEditing(null);
      setEditBody('');
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || 'That edit did not save');
    }
  };

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;

    setUploading(true);
    setError('');
    try {
      // Sequential rather than parallel: a class chat on a phone connection is
      // already the bottleneck, and five simultaneous uploads make all five slower.
      const uploaded = [];
      for (const file of files) {
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

  const handleSubmit = async () => {
    const body = newComment.trim();
    if (!body && pendingMedia.length === 0) return;

    setSending(true);
    setError('');
    try {
      await onAddComment(postId, body || null, replyTo?._id, { media: pendingMedia });
      reset();
    } catch (e) {
      // The message is kept on screen so a failed send is not silently lost.
      setError(e?.response?.data?.message || e?.message || 'That message did not send');
    } finally {
      setSending(false);
    }
  };

  const formatTime = (ts) => {
    if (!ts) return '';
    const date = new Date(ts);
    const now = new Date();
    const diff = (now - date) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="mt-4 space-y-3 border-t border-slate-100 pt-3">
      {comments.length === 0 && (
        <p className="py-2 text-center text-[12px] text-slate-400">No comments yet</p>
      )}

      {comments.map((c) => {
        // `parentCommentId` arrives populated from the API so a reply can show
        // what it is replying to without a second request.
        const parent = c.parentCommentId && typeof c.parentCommentId === 'object' ? c.parentCommentId : null;
        const media = Array.isArray(c.media) ? c.media.filter((m) => m?.url) : [];
        const mine = currentUserId && String(c.authorId?._id || c.authorId) === String(currentUserId);
        const isEditing = editing?._id === c._id;

        return (
          <div key={c._id} className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-100 text-[10px] font-extrabold text-teal-700">
              {(c.authorName || 'U').slice(0, 2).toUpperCase()}
            </div>

            <div className="flex-1 rounded-xl bg-slate-50 p-3">
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-extrabold text-ink">{c.authorName || 'Unknown'}</span>
                <span className="text-[10px] text-slate-400">{formatTime(c.createdAt)}</span>
                {c.editedAt && (
                  <span className="text-[9.5px] italic text-slate-400" title="This message was edited">
                    edited
                  </span>
                )}
                {c.isAcceptedAnswer && (
                  <span className="inline-flex items-center gap-0.5 rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-extrabold text-emerald-700">
                    <CheckCircle className="h-3 w-3" /> Accepted
                  </span>
                )}
              </div>

              {c.forwardedFrom && (
                <p className="mt-1 text-[10.5px] text-slate-400">
                  Forwarded{c.forwardedFromAuthor ? ` from ${c.forwardedFromAuthor}` : ''}
                </p>
              )}

              {parent && (
                <div className="mt-1.5 border-l-2 border-teal-300 pl-2">
                  <p className="text-[10px] font-bold text-teal-700">{parent.authorName || 'Unknown'}</p>
                  {parent.body && (
                    <p className="line-clamp-2 text-[11px] text-slate-500">{parent.body}</p>
                  )}
                </div>
              )}

              {isEditing ? (
                <div className="mt-1.5">
                  <textarea
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    rows={2}
                    autoFocus
                    className="w-full resize-none rounded-lg border border-slate-200 px-2 py-1.5 text-[12.5px]"
                  />
                  <div className="mt-1 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={saveEdit}
                      disabled={!editBody.trim()}
                      className="rounded-lg bg-teal-600 px-2.5 py-1 text-[10.5px] font-bold text-white disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(null);
                        setEditBody('');
                      }}
                      className="text-[10.5px] font-bold text-slate-500 hover:text-slate-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <Bubble
                    message={c}
                    onOpenMenu={(position) => setMenu({ message: c, ...position })}
                  >
                    {c.body && (
                      <p className="mt-1 whitespace-pre-wrap text-[12.5px] text-slate-600">{c.body}</p>
                    )}

                    {c.linkPreview?.url && (
                      <div className="mt-2">
                        <LinkPreviewCard preview={c.linkPreview} compact />
                      </div>
                    )}
                  </Bubble>

                  {media.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {media.map((m, i) => (
                        <MediaAttachment key={m.publicId || `${m.url}-${i}`} media={m} compact />
                      ))}
                    </div>
                  )}
                </>
              )}

              <div className="mt-2 flex items-center gap-3">
                <ReactionPicker
                  targetId={c._id}
                  targetType="comment"
                  onReact={onReact}
                  currentReaction={reactions[c._id]?.type}
                />
                {/* Reply / Edit / Delete live in the right-click and long-press
                    menu, so a comment reads as text rather than a row of controls. */}
                {onForward && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setForwarding((prev) => (prev === c._id ? null : c._id))}
                      className="inline-flex items-center gap-1 text-[10.5px] font-bold text-slate-500 hover:text-teal-600"
                    >
                      <Forward className="h-3 w-3" /> Forward
                    </button>

                    {forwarding === c._id && (
                      <div className="absolute bottom-full left-0 z-20 mb-1 w-56 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                        <p className="px-2 py-1 text-[9.5px] font-bold uppercase tracking-wide text-slate-400">
                          Forward to
                        </p>
                        {forwardTargets.length === 0 && (
                          <p className="px-2 py-1.5 text-[11px] text-slate-400">
                            No other posts to forward to
                          </p>
                        )}
                        {forwardTargets.map((t) => (
                          <button
                            key={t._id}
                            type="button"
                            onClick={async () => {
                              setForwarding(null);
                              await onForward(t._id, c);
                            }}
                            className="block w-full truncate rounded-lg px-2 py-1.5 text-left text-[11.5px] text-slate-600 hover:bg-slate-100"
                          >
                            {t.title || `${t.postType} post`}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}

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
                ...(isOwn(menu.message, currentUserId) && onUpdateComment && canStillEdit(menu.message)
                  ? [
                      {
                        label: 'Edit',
                        icon: <Pencil className="h-3.5 w-3.5" />,
                        onSelect: () => startEdit(menu.message),
                      },
                    ]
                  : []),
                {
                  label: 'Copy',
                  icon: <Copy className="h-3.5 w-3.5" />,
                  onSelect: () => {
                    const text = [
                      menu.message.body,
                      menu.message.linkPreview?.url,
                      ...(menu.message.media || []).map((m) => m.url),
                    ]
                      .filter(Boolean)
                      .join('\n');
                    if (text && navigator.clipboard) navigator.clipboard.writeText(text);
                  },
                },
                ...(isOwn(menu.message, currentUserId) && onDeleteComment
                  ? [
                      {
                        label: 'Delete',
                        icon: <Trash2 className="h-3.5 w-3.5" />,
                        danger: true,
                        onSelect: () => {
                          if (window.confirm('Delete this message for everyone?')) {
                            onDeleteComment(postId, menu.message._id).catch(() => {});
                          }
                        },
                      },
                    ]
                  : []),
              ]
            : []
        }
      />

      <div className="rounded-xl border border-slate-200 p-2">
        {replyTo && (
          <div className="mb-1.5 flex items-start justify-between gap-2 rounded-lg bg-slate-50 px-2 py-1.5">
            <div className="min-w-0 border-l-2 border-teal-400 pl-2">
              <p className="text-[10px] font-bold text-teal-700">
                Replying to {replyTo.authorName || 'Unknown'}
              </p>
              {replyTo.body && <p className="line-clamp-1 text-[11px] text-slate-500">{replyTo.body}</p>}
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
              <div key={m.publicId || i} className="flex items-center gap-1 rounded-lg bg-slate-50 px-2 py-1">
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

        {/* The card for a link that has been typed but not yet sent. */}
        {(draftPreview || previewLoading) && (
          <div className="mb-1.5">
            {previewLoading && !draftPreview ? (
              <div className="h-14 animate-pulse rounded-lg border border-slate-200 bg-slate-50" />
            ) : (
              <LinkPreviewCard preview={draftPreview} compact onRemove={dismissPreview} />
            )}
          </div>
        )}

        {error && <p className="mb-1.5 text-[11px] font-semibold text-red-600">{error}</p>}

        <div className="flex items-end gap-1">
          <EmojiPicker
            onPick={(e) => setNewComment((prev) => insertAtCaret(inputRef.current, e))}
          />

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

          <input
            ref={inputRef}
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder={replyTo ? `Reply to ${replyTo.authorName || 'message'}...` : 'Add a comment...'}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-[12.5px]"
          />

          <button
            type="button"
            onClick={handleSubmit}
            disabled={sending || uploading || (!newComment.trim() && pendingMedia.length === 0)}
            className="rounded-xl bg-teal-600 px-3 py-2 text-white disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CommentThread;