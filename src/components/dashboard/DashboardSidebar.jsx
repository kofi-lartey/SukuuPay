import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Building2,
  CalendarClock,
  ChartColumn,
  ChevronUp,
  CreditCard,
  Coins,
  Inbox,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  ScrollText,
  Settings,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import { ROUTES, isNavItemActive, visibleDashboardNav } from '../../utils/constants';
import { LogoMark } from '../common/Logo';
/**
 * lucide name → component, resolving the strings in `DASHBOARD_NAV`.
 *
 * The config stores names rather than components so `utils/constants.js` stays
 * a plain data module; this is the one place that pairing happens. Same shape as
 * `Stepper`'s `ICONS` for `ONBOARDING_STEPS`.
 */
const ICONS = {
  LayoutDashboard,
  Users,
  CreditCard,
  CalendarClock,
  MessageSquare,
  Inbox,
  Coins,
  Megaphone,
  ChartColumn,
  ScrollText,
  Settings,
  UserCog,
};

/**
 * The module rail.
 *
 * Single-column, and that reverses the earlier two-column decision. The design
 * gives the rail a fixed 244px and fills it with the wordmark, seven entries and
 * a school card; there is no room for a second line of description, and the
 * design's own answer — an icon plus a label — is enough. The descriptions moved
 * to the topbar's tooltips and the Overview's header, where there is space.
 *
 * The active entry is a filled dark-green pill rather than a tinted background,
 * which is the difference between "you are here" and "this row is hovered". It
 * has to be findable in one glance while reconciling eight modules, so it is the
 * strongest contrast on the page.
 *
 * `variant` keeps the persistent rail and the mobile drawer the same component:
 * `fixed` is a sticky column with its own scroll, `drawer` is the same content in
 * an overlay with a close button.
 */
const DashboardSidebar = ({ user, school, variant = 'fixed', className = '', onClose }) => {
  const { pathname } = useLocation();
  const groups = visibleDashboardNav(user?.role);
  const isDrawer = variant === 'drawer';

  return (
    <aside
      className={`flex-col border-slate-200 bg-white ${
        isDrawer ? 'border-r shadow-2xl' : 'sticky top-0 h-screen border-r'
      } ${className}`}
      aria-label="Dashboard modules"
    >
      <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4">
        <Link
          to={ROUTES.HOME}
          className="flex shrink-0 items-center gap-2.5 pr-1"
          aria-label="SukuuPay platform console"
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
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        <ul className="flex flex-col gap-1">
          {groups.flatMap((group) => group.items).map((item) => {
            const Icon = ICONS[item.icon] || LayoutDashboard;
            const active = isNavItemActive(pathname, item);

            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  aria-current={active ? 'page' : undefined}
                  title={item.description}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40 ${
                    active
                      ? 'bg-brand-700 text-white shadow-lift'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-ink'
                  }`}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/*
        The school card, pinned to the bottom.
        `mt-auto` is what keeps it there regardless of nav length: with few
        modules the list is short and the card must still sit on the floor of the
        rail, not float up under the last entry.
      */}
      <div className="shrink-0 border-t border-slate-100 p-3">
        <div className="flex items-center gap-2.5 rounded-xl bg-brand-700 p-3 text-white">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15">
            <Building2 className="h-4 w-4" aria-hidden="true" />
          </span>
          <Link to={ROUTES.DASHBOARD_SETTINGS} className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-extrabold leading-tight">
              {school?.name || 'Your school'}
            </span>
            <span className="block truncate text-[11px] font-semibold leading-tight text-white/70">
              {school?.city || 'School settings'}
            </span>
          </Link>
          <Link
            to={ROUTES.DASHBOARD_SETTINGS}
            aria-label="School settings"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10 transition-colors hover:bg-white/20"
          >
            <ChevronUp className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        {/*
          The way back to the public site.
          The shell replaced the marketing navbar, and the account menu that also
          offers this only exists behind a popover — so on a page with no other
          exit, the one guaranteed escape from the app was invisible. A quiet
          link under the school card costs 28px of height and keeps the card as
          the footer's primary element, which is what the design asks for.
        */}
        <Link
          to={ROUTES.HOME}
          className="mt-1.5 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-extrabold text-slate-500 transition-colors hover:bg-slate-50 hover:text-brand-700"
        >
          Back to website
        </Link>
      </div>
    </aside>
  );
};

export default DashboardSidebar;
