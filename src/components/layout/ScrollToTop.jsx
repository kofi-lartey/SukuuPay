import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Resets scroll on navigation.
 *
 * The other layouts in the app each carry a copy of this effect (AppChrome,
 * DashboardLayout, AdminLayout) and the portal needs the same one the moment it
 * grows a second page: a parent who reads to the bottom of the attendance log
 * and taps Fees in the tab bar should land at the top of the fee card, not at
 * the bottom of a page they have never seen. Inherited here rather than
 * re-invented at the call site, because the smooth-scroll suppression is the
 * part nobody remembers to write twice.
 *
 * ## Keyed on the pathname, not the search
 *
 * `/pay/:token/history` redirects to `/fees?tab=receipts`, and the query string
 * is state — a parent switching tabs inside the fees page should keep their
 * place in the receipts list. Only a new *page* resets.
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

export default ScrollToTop;
