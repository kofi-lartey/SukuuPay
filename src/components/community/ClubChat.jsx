import React, { useState, useEffect } from 'react';
import { Send, Users, MessageCircle, Video } from 'lucide-react';
import { useClubChat } from '../../hooks/useCommunity';

const ClubChat = ({ clubId }) => {
  const { messages, loading, sendMessage } = useClubChat(clubId);
  const [newMsg, setNewMsg] = useState('');

  const handleSend = () => {
    if (!newMsg.trim()) return;
    sendMessage(newMsg);
    setNewMsg('');
  };

  return (
    <div className="flex flex-col h-96 rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-teal-600" />
          <span className="text-[13px] font-extrabold text-ink">Club Chat</span>
        </div>
        <div className="flex items-center gap-1">
          <button className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
            <Users className="h-4 w-4" />
          </button>
          <button className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
            <Video className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {loading && <p className="text-[12px] text-slate-400 text-center">Loading...</p>}
        {!loading && messages.length === 0 && (
          <p className="text-[12px] text-slate-400 text-center py-4">No messages yet</p>
        )}
        {messages.map((m) => (
          <div key={m._id} className="text-[12px]">
            <span className="font-extrabold text-teal-700">{m.authorName || 'Unknown'}: </span>
            <span className="text-slate-600">{m.body}</span>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-100 p-3 flex gap-2">
        <input
          value={newMsg}
          onChange={(e) => setNewMsg(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Message club..."
          className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-[12px]"
        />
        <button onClick={handleSend} className="rounded-xl bg-teal-600 px-3 py-2 text-white">
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default ClubChat;