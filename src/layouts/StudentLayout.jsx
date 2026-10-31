import React, { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import ScrollToTop from '../components/layout/ScrollToTop';
import ErrorBoundary from '../components/common/ErrorBoundary';
import LegalLinks from '../components/common/LegalLinks';
import StudentSidebar from '../components/student/StudentSidebar';
import StudentTopBar from '../components/student/StudentTopBar';
import StudentBottomNav from '../components/student/StudentBottomNav';
import { useAuth } from '../context/AuthContext';

const ErrorBoundaryResetOnChange = ({ routeKey, children }) => (
  <ErrorBoundary key={routeKey} label="This page">
    {children}
  </ErrorBoundary>
);

const StudentLayout = () => {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => setDrawerOpen(false), [pathname]);

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
      <a
        href="#student-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-xl focus:bg-brand-700 focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-white"
      >
        Skip to content
      </a>
      <ScrollToTop />
      <div className="lg:grid lg:grid-cols-[15.25rem_minmax(0,1fr)]">
        <StudentSidebar user={user} variant="fixed" className="hidden lg:flex" />
        <div className="flex min-w-0 flex-col">
          <StudentTopBar user={user} navOpen={drawerOpen} onOpenNav={() => setDrawerOpen(true)} />
          <main id="student-main" tabIndex={-1} className="min-w-0 flex-1 px-4 pb-20 pt-6 sm:px-6 lg:px-8 lg:pb-8">
            <div className="mx-auto w-full max-w-7xl">
              <ErrorBoundaryResetOnChange routeKey={pathname}>
                <Outlet context={{ user }} />
              </ErrorBoundaryResetOnChange>
            </div>
          </main>
          <div className="border-t border-slate-200 px-4 py-4 sm:px-6 lg:px-8">
            <LegalLinks className="justify-center" />
          </div>
        </div>
      </div>
      {drawerOpen && (
        <div className="lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setDrawerOpen(false)}
            className="fixed inset-0 z-40 cursor-default bg-ink/40 backdrop-blur-[2px]"
          />
          <div id="student-nav-drawer">
            <StudentSidebar
              user={user}
              variant="drawer"
              onClose={() => setDrawerOpen(false)}
              className="fixed inset-y-0 left-0 z-50 flex w-[15.25rem] max-w-[85vw]"
            />
          </div>
        </div>
      )}
      <StudentBottomNav />
    </div>
  );
};

export default StudentLayout;
