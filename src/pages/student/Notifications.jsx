import React from 'react';
import { Bell, BookOpen, ClipboardList, Calendar, GraduationCap, AlertCircle, RefreshCw, Sparkles } from 'lucide-react';

const TYPE_META = {
  lms: { icon: BookOpen, color: 'bg-blue-50 text-blue-700', label: 'Learning' },
  assessment: { icon: ClipboardList, color: 'bg-amber-50 text-amber-700', label: 'Assessment' },
  plan: { icon: Calendar, color: 'bg-emerald-50 text-emerald-700', label: 'Study Plan' },
  course: { icon: BookOpen, color: 'bg-blue-50 text-blue-700', label: 'Course' },
  grades: { icon: GraduationCap, color: 'bg-purple-50 text-purple-700', label: 'Grades' },
  fees: { icon: AlertCircle, color: 'bg-rose-50 text-rose-700', label: 'Fees' },
  attendance: { icon: AlertCircle, color: 'bg-amber-50 text-amber-700', label: 'Attendance' },
  general: { icon: Bell, color: 'bg-slate-50 text-slate-700', label: 'General' },
};

const NOTIFICATIONS = [
  { id: 1, title: 'New course published', body: 'Mathematics — Geometry module added by Mr. Boateng.', time: '10m ago', read: false, type: 'course' },
  { id: 2, title: 'New assessment assigned', body: 'Algebra Quiz is due Nov 5. Open in LMS to attempt.', time: '1h ago', read: false, type: 'assessment' },
  { id: 3, title: 'New study plan', body: 'Weekly Math Revision plan is now available.', time: '2h ago', read: false, type: 'plan' },
  { id: 4, title: 'Fee reminder', body: 'Your outstanding balance is GH₵ 600.00. Please pay before the deadline.', time: '1h ago', read: false, type: 'fees' },
  { id: 5, title: 'New grade published', body: 'Your Term 1 grades are now available.', time: '3h ago', read: false, type: 'grades' },
  { id: 6, title: 'Attendance alert', body: 'You were marked absent on 2026-10-20.', time: '1d ago', read: true, type: 'attendance' },
  { id: 7, title: 'School announcement', body: 'PTA meeting this Saturday at 10am.', time: '2d ago', read: true, type: 'general' },
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
        {items.map((n) => {
          const meta = TYPE_META[n.type] || TYPE_META.general;
          const Icon = meta.icon;
          return (
            <div
              key={n.id}
              onClick={() => markRead(n.id)}
              className={`rounded-2xl border p-5 shadow-sm cursor-pointer transition ${n.read ? 'border-slate-200 bg-white' : 'border-amber-200 bg-amber-50'}`}
            >
              <div className="flex items-start gap-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${meta.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[13px] font-extrabold text-ink">{n.title}</p>
                      <p className="text-[10.5px] font-extrabold text-slate-400 mt-0.5">{meta.label} · {n.time}</p>
                    </div>
                    {!n.read && <span className="h-2 w-2 rounded-full bg-amber-500 mt-1.5" />}
                  </div>
                  <p className="mt-2 text-[12.5px] text-slate-600">{n.body}</p>
                  {!n.read && n.type !== 'general' && (
                    <span className="mt-2 inline-flex items-center gap-1 text-[10.5px] font-extrabold text-rose-600">
                      <Sparkles className="h-3 w-3" /> New
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Notifications;