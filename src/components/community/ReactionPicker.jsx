import React, { useEffect, useRef, useState } from 'react';
import { Heart, CheckCircle } from 'lucide-react';
import { getReactionCount } from '../../services/community';
import { initializeSocket } from '../../utils/socket';

/**
 * The reaction button on a post or comment.
 *
 * ## Counts come from the server, not from this component
 *
 * This used to fetch counts for every card on mount — twenty posts meant twenty
 * requests before the feed was interactive. The feed now returns `reactionCounts`
 * per post (one aggregation for the whole page), so the picker renders from that
 * and only asks when it has nothing to show.
 *
 * ## Everyone sees the same number
 *
 * A reaction is broadcast as `community:reaction { targetId, targetType }`. This
 * listens for its own target and refetches, so the tally moves for everyone
 * reading the post, not just the person who tapped.
 *
 * ## One reaction per user, enforced twice
 *
 * The server has a unique index on (target, user) and toggles: same reaction
 * removes, different reaction rewrites. `myReaction` comes from the post payload,
 * so the button knows whether *this* user has already reacted without an extra
 * request. The local update below is optimistic and corrected by the socket.
 */

const EMPTY = { like: 0, helpful: 0, fire: 0, support: 0 };

const TYPES = [
  { type: 'like', icon: Heart, color: 'text-rose-500', label: 'Like' },
  { type: 'helpful', icon: CheckCircle, color: 'text-blue-500', label: 'Helpful' },
  { type: 'fire', icon: Heart, color: 'text-amber-500', label: 'Fire' },
  { type: 'support', icon: Heart, color: 'text-emerald-500', label: 'Support' },
];

const ReactionPicker = ({ targetId, targetType, onReact, myReaction, initialCounts, currentReaction }) => {
  const [showPicker, setShowPicker] = useState(false);
  const [counts, setCounts] = useState(initialCounts || EMPTY);
  const [mine, setMine] = useState(myReaction || currentReaction || null);
  const wrapper = useRef(null);

  useEffect(() => {
    if (initialCounts) setCounts(initialCounts);
  }, [initialCounts]);

  useEffect(() => {
    setMine(myReaction || currentReaction || null);
  }, [myReaction, currentReaction, targetId]);

  // Only fetches when the feed did not supply counts (a comment, for example).
  useEffect(() => {
    if (initialCounts || !targetId) return;
    let cancelled = false;

    getReactionCount(targetId, targetType)
      .then((res) => {
        if (!cancelled) setCounts(res?.data || EMPTY);
      })
      .catch((e) => {
        // A missing count must not take the card down; the button still works.
        console.warn('Failed to fetch reaction counts:', e?.message);
      });

    return () => { cancelled = true; };
  }, [targetId, targetType, initialCounts]);

  // Live tallies for everyone in the school room.
  useEffect(() => {
    if (!targetId) return undefined;
    let socket;
    let cancelled = false;

    const onReaction = (payload) => {
      if (String(payload?.targetId) !== String(targetId)) return;
      if (payload?.targetType !== targetType) return;

      getReactionCount(targetId, targetType)
        .then((res) => { if (!cancelled) setCounts(res?.data || EMPTY); })
        .catch(() => {});
    };

    initializeSocket(localStorage.getItem('auth_token'))
      .then((instance) => {
        if (cancelled) { instance?.close?.(); return; }
        socket = instance;
        socket.on('community:reaction', onReaction);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      socket?.off?.('community:reaction', onReaction);
    };
  }, [targetId, targetType]);

  useEffect(() => {
    if (!showPicker) return undefined;

    const onDocDown = (event) => {
      if (wrapper.current && !wrapper.current.contains(event.target)) setShowPicker(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') setShowPicker(false);
    };

    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [showPicker]);

  const handleReact = async (type) => {
    const previous = mine;
    const next = previous === type ? null : type;

    // Optimistic: the number and the filled state move with the tap.
    setMine(next);
    setCounts((prev) => {
      const updated = { ...prev };
      if (previous) updated[previous] = Math.max(0, (updated[previous] || 0) - 1);
      if (next) updated[next] = (updated[next] || 0) + 1;
      return updated;
    });
    setShowPicker(false);

    try {
      await onReact(targetId, targetType, type);
    } catch (e) {
      // Roll back rather than leave a tally that disagrees with the server.
      setMine(previous);
      setCounts((prev) => {
        const updated = { ...prev };
        if (next) updated[next] = Math.max(0, (updated[next] || 0) - 1);
        if (previous) updated[previous] = (updated[previous] || 0) + 1;
        return updated;
      });
      console.warn('Failed to react:', e?.message);
    }
  };

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="relative" ref={wrapper}>
      <button
        type="button"
        onClick={() => setShowPicker((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={showPicker}
        aria-label={mine ? `You reacted ${mine}. Change reaction` : 'Add a reaction'}
        className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold transition ${
          mine ? 'text-teal-700 bg-teal-50' : 'text-slate-500 hover:bg-slate-100'
        }`}
      >
        <Heart className={`h-3.5 w-3.5 ${mine ? 'fill-current' : ''}`} />
        {total > 0 && <span>{total}</span>}
      </button>

      {showPicker && (
        <div className="absolute bottom-full left-0 z-20 mb-1 flex gap-1 rounded-xl bg-white border border-slate-200 p-1 shadow-lg">
          {TYPES.map((r) => (
            <button
              key={r.type}
              type="button"
              onClick={() => handleReact(r.type)}
              title={r.label}
              aria-label={r.label}
              className={`flex h-7 w-7 items-center justify-center rounded-lg hover:bg-slate-100 ${r.color} ${
                mine === r.type ? 'bg-slate-100' : ''
              }`}
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