import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bell,
  Building2,
  ChevronDown,
  GraduationCap,
  LogOut,
  Menu,
  MessageSquare,
  Plus,
  Search,
  User,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ROUTES, roleLabel } from '../../utils/constants';
import { formatCount } from '../../utils/format';
import { LogoMark } from '../common/Logo';
import Popover from './ui/Popover';
import Badge from './ui/Badge';

const MenuItem = ({ to, icon: Icon, children, onClick }) => (
  <Link
    to={to}
    role="menuitem"
    onClick={onClick}
    className="flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 hover:text-brand-700"
  >
    {Icon && <Icon className="h-4 w-4 text-slate-400" aria-hidden="true" />}
    {children}
  </Link>
);

/**
 * The shell header.
 *
 * Carries the four things that scope every module below it — which school, which
 * term, which student is being looked for, and how much SMS credit is left —
 * because those are decisions made *before* opening a module, not inside one. A
 * bursar setting term scope once and carrying it across eight modules is the
 * whole reason this bar is the design's most opinionated element.
 *
 * It also replaces the module title bar from the previous shell. The current
 * module is named in the sidebar, which is always visible on desktop and one tap
 * away on mobile, so repeating it here spent the width that the school and term
 * selectors needed.
 *
 * The responsive strategy is progressive collapse rather than a second mobile
 * layout: the school and term selectors are the first to go, then the search
 * field, and the last two items — New Payment and the account menu — are what a
 * phone user came for. A separate mobile header would drift from this one.
 */
