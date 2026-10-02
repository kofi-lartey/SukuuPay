import React, { useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CalendarRange } from 'lucide-react';
import ModuleTabs from '../../../components/dashboard/ModuleTabs';
import { ADMIN_ROUTES } from '../../../utils/constants';

/**
 * The sub-navigation between the four analytics screens.
 *
 * `ModuleTabs` rather than a row of `NavLink`s, and the reason is the one documented on
 * that component: the analytics screens are *routes*, so `NavLink`'s pathname matching
 * would light every tab at once — `/admin/analytics/revenue` is a prefix-match hit for
 * `/admin/analytics` — and four simultaneously-highlighted tabs is a wrong-`to` problem,
 * not a styling one. So the current screen is compared explicitly and the tab is a
 * button that navigates.
 *
 * It is still real keyboard navigation, which is what a person at a desk needs: every tab
 * is a `<button>` in the natural tab order, it carries `aria-current="page"` from
 * `ModuleTabs`, and Escape/Tab behave. Arrow-key roving focus would be a better widget
 * for a tab *panel*; this is a navigation bar over four separate pages, where Tab is the
 * expected interaction and arrow keys are not.
 *
 * The paths come from `ADMIN_ROUTES`, which already carries the three nested analytics
 * paths (`REVENUE_ANALYTICS`, `SCHOOLS_ANALYTICS`, `COLLECTION_RATE_ANALYTICS`) — no
 * path string is written inline anywhere in this folder.
 */
const TABS = [
  { value: ADMIN_ROUTES.ANALYTICS, label: 'Overview' },
  { value: ADMIN_ROUTES.REVENUE_ANALYTICS, label: 'Revenue' },
  { value: ADMIN_ROUTES.SCHOOLS_ANALYTICS, label: 'Schools' },
  { value: ADMIN_ROUTES.COLLECTION_RATE_ANALYTICS, label: 'Collection rate' },
];

/**
 * Which tab is current, matched on the pathname rather than on the index.
 *
 * Segment-aware, and `ADMIN_ROUTES.ANALYTICS` last rather than first: `/admin/analytics`
 * is the prefix of all three sub-paths, so a `startsWith` scan in TABS order would make
 * the sub-screen light the Overview tab as well.
 */
export const activeAnalyticsTab = (pathname) => {
  const exact = TABS.find((tab) => tab.value === pathname);
  if (exact) return exact.value;
  const nested = TABS.filter((tab) => tab.value !== ADMIN_ROUTES.ANALYTICS).find(
    (tab) => pathname.startsWith(`${tab.value}/`)
  );
  return nested ? nested.value : ADMIN_ROUTES.ANALYTICS;
};

const AnalyticsTabs = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const current = activeAnalyticsTab(pathname);

  return (
    <ModuleTabs
      items={TABS}
      value={current}
      onChange={(value) => navigate(value)}
      ariaLabel="Analytics section"
    />
  );
};

/**
 * The date window, as two labelled date inputs bound to the query string.
 *
 * **Empty means "ask the server for its default", and that is a real choice rather than
 * a missing feature.** Each of these endpoints documents a different default window —
 * 12 months for revenue, schools and collection rate (`resolveWindow(from, to, 365)`),
 * 30 days for usage — so the inputs are never pre-filled with a guess: a pre-filled date
 * that disagrees with the endpoint's default would put a filter on screen that the first
 * render quietly ignored. Leaving both blank sends nothing and the payload's own
 * `period` block is displayed underneath, so the reader can always see which window they
 * are looking at.
 *
 * `to` is widened to the end of the day server-side (`resolveDateRange`), so an operator
 * who picks "today" as `to` gets today rather than the first instant of it. Nothing to
 * work around here; it is stated because the payload's `period` reflects the widened end
 * and a reader comparing it against the date they typed would otherwise think they were
 * being fobbed off.
 *
 * Both inputs are `<label>`-bound rather than placeholder-labelled: a date input's
 * placeholder is empty in every browser, so a placeholder-only label is an unlabelled
 * control.
 */
const DateRangeField = ({ from, to, onChange, idPrefix = 'analytics' }) => {
  const set = useCallback(
    (key) => (event) => onChange(key, event.target.value),
    [onChange]
  );

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div>
        <label
          htmlFor={`${idPrefix}-from`}
          className="mb-0.5 flex items-center gap-1.5 text-[11px]/[15px] font-semibold text-slate-700"
        >
          <CalendarRange className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
          From
        </label>
        <input
          id={`${idPrefix}-from`}
          type="date"
          value={from || ''}
          onChange={set('from')}
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-3 text-[13px]/[18px] font-medium text-ink focus:border-brand-700 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/30"
        />
      </div>

      <div>
        <label
          htmlFor={`${idPrefix}-to`}
          className="mb-0.5 text-[11px]/[15px] font-semibold text-slate-700"
        >
          To
        </label>
        <input
          id={`${idPrefix}-to`}
          type="date"
          value={to || ''}
          onChange={set('to')}
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-3 text-[13px]/[18px] font-medium text-ink focus:border-brand-700 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/30"
        />
      </div>

      {/*
        Stated rather than inferred. A reader who has not touched either date is looking
        at whatever the endpoint chose, and "the last 12 months" is a choice somebody made
        — the screen should not be the only place it is invisible.
      */}
      <p className="text-[11px]/[16px] font-semibold text-slate-500 sm:col-span-2">
        Leave both empty for the endpoint&rsquo;s own default window. The window it applied is
        printed under the figures.
      </p>
    </div>
  );
};

export default AnalyticsTabs;
export { AnalyticsTabs, DateRangeField };
