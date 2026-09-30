import { useMemo } from 'react';
import { DEMO_OVERVIEW } from '../data/dashboardDemo';

/**
 * The Overview's single data seam.
 *
 * Everything the page renders comes from here, so moving the Overview from
 * fixtures to live data is a change to this file alone — not an edit threaded
 * through six cards and three chart components.
 *
 * `isDemo` is the load-bearing part of the contract. The design this page
 * follows carries a "LIVE SYNC ACTIVE" marker, and that marker must never be
 * able to appear over fixture data: a bursar reconciling GH₵ 318,000 against a
 * real bank statement cannot be told the screen is live when it is not. The page
 * reads this flag rather than hardcoding the marker, and disables the two header
 * actions that would otherwise export or record fiction.
 *
 * State is *initialised* from the data rather than fetched into it. The fixture
 * is a static import, so a `loading` round trip would be theatre — it would
 * paint a skeleton for one frame over data that is already in memory, and it
 * would make the page unrenderable on the server, where effects never run. When
 * the real service lands this becomes a genuine async hook again: initialise
 * `{ data: null, loading: true }`, fetch in an effect, and leave the rest of the
 * page untouched.
 */
export const useDashboardOverview = () => {
  const data = DEMO_OVERVIEW;
  const isDemo = true;

  /**
   * The weekly series, narrowed to one network.
   *
   * `all` sums nothing: each row carries an explicit `total` so the chart's last
   * point and the KPI headline are the same stored figure rather than one
   * computed and one remembered. See the reconciliation note in
   * `data/dashboardDemo.js`.
   */
  const seriesFor = useMemo(
    () => (channel) =>
      (data?.weeklyInflow || []).map((row) => ({
        label: row.week,
        value: channel === 'all' ? row.total : row[channel],
      })),
    [data]
  );

  return { data, loading: false, isDemo, error: null, seriesFor };
};

export default useDashboardOverview;
