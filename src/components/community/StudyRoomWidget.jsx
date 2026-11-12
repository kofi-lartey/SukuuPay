import React from 'react';
import { Video, Users, Calendar, Clock } from 'lucide-react';

const StudyRoomWidget = ({ room, onJoin, onLeave }) => {
  const isJoined = room?.isJoined;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
          <Video className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[14px] font-extrabold text-ink">Study Room</p>
          <p className="text-[11px] text-slate-400">
            {room?.participants || 0} participants
          </p>
        </div>
      </div>

      {isJoined ? (
        <div className="mt-3">
          <div className="rounded-xl bg-teal-50 p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[12px] font-bold text-teal-700">Live</span>
            </div>
            <button
              onClick={onLeave}
              className="rounded-xl bg-slate-100 px-3 py-1.5 text-[12px] font-bold text-slate-700"
            >
              Leave
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-[12px] text-slate-600">Join the study room to collaborate with your peers.</p>
          <button
            onClick={onJoin}
            className="mt-2 rounded-xl bg-teal-600 px-3 py-1.5 text-[12px] font-bold text-white"
          >
            Join Room
          </button>
        </div>
      )}
    </div>
  );
};

export default StudyRoomWidget;