const DashboardTopbar = ({ user, onOpenNav, navOpen = false, school, term, smsCredit }) => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const displayName = user?.name || 'Account';
  const roleLabelText = roleLabel(user?.role);
  // The design stacks "Mr. E. K. Mensah" over "School Bursar"; the name is
  // shortened to initials-and-surname so the two lines stay balanced.
  const nameParts = displayName.split(/\s+/).filter(Boolean);
  const shortName =
    nameParts.length > 2
      ? `${nameParts[0][0]}. ${nameParts.slice(1).join(' ')}`
      : displayName;

  const onSearch = (event) => {
    event.preventDefault();
    const q = query.trim();
    // A search that stays on the Overview has nowhere to show its result.
    // Routing to Students — where the roster lives — is the honest target until
    // a global search index exists.
    navigate(q ? `${ROUTES.DASHBOARD_STUDENTS}?q=${encodeURIComponent(q)}` : ROUTES.DASHBOARD_STUDENTS);
    setQuery('');
  };

  return (
    <header className="sticky top-0 z-30 shrink-0 border-b border-slate-200 bg-white">
      <div className="flex h-16 items-center gap-2 px-3 sm:gap-3 sm:px-5 lg:px-6">
        <button
          type="button"
          onClick={onOpenNav}
          aria-label="Open navigation"
          aria-expanded={navOpen}
          aria-controls="dashboard-nav-drawer"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-slate-100 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        <Link
          to={ROUTES.DASHBOARD}
          className="flex shrink-0 items-center gap-2.5 pr-1"
          aria-label="SukuuPay dashboard"
        >
          <LogoMark className="h-9 w-9" markClassName="text-base" />
          <span className="hidden text-lg font-extrabold tracking-tight text-ink sm:block">
            Sukuu<span className="text-brand-700">Pay</span>
          </span>
        </Link>

        {/* School and term. Hidden below xl rather than truncated: a clipped
            school name is worse than no selector, because it looks like the
            whole school when it is not. */}
        <div className="hidden min-w-0 items-center divide-x divide-slate-200 xl:flex">
          <Popover
            className="max-w-[15rem]"
            panel={
              <div className="py-1.5">
                <p className="px-3.5 pb-1.5 pt-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                  Your schools
                </p>
                <div className="flex items-center gap-2.5 bg-brand-50/60 px-3.5 py-2.5">
                  <Building2 className="h-4 w-4 shrink-0 text-brand-700" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-extrabold text-ink">
                      {school?.name || 'Your school'}
                    </span>
                    <span className="block truncate text-[11px] font-semibold text-slate-500">
                      {school?.city || 'Current school'}
                    </span>
                  </span>
                </div>
                <MenuItem to={ROUTES.DASHBOARD_SETTINGS} icon={Building2}>
                  School settings
                </MenuItem>
              </div>
            }
            label={
              <>
                <GraduationCap className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-extrabold leading-tight text-ink">
                    {school?.name || 'Your school'}
                  </span>
                  <span className="block truncate text-[11px] font-semibold leading-tight text-slate-500">
                    {school?.city || 'Switch school'}
                  </span>
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              </>
            }
          />

          <Popover
            className="ml-1 max-w-[11rem]"
            panel={
              <div className="py-1.5">
                <p className="px-3.5 pb-1.5 pt-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                  Academic term
                </p>
                <div className="flex items-center gap-2.5 bg-brand-50/60 px-3.5 py-2.5">
                  <GraduationCap className="h-4 w-4 shrink-0 text-brand-700" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-extrabold text-ink">
                      {term?.label || 'Current term'}
                    </span>
                    <span className="block truncate text-[11px] font-semibold text-slate-500">
                      ({term?.academicYear || '—'})
                    </span>
                  </span>
                </div>
                <MenuItem to={ROUTES.DASHBOARD_SETTINGS} icon={GraduationCap}>
                  Change term in settings
                </MenuItem>
              </div>
            }
            label={
              <>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-extrabold leading-tight text-ink">
                    {term?.label || 'Current term'}
                  </span>
                  <span className="block truncate text-[11px] font-semibold leading-tight text-slate-500">
                    ({term?.academicYear || '—'})
                  </span>
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              </>
            }
          />
        </div>

        {/* Search grows to fill whatever is left, so the header stays one row at
            every width instead of wrapping. */}
        <form onSubmit={onSearch} role="search" className="ml-auto hidden min-w-0 flex-1 md:block">
          <div className="relative mx-auto max-w-md">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search student name or ID…"
              aria-label="Search students"
              className="h-10 w-full rounded-full border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm font-semibold text-ink placeholder:font-medium placeholder:text-slate-400 focus:border-brand-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-700/20"
            />
          </div>
        </form>

        <div className="ml-auto flex shrink-0 items-center gap-2 md:ml-0">
          {/*
            SMS credit.
            Rendered only once a school-scoped balance endpoint exists (see
            `getSmsCredit` in services/dashboard.js) — `GET /admin/sms-balance`
            is super_admin only and reports the platform's master credit, which
            is the wrong number for a school. Until then this stays hidden rather
            than showing a platform figure on a school's own header.
          */}
          {smsCredit && (
            <Badge tone="amber" icon={MessageSquare} className="hidden lg:inline-flex">
              {formatCount(smsCredit.units)} SMS left
            </Badge>
          )}

          <Link
            to={ROUTES.DASHBOARD_PAYMENTS}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-brand-700 px-3 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 sm:px-4"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">New Payment</span>
          </Link>

          {/*
            No notifications surface exists yet, so this is a disabled control
            with a stated reason rather than a bell that goes nowhere. The
            in-flight AuthContext load is the only thing that legitimately puts a
            dot on a bell, and that is the spinner.
          */}
          <button
            type="button"
            disabled
            title="Notifications arrive with the SMS Reminders module"
            aria-label="Notifications (coming soon)"
            className="hidden h-10 w-10 cursor-not-allowed items-center justify-center rounded-xl text-slate-300 sm:flex"
          >
            <Bell className="h-5 w-5" />
          </button>

          <Popover
            align="right"
            className="max-w-[13rem]"
            panel={
              <div className="py-1.5">
                <div className="border-b border-slate-100 px-3.5 py-2.5">
                  <p className="truncate text-sm font-extrabold text-ink">{displayName}</p>
                  <p className="truncate text-[11px] font-semibold text-slate-500">{roleLabelText}</p>
                </div>
                <MenuItem to={ROUTES.DASHBOARD_SETTINGS} icon={User}>
                  Account settings
                </MenuItem>
                <MenuItem to={ROUTES.HOME} icon={Building2}>
                  Back to website
                </MenuItem>
                {/* The shell replaced the marketing navbar, so signing out has to
                    live here rather than being left to a header that is gone. */}
                <button
                  type="button"
                  role="menuitem"
                  onClick={logout}
                  className="flex w-full items-center gap-2.5 border-t border-slate-100 px-3.5 py-2.5 text-left text-sm font-bold text-red-600 transition-colors hover:bg-red-50"
                >
                  <LogOut className="h-4 w-4 text-red-400" aria-hidden="true" />
                  Logout
                </button>
              </div>
            }
            label={
              <>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-700 text-white">
                  <User className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="hidden min-w-0 lg:block">
                  <span className="block truncate text-[13px] font-extrabold leading-tight text-ink">
                    {shortName}
                  </span>
                  <span className="block truncate text-[11px] font-semibold leading-tight text-slate-500">
                    {roleLabelText}
                  </span>
                </span>
                <ChevronDown className="hidden h-4 w-4 shrink-0 text-slate-400 lg:block" aria-hidden="true" />
              </>
            }
          />
        </div>
      </div>
    </header>
  );
};

export default DashboardTopbar;
