import React, { useState } from 'react';
import { Users, Calendar, Trophy, Megaphone, MessageCircle, Heart, Send, Plus } from 'lucide-react';

const TABS = [
  { key: 'feed', label: 'Feed', icon: Megaphone },
  { key: 'clubs', label: 'Clubs', icon: Users },
  { key: 'events', label: 'Events', icon: Calendar },
  { key: 'chat', label: 'Chat', icon: MessageCircle },
];

const POSTS = [
  { id: 1, author: 'Ama Osei', avatar: 'AO', time: '2h ago', body: 'Great job to everyone at the science fair! 🎉', likes: 12, comments: 3 },
  { id: 2, author: 'Kwame Asante', avatar: 'KA', time: '5h ago', body: 'Chess club meeting moved to Friday 3pm.', likes: 5, comments: 1 },
];

const CLUBS = [
  { id: 1, name: 'Debate Club', members: 24, desc: 'Sharpen public speaking and critical thinking.', joined: false, privacy: 'public' },
  { id: 2, name: 'Robotics Club', members: 18, desc: 'Build and program robots for competitions.', joined: true, privacy: 'private' },
  { id: 3, name: 'Drama Society', members: 31, desc: 'Stage plays and theatre arts.', joined: false, privacy: 'public' },
];

const EVENTS = [
  { id: 1, title: 'Inter-House Sports Day', date: '2026-11-14', location: 'School Field', rsvp: false },
  { id: 2, title: 'Science Fair', date: '2026-11-28', location: 'Hall A', rsvp: true },
];

