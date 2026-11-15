import React from 'react';
import { MessageCircle, Pencil, Users } from 'lucide-react';

/**
 * Club card.
 *
 * ## The edit affordance
 *
 * Rendered only for the creator. The server enforces the same rule
 * (`CLUB_NOT_CREATOR`), so this is presentation only — but it is deliberately
 * absent rather than disabled for everyone else: a visible-but-dead control
 * reads as a bug and advertises a capability the user does not have.
 *
 * It sits in the card's action row as a labelled button, not as a bare icon in
 * the header. The earlier 14px `text-slate-400` glyph with no border disappeared
 * against the card and was reported as missing; the action row is where the
 * card's other controls live, so the button is found where a user looks for it.
 *
 * `createdBy` may hold either a `User._id` (staff creator) or a `Student._id`
 * (student creator), so it is compared as a string against `currentUserId` and
 * never populated.
 */
const ClubDetail = ({ club, onJoin, onLeave, onOpenChat, onEdit, currentUserId }) => {
  const handleJoin = async () => {
    if (onJoin) await onJoin(club._id);
  };

  const handleLeave = async () => {
    if (onLeave) await onLeave(club._id);
  };

  const isMember = club.memberIds?.includes('me');
  const isCreator =
    !!club.createdBy && !!currentUserId && String(club.createdBy) === String(currentUserId);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[14px] font-extrabold text-ink">{club.name}</p>
            <p className="text-[11px] text-slate-400">{club.memberIds?.length || 0} members</p>
          </div>
        </div>
        <span
          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${
            club.privacy === 'private'
              ? 'bg-amber-100 text-amber-700'
              : 'bg-slate-100 text-slate-500'
          }`}
        >
          {club.privacy}
        </span>
      </div>
      <p className="mt-2 text-[12.5px] text-slate-600">{club.description}</p>
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={isMember ? handleLeave : handleJoin}
          className={`rounded-xl px-3 py-1.5 text-[12px] font-bold ${
            isMember ? 'bg-slate-100 text-slate-700' : 'bg-teal-600 text-white'
          }`}
        >
          {isMember ? 'Leave' : 'Join'}
        </button>
        {isMember && (
          <button
            onClick={() => onOpenChat && onOpenChat(club._id)}
            aria-label={`Open ${club.name} chat`}
            className="rounded-xl bg-slate-100 px-3 py-1.5 text-[12px] font-bold text-slate-700"
          >
            <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
        {isCreator && (
          <button
            type="button"
            onClick={() => onEdit && onEdit(club)}
            aria-label={`Edit ${club.name}`}
            title="Edit club"
            className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-bold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            Edit
          </button>
        )}
      </div>
    </div>
  );
};

export default ClubDetail;