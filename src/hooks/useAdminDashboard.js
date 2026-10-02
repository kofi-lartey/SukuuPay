import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getDashboardKpis, getRevenue } from '../services/admin';

/**
 * The platform console's Overview data.
 *
 * Two requests, issued **independently** rather than in one `Promise.all`:
 * `GET /admin/dashboard` for the standing figures and `GET /admin/revenue` for
 * the period card, and only when the operator actually changes the period.
 *
 * That is a deliberate departure from `useDashboardOverview`, which fires six
 * requests in a single `Promise.allSettled` and hand-merges them into one
 * synthetic object — a shape that exists because a previous version fell back to
 * invented figures whenever a request failed, and the fix for invented figures
 * was to make every failure look like zero. One call per card cannot do that: a
 * card that fails renders its own error and the other four cards are unaffected.
 *
 * `Promise.all` would couple them in exactly the wrong direction — one refused
 * call would blank the whole page, which is the school Overview's original
 * failure mode with a new endpoint list.
 *
 * Filters live in the query string and `reloadKey` is the invalidation handle,
 * matching `useUsers`: a filter is a URL, a refresh is a counter, and neither
 * duplicates the other's job.
 */
export const useAdminDashboard = (reloadKey = 0) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const period = searchParams.get('period') || 'all';

  const [kpis, setKpis] = useState({ data: null, loading: true, error: null });
  const [revenue, setRevenue] = useState({ data: null, loading: true, error: null });

  useEffect(() => {
    let active = true;
    setKpis((current) => ({ ...current, loading: true, error: null }));
    getDashboardKpis()
      .then((data) => active && setKpis({ data, loading: false, error: null }))
      .catch((error) => active && setKpis({ data: null, loading: false, error }));
    return () => {
      active = false;
    };
  }, [reloadKey]);

  useEffect(() => {
    let active = true;
    setRevenue({ data: null, loading: true, error: null });
    getRevenue({ period })
      .then((data) => active && setRevenue({ data, loading: false, error: null }))
      .catch((error) => active && setRevenue({ data: null, loading: false, error }));
    return () => {
      active = false;
    };
  }, [period, reloadKey]);

  /** Resets to page 1 — the one thing a changed filter must always do. */
  const setPeriod = useCallback(
    (next) => {
      setSearchParams(
        (current) => {
          const params = new URLSearchParams(current);
          if (!next || next === 'all') params.delete('period');
          else params.set('period', next);
          return params;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  return useMemo(
    () => ({ kpis, revenue, period, setPeriod }),
    [kpis, revenue, period, setPeriod]
  );
};

export default useAdminDashboard;