import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Activity,
  Building2,
  CreditCard,
  Eye,
  FileBarChart,
  Gauge,
  Images,
  Megaphone,
  MessageSquare,
  Receipt,
  ScrollText,
  Settings,
  TrendingUp,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { ROUTES, isNavItemActive, visibleAdminNav } from '../../utils/constants';
import { useImpersonation } from '../../hooks/useImpersonation';
import { LogoMark } from '../common/Logo';

/**
 * lucide name → component, resolving the strings in `ADMIN_NAV`.
 *
 * A copy of `DashboardSidebar`'s map rather than a shared one, and deliberately:
 * the two rails will diverge (the console has no school card, the school rail has
 * no platform module), and a shared map that one rail then partially imports back
 * out of is harder to follow than two short tables that each name what they use.
 * The *config* is shared — `ADMIN_NAV` and `DASHBOARD_NAV` follow one contract —
 * which is where drift would actually hurt.
 *
 * Every icon named in `ADMIN_NAV` must appear here. `ICONS[item.icon] || Gauge` means
 * a missing entry renders the platform glyph rather than crashing, which is the
 * right failure for the rail but a silent one — so the fallback is deliberately the
 * least misleading icon available rather than something plausible-looking.
 */
const ICONS = {
  Activity,
  Building2,
  CreditCard,
  Eye,
  FileBarChart,
  Gauge,
  Images,
  Megaphone,
  MessageSquare,
  Receipt,
  ScrollText,
  Settings,
  TrendingUp,
  Users,
  Wallet,
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
  const { isImpersonating, session } = useImpersonation();
  const groups = visibleAdminNav('super_admin');
  const isDrawer = variant === 'drawer';

  /*
   * **The rail is NOT filtered during an impersonation**, and the reason it used to
   * be is the whole argument.
   *
   * It hid every platform-wide module so the rail would "agree with the guard". But
   * the server does not agree — it deliberately serves platform-wide reads during a
   * support session and records each one against
   * `ImpersonationSession.actionsCount`. Hiding the links while the API would happily
   * answer them is the same incoherence as the guard's redirect: a restriction
   * enforced in one of two places, which reads as a product decision and is actually
   * an accident of layering.
   *
   * It was also the more annoying of the two. An owner mid-support-call who needs a
   * platform figure would have found six modules missing and no explanation, and
   * every workaround costs one of ten hourly impersonation starts.
   *
   * The risk that motivated it — an operator not realising they had left the school —
   * is handled where it actually matters: `ImpersonationBanner` reads "Platform data"
   * instead of "Viewing as" whenever the current path is outside the impersonated
   * school. Telling someone the truth in the one place they cannot miss is better
   * than preventing them from seeing it.
   */
  const visibleGroups = groups;

  return (
    <aside
      className={`flex-col border-slate-200 bg-white ${isDrawer ? 'border-r shadow-2xl' : 'sticky top-0 h-screen border-r'
        } ${className}`}
      aria-label="Platform console modules"
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
          {visibleGroups.flatMap((group) => group.items).map((item) => {
            const Icon = ICONS[item.icon] || Gauge;
            const active = isNavItemActive(pathname, item);

            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  aria-current={active ? 'page' : undefined}
                  title={item.description}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40 ${active
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

        {/*
          Which school, while impersonating.

          Only the school name, and deliberately nothing about the other modules —
          they are all reachable now, and this rail does not pretend otherwise. The
          banner at the top of the viewport carries the state (and changes wording
          when the operator is off the school's pages); this repeats the one fact that
          belongs next to the navigation, because the rail is what the eye follows
          down and the banner can be scrolled past a long payments table.
        */}
        {isImpersonating && session?.schoolName && (
          <p className="mt-2 truncate px-1 text-center text-[11px] font-bold text-amber-700">
            {session.schoolName}
          </p>
        )}
      </div>
    </aside>
  );
};

export default AdminSidebar;