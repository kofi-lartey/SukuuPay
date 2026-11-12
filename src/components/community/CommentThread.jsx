import React, { useState, useEffect } from 'react';
import { MessageCircle, Send, User, Clock, Reply, CheckCircle, MoreVertical, Pin, Trash2 } from 'lucide-react';
import ReactionPicker from './ReactionPicker';

const CommentThread = ({ postId, comments, onAddComment, onAcceptAnswer, onDeleteComment, onReact, reactions = {} }) => {
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState(null);

  const handleSubmit = () => {
    if (!newComment.trim()) return;
    onAddComment(postId, newComment, replyTo?._id);
    setNewComment('');
    setReplyTo(null);
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
        <p className="text-[12px] text-slate-400 text-center py-2">No comments yet</p>
      )}
      {comments.map((c) => (
        <div key={c._id} className="flex gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-100 text-teal-700 text-[10px] font-extrabold shrink-0">
            {(c.authorName || 'U').slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 rounded-xl bg-slate-50 p-3">
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-extrabold text-ink">{c.authorName || 'Unknown'}</span>
              <span className="text-[10px] text-slate-400">{formatTime(c.createdAt)}</span>
              {c.isAcceptedAnswer && (
                <span className="inline-flex items-center gap-0.5 rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-extrabold text-emerald-700">
                  <CheckCircle className="h-3 w-3" /> Accepted
                </span>
              )}
            </div>
            <p className="mt-1 text-[12.5px] text-slate-600">{c.body}</p>
            <div className="mt-2 flex items-center gap-3">
              <ReactionPicker
                targetId={c._id}
                targetType="comment"
                onReact={onReact}
                currentReaction={reactions[c._id]?.type}
              />
              <button
                onClick={() => setReplyTo(c)}
                className="text-[10.5px] font-bold text-slate-500 hover:text-teal-600"
              >
                Reply
              </button>
            </div>
          </div>
        </div>
      ))}

      <div className="flex gap-2">
        <input
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder={replyTo ? `Reply to ${replyTo.authorName}...` : 'Add a comment...'}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-[12.5px]"
        />
        <button onClick={handleSubmit} className="rounded-xl bg-teal-600 px-3 py-2 text-white">
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default CommentThread;