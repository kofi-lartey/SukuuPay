import React, { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import loadingController from './loadingController';

/**
 * Shows the global loader on every navigation.
 *
 * React Router's own data transitions (`useTransition`/lazy) are not used here,
 * so there is no router event to hook — a `<Link>` click re-renders
 * synchronously and the new page's `useEffect` fetch starts immediately. That
 * means the loader has to be armed *before* the navigation settles, from the
 * click itself, and released when the new route's first request completes.
 *
 * So this listens for `pathname` changes and arms the loader on change, using
 * `immediate` because the click already told the user something is happening —
 * a 250ms "are you sure?" delay before the loader on a click reads as a dead
 * link. The corresponding release comes from the axios interceptor when the new
 * page's fetch resolves, or from the poll below if the route needs no data.
 *
 * Two guards keep it from misbehaving:
 *
 *  - **The first render is skipped.** Mounting fires `useLocation` with the
 *    initial route, and `main.jsx` already owns the startup loader; arming a
 *    second one here would immediately double-show.
 *  - **Only pathname changes count, not search/hash.** A `?page=2` on a list
 *    or a `#section` toggle is a smaller, in-page action whose own request
 *    already shows the loader; re-showing it from here would restart the fade
 *    and make the page jump.
 *
 * Why the release is a poll rather than a one-shot timer
 * ------------------------------------------------------
 * The counter is shared, so this component cannot tell its own contribution
 * apart from an in-flight request's — it can only see the total. A one-shot
 * `hide()` would be wrong in both directions: it releases a navigation whose
 * route has no data, but it also dismisses the loader while a slow request
 * (a cold start on a hosted backend can take tens of seconds) is still the
 * reason the user is waiting.
 *
 * So every second it asks one question — *is the navigation's own contribution
 * the only thing left?* — and releases only when the answer is yes. A
 * data-free route releases on the first tick; a page whose fetch completes
 * releases on the tick after that; a slow request holds it open until the
 * request itself finishes. There is no timeout at which the loader is
 * abandoned while a request is genuinely still running.
 */
const RELEASE_POLL_MS = 1000;

function RouteChangeLoader({ children }) {
  const location = useLocation();
  const previousPathRef = useRef(location.pathname);
  const pollTimerRef = useRef(null);

  useEffect(() => {
    const previousPath = previousPathRef.current;
    previousPathRef.current = location.pathname;

    // Same route (or the very first render): nothing to announce.
    if (previousPath === location.pathname) return undefined;

    const stopPolling = () => {
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };

    loadingController.show({ immediate: true, source: `navigate ${location.pathname}` });

    const poll = () => {
      // Stop as soon as the loader is no longer on screen — either it already
      // faded out, or its own counter ran dry before this poll could fire.
      const { status } = loadingController.getState();
      if (status === 'idle') {
        stopPolling();
        return;
      }

      // > 1 means a request beyond this navigation's own contribution is still
      // in flight, so it owns the release and this must stay out of the way.
      if (loadingController.pending() <= 1) {
        loadingController.hide(true);
        stopPolling();
        return;
      }

      pollTimerRef.current = setTimeout(poll, RELEASE_POLL_MS);
    };

    pollTimerRef.current = setTimeout(poll, RELEASE_POLL_MS);

    return stopPolling;
  }, [location.pathname]);

  return <>{children}</>;
}

export default RouteChangeLoader;