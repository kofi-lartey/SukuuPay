import React, { useState, useEffect, useCallback } from 'react';
import { LoaderCircle, Heart, MessageCircle, Send, Plus, User, Clock, Pin, Bookmark, CheckCircle, MoreVertical, Search, Filter, X } from 'lucide-react';
import { useCommunity } from '../../context/CommunityContext';
import { getReactionCount } from '../../services/community';

const ReactionPicker = ({ targetId, targetType, onReact, currentReaction }) => {
  const [showPicker, setShowPicker] = useState(false);
  const [counts, setCounts] = useState({ like: 0, helpful: 0, fire: 0, support: 0 });

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const res = await getReactionCount(targetId, targetType);
        setCounts(res.data);
      } catch (e) {
        console.error('Failed to fetch reaction counts:', e);
      }
    };
    if (targetId) fetchCounts();
  }, [targetId, targetType]);

  const handleReact = async (type) => {
    try {
      await onReact(targetId, targetType, type);
      setShowPicker(false);
    } catch (e) {
      console.error('Failed to react:', e);
    }
  };

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="relative">
      <button
        onClick={() => setShowPicker(!showPicker)}
        className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold transition ${currentReaction ? 'text-teal-700 bg-teal-50' : 'text-slate-500 hover:bg-slate-100'}`}
      >
        <Heart className={`h-3.5 w-3.5 ${currentReaction ? 'fill-current' : ''}`} />
        {total > 0 && <span>{total}</span>}
      </button>

      {showPicker && (
        <div className="absolute bottom-full left-0 z-20 mb-1 flex gap-1 rounded-xl bg-white border border-slate-200 p-1 shadow-lg">
          {[
            { type: 'like', icon: Heart, color: 'text-rose-500' },
            { type: 'helpful', icon: CheckCircle, color: 'text-blue-500' },
            { type: 'fire', icon: Heart, color: 'text-amber-500' },
            { type: 'support', icon: Heart, color: 'text-emerald-500' },
          ].map((r) => (
            <button
              key={r.type}
              onClick={() => handleReact(r.type)}
              title={r.type}
              className={`flex h-7 w-7 items-center justify-center rounded-lg hover:bg-slate-100 ${r.color} ${currentReaction === r.type ? 'bg-slate-100' : ''}`}
            >
              <r.icon className="h-4 w-4" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ReactionPicker;