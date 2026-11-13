import React, { useRef, useState } from 'react';
import {
  MessageCircle,
  MoreVertical,
  Trash2,
  Bookmark,
} from 'lucide-react';
import ReactionPicker from './ReactionPicker';
import CommentThread from './CommentThread';
import MediaAttachment from './MediaAttachment';
import Avatar from '../common/Avatar';
import { useCommunity } from '../../context/CommunityContext';
import { listComments } from '../../services/community';

/** How many comments the thread loads per page. */
const PAGE_SIZE = 5;

/**
 // One post in the campus feed.
 *
 // ## Layout
 *
 // Comments open *beside* the post on a wide screen rather than underneath it, so a
 // post and its discussion read as one object instead of a post followed by an
 // unrelated-looking panel. Below `lg` there is no room for two columns and it
 // stacks, which is the only sensible answer on a phone.
 *
 // ## Counters
 *
 // `commentsCount` and `reactionCounts` arrive with the post from the feed query
 // (one aggregation for the whole page) rather than being fetched per card. The
 // local counters only adjust for actions taken in this session; everyone else's
 // changes arrive on the next feed fetch.
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
  // Paging state. Five at a time: enough to read the shape of the conversation,
  // cheap enough that opening a thread does not pull the whole thing.
  const [commentPage, setCommentPage] = useState(1);
  const [hasMoreComments, setHasMoreComments] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Held locally so the number moves the moment you comment, without waiting for a
  // refetch. Seeded from the server tally so every reader starts on the same value.
  const [commentCount, setCommentCount] = useState(post.commentsCount || 0);

  // The thread is rendered twice (inline on a phone, in an aside on a wide
   // screen), and only one of them is visible at a time. Scrolling needs a handle
   // on whichever one is on screen, so each gets its own ref and the visible one
   // is measured at click time.
  const inlineRef = useRef(null);
  const asideRef = useRef(null);

  const { feedPosts, handleAddComment, handleUpdateComment, handleDeleteComment, user } =
    useCommunity();

  const hasMedia = Array.isArray(post.media) && post.media.filter((m) => m?.url).length > 0;
  const isOwn = String(post.authorId?._id || post.authorId) === String(user?._id || '');

  const loadFirstPage = async () => {
    setLoadingComments(true);
    try {
      const res = await listComments(post._id, { page: 1, perPage: PAGE_SIZE });
      const payload = res.data || {};
      const list = Array.isArray(payload.data)
        ? payload.data
        : (Array.isArray(payload) ? payload : []);
      const meta = payload.meta || {};

      // The API returns newest-first; a thread reads oldest-first. Only the first
      // page is fetched - the rest arrive on "Read more".
      setComments([...list].reverse());
      setCommentPage(1);
      setHasMoreComments((meta.page || 1) < (meta.totalPages || 1));
    } catch (e) {
      console.error('Failed to fetch comments:', e);
    } finally {
      setLoadingComments(false);
    }
  };

  const toggleComments = () => {
    const opening = !showComments;
    setShowComments(opening);

    // Only the first page. The endpoint was already correct; what was wrong is
   // that this only ever fired once per mount, so a second open showed a stale
   // list. Reopening re-reads page one.
    if (opening && post._id) loadFirstPage();

    // A card that has just grown downward leaves the thread below the fold on a
    // phone, which reads as "nothing happened". Nudge it into view once it exists.
    if (opening) {
      requestAnimationFrame(() => {
        const target = inlineRef.current?.offsetParent ? inlineRef.current : asideRef.current;
        target?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    }
  };

  const loadMoreComments = async () => {
    if (!post._id || loadingMore || !hasMoreComments) return;

    setLoadingMore(true);
    try {
      const next = commentPage + 1;
      const res = await listComments(post._id, { page: next, perPage: PAGE_SIZE });
      const payload = res.data || {};
      const list = Array.isArray(payload.data)
        ? payload.data
        : (Array.isArray(payload) ? payload : []);
      const meta = payload.meta || {};

      // Newest-first from the API, oldest-first in the thread: appending a page
   // of newer comments prepends it. The dedupe guards against a comment posted
   // between the two requests appearing twice.
      const incoming = [...list]
        .reverse()
        .filter((c) => !comments.some((existing) => existing._id === c._id));

      setComments((prev) => [...incoming, ...prev]);
      setCommentPage(next);
      setHasMoreComments(next < (meta.totalPages || next));
    } catch (e) {
      console.error('Failed to load more comments:', e);
    } finally {
      setLoadingMore(false);
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
   // the client only names the message - it cannot forge the attribution.
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

  // A middle dot as an escape, not as a character: the source stays ASCII, so no
  // encoding round-trip can corrupt it on the way to the browser.
  const DOT = ' \u00B7 ';

  return (
    <article
      className={`overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-shadow hover:shadow-md ${
        showComments ? 'lg:grid lg:grid-cols-[minmax(0,1fr)_20rem]' : ''
      }`}
    >
      {/* Post */}
      <div className="min-w-0 p-4">
        <header className="flex items-start gap-3">
          <Avatar
            name={post.authorName}
            src={post.authorAvatar}
            size="sm"
            className="ring-2 ring-white"
          />

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
                <span className="text-[10px] font-semibold text-slate-400">{DOT} you</span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              {formatTime(post.createdAt)}
              {post.clubId ? `${DOT}in a club` : `${DOT}campus`}
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
          <h3 className="mt-2.5 text-[14px] font-extrabold leading-snug tracking-tight text-ink">
            {post.title}
          </h3>
        )}

        {post.body && (
          <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-slate-700">
            {post.body}
          </p>
        )}

        {hasMedia && (
          // Negative margin only when the discussion is beside the post, so the
          // image runs to the divider instead of leaving a white band before it.
          <div className={`mt-3 space-y-2 ${showComments ? 'lg:-mx-4' : ''}`}>
            {post.media
              .filter((m) => m?.url)
              .map((m, i) => (
                <MediaAttachment
                  key={m.publicId || `${m.url}-${i}`}
                  media={m}
                  fullBleed={showComments}
                />
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

        {/* Action bar */}
        <div className="mt-2.5 flex items-center gap-0.5 border-t border-slate-100 pt-1.5">
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
            aria-label={showComments ? 'Hide comments' : 'Show comments'}
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
          <div className="mt-3 lg:hidden" ref={inlineRef}>
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
              onLoadMore={loadMoreComments}
              hasMore={hasMoreComments}
              loadingMore={loadingMore}
            />
          </div>
        )}
      </div>

      {/* Discussion, beside the post on a wide screen */}
      {showComments && (
        <aside
          className="hidden border-l border-slate-100 bg-slate-50/60 p-3.5 lg:block"
          ref={asideRef}
        >
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
            onLoadMore={loadMoreComments}
            hasMore={hasMoreComments}
            loadingMore={loadingMore}
          />
        </aside>
      )}
    </article>
  );
};

export default PostCard;
