import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Compass, LifeBuoy } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  HELPDESK_PHONE,
  NAV_LINKS,
  ROUTES,
  roleLabel,
  visibleAdminNav,
  visibleDashboardNav,
} from '../utils/constants';

/**
 * The path, shortened from the middle so both ends stay readable.
 *
 * `/admin/revenue/series?period=ytd` has to survive the truncation as a path a
 * reader can still act on, so the head (which says *where*) and the tail (which
 * says *what*) are kept and only the middle is elided. A leading slice would
 * render eight school modules as identical prefixes.
 */
const shortenPath = (pathname) => {
  const value = pathname || '';
  if (value.length <= 64) return value;
  return `${value.slice(0, 40)}…${value.slice(-20)}`;
};

/**
 * Where a lost visitor goes next, per shell.
 *
 * This is the whole reason the component takes a `variant`. A 404 inside the
 * school console that offered marketing links was sending a bursar out of the
 * app to look at a website, and one inside the platform console offering
 * `/features` was worse — those links are for people deciding whether to buy
 * the product, and a platform admin already runs it.
 *
 * The module pills come from the same `visible*Nav` helpers the rail uses, so
 * the exits can never name a module the rail is hiding from this role.
 */
const exitsFor = (variant, role) => {
  if (variant === 'admin') {
    return {
      eyebrow: '404',
      heading: 'That console module does not exist',
      blurb: 'The platform console has five modules. Pick one below, or go back to the platform overview.',
      primary: { to: ROUTES.ADMIN, label: 'Platform overview' },
      modules: visibleAdminNav('super_admin').flatMap((group) => group.items),
    };
  }

  if (variant === 'app') {
    return {
      eyebrow: '404',
      heading: 'We couldn’t find that module',
      blurb: 'The module may have been renamed, or the link may be out of date. Your work is not affected.',
      primary: { to: ROUTES.DASHBOARD, label: 'Back to dashboard' },
      modules: visibleDashboardNav(role).flatMap((group) => group.items),
    };
  }

  if (variant === 'pay') {
    /*
     * The page a parent lands on from an SMS link. There is no account here and
     * no shell to inherit, so this is the one variant with nothing to offer but
     * contact: the token is the only credential involved, there is no console to
     * link to, and a footer of product links under a dead fee link reads as
     * advertising at the worst possible moment.
     *
     * `ROUTES.CONTACT` rather than a bursar's phone number, because a wrong
     * contact route is honest and an unassigned number is not — see
     * `HELPDESK_PHONE` in constants.js.
     */
    return {
      eyebrow: 'Link expired',
      heading: 'This fee link is no longer valid',
      blurb:
        'Payment links are single-use and expire. If you were sent this by SMS, ask the school to send a fresh link — your account is unaffected either way.',
      primary: { to: ROUTES.CONTACT, label: 'Contact the school' },
      modules: [],
      variant,
    };
  }

  return {
    eyebrow: '404',
    heading: 'We couldn’t find that page',
    blurb: 'The link may be out of date. The pages below cover everything SukuuPay does.',
    primary: { to: ROUTES.HOME, label: 'Back to home' },
    modules: NAV_LINKS,
    variant,
  };
};

/**
 * Catch-all for unmatched routes.
 *
 * Previously a bad path rendered the bare chrome around an empty `<main>`, which
 * looked like a rendering bug rather than a missing page. Then the catch-all was
 * moved inside the `AppChrome` route group to fix that — which fixed the
 * marketing pages and quietly broke the other two shells, because a match under
 * `/dashboard` or `/pay` fell through to *this* route and arrived wearing the
 * marketing navbar and a footer of product links. Each guarded subtree now
 * carries its own catch-all; this component's job is to render correctly inside
 * whichever one matched.
 *
 * The other thing worth stating: the attempted path is shown. "We couldn't find
 * that page" reads as *the site is broken*; "we couldn't find `/dashboard/repotrs`"
 * reads as *I clicked the wrong thing*, and the second one is almost always the
 * truth. It is the single highest-value line on the page.
 */
