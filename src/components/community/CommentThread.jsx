import React, { useMemo, useRef, useState } from 'react';
import { Send, X, Paperclip, Reply, Pencil, Trash2, Copy } from 'lucide-react';
import EmojiPicker, { insertAtCaret } from './EmojiPicker';
import LinkPreviewCard from './LinkPreviewCard';
import { mediaKindForUrl } from './LinkOrMedia';
import ContextMenu from './ContextMenu';
import CommentItem, { canStillEdit, isOwn } from './CommentItem';
import useLinkPreview from '../../hooks/useLinkPreview';
import { uploadCommunityFile } from '../../services/community';

/**
 // The discussion under a post.
 *
 // ## Structure
 *
 // Replies are rendered as real nested lists: each level is its own `<ul>`, so the DOM
 // mirrors the conversation and a screen reader follows one thread at a time. The
 // previous version rendered a flat list ordered and indented to look nested â€” visually
 // similar, semantically a sequence of siblings.
 *
 // ## Why the tree is built here and not in the item
 *
 // The children map is shared by every node, and building it once avoids re-deriving it
 // at each level. Each `CommentItem` then reads its own children from that map, which is
 // what makes the recursion cheap.
 *
 // ## Orphans
 *
 // Paging fetches comments, not whole subtrees, so a reply whose parent is not on the
 // loaded page is treated as a root. Dropping it would make "Read more" lose messages.
 */

const CommentThread = ({
  postId,
  comments,
  onAddComment,
  onUpdateComment,
  onAcceptAnswer,
  onDeleteComment,
  onReact,
  forwardTargets = [],
  loading = false,
  onForward,
  currentUserId,
  reactions = {},
  onLoadMore,
  hasMore = false,
  loadingMore = false,
}) => {
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [menu, setMenu] = useState(null);
  const [pendingMedia, setPendingMedia] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  const fileRef = useRef(null);

  const { childrenByParent, roots } = useMemo(() => {
    const ids = new Set(comments.map((c) => String(c._id)));
    const byParent = new Map();

    for (const c of comments) {
      const parentId = c.parentCommentId
        ? String(c.parentCommentId._id || c.parentCommentId)
        : null;
      // A parent that is not on this page cannot own a nested slot.
      if (!parentId || !ids.has(parentId)) continue;
      if (!byParent.has(parentId)) byParent.set(parentId, []);
      byParent.get(parentId).push(c);
    }

    return {
      childrenByParent: byParent,
      roots: comments.filter((c) => {
        if (!c.parentCommentId) return true;
        const parentId = String(c.parentCommentId._id || c.parentCommentId);
        return !ids.has(parentId);
      }),
    };
  }, [comments]);

  const { preview: draftPreview, loading: previewLoading, dismiss: dismissPreview } =
    useLinkPreview(newComment);

  const reset = () => {
    setNewComment('');
    setReplyTo(null);
    setPendingMedia([]);
    setError('');
  };

  const startReply = (comment) => {
    setReplyTo(comment);
    inputRef.current?.focus();
  };

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;

    setUploading(true);
    setError('');
    try {
      // Sequential: a phone connection is the bottleneck, and parallel uploads make
      // all of them slower.
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

  return (
    <div className="mt-4 space-y-3 border-t border-slate-100 pt-3">
      {loading && comments.length === 0 && (
        <p className="py-2 text-center text-[12px] text-slate-400">Loading comments...</p>
      )}

      {!loading && comments.length === 0 && (
        <p className="py-2 text-center text-[12px] text-slate-400">No comments yet</p>
      )}

      <ul className="space-y-3">
        {roots.map((c) => (
          <CommentItem
            key={c._id}
            comment={c}
            depth={0}
            childrenByParent={childrenByParent}
            postId={postId}
            currentUserId={currentUserId}
            reactions={reactions}
            onReply={startReply}
            onUpdate={onUpdateComment}
            onDelete={onDeleteComment}
            onReact={onReact}
            onForward={onForward}
            forwardTargets={forwardTargets}
            onOpenMenu={(position) => setMenu({ message: c, ...position })}
          />
        ))}
      </ul>

      {hasMore && (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={loadingMore}
          className="w-full rounded-lg py-1.5 text-center text-[11.5px] font-bold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
        >
          {loadingMore ? 'Loading...' : 'Read more comments'}
        </button>
      )}

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
                  onSelect: () => startReply(menu.message),
                },
                ...(isOwn(menu.message, currentUserId) &&
                onUpdateComment &&
                canStillEdit(menu.message)
                  ? [
                      {
                        label: 'Edit',
                        icon: <Pencil className="h-3.5 w-3.5" />,
                        onSelect: () => {
                          // Edit state lives in the item; the event carries the id so
                          // the right row opens its own textarea.
                          window.dispatchEvent(
                            new CustomEvent('community:edit-comment', {
                              detail: menu.message._id,
                            })
                          );
                        },
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

        {/* The card for a link that has been typed but not yet sent. Audio/video
            links render as players once sent, so don't show a preview card here. */}
        {(draftPreview || previewLoading) && mediaKindForUrl(draftPreview?.url) === null && (
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
            placeholder={
              replyTo ? `Reply to ${replyTo.authorName || 'message'}...` : 'Add a comment...'
            }
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
