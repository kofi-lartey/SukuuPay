import React, { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import ScrollToTop from '../components/layout/ScrollToTop';
import ErrorBoundary from '../components/common/ErrorBoundary';
import LegalLinks from '../components/common/LegalLinks';
import TeacherSidebar from '../components/teacher/TeacherSidebar';
import TeacherTopBar from '../components/teacher/TeacherTopBar';
import TeacherBottomNav from '../components/teacher/TeacherBottomNav';
import { useAuth } from '../context/AuthContext';

/**
 * Keying on the pathname rather than remounting by hand: React unmounts the
 * subtree when the key changes, which discards the error state. Copied from
 * `DashboardLayout` rather than shared, because the two shells are deliberately
 * independent — but *not having it* was a divergence with a cost: a throw in one
 * teacher module used to blank the whole portal, rail included, with no way to
 * navigate out.
 */
const ErrorBoundaryResetOnChange = ({ routeKey, children }) => (
  <ErrorBoundary key={routeKey} label="This page">
    {children}
  </ErrorBoundary>
);

/**
 * The teacher shell.
 *
 *   ┌────────────────────────────┐
 *   │ rail │      top bar        │
 *   │      ├─────────────────────┤
 *   │      │      main           │
 *   │      │    (max-w-7xl)      │
 *   └────────────────────────────┘
 *              bottom bar (mobile)
 *
 * ## This is the school console's shell, token for token
 *
 * The teacher portal used to be a parallel design rather than a sibling of the
 * one a bursar sees: its own background (`#F7F9F8`), its own rail width (`248px`),
 * its own content width (`1200px`), and — the divergence everything else followed
 * from — Tailwind's built-in `sky` palette, which appears nowhere else in the
 * product. A teacher who also holds a school-admin account crossed between two
 * apps that looked like two companies.
 *
 * So every shell token now matches `DashboardLayout` exactly: `bg-slate-50`, a
 * `15.25rem` grid column, `max-w-7xl` content, and `brand-700` as the accent.
 * The three deltas that remain are the three this portal genuinely needs:
 *
 *   - `pb-20 lg:pb-8` on `main`, to clear the fixed bottom bar that the console
 *     does not have.
 *   - The rail's own routes and the wordmark's target — a teacher's rail goes to
 *     the teacher dashboard, not to `ROUTES.HOME`.
 *   - The bottom block holds this teacher's identity and settings rather than the
 *     school card.
 *
 * ## The mobile drawer
 *
 * Same shape as the console's: a hamburger in the topbar, the rail as an overlay
 * at `w-[15.25rem]`, a dismissable backdrop, and Escape to close. Without it the
 * rail was `hidden lg:flex` and could never be opened on a phone at all — the
 * teacher portal had no navigation below 1024px except the five-tab bottom bar.
 */
const TeacherLayout = () => {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Navigating with the drawer open must close it, or it hangs over the module
  // the teacher just asked for. Mirrors `DashboardLayout`.
  useEffect(() => setDrawerOpen(false), [pathname]);

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
      {/* First tab stop. The nav links sit before any module control, so without
          this a keyboard user re-tabs the whole rail on every page. */}
      <a
        href="#teacher-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-xl focus:bg-brand-700 focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-white"
      >
        Skip to content
      </a>

      <ScrollToTop />

      <div className="lg:grid lg:grid-cols-[15.25rem_minmax(0,1fr)]">
        <TeacherSidebar user={user} variant="fixed" className="hidden lg:flex" />

        <div className="flex min-w-0 flex-col">
          <TeacherTopBar user={user} navOpen={drawerOpen} onOpenNav={() => setDrawerOpen(true)} />

          {/*
            `min-w-0` is load-bearing, not defensive: a grid child defaults to
            `min-width: auto`, so one wide register would push the whole column —
            and the viewport — sideways instead of scrolling inside it.
          */}
          <main
            id="teacher-main"
            tabIndex={-1}
            className="min-w-0 flex-1 px-4 pb-20 pt-6 sm:px-6 lg:px-8 lg:pb-8"
          >
            <div className="mx-auto w-full max-w-7xl">
              <ErrorBoundaryResetOnChange routeKey={pathname}>
                {/*
                  No role check here, deliberately. `TeacherGuard` decides who gets
                  into `/teacher` at all, and this layout is mounted *inside* that
                  route — so a non-teacher never reaches this component, which means
                  the shell never has to defend itself.
                */}
                <Outlet context={{ user }} />
              </ErrorBoundaryResetOnChange>
            </div>
          </main>

          {/*
            The console has no `SiteFooter` — a product footer with marketing
            navigation does not belong inside a signed-in school — but the legal
            documents still have to be reachable from here. Same pair, same reason.
          */}
          <div className="border-t border-slate-200 px-4 py-4 sm:px-6 lg:px-8">
            <LegalLinks className="justify-center" />
          </div>
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
          <div id="teacher-nav-drawer">
            <TeacherSidebar user={user} variant="drawer" onClose={() => setDrawerOpen(false)} className="fixed inset-y-0 left-0 z-50 flex w-[15.25rem] max-w-[85vw]" />
          </div>
        </div>
      )}

      <TeacherBottomNav />
    </div>
  );
};

export default TeacherLayout;
