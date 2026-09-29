import React, { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import SiteFooter from './SiteFooter';

/**
 * Resets scroll on navigation.
 *
 * The previous layout only ever swapped the `<Outlet>` child, so a visitor who
 * scrolled halfway down the homepage and clicked a nav link landed halfway down
 * the next page. `scroll-behavior: smooth` in index.css also turned the reset
 * into an animated lurch, so it is suppressed for the jump.
 */
const ScrollToTop = () => {
  const { pathname } = useLocation();

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

  return null;
};

/**
 * Application chrome: navbar, routed content, footer.
 *
 * This is mounted a single time above `<Routes>` rather than as a parent route
 * element. That distinction matters: the old `Layout` branched on
 * `pathname` and bailed out to a bare `<Outlet />` for the auth screens, so
 * navigating between the marketing pages and the login page unmounted and
 * rebuilt the entire header. Mounted here, the navbar and footer are never torn
 * down, so there is no flash, no lost scroll offset and no reset focus.
 */
const AppChrome = () => (
  <div className="flex min-h-screen flex-col bg-white">
    <ScrollToTop />
    <Navbar />
    <main className="flex-1">
      <Outlet />
    </main>
    <SiteFooter />
  </div>
);

export default AppChrome;
