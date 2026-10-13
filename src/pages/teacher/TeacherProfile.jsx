import { Link } from 'react-router-dom';
import { Bell, BookOpen, CalendarCheck, ChevronRight, LogOut, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { TEACHER_ROUTES } from '../../utils/constants';

const ROWS = [
  { key: 'classes', label: 'My Classes', to: TEACHER_ROUTES.classes, icon: Users },
  { key: 'schedule', label: 'My Schedule', to: TEACHER_ROUTES.schedule, icon: BookOpen },
  { key: 'attendance', label: 'Attendance', to: TEACHER_ROUTES.attendance, icon: CalendarCheck },
  { key: 'notifications', label: 'Notifications', to: TEACHER_ROUTES.notifications, icon: Bell },
];

/**
 * "More", as a page.
 *
 * Because the bottom bar is five items and the teacher's surface is eight, the
 * three that did not fit — schedule, reports, notifications — land here rather
 * than being unreachable. It is also the only screen that names who is signed
 * in on mobile, which matters on a handset shared between the staff room.
 *
 * Sign out is a button rather than a link: it ends the session server-side
 * before the tokens are dropped, so a teacher signing out on a shared handset
 * does not leave a valid JWT in `localStorage` for the next person.
 */
const TeacherProfile = () => {
  const { user, logout } = useAuth();
  const initials = (user?.name || 'T')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-sky-100 text-[18px] font-extrabold text-sky-700">
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] font-extrabold text-ink">{user?.name || 'Teacher'}</p>
            <p className="truncate text-[12.5px] text-slate-500">{user?.position || 'Teacher'}</p>
            <p className="mt-0.5 truncate text-[11.5px] text-slate-400">{user?.email}</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-1">
        {ROWS.map((row) => (
          <Link
            key={row.key}
            to={row.to}
            className="flex min-h-[52px] items-center gap-3 rounded-xl px-3 transition-colors hover:bg-slate-50"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
              <row.icon className="h-[17px] w-[17px]" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1 truncate text-[14px] font-bold text-slate-800">
              {row.label}
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
          </Link>
        ))}
      </div>

      <button
        type="button"
        onClick={logout}
        className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 text-[13.5px] font-extrabold text-red-700 transition-colors hover:bg-red-100"
      >
        <LogOut className="h-4 w-4" aria-hidden="true" />
        Sign out
      </button>

      <p className="pt-2 text-center text-[11px] font-semibold text-slate-400">
        SukuuPay · Teacher Portal v1.0
      </p>
    </div>
  );
};

export default TeacherProfile;
