import React, { useState } from 'react';
import { Users, Plus, Settings, MessageCircle } from 'lucide-react';

const ClubDetail = ({ club, onJoin, onLeave, onOpenChat, isOpen }) => {
  const [showCreate, setShowCreate] = useState(false);

  const handleJoin = async () => {
    if (onJoin) await onJoin(club._id);
  };

  const handleLeave = async () => {
    if (onLeave) await onLeave(club._id);
  };

  const isMember = club.memberIds?.includes('me');

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
        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${club.privacy === 'private' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
          {club.privacy}
        </span>
      </div>
      <p className="mt-2 text-[12.5px] text-slate-600">{club.description}</p>
      <div className="mt-3 flex gap-2">
        <button
          onClick={isMember ? handleLeave : handleJoin}
          className={`rounded-xl px-3 py-1.5 text-[12px] font-bold ${isMember ? 'bg-slate-100 text-slate-700' : 'bg-teal-600 text-white'}`}
        >
          {isMember ? 'Leave' : 'Join'}
        </button>
        {isMember && (
          <button
            onClick={() => onOpenChat && onOpenChat(club._id)}
            className="rounded-xl bg-slate-100 px-3 py-1.5 text-[12px] font-bold text-slate-700"
          >
            <MessageCircle className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};

export default ClubDetail;