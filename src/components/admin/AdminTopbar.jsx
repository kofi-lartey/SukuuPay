import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Globe, LogOut, Menu, Search, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ROUTES, activeAdminItem, roleLabel } from '../../utils/constants';
import { LogoMark } from '../common/Logo';
import NotificationBell from '../common/NotificationBell';
import Popover from '../dashboard/ui/Popover';
import Badge from '../dashboard/ui/Badge';

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
 * The platform console header.
 *
 * It looks like `DashboardTopbar` and that is on purpose — two shells with
 * different headers read as two products, and this is the same one. But three of
 * its elements are *deliberately absent*, and each absence is a decision rather
 * than an omission:
 *
 *   - **No school or term selector.** Both are school-scoped, and a
 *     `super_admin` has `schoolId: null`. Rendering them anyway is how the school
 *     rail ends up saying "Your school" forever. Nothing here is scoped to a
 *     school, so there is nothing to select.
 *   - **No "New Payment".** Taking a payment is an act *on a school*. The one
 *     action the school header leads with has no meaning here, and carrying it
 *     across because the layout matched would have put a button on every page
 *     that cannot do the thing it says.
 *   - **No global search.** There is no platform-wide search index — the schools
 *     list is paginated and unfiltered server-side, so typing a name and finding
 *     one school out of two hundred would mean fetching all of them. It is a
 *     disabled control with its reason stated, which is the treatment
 *     `DashboardTopbar` gives notifications.
 *
 * `actions` is the slot that replaces the missing primary action, so a module
 * with a real one (approve a creative, suspend a school) puts it here instead of
 * every module inventing a header row.
 */
const AdminTopbar = ({ user, onOpenNav, navOpen = false, pathname, actions }) => {
  const { logout } = useAuth();

  const displayName = user?.name || 'Account';
  const label = roleLabel(user?.role);
  const current = activeAdminItem(pathname, user?.role);

  const nameParts = displayName.split(/\s+/).filter(Boolean);
  const shortName =
    nameParts.length > 2 ? `${nameParts[0][0]}. ${nameParts.slice(1).join(' ')}` : displayName;

  return (
    <header className="sticky top-0 z-30 shrink-0 border-b border-slate-200 bg-white">
      <div className="flex h-16 items-center gap-2 px-3 sm:gap-3 sm:px-5 lg:px-6">
        <button
          type="button"
          onClick={onOpenNav}
          aria-label="Open navigation"
          aria-expanded={navOpen}
          aria-controls="admin-nav-drawer"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-slate-100 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        <Link
          to={ROUTES.ADMIN}
          className="flex shrink-0 items-center gap-2.5 pr-1"
          aria-label="SukuuPay platform console"
        >
          <LogoMark className="h-10 w-10" />
          <span className="hidden text-lg font-extrabold tracking-tight text-ink sm:block">
            Sukuu<span className="text-brand-700">Pay</span>
          </span>
        </Link>

        {/*
          The current module, as text.

          It earns its place here for the same reason the school header *dropped*
          its title bar: the rail is one tap away on desktop and always visible,
          so the module is never in doubt — except on mobile, where the rail is a
          closed drawer and the header is the only thing on screen that says where
          you are. One line, hidden at `sm` where the rail is visible, is the
          cheapest honest answer.
        */}
        {current && (
          <div className="hidden min-w-0 items-center gap-2 sm:flex">
            <span aria-hidden="true" className="text-slate-300">
              /
            </span>
            <span className="truncate text-sm font-extrabold text-slate-600">{current.label}</span>
          </div>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Badge tone="ink" icon={Globe} className="hidden lg:inline-flex">
            All schools
          </Badge>

          {/*
            The same bell as the school shell. It was absent here rather than
            disabled, and the file comment justified that by pointing at
            `DashboardTopbar`'s disabled bell — which is not a justification, it is the
            same gap cited from the other side.

            For the platform console it earns its place on the platform's own alerts:
            `plan.requested` and `parent.message` rows are addressed to school admins
            only, so the platform owner sees `system.alert`, `school.join_request` and
            whatever a service raises directly, and can act on them.
          */}
          <NotificationBell />

          {/*
            Search: disabled, with the reason. See the file comment — there is no
            platform-wide index to search, and a field that only appears to work
            is worse than one that admits it does not.
          */}
          <button
            type="button"
            disabled
            title="There is no platform-wide search yet — use the Schools list to filter"
            aria-label="Search (coming soon)"
            className="hidden h-10 w-10 cursor-not-allowed items-center justify-center rounded-xl text-slate-300 md:flex"
          >
            <Search className="h-5 w-5" />
          </button>

          {actions}

          <Popover
            align="right"
            className="max-w-[13rem]"
            panel={
              <div className="py-1.5">
                <div className="border-b border-slate-100 px-3.5 py-2.5">
                  <p className="truncate text-sm font-extrabold text-ink">{displayName}</p>
                  <p className="truncate text-[11px] font-semibold text-slate-500">{label}</p>
                </div>
                <MenuItem to={ROUTES.ADMIN_SETTINGS} icon={User}>
                  Account settings
                </MenuItem>
                {/*
                  The escape hatch. The school console's header offers this too,
                  and it matters more here: a platform admin has no school, so
                  `/dashboard` is not a place they can go — this link and "Back to
                  website" in the rail are the only two ways out.
                */}
                <MenuItem to={ROUTES.HOME} icon={Globe}>
                  Back to website
                </MenuItem>
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
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-white">
                  <User className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="hidden min-w-0 lg:block">
                  <span className="block truncate text-[13px] font-extrabold leading-tight text-ink">
                    {shortName}
                  </span>
                  <span className="block truncate text-[11px] font-semibold leading-tight text-slate-500">
                    {label}
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

export default AdminTopbar;