import React, { useEffect, useState } from 'react';
import { CheckCircle, Reply, Forward, Pencil, Trash2, Copy } from 'lucide-react';
import ReactionPicker from './ReactionPicker';
import MediaAttachment from './MediaAttachment';
import LinkOrMedia from './LinkOrMedia';
import Bubble from './Bubble';
import Avatar from '../common/Avatar';

/** Mirrors `EDIT_WINDOW_MS` in `services/communityComment.service.js`. */
export const EDIT_WINDOW_MS = 15 * 60 * 1000;

export const canStillEdit = (comment) => {
  if (!comment?.createdAt) return false;
  return Date.now() - new Date(comment.createdAt).getTime() < EDIT_WINDOW_MS;
};

export const isOwn = (comment, userId) =>
  Boolean(userId) && String(comment?.authorId?._id || comment?.authorId) === String(userId);

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

/**
 * One comment, plus its replies nested inside it.
 *
 * ## Why this is its own component
 *
 * The thread used to render a flat list, ordered and indented to *look* nested. That
 * works visually and fails semantically: a screen reader announces a sequence of
 * siblings, there is no group to collapse, and "how many replies does this have" is
 * not answerable from the markup.
 *
 * Rendering an actual `<ul>` per level gives all three for free, and makes each
 * comment's own state (editing, forwarding) local to that comment instead of a
 * single id being compared against every row.
 *
 * ## Depth is not passed down
 *
 * `depth` is used only to decide how much to indent the avatar column, and it is
 * computed by the caller from the tree it already built. The nesting itself comes
 * from the `<ul>` structure, so the DOM and the visual indent cannot disagree.
 */
const CommentItem = ({
  comment: c,
  depth = 0,
  childrenByParent,
  postId,
  currentUserId,
  reactions = {},
  onReply,
  onUpdate,
  onDelete,
  onReact,
  onForward,
  forwardTargets = [],
  onOpenMenu,
}) => {
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState('');
  const [editError, setEditError] = useState('');
  const [forwarding, setForwarding] = useState(false);

  // `parentCommentId` arrives populated from the API so a reply can show what it is
  // replying to without a second request.
  const parent = c.parentCommentId && typeof c.parentCommentId === 'object' ? c.parentCommentId : null;
  const media = Array.isArray(c.media) ? c.media.filter((m) => m?.url) : [];
  const mine = isOwn(c, currentUserId);
  const replies = childrenByParent.get(String(c._id)) || [];

  const startEdit = () => {
    setEditBody(c.body || '');
    setEditError('');
    setEditing(true);
  };

  /*
   * The thread's context menu can only name a comment; the edit state lives here.
   * A custom event is the bridge: the menu dispatches, this item listens for its own
   * id, and no state has to be lifted out of the component that owns the textarea.
   */
  useEffect(() => {
    if (!editing) {
      const onEditRequest = (event) => {
        if (String(event.detail) === String(c._id)) startEdit();
      };
      window.addEventListener('community:edit-comment', onEditRequest);
      return () => window.removeEventListener('community:edit-comment', onEditRequest);
    }
    return undefined;
  }, [c._id, editing]);

  const saveEdit = async () => {
    if (!editBody.trim() || !onUpdate) return;
    setEditError('');
    try {
      await onUpdate(c._id, editBody.trim());
      setEditing(false);
    } catch (e) {
      setEditError(e?.response?.data?.message || e?.message || 'That edit did not save');
    }
  };

  return (
    <li>
      <div className="flex gap-3">
        <Avatar name={c.authorName} src={c.authorAvatar} size="sm" />

        <div className="flex-1 rounded-xl bg-slate-50 p-3">
          <div className="flex items-center gap-2">
            {/* The author is the label of the comment, so the name sits beside the
                text rather than on a line of its own above it. */}
            <span className="text-[10px] text-slate-400">{formatTime(c.createdAt)}</span>
            {c.editedAt && (
              <span
                className="text-[9.5px] italic text-slate-400"
                title="This message was edited"
              >
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
              <p className="text-[10px] font-bold text-teal-700">
                {parent.authorName || 'Unknown'}
              </p>
              {parent.body && (
                <p className="line-clamp-2 text-[11px] text-slate-500">{parent.body}</p>
              )}
            </div>
          )}

          {editing ? (
            <div className="mt-1.5">
              {/* Editing replaces the body, so the author label moves here to stay visible. */}
              <p className="mb-1 text-[12px] font-extrabold text-ink">
                {c.authorName || 'Unknown'}
              </p>
              <textarea
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                rows={2}
                autoFocus
                className="w-full resize-none rounded-lg border border-slate-200 px-2 py-1.5 text-[12.5px]"
              />
              {editError && (
                <p className="mt-1 text-[11px] font-semibold text-red-600">{editError}</p>
              )}
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
                    setEditing(false);
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
              <Bubble message={c} onOpenMenu={onOpenMenu}>
                <p className="mt-1 whitespace-pre-wrap text-[12.5px] leading-snug text-slate-600">
                  <span className="font-extrabold text-ink">{c.authorName || 'Unknown'}</span>
                  {c.body ? ` ${c.body}` : null}
                </p>

                {c.linkPreview?.url && (
                  <div className="mt-2">
                    <LinkOrMedia preview={c.linkPreview} />
                  </div>
                )}
              </Bubble>

              {media.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {media.map((m, i) => (
                    <MediaAttachment
                      key={m.publicId || `${m.url}-${i}`}
                      media={m}
                      compact
                    />
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
              myReaction={c.myReaction}
            />

            {/*
              * Reply is a visible link, not only a menu item. It was moved into the
              * right-click / long-press menu to keep the transcript quiet, and that
              * made it undiscoverable on a desktop, where right-click is not a
              * gesture anyone tries on a paragraph of text. Edit and Delete stay in
              * the menu: they are destructive, and a reply is something you do to
              * every second comment.
              */}
            <button
              type="button"
              onClick={() => onReply?.(c)}
              className="inline-flex items-center gap-1 text-[10.5px] font-bold text-slate-500 hover:text-teal-600"
            >
              <Reply className="h-3 w-3" /> Reply
              {replies.length > 0 && <span className="text-slate-400">{replies.length}</span>}
            </button>

            {onForward && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setForwarding((v) => !v)}
                  className="inline-flex items-center gap-1 text-[10.5px] font-bold text-slate-500 hover:text-teal-600"
                >
                  <Forward className="h-3 w-3" /> Forward
                </button>

                {forwarding && (
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
                          setForwarding(false);
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

      {/*
        * The nesting. Each level is its own list, so the DOM mirrors the tree and a
        * reader can follow one thread without the rest of the conversation.
        */}
      {replies.length > 0 && (
        <ul className="mt-3 space-y-3 border-l border-slate-200 pl-4">
          {replies.map((reply) => (
            <CommentItem
              key={reply._id}
              comment={reply}
              depth={depth + 1}
              childrenByParent={childrenByParent}
              postId={postId}
              currentUserId={currentUserId}
              reactions={reactions}
              onReply={onReply}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onReact={onReact}
              onForward={onForward}
              forwardTargets={forwardTargets}
              onOpenMenu={onOpenMenu}
            />
          ))}
        </ul>
      )}
    </li>
  );
};

export default CommentItem;
