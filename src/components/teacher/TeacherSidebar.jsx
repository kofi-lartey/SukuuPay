import React, { useCallback } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import {
  Bell,
  CalendarCheck,
  CalendarRange,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { LogoMark } from '../common/Logo';
import { TEACHER_ROUTES } from '../../utils/constants';

/**
 * The teacher portal's rail — the desktop face of `TeacherBottomNav`.
 *
 * The chrome (brand row, nav row, active pill, bottom card) is byte-identical
 * to the school console's `DashboardSidebar`, so a teacher who also holds a
 * school-admin account does not cross between two products.
 *
 * ## The avatar moved out
 *
 * The identity card used to carry an `AvatarUpload` with a camera badge.
 * A photo-upload affordance on a persistent navigation surface is a trap:
 * the click is easy to trigger by accident, and the result is invisible
 * until the teacher opens the Profile screen anyway. The card is now text
 * only. The avatar — with upload and crop — lives in the top bar, where a
 * teacher sees the result of the upload immediately.
 */

const NAV_ITEMS = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    to: TEACHER_ROUTES.dashboard,
    icon: LayoutDashboard,
    end: true,
    description: 'Your classes, today’s register and what needs a mark.',
  },
  {
    key: 'classes',
    label: 'My Classes',
    to: TEACHER_ROUTES.classes,
    icon: Users,
    description: 'The classes you teach, and who is in them.',
  },
  {
    key: 'attendance',
    label: 'Attendance',
    to: TEACHER_ROUTES.attendance,
    icon: CalendarCheck,
    description: 'Take and review the register.',
  },
  {
    key: 'grades',
    label: 'Grades',
    to: TEACHER_ROUTES.grades,
    icon: ClipboardList,
    description: 'Enter marks and submit them for approval.',
  },
  {
    key: 'schedule',
    label: 'Schedule',
    to: TEACHER_ROUTES.schedule,
    icon: CalendarRange,
    description: 'Your teaching timetable.',
  },
  {
    key: 'records',
    label: 'Terminal Reports',
    to: TEACHER_ROUTES.records,
    icon: ClipboardList,
    description: 'Compile and review report cards.',
  },
  {
    key: 'notifications',
    label: 'Notifications',
    to: TEACHER_ROUTES.notifications,
    icon: Bell,
    description: 'Your notifications.',
  },
];

/** First letter of each word, max two, uppercase. Falls back to "T". */
const initialsOf = (name) =>
  String(name || 'Teacher')
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'T';

const TeacherSidebar = ({
  user,
  variant = 'fixed',
  className = '',
  onClose,
}) => {
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
            active
              ? 'bg-brand-700 text-white shadow-lift'
              : 'text-slate-600 hover:bg-slate-50 hover:text-ink'
          }`}
        >
          <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
          <span className="truncate">{item.label}</span>
        </NavLink>
      </li>
    );
  };

  // The fixed rail on desktop, the drawer panel on mobile. `lg:h-dvh`, not
  // `h-screen`, so iOS Safari's URL bar does not push the last row below
  // the visual viewport.
  const asideClass = isDrawer
    ? `flex flex-col w-72 max-w-[85vw] h-full border-r border-slate-200 bg-white shadow-2xl ${className}`
    : `hidden lg:flex lg:flex-col lg:sticky lg:top-0 lg:h-dvh border-r border-slate-200 bg-white ${className}`;

  return (
    <aside className={asideClass} aria-label="Teacher portal navigation">
      {/* ── Brand ── */}
      <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4">
        <Link
          to={TEACHER_ROUTES.dashboard}
          onClick={isDrawer ? onClose : undefined}
          className="flex shrink-0 items-center gap-2.5 pr-1"
          aria-label="SukuuPay teacher portal"
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

      {/* ── Nav ── */}
      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        <ul className="flex flex-col gap-1">{NAV_ITEMS.map(navRow)}</ul>
      </nav>

      {/* ── Bottom block ── */}
      <div className="shrink-0 border-t border-slate-100 p-3">
        {/* Identity card — no photo upload. Initials, name, position, cog. */}
        <Link
          to={TEACHER_ROUTES.profile}
          onClick={isDrawer ? onClose : undefined}
          className="flex items-center gap-2.5 rounded-xl bg-brand-700 p-3 text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-[12px] font-extrabold text-white ring-1 ring-inset ring-white/20"
          >
            {initialsOf(user?.name)}
          </span>

          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-extrabold leading-tight">
              {user?.name || 'Teacher'}
            </span>
            <span className="block truncate text-[11px] font-semibold leading-tight text-white/70">
              {user?.position || 'Teacher'}
            </span>
          </span>

          <UserCog className="h-4 w-4 shrink-0 text-white/70" aria-hidden="true" />
        </Link>

        {/* Profile & settings — same rail shape as the seven above. */}
        <ul className="mt-2 flex flex-col gap-1">
          <li>
            <NavLink
              to={TEACHER_ROUTES.profile}
              onClick={isDrawer ? onClose : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40 ${
                  isActive
                    ? 'bg-brand-700 text-white shadow-lift'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-ink'
                }`
              }
            >
              <UserCog className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
              Profile &amp; settings
            </NavLink>
          </li>
        </ul>

        {/* Sign out — a button, not a link. */}
        <button
          type="button"
          onClick={signOut}
          className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
          Sign out
        </button>

        {/* Back to the public site — the guaranteed exit from the shell. */}
        <Link
          to="/"
          className="mt-1.5 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-extrabold text-slate-500 transition-colors hover:bg-slate-50 hover:text-brand-700"
        >
          Back to website
        </Link>
      </div>
    </aside>
  );
};

/**
 * Route matching.
 *
 * `exact` means "this path only" (used for Dashboard, whose prefix would
 * otherwise swallow everything under /teacher). Every other entry matches
 * the path or any sub-path.
 */
const isActive = (pathname, to, exact = false) => {
  if (exact) return pathname === to;
  return pathname === to || pathname.startsWith(`${to}/`);
};

export default TeacherSidebar;