import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Building2,
  Gauge,
  Megaphone,
  Settings,
  Users,
  X,
} from 'lucide-react';
import { ROUTES, isNavItemActive, visibleAdminNav } from '../../utils/constants';

/**
 * lucide name → component, resolving the strings in `ADMIN_NAV`.
 *
 * A copy of `DashboardSidebar`'s map rather than a shared one, and deliberately:
 * the two rails will diverge (the console has no school card, the school rail has
 * no platform module), and a shared map that one rail then partially imports back
 * out of is harder to follow than two short tables that each name what they use.
 * The *config* is shared — `ADMIN_NAV` and `DASHBOARD_NAV` follow one contract —
 * which is where drift would actually hurt.
 */
const ICONS = {
  Gauge,
  Building2,
  Users,
  Megaphone,
  Settings,
};

/**
 * The platform console rail.
 *
 * Structurally `DashboardSidebar`: a fixed column, an icon-plus-label list, the
 * active entry as a filled `brand-700` pill, and `variant` keeping the desktop
 * rail and the mobile drawer the same component so a module cannot change
 * behaviour when the viewport shrinks.
 *
 * The one thing it deliberately does *not* copy is the school card at the foot.
 * That card links to `/dashboard/settings` and is the fastest route from the rail
 * to a school's configuration — meaningless for an operator who belongs to no
 * school. In its place is a platform card that states what this console is and
 * where the school console is, because the rail otherwise has no exit at all.
 */
const AdminSidebar = ({ variant = 'fixed', className = '', onClose }) => {
  const { pathname } = useLocation();
  const groups = visibleAdminNav('super_admin');
  const isDrawer = variant === 'drawer';

  return (
    <aside
      className={`flex-col border-slate-200 bg-white ${
        isDrawer ? 'border-r shadow-2xl' : 'sticky top-0 h-screen border-r'
      } ${className}`}
      aria-label="Platform console modules"
    >
      <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4">
        <span className="text-lg font-extrabold tracking-tight text-ink">
          Sukuu<span className="text-brand-700">Pay</span>
        </span>

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

      {/*
        The console's name, stated once at the top of the rail.

        This is not decoration. A platform admin and a school admin see two shells
        with the same wordmark, the same pill, the same account menu and the same
        green, and the only thing that distinguishes them at a glance is what the
        rail is called. Without it, a screenshot of either screen is
        indistinguishable from the other — and "am I in the school console or the
        platform one" is the question a super admin asks every time they log in.
      */}
      <div className="shrink-0 border-b border-slate-100 px-4 py-3">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-brand-700">
          Platform console
        </p>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        <ul className="flex flex-col gap-1">
          {groups.flatMap((group) => group.items).map((item) => {
            const Icon = ICONS[item.icon] || Gauge;
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

      <div className="shrink-0 border-t border-slate-100 p-3">
        {/*
          The console card. `mt-auto` on the container above keeps it on the floor
          of the rail regardless of how many modules are added above it.
        */}
        <div className="flex items-center gap-2.5 rounded-xl bg-brand-700 p-3 text-white">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15">
            <Gauge className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-extrabold leading-tight">
              All schools
            </span>
            <span className="block truncate text-[11px] font-semibold leading-tight text-white/70">
              Platform-wide view
            </span>
          </span>
        </div>

        <Link
          to={ROUTES.HOME}
          className="mt-1.5 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-extrabold text-slate-500 transition-colors hover:bg-slate-50 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
        >
          Back to website
        </Link>
      </div>
    </aside>
  );
};

export default AdminSidebar;