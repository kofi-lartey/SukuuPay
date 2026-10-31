import React from 'react';
import { Bell, Loader2, AlertCircle, RefreshCw } from 'lucide-react';

const NOTIFICATIONS = [
  { id: 1, title: 'Fee reminder', body: 'Your outstanding balance is GH₵ 600.00. Please pay before the deadline.', time: '1h ago', read: false, type: 'fees' },
  { id: 2, title: 'New grade published', body: 'Your Term 1 grades are now available.', time: '3h ago', read: false, type: 'grades' },
  { id: 3, title: 'Attendance alert', body: 'You were marked absent on 2026-10-20.', time: '1d ago', read: true, type: 'attendance' },
  { id: 4, title: 'School announcement', body: 'PTA meeting this Saturday at 10am.', time: '2d ago', read: true, type: 'general' },
];

const Notifications = () => {
  const [items, setItems] = React.useState(NOTIFICATIONS);
  const unread = items.filter((n) => !n.read).length;

  const markAllRead = () => setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  const markRead = (id) => setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-ink">Notifications</h1>
            <p className="text-[13px] font-semibold text-slate-500">{unread} unread</p>
          </div>
        </div>
        {unread > 0 && (
          <button onClick={markAllRead} className="rounded-xl bg-slate-100 px-3 py-2 text-[12px] font-bold text-slate-700 hover:bg-slate-200">
            Mark all read
          </button>
        )}
      </div>

      <div className="space-y-3">
        {items.map((n) => (
          <div
            key={n.id}
            onClick={() => markRead(n.id)}
            className={`rounded-2xl border p-5 shadow-sm cursor-pointer transition ${n.read ? 'border-slate-200 bg-white' : 'border-amber-200 bg-amber-50'}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[13px] font-extrabold text-ink">{n.title}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{n.time}</p>
              </div>
              {!n.read && <span className="h-2 w-2 rounded-full bg-amber-500 mt-1.5" />}
            </div>
            <p className="mt-2 text-[12.5px] text-slate-600">{n.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Notifications;