const Community = () => {
  const [tab, setTab] = useState('feed');
  const [posts, setPosts] = useState(POSTS);
  const [clubs, setClubs] = useState(CLUBS);
  const [events, setEvents] = useState(EVENTS);
  const [newPost, setNewPost] = useState('');
  const [messages, setMessages] = useState([
    { id: 1, from: 'System', body: 'Welcome to the community chat!' },
  ]);
  const [selectedClub, setSelectedClub] = useState(null);
  const [clubMessages, setClubMessages] = useState({});
  const [clubMsg, setClubMsg] = useState('');
  const [msg, setMsg] = useState('');

  const sendClubMsg = (clubId) => {
    if (!clubMsg.trim()) return;
    setClubMessages((prev) => ({
      ...prev,
      [clubId]: [...(prev[clubId] || []), { id: Date.now(), from: 'You', body: clubMsg }],
    }));
    setClubMsg('');
  };

  const toggleJoin = (id) => setClubs((c) => c.map((x) => (x.id === id ? { ...x, joined: !x.joined, members: x.joined ? x.members - 1 : x.members + 1 } : x)));
  const toggleRsvp = (id) => setEvents((e) => e.map((x) => (x.id === id ? { ...x, rsvp: !x.rsvp } : x)));
  const likePost = (id) => setPosts((p) => p.map((x) => (x.id === id ? { ...x, likes: x.likes + 1 } : x)));
  const submitPost = () => {
    if (!newPost.trim()) return;
    setPosts([{ id: Date.now(), author: 'You', avatar: 'YO', time: 'now', body: newPost, likes: 0, comments: 0 }, ...posts]);
    setNewPost('');
  };
  const sendMsg = () => {
    if (!msg.trim()) return;
    setMessages([...messages, { id: Date.now(), from: 'You', body: msg }]);
    setMsg('');
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
          <Users className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">Community</h1>
          <p className="text-[13px] font-semibold text-slate-500">School events, clubs and announcements</p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button key={t.key} type="button" onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12.5px] font-bold transition ${active ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
              <Icon className="h-3.5 w-3.5" />{t.label}
            </button>
          );
        })}
      </div>

      {tab === 'feed' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex gap-2">
              <input value={newPost} onChange={(e) => setNewPost(e.target.value)} placeholder="Share something with the community..."
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-[12.5px]" />
              <button onClick={submitPost} className="rounded-xl bg-teal-600 px-3 py-2 text-white"><Plus className="h-4 w-4" /></button>
            </div>
          </div>
          {posts.map((p) => (
            <div key={p.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-100 text-teal-700 text-[11px] font-extrabold">{p.avatar}</div>
                <div>
                  <p className="text-[13px] font-extrabold text-ink">{p.author}</p>
                  <p className="text-[10.5px] text-slate-400">{p.time}</p>
                </div>
              </div>
              <p className="mt-3 text-[12.5px] text-slate-600">{p.body}</p>
              <div className="mt-3 flex gap-4 text-[11.5px] text-slate-500">
                <button onClick={() => likePost(p.id)} className="inline-flex items-center gap-1 hover:text-rose-600"><Heart className="h-3.5 w-3.5" />{p.likes}</button>
                <span className="inline-flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" />{p.comments}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'clubs' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {clubs.map((c) => (
              <div key={c.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[14px] font-extrabold text-ink">{c.name}</p>
                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${c.privacy === 'private' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                    {c.privacy}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-slate-400">{c.members} members</p>
                <p className="mt-2 text-[12.5px] text-slate-600">{c.desc}</p>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => toggleJoin(c.id)}
                    className={`rounded-xl px-3 py-1.5 text-[12px] font-bold ${c.joined ? 'bg-slate-100 text-slate-700' : 'bg-teal-600 text-white'}`}>
                    {c.joined ? 'Leave' : 'Join'}
                  </button>
                  {c.joined && (
                    <button onClick={() => setSelectedClub(selectedClub === c.id ? null : c.id)}
                      className="rounded-xl bg-slate-100 px-3 py-1.5 text-[12px] font-bold text-slate-700">
                      {selectedClub === c.id ? 'Hide chat' : 'Open chat'}
                    </button>
                  )}
                </div>
                {selectedClub === c.id && c.joined && (
                  <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 flex flex-col h-48">
                    <div className="flex-1 overflow-y-auto p-3 space-y-1">
                      {(clubMessages[c.id] || []).map((m) => (
                        <div key={m.id} className="text-[12px]">
                          <span className="font-extrabold text-teal-700">{m.from}: </span>
                          <span className="text-slate-600">{m.body}</span>
                        </div>
                      ))}
                      {!(clubMessages[c.id] || []).length && (
                        <p className="text-[11px] text-slate-400 text-center py-4">No messages yet</p>
                      )}
                    </div>
                    <div className="border-t border-slate-200 p-2 flex gap-2">
                      <input value={clubMsg} onChange={(e) => setClubMsg(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && sendClubMsg(c.id)}
                        placeholder="Message club..."
                        className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-[12px]" />
                      <button onClick={() => sendClubMsg(c.id)} className="rounded-lg bg-teal-600 px-2 py-1.5 text-white">
                        <Send className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'events' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {events.map((e) => (
            <div key={e.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <p className="text-[14px] font-extrabold text-ink">{e.title}</p>
                <span className="text-[10px] font-extrabold text-teal-700 bg-teal-100 px-2 py-0.5 rounded-md">
                  {new Date(e.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-slate-400">{e.location}</p>
              <button onClick={() => toggleRsvp(e.id)}
                className={`mt-3 rounded-xl px-3 py-1.5 text-[12px] font-bold ${e.rsvp ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
                {e.rsvp ? 'Going' : 'RSVP'}
              </button>
            </div>
          ))}
        </div>
      )}

      {tab === 'chat' && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col h-96">
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {messages.map((m) => (
              <div key={m.id} className="text-[12.5px]">
                <span className="font-extrabold text-teal-700">{m.from}: </span>
                <span className="text-slate-600">{m.body}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-slate-100 p-3 flex gap-2">
            <input value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Type a message..."
              onKeyDown={(e) => e.key === 'Enter' && sendMsg()}
              className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-[12.5px]" />
            <button onClick={sendMsg} className="rounded-xl bg-teal-600 px-3 py-2 text-white"><Send className="h-4 w-4" /></button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Community;
