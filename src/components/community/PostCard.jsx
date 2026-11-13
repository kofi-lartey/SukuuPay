import React, { useState } from 'react';
import {
  Heart,
  MessageCircle,
  Send,
  MoreVertical,
  Pin,
  Trash2,
  Bookmark,
  CheckCircle,
} from 'lucide-react';
import ReactionPicker from './ReactionPicker';
import CommentThread from './CommentThread';
import MediaAttachment from './MediaAttachment';
import { useCommunity } from '../../context/CommunityContext';
import { listComments } from '../../services/community';

/**
 * One post in the campus feed.
 *
 * ## Layout
 *
 * Comments open *beside* the post on a wide screen rather than underneath it, so a
 * post and its discussion read as one object instead of a post followed by an
 * unrelated-looking panel. Below `md` there is no room for two columns and it
 * stacks, which is the only sensible answer on a phone.
 *
 * ## Counters
 *
 * `commentsCount` and `reactionCounts` arrive with the post from the feed query
 * (one aggregation for the whole page) rather than being fetched per card. The
 * local counters below only adjust for actions taken in this session; everyone
 * else's changes arrive on the next feed fetch.
 */
const PostCard = ({
  post,
  onReact,
  onAddComment,
  onUpdateComment,
  onAcceptAnswer,
  onDeleteComment,
  onDeletePost,
  onBookmark,
}) => {
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);

  // Held locally so the number moves the moment you comment, without waiting for a
  // refetch. Seeded from the server tally so every reader starts on the same value.
  const [commentCount, setCommentCount] = useState(post.commentsCount || 0);

  const { feedPosts, handleAddComment, handleUpdateComment, handleDeleteComment, user } =
    useCommunity();

  const hasMedia = Array.isArray(post.media) && post.media.filter((m) => m?.url).length > 0;
  const isOwn = String(post.authorId?._id || post.authorId) === String(user?._id || '');

  const toggleComments = async () => {
    const opening = !showComments;
    setShowComments(opening);

    // The stub this replaces only flipped the flag, so opening a post with twenty
    // comments rendered "No comments yet" every time.
    if (opening && post._id) {
      setLoadingComments(true);
      try {
        const res = await listComments(post._id, { perPage: 50 });
        const payload = res.data || {};
        const list = Array.isArray(payload.data)
          ? payload.data
          : (Array.isArray(payload) ? payload : []);
        // The API returns newest-first; a thread reads oldest-first.
        setComments([...list].reverse());
      } catch (e) {
        console.error('Failed to fetch comments:', e);
      } finally {
        setLoadingComments(false);
      }
    }
  };

  const handleReact = async (targetId, targetType, reactionType) => {
    if (onReact) await onReact(targetId, targetType, reactionType);
  };

  const handleComment = async (postId, body, parentId, extra = {}) => {
    const add = onAddComment || handleAddComment;
    if (add) {
      const newComment = await add(postId, body, parentId, extra);
      if (newComment) {
        setComments((prev) => [...prev, newComment]);
        setCommentCount((n) => n + 1);
      }
      return newComment;
    }
    return null;
  };

  const handleDeleteCommentLocal = async (postId, commentId) => {
    if (!onDeleteComment && !handleDeleteComment) return;
    const remove = onDeleteComment || handleDeleteComment;
    await remove(postId, commentId);
    setComments((prev) => prev.filter((c) => c._id !== commentId));
    setCommentCount((n) => Math.max(0, n - 1));
  };

  const handleCommentUpdate = async (commentId, body) => {
    if (!onUpdateComment) return;
    const updated = await onUpdateComment(commentId, body);
    const next = updated?.data || updated;
    if (next) {
      setComments((prev) => prev.map((c) => (c._id === commentId ? { ...c, ...next } : c)));
    }
  };

  const handleForward = async (targetPostId, comment) => {
    // `forwardedFrom` is resolved server-side against the source's own school, so
    // the client only names the message — it cannot forge the attribution.
    await handleComment(targetPostId, null, null, { forwardedFrom: comment._id });
  };

  const formatTime = (ts) => {
    if (!ts) return '';
    const date = new Date(ts);
    const now = new Date();
    const diff = (now - date) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <article
      className={`overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-shadow hover:shadow-md ${
        showComments ? 'lg:grid lg:grid-cols-[minmax(0,1fr)_22rem]' : ''
      }`}
    >
      {/* ── Post ─────────────────────────────────────────────── */}
      <div className="min-w-0 p-4 sm:p-5">
        <header className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 text-[11px] font-extrabold text-white ring-2 ring-white">
            {(post.authorName || 'U').slice(0, 2).toUpperCase()}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-[13px] font-bold text-ink">
                {post.authorName || 'Unknown'}
              </p>
              {post.authorRole === 'teacher' && (
                <span className="rounded bg-teal-50 px-1 py-0.5 text-[8.5px] font-extrabold uppercase tracking-wide text-teal-700">
                  Staff
                </span>
              )}
              {isOwn && (
                <span className="text-[10px] font-semibold text-slate-400">· you</span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              {formatTime(post.createdAt)}
              {post.clubId ? ' · in a club' : ' · campus'}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={() => onBookmark && onBookmark(post._id)}
              aria-label="Save post"
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-teal-600"
            >
              <Bookmark className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="More options"
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </div>
        </header>

        {post.title && (
          <h3 className="mt-3 text-[15px] font-extrabold leading-snug tracking-tight text-ink">
            {post.title}
          </h3>
        )}

        {post.body && (
          <p className="mt-1.5 whitespace-pre-wrap text-[13.5px] leading-relaxed text-slate-700">
            {post.body}
          </p>
        )}

        {hasMedia && (
          <div className="mt-3 space-y-2">
            {post.media
              .filter((m) => m?.url)
              .map((m, i) => (
                <MediaAttachment key={m.publicId || `${m.url}-${i}`} media={m} />
              ))}
          </div>
        )}

        {post.poll && (
          <div className="mt-3 space-y-1.5">
            <p className="text-[12px] font-bold text-slate-700">{post.poll.question}</p>
            {post.poll.options.map((opt, idx) => {
              const total = post.poll.options.reduce(
                (sum, o) => sum + (o.voterIds?.length || 0),
                0
              );
              const pct = total > 0 ? ((opt.voterIds?.length || 0) / total) * 100 : 0;
              return (
                <div
                  key={idx}
                  className="relative overflow-hidden rounded-lg bg-slate-100 px-3 py-2 text-[12px]"
                >
                  <div className="relative z-10 flex justify-between">
                    <span>{opt.text}</span>
                    <span className="text-slate-500">{opt.voterIds?.length || 0} votes</span>
                  </div>
                  <div
                    className="absolute inset-y-0 left-0 z-0 bg-teal-100"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* ── Action bar ─────────────────────────────────────── */}
        <div className="mt-3 flex items-center gap-1 border-t border-slate-100 pt-2">
          <ReactionPicker
            targetId={post._id}
            targetType="post"
            onReact={handleReact}
            myReaction={post.myReaction}
            initialCounts={post.reactionCounts}
          />

          <button
            type="button"
            onClick={toggleComments}
            aria-expanded={showComments}
            className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold transition-colors ${
              showComments
                ? 'bg-slate-100 text-slate-700'
                : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            <MessageCircle className="h-3.5 w-3.5" />
            {commentCount}
          </button>

          {onDeletePost && isOwn && (
            <button
              type="button"
              onClick={() => onDeletePost(post._id)}
              aria-label="Delete post"
              className="ml-auto rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Inline thread on a narrow screen: the side panel is not available. */}
        {showComments && (
          <div className="mt-3 lg:hidden">
            <CommentThread
              postId={post._id}
              loading={loadingComments}
              comments={comments}
              onAddComment={handleComment}
              onUpdateComment={onUpdateComment ? handleCommentUpdate : undefined}
              onDeleteComment={handleDeleteCommentLocal}
              onReact={handleReact}
              onForward={handleForward}
              forwardTargets={(feedPosts || []).filter((p) => p._id !== post._id)}
              currentUserId={user?._id}
            />
          </div>
        )}
      </div>

      {/* ── Discussion, beside the post on a wide screen ───────── */}
      {showComments && (
        <aside className="hidden border-l border-slate-100 bg-slate-50/60 p-4 lg:block">
          <CommentThread
            postId={post._id}
            loading={loadingComments}
            comments={comments}
            onAddComment={handleComment}
            onUpdateComment={onUpdateComment ? handleCommentUpdate : undefined}
            onDeleteComment={handleDeleteCommentLocal}
            onReact={handleReact}
            onForward={handleForward}
            forwardTargets={(feedPosts || []).filter((p) => p._id !== post._id)}
            currentUserId={user?._id}
          />
        </aside>
      )}
    </article>
  );
};

export default PostCard;