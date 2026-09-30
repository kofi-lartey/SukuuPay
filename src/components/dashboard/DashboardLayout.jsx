import React, { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import DashboardSidebar from './DashboardSidebar';
import DashboardTopbar from './DashboardTopbar';
import { useAuth } from '../../context/AuthContext';
import { useDashboardOverview } from '../../hooks/useDashboardOverview';

/**
 * The management-system app shell.
 *
 * A sibling of `AppChrome`, not a child — the same distinction the onboarding
 * wizard makes. `AppChrome` owns the marketing navbar and footer, and an
 * authenticated admin running a bursar's workflow has no use for either: the
 * footer is four links to pages they cannot act on, and the navbar competes for
 * the top of the viewport with the module controls. This shell replaces both
 * with a persistent module rail.
 *
 * Mounted once, above the routed content, so the rail survives every module
 * change: the eight nav entries are never unmounted and rebuilt, so nothing
 * flickers and an open drawer is not re-measured on each click.
 *
 * The split is a real two-column grid rather than a fixed sidebar with
 * negative-margin escapes, so the rail is a first-class column instead of an
 * overlay the content has to be padded away from. The rail is sticky and the
 * page scrolls under it, which is what keeps the eight entries in place while a
 * long roster runs past them.
 *
 * Mobile gets the rail as an overlay drawer behind a menu button in the topbar.
 * The two are the same component so a module cannot look or behave differently
 * once the viewport shrinks, which is the failure mode of maintaining a
 * separate mobile nav.
 */
const DashboardLayout = () => {
  const { user, school } = useAuth();
  const { pathname } = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // The header's school and term selectors.
  //
  // The identity comes from `GET /schools/:id` via the overview hook, because
  // `AuthContext.school` is never actually populated — `refreshUser` only ever
  // calls `setSchool((current) => current ?? null)`, so it stays null and a
  // topbar bound to it alone would read "Your school" forever. Populating
  // `AuthContext.school` properly is the better fix, but it is a change to
  // session state rather than to layout.
  //
  // It used to fall back to the overview payload, which was `DEMO_SCHOOL` — so
  // the header of every dashboard page read "Prampram Basic Sch…" for a school
  // that has nothing to do with it. There is no fallback now: an unloaded school
  // renders "Your school", which is the truth.
  //
  // The rail and the topbar both read `school.name` and `school.campus`, so what
  // is handed down is an object. `campus` was never a field on the School model —
  // it existed only on the fixture — so they read `city`, which is real, and the
  // cards fall back to their own text when a school has not set one.
  const { data } = useDashboardOverview(user?.schoolId);
  const schoolCard = useMemo(
    () => ({
      name: school?.name || data?.school?.name || '',
      city: data?.school?.city || '',
    }),
    [school, data]
  );
  const term = data?.term;
  const smsCredit = null;

  // Navigating with the drawer open must close it, or it hangs over the module
  // the user just asked for. Mirrors the marketing navbar's drawer.
  useEffect(() => setDrawerOpen(false), [pathname]);

  // Reset scroll on module change.
  //
  // `AppChrome` does this for the marketing pages, and the shell has to repeat
  // it: the shell is not inside `AppChrome`, so a bursar who scrolled halfway
  // down a long roster and clicked Reports lands halfway down Reports — looking
  // like a page that failed to load its top. `scroll-behavior: smooth` in
  // index.css would also turn the reset into an animated lurch, so it is
  // suppressed for the jump, exactly as in `AppChrome`.
  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      window.scrollTo(0, 0);
    } else {
      const previous = document.documentElement.style.scrollBehavior;
      document.documentElement.style.scrollBehavior = 'auto';
      window.scrollTo(0, 0);
      document.documentElement.style.scrollBehavior = previous;
    }
  }, [pathname]);

  // Escape closes the drawer. Without it the overlay is the only way out, which
  // strands anyone on a keyboard.
  useEffect(() => {
    if (!drawerOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [drawerOpen]);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* First tab stop. Eight nav links sit before any module control, so
          without this a keyboard user re-tabs the whole rail on every page. */}
      <a
        href="#dashboard-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-xl focus:bg-brand-700 focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-white"
      >
        Skip to content
      </a>

      <div className="lg:grid lg:grid-cols-[15.25rem_minmax(0,1fr)]">
        {/*
          The persistent rail. `hidden lg:flex` rather than conditional
          rendering, so it stays in the DOM across the breakpoint and a resize
          does not tear down and rebuild the nav.
        */}
        <DashboardSidebar
          user={user}
          school={schoolCard}
          variant="fixed"
          className="hidden lg:flex"
        />

        <div className="flex min-w-0 flex-col">
          <DashboardTopbar
            user={user}
            navOpen={drawerOpen}
            onOpenNav={() => setDrawerOpen(true)}
            school={schoolCard}
            term={term}
            smsCredit={smsCredit}
          />

          {/*
            `min-w-0` is load-bearing, not defensive: a grid child defaults to
            `min-width: auto`, so one wide table would push the whole column —
            and the viewport — sideways instead of scrolling inside it.
          */}
          <main id="dashboard-main" tabIndex={-1} className="min-w-0 flex-1 px-4 pb-16 pt-6 sm:px-6 lg:px-8">
            <div className="mx-auto w-full max-w-7xl">
              <Outlet />
            </div>
          </main>
        </div>
      </div>

      {/* The drawer is rendered only while open, so it cannot sit in the tab
          order behind the page it is covering. */}
      {drawerOpen && (
        <div className="lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setDrawerOpen(false)}
            className="fixed inset-0 z-40 cursor-default bg-ink/40 backdrop-blur-[2px]"
          />
          <div id="dashboard-nav-drawer">
            <DashboardSidebar
              user={user}
              school={schoolCard}
              variant="drawer"
              onClose={() => setDrawerOpen(false)}
              className="fixed inset-y-0 left-0 z-50 flex w-[15.25rem] max-w-[85vw]"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardLayout;
