import React, { useState } from 'react';
import { Heart, MessageCircle, Send, MoreVertical, Pin, Trash2, Bookmark, CheckCircle } from 'lucide-react';
import ReactionPicker from './ReactionPicker';
import CommentThread from './CommentThread';

const PostCard = ({ post, onReact, onAddComment, onAcceptAnswer, onDeleteComment, onDeletePost, onBookmark }) => {
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);

  const toggleComments = async () => {
    setShowComments((prev) => !prev);
    if (!showComments && comments.length === 0 && post._id) {
      setLoadingComments(true);
      try {
        // Comments would be fetched here if we had a listComments call in context
        // For now, comments are managed via the socket events
        setLoadingComments(false);
      } catch (e) {
        console.error('Failed to fetch comments:', e);
        setLoadingComments(false);
      }
    }
  };

  const handleReact = async (targetId, targetType, reactionType) => {
    if (onReact) await onReact(targetId, targetType, reactionType);
  };

  const handleComment = async (postId, body, parentId) => {
    if (onAddComment) {
      const newComment = await onAddComment(postId, body, parentId);
      if (newComment) {
        setComments((prev) => [...prev, newComment]);
      }
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
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-100 text-teal-700 text-[11px] font-extrabold">
            {(post.authorName || 'U').slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="text-[13px] font-extrabold text-ink">{post.authorName || 'Unknown'}</p>
            <p className="text-[10.5px] text-slate-400">{formatTime(post.createdAt)}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => onBookmark && onBookmark(post._id)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
            <Bookmark className="h-4 w-4" />
          </button>
          <button className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>
      </div>

      {post.title && (
        <h3 className="mt-3 text-[14px] font-extrabold text-ink">{post.title}</h3>
      )}

      {post.body && (
        <p className="mt-2 text-[12.5px] text-slate-600">{post.body}</p>
      )}

      {post.poll && (
        <div className="mt-3 space-y-1.5">
          <p className="text-[12px] font-bold text-slate-700">{post.poll.question}</p>
          {post.poll.options.map((opt, idx) => {
            const total = post.poll.options.reduce((sum, o) => sum + (o.voterIds?.length || 0), 0);
            const pct = total > 0 ? ((opt.voterIds?.length || 0) / total) * 100 : 0;
            return (
              <div key={idx} className="relative overflow-hidden rounded-lg bg-slate-100 px-3 py-2 text-[12px]">
                <div className="relative z-10 flex justify-between">
                  <span>{opt.text}</span>
                  <span className="text-slate-500">{opt.voterIds?.length || 0} votes</span>
                </div>
                <div className="absolute inset-0 z-0 bg-teal-100" style={{ width: `${pct}%` }} />
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-3 flex items-center gap-4">
        <ReactionPicker
          targetId={post._id}
          targetType="post"
          onReact={handleReact}
          currentReaction={post.reactionType}
        />
        <button onClick={toggleComments} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-500 hover:bg-slate-100">
          <MessageCircle className="h-3.5 w-3.5" />
          {post.commentsCount || 0} comments
        </button>
      </div>

      {showComments && (
        <CommentThread
          postId={post._id}
          comments={comments}
          onAddComment={handleComment}
          onReact={handleReact}
        />
      )}
    </div>
  );
};

export default PostCard;