import React, { useCallback } from 'react';
import { Link, NavLink } from 'react-router-dom';
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
import AvatarUpload from '../common/AvatarUpload';
import { LogoMark } from '../common/Logo';
import { TEACHER_ROUTES } from '../../utils/constants';

/**
 * The teacher portal's rail — the desktop face of `TeacherBottomNav`.
 *
 * ## What the redesign is for
 *
 * The old rail was a single flat list of eight destinations with a letter "S"
 * in a tile where the brand mark should be. Two things were wrong with that,
 * and both are about the person using it, not about the aesthetics:
 *
 * 1. **There was no identity.** A teacher on a shared handset, or one who also
 *    holds a school-admin account, had nothing on screen to say *who* was
 *    signed in — and no way to change the picture, which is the only avowedly
 *    personal thing in the portal. The identity card at the top is now the
 *    first thing in the rail, and its camera badge uploads straight away.
 *
 * 2. **Everything was the same shape.** "Dashboard" and "Terminal Reports"
 *    rendered as neighbours of equal weight, so the rail carried no information
 *    about what a thing *is* — only where it goes. The nav is now grouped into
 *    Teaching and Planning, and the account's own settings sit in their own
 *    section at the bottom, which is where the school console puts them and
 *    where people look for them.
 *
 * ## The settings menu
 *
 * Profile and Sign out, pinned to the floor with `mt-auto`. Profile is the
 * teacher's own settings screen: their picture, their details, their way out.
 * A teacher cannot change anybody else's role, so there is nothing else to put
 * in a settings menu for this role, and inventing entries would be decoration.
 *
 * ## The rail is white, on purpose
 *
 * `TeacherLayout` paints the shell `bg-[#F7F9F8]` and the active pill is
 * `bg-sky-50` — a barely-there tint with barely-there text, which is wrong for
 * the one element that has to be findable while a teacher is looking at their
 * phone in a noisy corridor. An opaque white rail with a solid sky pill is a
 * stronger "you are here" at the same glance, and the shell's background shows
 * through only in the main column.
 *
 * `variant` keeps the rail and a mobile drawer the same component: `fixed` is
 * a sticky column with its own scroll, `drawer` is the same content in an
 * overlay with a close button.
 */
const NAV_GROUPS = [
  {
    label: 'Teaching',
    items: [
      { key: 'dashboard', label: 'Dashboard', to: TEACHER_ROUTES.dashboard, icon: LayoutDashboard, end: true },
      { key: 'classes', label: 'My Classes', to: TEACHER_ROUTES.classes, icon: Users },
      { key: 'attendance', label: 'Attendance', to: TEACHER_ROUTES.attendance, icon: CalendarCheck },
      { key: 'grades', label: 'Grades', to: TEACHER_ROUTES.grades, icon: ClipboardList },
    ],
  },
  {
    label: 'Planning',
    items: [
      { key: 'schedule', label: 'Schedule', to: TEACHER_ROUTES.schedule, icon: CalendarRange },
      { key: 'records', label: 'Terminal Reports', to: TEACHER_ROUTES.records, icon: ClipboardList },
      { key: 'notifications', label: 'Notifications', to: TEACHER_ROUTES.notifications, icon: Bell },
    ],
  },
];

