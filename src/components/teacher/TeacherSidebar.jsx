import { NavLink, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarCheck,
  ClipboardList,
  Users,
  FileText,
  Bell,
  User,
  BookOpen,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { TEACHER_ROUTES } from '../../utils/constants';

const NAV = [
  { key: 'dashboard', label: 'Dashboard', to: TEACHER_ROUTES.dashboard, icon: LayoutDashboard },
  { key: 'classes', label: 'My Classes', to: TEACHER_ROUTES.classes, icon: Users },
  { key: 'attendance', label: 'Attendance', to: TEACHER_ROUTES.attendance, icon: CalendarCheck },
  { key: 'grades', label: 'Grades', to: TEACHER_ROUTES.grades, icon: ClipboardList },
  { key: 'records', label: 'Reports', to: TEACHER_ROUTES.records, icon: FileText },
  { key: 'schedule', label: 'Schedule', to: TEACHER_ROUTES.schedule, icon: BookOpen },
  { key: 'notifications', label: 'Notifications', to: TEACHER_ROUTES.notifications, icon: Bell },
  { key: 'profile', label: 'Profile', to: TEACHER_ROUTES.profile, icon: User },
];

/**
 * The rail — the desktop face of `TeacherBottomNav`.
 *
 * `hidden lg:flex` rather than conditionally rendered, so a resize moves the
 * teacher between rail and bar without tearing the nav down and without a
 * frame where neither knows which page it is on. The active state comes from
 * the router either way, so exactly one of the two navigations is ever lit.
 *
 * The accent is `sky`, not the platform's green. Green is what SukuuPay looks
 * like to a parent and to an admin; a teacher's whole surface is the records
 * side of the school, and the two must be distinguishable at a glance by
 * someone who works in both.
 */
const TeacherSidebar = () => {
  const { user } = useAuth();

  const initials = (user?.name || 'T')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <aside className="hidden w-full flex-col gap-5 border-r border-slate-200/80 bg-white px-3 py-5 lg:flex lg:sticky lg:top-0 lg:h-dvh">
      <Link to={TEACHER_ROUTES.dashboard} className="flex items-center gap-2.5 px-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0A5C36] text-[15px] font-extrabold text-white">
          S
        </span>
        <span className="text-[15px] font-extrabold tracking-tight text-slate-900">SukuuPay</span>
      </Link>

      <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-slate-50 p-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-100 text-[13px] font-extrabold text-sky-700">
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-extrabold text-slate-900">{user?.name || 'Teacher'}</p>
          <p className="truncate text-[11.5px] text-slate-500">{user?.position || 'Teacher'}</p>
        </div>
      </div>

      <nav aria-label="Teacher sections" className="flex flex-col gap-0.5">
        {NAV.map((item) => (
          <NavLink
            key={item.key}
            to={item.to}
            end={item.key === 'dashboard'}
            className={({ isActive }) =>
              `group relative flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-[13.5px] font-bold transition-colors ${
                isActive ? 'bg-sky-50 text-sky-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {/*
                  The sky-600 accent, and the reason it is a bar rather than a
                  bolder word: the label is set at 13.5px, where `sky-600` on
                  `sky-50` is below the contrast a teacher reading a rail needs.
                  The bar carries the accent at full strength; the text keeps
                  the darker, readable shade. Same trade `ParentSidebar` makes
                  with green.
                */}
                <span
                  aria-hidden="true"
                  className={`absolute left-0 top-1/2 -translate-y-1/2 rounded-r-full bg-sky-600 transition-all ${
                    isActive ? 'h-5 w-1' : 'h-0 w-0'
                  }`}
                />

                <item.icon
                  className="h-[19px] w-[19px] shrink-0"
                  strokeWidth={isActive ? 2.3 : 2}
                  aria-hidden="true"
                />
                <span className="truncate">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};

export default TeacherSidebar;
