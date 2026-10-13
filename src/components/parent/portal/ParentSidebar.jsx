import { Link, NavLink } from 'react-router-dom';
import { useParentPay } from '../../../layouts/ParentLayout';
import { PRIMARY_NAV, SECONDARY_NAV } from './navConfig';
import { PARENT_ROUTES } from '../../../utils/constants';
import { initialsOf } from '../../../utils/parentFormat';
import { LogoMark } from '../../common/Logo';

/**
 * The portal's left rail — the desktop face of `BottomNav`.
 *
 * ## Why a rail and not a bigger bottom bar
 *
 * The bottom bar is right for a thumb and wrong for a mouse: it costs vertical
 * space on every scroll, caps the portal at five destinations, and hides the
 * "More" bucket behind a page hop. A column costs none of those, and the
 * pattern is already proven in this codebase — `DashboardLayout` renders its
 * rail as `hidden lg:flex` beside a `lg:grid` with a fixed column, and the
 * school console and the parent portal reading as siblings is worth more than
 * any originality here.
 *
 * ## Both navigations stay mounted
 *
 * This is `hidden lg:flex`, not conditionally rendered. A resize then moves the
 * parent between rail and bar without tearing the nav down, and — the part that
 * matters — the active-link state comes from the router, so there is never a
 * frame where neither navigation knows which page it is on.
 *
 * ## No drawer below `lg`
 *
 * `DashboardLayout` pairs its rail with a hamburger drawer for mobile. This
 * portal already has a bottom bar there, so a drawer would be a second,
 * competing navigation on the small screen — which is how a parent ends up
 * looking for Home in a slide-out that was never supposed to exist.
 */
const ParentSidebar = () => {
  const { token, student, school, unreadCount } = useParentPay();

  /** One nav row, shared by both groups. */
  const row = (item) => (
    <NavLink
      key={item.key}
      to={item.path(token)}
      end={item.key === 'home'}
      className={({ isActive }) =>
        `group relative flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-[13.5px] font-bold transition-colors ${
          isActive
            ? 'bg-emerald-50 text-[#0A5C36]'
            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {/* Left accent bar on active — a thin visual thread that makes the
              current row findable at a glance without needing a heavy fill. */}
          <span
            aria-hidden="true"
            className={`absolute left-0 top-1/2 -translate-y-1/2 rounded-r-full bg-[#0A5C36] transition-all ${
              isActive ? 'h-5 w-1' : 'h-0 w-0'
            }`}
          />

          <svg
            viewBox="0 0 24 24"
            className="h-[19px] w-[19px] shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth={isActive ? 2.3 : 2}
            aria-hidden="true"
          >
            {item.icon}
          </svg>

          <span className="truncate">{item.label}</span>

          {item.key === 'messages' && unreadCount > 0 ? (
            <span className="ml-auto inline-flex h-[18px] min-w-[20px] items-center justify-center rounded-full bg-amber-100 px-1.5 text-[10.5px] font-extrabold tabular-nums text-amber-900">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          ) : null}
        </>
      )}
    </NavLink>
  );

  return (
    <aside className="hidden w-full flex-col gap-6 border-r border-slate-200/80 bg-white px-3 py-5 lg:flex lg:sticky lg:top-0 lg:h-dvh">

      <Link
          to={PARENT_ROUTES.portal(token)}
          className="flex shrink-0 items-center gap-2.5 pr-1"
          aria-label="SukuuPay platform console"
        >
          <LogoMark className="h-10 w-10" />
          <span className="hidden text-lg font-extrabold tracking-tight text-ink sm:block">
            Sukuu<span className="text-brand-700">Pay</span>
          </span>
        </Link>

      {/* ── Ward card ──
          Where the bottom bar sends a parent to a page to switch child, the
          rail states whose child every page below is about — the
          shared-handset reality does not stop at a laptop. */}
      <Link
        to={PARENT_ROUTES.profile(token)}
        className="group flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-3 transition-colors hover:border-slate-300 hover:bg-slate-50"
      >
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[13px] font-extrabold text-[#0A5C36] ring-1 ring-inset ring-emerald-200"
        >
          {initialsOf(student?.studentName)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-extrabold leading-tight text-slate-900">
            {student?.studentName || 'Student'}
          </span>
          <span className="mt-0.5 block truncate text-[11.5px] font-medium text-slate-500">
            {student?.studentClass ? `${student.studentClass} · ` : ''}
            {school?.name || 'School'}
          </span>
        </span>
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          aria-hidden="true"
        >
          <path
            d="M8 3L4 7l4 4M4 7h13a3 3 0 013 3v1M16 21l4-4-4-4M20 17H7a3 3 0 01-3-3v-1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </Link>

      {/* ── Navigation ── */}
      <nav aria-label="Portal sections" className="flex flex-col gap-0.5">
        {PRIMARY_NAV.filter((item) => item.key !== 'more').map((item) => row(item))}

        <p className="mt-5 mb-1 px-3 text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-slate-400">
          More
        </p>
        {SECONDARY_NAV.map((item) => row(item))}
      </nav>

      {/* ── Footer ──
          The school's number, on every page, because "who do I call" is the
          question this whole portal exists to prevent — and a parent on a
          laptop can act on it without switching devices. */}
      <div className="mt-auto space-y-1 px-1">
        {school?.phone ? (
          <a
            href={`tel:${school.phone}`}
            className="group flex min-h-[44px] items-center gap-2.5 rounded-xl border border-slate-200/80 px-3 text-[12.5px] font-bold text-slate-700 transition-colors hover:border-emerald-200 hover:bg-emerald-50 hover:text-[#0A5C36]"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition-colors group-hover:bg-emerald-100 group-hover:text-[#0A5C36]">
              <svg
                viewBox="0 0 24 24"
                className="h-[15px] w-[15px]"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path
                  d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1.9.4 1.8.7 2.6a1 1 0 01-.5 2.1L8.1 9.6a16 16 0 006 6l1.2-1.2a2 2 0 012.1-.5c.8.3 1.7.6 2.6.7a1 1 0 011.7 2z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className="flex-1 truncate">Call the school</span>
            <span className="text-[11px] font-semibold text-slate-400 group-hover:text-[#0A5C36]">
              {school.phone}
            </span>
          </a>
        ) : null}

        <div className="flex items-center gap-3 px-3 pt-2 text-[11px] font-medium text-slate-400">
          <Link to="/privacy" className="transition-colors hover:text-slate-600">
            Privacy
          </Link>
          <span aria-hidden="true">·</span>
          <Link to="/terms" className="transition-colors hover:text-slate-600">
            Terms
          </Link>
          <span className="ml-auto text-[10px] font-semibold tracking-wide text-slate-300">
            v1.0
          </span>
        </div>
      </div>
    </aside>
  );
};

export default ParentSidebar;