const NotFound = ({ variant = 'marketing' }) => {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const config = exitsFor(variant, user?.role);
  const attempted = shortenPath(pathname);

  // In-shell the shell already supplies the way out, the navigation and the
  // background, so the panel is compact. Everything else — marketing and the pay
  // link — renders standalone and carries all three, because there is no shell
  // behind those routes to inherit anything from.
  const inShell = variant === 'app' || variant === 'admin';

  const panel = (
    <div className="text-center">
      <span
        className={`mx-auto mb-6 flex items-center justify-center rounded-2xl bg-brand-50 text-brand-800 ${
          inShell ? 'h-14 w-14' : 'h-16 w-16'
        }`}
      >
        <Compass size={inShell ? 26 : 32} aria-hidden="true" />
      </span>

      {/*
        The eyebrow is decorative. A screen reader reading "404, we couldn't find
        that page" gains nothing from the number, and announcing it as an alert
        would be wrong — nothing failed at runtime, the path simply has no page.
      */}
      <p aria-hidden="true" className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand-700">
        {config.eyebrow}
      </p>

      <h1
        className={`mt-2 font-display font-extrabold tracking-tight text-ink ${
          inShell ? 'text-2xl sm:text-3xl' : 'text-3xl sm:text-4xl'
        }`}
      >
        {config.heading}
      </h1>

      {/*
        The attempted path. `break-all` rather than truncation alone: a long path
        is the one string on this page that can exceed a phone's width, and
        `overflow-x-auto` on a code block produces a horizontal scrollbar inside
        a vertically centred panel, which reads as a layout bug.
      */}
      {attempted && attempted !== '/' && (
        <p className="mx-auto mt-4 max-w-md text-sm">
          <span className="text-slate-600">No page is registered at</span>{' '}
          <code className="break-all rounded-lg bg-slate-100 px-2 py-1 font-mono text-[13px] font-bold text-ink">
            {attempted}
          </code>
        </p>
      )}

      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-600">{config.blurb}</p>

      {config.modules.length > 0 && (
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {config.modules.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
        <Link
          to={config.primary.to}
          className="inline-flex items-center gap-2 text-sm font-bold text-brand-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {config.primary.label}
        </Link>

        {/*
          A signed-in visitor who mistyped a public URL is one click from the
          console they actually use. Marketing pages get this only when there is
          an identity to route to — the console to offer depends on the role, so
          this cannot be a static link.
        */}
        {variant === 'marketing' && user && (
          <Link
            to={user.role === 'super_admin' ? ROUTES.ADMIN : ROUTES.DASHBOARD}
            className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-brand-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
          >
            {user.role === 'super_admin' ? 'Platform console' : 'Your dashboard'}
            <span className="text-[11px] font-semibold text-slate-400">{roleLabel(user.role)}</span>
          </Link>
        )}

        {/*
          Support, and only when there is one. `HELPDESK_PHONE` is empty until the
          line is assigned (see `constants.js`); `Contact` is a real route, so it
          is always a valid destination.
        */}
        <Link
          to={ROUTES.CONTACT}
          className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-brand-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
        >
          <LifeBuoy className="h-4 w-4" aria-hidden="true" />
          Report a broken link
        </Link>
      </div>

      {HELPDESK_PHONE && (
        <p className="mt-6 text-[11px] font-semibold text-slate-400">
          Or call {HELPDESK_PHONE} and we will fix the link that sent you here.
        </p>
      )}
    </div>
  );

  if (inShell) {
    // The shell already supplies the background, the rail and the width.
    return <div className="py-10 sm:py-16">{panel}</div>;
  }

  return (
    <div className="bg-slate-50">
      <div className="mx-auto max-w-3xl px-4 py-24 sm:px-6 lg:px-8">{panel}</div>
    </div>
  );
};

export default NotFound;