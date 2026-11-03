import React, { useCallback } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import {
  Bell,
  BookOpen,
  Calendar,
  CalendarCheck,
  CreditCard,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Settings,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { LogoMark } from '../common/Logo';
import { STUDENT_ROUTES } from '../../utils/constants';

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', to: STUDENT_ROUTES.dashboard, icon: LayoutDashboard, end: true, description: 'Your overview and quick actions.' },
  { key: 'grades', label: 'Grades', to: STUDENT_ROUTES.grades, icon: GraduationCap, description: 'Your subject scores and term results.' },
  { key: 'attendance', label: 'Attendance', to: STUDENT_ROUTES.attendance, icon: CalendarCheck, description: 'Your attendance record.' },
  { key: 'timetable', label: 'Timetable', to: STUDENT_ROUTES.timetable, icon: Calendar, description: 'Your class timetable.' },
  { key: 'fees', label: 'Fees', to: STUDENT_ROUTES.fees, icon: CreditCard, description: 'Fee balance and payment history.' },
  { key: 'messages', label: 'Messages', to: STUDENT_ROUTES.messages, icon: MessageSquare, description: 'Messages from your school.' },
  { key: 'community', label: 'Community', to: STUDENT_ROUTES.community, icon: Users, description: 'School-wide community.' },
  { key: 'lms', label: 'LMS', to: STUDENT_ROUTES.lms, icon: BookOpen, description: 'Courses and learning materials.', badge: 3 },
  { key: 'notifications', label: 'Notifications', to: STUDENT_ROUTES.notifications, icon: Bell, description: 'Your notifications.', badge: 4 },
];

const initialsOf = (name) =>
  String(name || 'Student')
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'S';

const isActive = (pathname, to, exact = false) => {
  if (exact) return pathname === to;
  return pathname === to || pathname.startsWith(`${to}/`);
};

const StudentSidebar = ({ user, variant = 'fixed', className = '', onClose }) => {
  const { logout } = useAuth();
  const { pathname } = useLocation();
  const isDrawer = variant === 'drawer';

  const signOut = useCallback(async () => {
    await logout();
  }, [logout]);

  const navRow = (item) => {
    const active = isActive(pathname, item.to, item.end);
    const Icon = item.icon;
    return (
      <li key={item.key}>
        <NavLink
          to={item.to}
          end={item.end}
          aria-current={active ? 'page' : undefined}
          title={item.description}
          onClick={isDrawer ? onClose : undefined}
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40 ${
            active ? 'bg-brand-700 text-white shadow-lift' : 'text-slate-600 hover:bg-slate-50 hover:text-ink'
          }`}
        >
          <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
          <span className="truncate">{item.label}</span>
          {item.badge ? (
            <span className="ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-extrabold text-white">
              {item.badge}
            </span>
          ) : null}
        </NavLink>
      </li>
    );
  };

  const asideClass = isDrawer
    ? `flex flex-col w-72 max-w-[85vw] h-full border-r border-slate-200 bg-white shadow-2xl ${className}`
    : `hidden lg:flex lg:flex-col lg:sticky lg:top-0 lg:h-dvh border-r border-slate-200 bg-white ${className}`;

  return (
    <aside className={asideClass} aria-label="Student portal navigation">
      <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4">
        <Link
          to={STUDENT_ROUTES.dashboard}
          onClick={isDrawer ? onClose : undefined}
          className="flex shrink-0 items-center gap-2.5 pr-1"
          aria-label="SukuuPay student portal"
        >
          <LogoMark className="h-10 w-10" />
          <span className="hidden text-lg font-extrabold tracking-tight text-ink sm:block">
            Sukuu<span className="text-brand-700">Pay</span>
          </span>
        </Link>
        {isDrawer && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-ink"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
      </div>
      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        <ul className="flex flex-col gap-1">{NAV_ITEMS.map(navRow)}</ul>
      </nav>
      <div className="shrink-0 border-t border-slate-100 p-3">
        <Link
          to={STUDENT_ROUTES.settings}
          onClick={isDrawer ? onClose : undefined}
          className="flex items-center gap-2.5 rounded-xl bg-brand-700 p-3 text-white transition-colors hover:bg-brand-800"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-[12px] font-extrabold">
            {initialsOf(user?.name)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-extrabold leading-tight">{user?.name || 'Student'}</span>
            <span className="block truncate text-[11px] font-semibold leading-tight text-white/70">{user?.className || 'Student'}</span>
          </span>
          <Settings className="h-4 w-4 shrink-0 text-white/70" aria-hidden="true" />
        </Link>
        <button
          type="button"
          onClick={signOut}
          className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50 hover:text-ink"
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
          Sign out
        </button>
        <Link to="/" className="mt-1.5 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-extrabold text-slate-500 transition-colors hover:bg-slate-50 hover:text-brand-700">
          Back to website
        </Link>
      </div>
    </aside>
  );
};

export default StudentSidebar;
