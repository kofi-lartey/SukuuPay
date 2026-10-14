import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, Globe, LogOut, Menu, Search, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ROUTES, TEACHER_ROUTES } from '../../utils/constants';
import NotificationBell from '../common/NotificationBell';
import Popover from '../dashboard/ui/Popover';
import Badge from '../dashboard/ui/Badge';

/**
 * The teacher portal header — the same chrome as the school console and the
 * platform console.
 *
 * ## Avatar, not initials
 *
 * The teacher's picture (or initials when none is set) sits where the school
 * admin's avatar sits, in a `Popover` with the account menu behind it.
 * Uploading the picture happens on the Profile page; the top bar only
 * renders it. There is no camera affordance here, so a misclick opens the
 * menu rather than a file picker.
 *
 * ## What is deliberately different from the admin console
 *
 *   - The module title is derived from the path, not passed as a prop. The
 *     previous version's per-page prop meant every teacher page had to
 *     remember it and the bar silently read "Dashboard" on the pages that
 *     forgot.
 *   - No "All schools" badge — a teacher belongs to one school, and the
 *     badge exists on the console to state a scope the teacher does not have.
 *   - No `actions` slot at the top level; the pages that need a header
 *     action render it themselves under the bar.
 *
 * ## Search stays disabled
 *
 * Same reason the console gives: there is no teacher-wide search index. A
 * disabled control with a title stating why is better than a field that
 * only appears to work.
 */

const TITLE_BY_ROUTE = (pathname) => {
  const exact = [
    [TEACHER_ROUTES.dashboard, 'Dashboard'],
    [TEACHER_ROUTES.classes, 'My Classes'],
    [TEACHER_ROUTES.attendance, 'Attendance'],
    [TEACHER_ROUTES.grades, 'Grades'],
    [TEACHER_ROUTES.schedule, 'Schedule'],
    [TEACHER_ROUTES.records, 'Terminal Reports'],
    [TEACHER_ROUTES.notifications, 'Notifications'],
    [TEACHER_ROUTES.profile, 'Profile & settings'],
  ];
  for (const [route, label] of exact) {
    if (pathname === route) return label;
  }

  if (pathname.startsWith(`${TEACHER_ROUTES.classes}/`)) return 'Class detail';
  if (pathname.startsWith(`${TEACHER_ROUTES.attendance}/`)) return 'Attendance';
  if (pathname.startsWith(`${TEACHER_ROUTES.grades}/`)) return 'Grades';
  if (pathname.startsWith(`${TEACHER_ROUTES.records}/`)) return 'Terminal Reports';

  return 'Teacher portal';
};

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

const MenuItem = ({ to, icon: Icon, children, onClick, tone = 'default' }) => {
  const tones = {
    default:
      'text-slate-700 hover:bg-slate-50 hover:text-brand-700 focus-visible:bg-slate-50',
    danger:
      'text-red-600 hover:bg-red-50 focus-visible:bg-red-50',
  };
  const iconTones = {
    default: 'text-slate-400',
    danger: 'text-red-400',
  };

  return (
    <Link
      to={to}
      role="menuitem"
      onClick={onClick}
      className={`flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-bold transition-colors focus-visible:outline-none ${tones[tone]}`}
    >
      {Icon && <Icon className={`h-4 w-4 ${iconTones[tone]}`} aria-hidden="true" />}
      {children}
    </Link>
  );
};

const TeacherTopBar = ({
  onOpenNav,
  navOpen = false,
  showNotifications = true,
  unreadCount = 0,
}) => {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const title = TITLE_BY_ROUTE(pathname);

  const displayName = user?.name || 'Teacher';
  const role = user?.position || 'Teacher';

  const nameParts = displayName.split(/\s+/).filter(Boolean);
  const shortName =
    nameParts.length > 2
      ? `${nameParts[0][0]}. ${nameParts.slice(1).join(' ')}`
      : displayName;

  const hasPhoto = Boolean(user?.avatar);

  return (
    <header className="sticky top-0 z-30 shrink-0 border-b border-slate-200 bg-white">
      <div className="flex h-16 items-center gap-2 px-3 sm:gap-3 sm:px-5 lg:px-6">
        {/* Hamburger — the only way to reach the rail below lg. */}
        <button
          type="button"
          onClick={onOpenNav}
          aria-label={navOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={navOpen}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40 lg:hidden"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>

        {/* Page title — from the path, not a prop. */}
        <h1 className="min-w-0 flex-1 truncate text-[15px] font-extrabold tracking-tight text-ink">
          {title}
        </h1>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {showNotifications && (
            <NotificationBell unreadCount={unreadCount} to={TEACHER_ROUTES.notifications} />
          )}

          {/* Search: disabled, with the reason. */}
          <button
            type="button"
            disabled
            title="Search is coming soon — use the class list to find a student"
            aria-label="Search (coming soon)"
            className="hidden h-10 w-10 cursor-not-allowed items-center justify-center rounded-xl text-slate-300 md:flex"
          >
            <Search className="h-5 w-5" aria-hidden="true" />
          </button>

          {/* Avatar menu. */}
          <Popover
            align="right"
            className="max-w-[13rem]"
            panel={
              <div className="py-1.5">
                <div className="border-b border-slate-100 px-3.5 py-2.5">
                  <p className="truncate text-sm font-extrabold text-ink">
                    {displayName}
                  </p>
                  <p className="truncate text-[11px] font-semibold text-slate-500">
                    {role}
                  </p>
                </div>

                <MenuItem to={TEACHER_ROUTES.profile} icon={User}>
                  Profile &amp; settings
                </MenuItem>

                <MenuItem to={ROUTES.HOME} icon={Globe}>
                  Back to website
                </MenuItem>

                <button
                  type="button"
                  role="menuitem"
                  onClick={logout}
                  className="flex w-full items-center gap-2.5 border-t border-slate-100 px-3.5 py-2.5 text-left text-sm font-bold text-red-600 transition-colors hover:bg-red-50 focus-visible:bg-red-50 focus-visible:outline-none"
                >
                  <LogOut className="h-4 w-4 text-red-400" aria-hidden="true" />
                  Sign out
                </button>
              </div>
            }
            label={
              <>
                {/* The avatar. Photo when set, initials otherwise. */}
                {hasPhoto ? (
                  <img
                    src={user.avatar}
                    alt=""
                    className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-slate-200"
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-700 text-[12px] font-extrabold text-white"
                  >
                    {initialsOf(displayName)}
                  </span>
                )}

                <span className="hidden min-w-0 lg:block">
                  <span className="block truncate text-[13px] font-extrabold leading-tight text-ink">
                    {shortName}
                  </span>
                  <span className="block truncate text-[11px] font-semibold leading-tight text-slate-500">
                    {role}
                  </span>
                </span>

                <ChevronDown
                  className="hidden h-4 w-4 shrink-0 text-slate-400 lg:block"
                  aria-hidden="true"
                />
              </>
            }
          />
        </div>
      </div>
    </header>
  );
};

export default TeacherTopBar;