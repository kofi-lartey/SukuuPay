import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getDashboardKpis, getRevenue, getRevenueSeries } from '../services/admin';

/**
 * The bucket a period is charted at.
 *
 * Kept beside the period list rather than in `RevenueCard`, because two files
 * choosing a granularity independently is how the buttons and the request end up
 * disagreeing — the card would label the axis "per month" while the server was
 * asked for days.
 */
export const bucketForPeriod = (period) =>
  period === 'mtd' || period === 'last30' ? 'day' : 'month';

/**
 * The platform console's Overview data.
 *
 * Three requests, issued **independently** rather than in one `Promise.all`:
 * `GET /admin/dashboard` for the standing figures, `GET /admin/revenue` for the
 * period's totals, and `GET /admin/revenue/series` for its shape.
 *
 * That is a deliberate departure from `useDashboardOverview`, which fires six
 * requests in a single `Promise.allSettled` and hand-merges them into one
 * synthetic object — a shape that exists because a previous version fell back to
 * invented figures whenever a request failed, and the fix for invented figures
 * was to make every failure look like zero. One call per card cannot do that: a
 * card that fails renders its own error and the other two cards are unaffected.
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
  const period = searchParams.get('period') || 'ytd';

  const [kpis, setKpis] = useState({ data: null, loading: true, error: null });
  const [revenue, setRevenue] = useState({ data: null, loading: true, error: null });
  const [series, setSeries] = useState({ data: null, loading: true, error: null });

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

  // The series is a third request rather than a field on the revenue response,
  // because it is a different shape of answer — a chart, not a set of totals — and
  // a card that needs both should fail independently on each. A failed chart leaves
  // the totals above it intact, which is the whole point of issuing them separately.
  useEffect(() => {
    let active = true;
    setSeries({ data: null, loading: true, error: null });
    getRevenueSeries({ period, bucket: bucketForPeriod(period) })
      .then((data) => active && setSeries({ data, loading: false, error: null }))
      .catch((error) => active && setSeries({ data: null, loading: false, error }));
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
          if (!next || next === 'ytd') params.delete('period');
          else params.set('period', next);
          return params;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  return useMemo(
    () => ({ kpis, revenue, series, period, setPeriod }),
    [kpis, revenue, series, period, setPeriod]
  );
};

export default useAdminDashboard;