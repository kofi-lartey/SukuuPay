import React, { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';
import AdminTopbar from './AdminTopbar';
import ImpersonationBanner from './ImpersonationBanner';
import { useAuth } from '../../context/AuthContext';

/**
 * The platform console shell.
 *
 * A sibling of `DashboardLayout`, not a child, and the reason is the same one
 * that keeps the marketing navbar off the school console: an authenticated
 * operator working through a module has no use for the surrounding site. It also
 * cannot be nested *inside* `DashboardLayout`, because that shell binds to a
 * school — the overview hook, the school card in the rail, the school-scoped SMS
 * pill — and a `super_admin` has `schoolId: null` by design. It would mount a
 * school console around a platform admin and read "Your school" forever.
 *
 * Everything structural is copied from `DashboardLayout` on purpose, including
 * the parts that look like trivia: the grid is two real columns rather than a
 * fixed sidebar with negative-margin escapes; the rail is `hidden lg:flex` rather
 * than conditionally rendered so a resize does not tear down and rebuild the nav;
 * the content column is `min-w-0` so one wide table scrolls inside it instead of
 * pushing the viewport sideways; and the mobile drawer is the *same* sidebar
 * component, so a module cannot behave differently once the viewport shrinks.
 *
 * What is absent is as deliberate as what is present. There is no overview hook
 * here — `DashboardLayout` calls `useDashboardOverview`, which fires six requests
 * in one `Promise.allSettled` and hand-merges them; the console's Overview owns
 * its own single call instead, and the shell stays free of data fetching entirely.
 */
const AdminLayout = () => {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Navigating with the drawer open must close it, or it hangs over the module
  // the user just asked for. Same rule as the school console's drawer.
  useEffect(() => setDrawerOpen(false), [pathname]);

  /*
   * Scroll reset on module change, repeated here for the reason
   * `DashboardLayout` repeats it: this shell is not inside `AppChrome`, so
   * nobody else resets the scroll for it, and an operator who scrolled halfway
   * down a long schools table and clicked Content would otherwise land halfway
   * down Content — which looks like a page that failed to load its top.
   *
   * `index.css` sets `scroll-behavior: smooth`, which would turn the reset into
   * an animated lurch, so it is suppressed for the jump exactly as elsewhere.
   */
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
      {/* First tab stop. Five nav entries sit before any module control. */}
      <a
        href="#admin-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-xl focus:bg-brand-700 focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-white"
      >
        Skip to content
      </a>

      <div className="lg:grid lg:grid-cols-[15.25rem_minmax(0,1fr)]">
        <AdminSidebar variant="fixed" className="hidden lg:flex" />

        <div className="flex min-w-0 flex-col">
          <AdminTopbar
            user={user}
            pathname={pathname}
            navOpen={drawerOpen}
            onOpenNav={() => setDrawerOpen(true)}
          />

          {/*
            One banner for the whole console, above the content and below the
            header.

            Rendered here rather than in each page because it is a property of the
            *session*, not of any screen, and a per-page banner would flash on every
            navigation — a flashing warning is a warning people stop reading.
            `sticky top-16` pins it under the 4rem header, so it stays in view down
            a long payments table, which is exactly where an operator stops
            remembering they are in someone else's school.
          */}
          <ImpersonationBanner />

          {/*
            `min-w-0` is load-bearing, not defensive: a grid child defaults to
            `min-width: auto`, so one wide table would push the whole column — and
            the viewport — sideways instead of scrolling inside it. The platform
            schools table has more columns than any in the school console, so it
            is the likeliest place in the app for that to bite.
          */}
          <main id="admin-main" tabIndex={-1} className="min-w-0 flex-1 px-4 pb-16 pt-6 sm:px-6 lg:px-8">
            <div className="mx-auto w-full max-w-7xl">
              <Outlet />
            </div>
          </main>
        </div>
      </div>

      {/* Rendered only while open, so it cannot sit in the tab order behind the
          page it is covering. */}
      {drawerOpen && (
        <div className="lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setDrawerOpen(false)}
            className="fixed inset-0 z-40 cursor-default bg-ink/40 backdrop-blur-[2px]"
          />
          <div id="admin-nav-drawer">
            <AdminSidebar
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

export default AdminLayout;