const TeacherSidebar = ({ variant = 'fixed', className = '', onClose }) => {
  const { user, logout } = useAuth();
  const isDrawer = variant === 'drawer';

  const roleLine = user?.position || 'Teacher';

  const signOut = useCallback(async () => {
    await logout();
  }, [logout]);

  const row = (item) => (
    <li key={item.key}>
      <NavLink
        to={item.to}
        end={item.end}
        onClick={isDrawer ? onClose : undefined}
        className={({ isActive }) =>
          `group relative flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-[13.5px] font-bold transition-colors ${
            isActive
              ? 'bg-sky-600 text-white shadow-lift'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`
        }
      >
        {({ isActive }) => (
          <>
            {/* The active pill carries the weight rather than a tinted chip with
                tinted text: at a glance in a corridor, on a phone, the shape and
                the fill are what survive. */}
            <item.icon className="h-[19px] w-[19px] shrink-0" strokeWidth={isActive ? 2.3 : 2} aria-hidden="true" />
            <span className="truncate">{item.label}</span>
          </>
        )}
      </NavLink>
    </li>
  );

  return (
    <aside
      className={`flex-col bg-white ${
        isDrawer ? 'border-r shadow-2xl' : 'sticky top-0 h-screen border-r border-slate-200'
      } ${className}`}
      aria-label="Teacher portal navigation"
    >
      {/* ── Brand ── */}
      <div className="flex h-16 shrink-0 items-center justify-between gap-3 px-4">
        <Link
          to={TEACHER_ROUTES.dashboard}
          onClick={isDrawer ? onClose : undefined}
          className="flex shrink-0 items-center gap-2.5"
          aria-label="Teacher portal home"
        >
          {/*
            The real mark, not the letter. The placeholder tile this replaces was
            a "S" in a coloured square, which read as an unfinished app — and
            worse, told a teacher nothing about *which* surface they were on. The
            same file the marketing site and the email templates use is the one
            that belongs here: one logo, wherever the product is.
          */}
          <LogoMark className="h-9 w-9" />
          <span className="min-w-0">
            <span className="block text-[15px] font-extrabold leading-none tracking-tight text-ink">
              Sukuu<span className="text-sky-700">Pay</span>
            </span>
            <span className="mt-1 block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Teacher portal
            </span>
          </span>
        </Link>

        {isDrawer && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {/*
          The identity card, and it is not decoration. A teacher who also holds a
          school-admin account, or one sharing a handset in a staff room, has
          nothing else on screen that says who is signed in — and the camera badge
          on the avatar is the only place in the portal where they can put a face
          to the account.
        */}
        <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50/80 p-2.5">
          <AvatarUpload size="sm" showActions={false} showRemove={false} />
          <Link
            to={TEACHER_ROUTES.profile}
            onClick={isDrawer ? onClose : undefined}
            className="min-w-0 flex-1"
            aria-label="Your profile and settings"
          >
            <span className="block truncate text-[13px] font-extrabold leading-tight text-ink">
              {user?.name || 'Teacher'}
            </span>
            <span className="mt-0.5 block truncate text-[11px] font-semibold leading-tight text-slate-500">
              {roleLine}
            </span>
          </Link>
        </div>

        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-4">
            <p className="mb-1.5 px-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              {group.label}
            </p>
            <ul className="flex flex-col gap-1">{group.items.map(row)}</ul>
          </div>
        ))}
      </nav>

      {/* ── Settings ── */}
      <div className="shrink-0 border-t border-slate-200 p-3">
        <p className="mb-1.5 px-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
          Settings
        </p>
        <ul className="flex flex-col gap-1">
          <li>
            <NavLink
              to={TEACHER_ROUTES.profile}
              onClick={isDrawer ? onClose : undefined}
              className={({ isActive }) =>
                `flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-[13.5px] font-bold transition-colors ${
                  isActive
                    ? 'bg-sky-600 text-white shadow-lift'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              <UserCog className="h-[19px] w-[19px] shrink-0" aria-hidden="true" />
              Profile
            </NavLink>
          </li>
        </ul>

        {/*
          Sign out, and it is a button rather than a link.

          It used to live only on the Profile screen, two hops away, which meant
          a teacher on a shared handset had to navigate to sign out. On a
          device where the next person to pick it up would otherwise see
          somebody else's marks and roster, that is a real problem rather than an
          inconvenience.
        */}
        <button
          type="button"
          onClick={signOut}
          className="mt-1 flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 text-[13.5px] font-bold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
        >
          <LogOut className="h-[19px] w-[19px] shrink-0" aria-hidden="true" />
          Sign out
        </button>
      </div>
    </aside>
  );
};

export default TeacherSidebar;
