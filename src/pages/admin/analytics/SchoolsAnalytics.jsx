import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Building2, RefreshCw, ServerCrash, Timer } from 'lucide-react';
import PageHeader from '../../../components/dashboard/PageHeader';
import Card from '../../../components/dashboard/ui/Card';
import Badge from '../../../components/dashboard/ui/Badge';
import EmptyState from '../../../components/dashboard/EmptyState';
import ProgressBar from '../../../components/dashboard/charts/ProgressBar';
import AnalyticsTabs, { DateRangeField } from './AnalyticsControls';
import { monthKeysBetween, periodAxisLabel, rateIsDefined } from './analyticsShared';
import { getSchoolsAnalytics } from '../../../services/admin';
import { ROUTES } from '../../../utils/constants';
import { formatCount, formatPercent } from '../../../utils/format';

/**
 * Signups, churn, activation and how long a new school takes to take its first payment.
 *
 * `GET /admin/analytics/schools`. Three of the four numbers here are about **who is
 * missing**, which is the whole difficulty of a signup funnel and the reason each is
 * rendered with its denominator:
 *
 *   - **Activation rate** is schools that completed onboarding ÷ schools created in the
 *     window. Schools that signed up and never onboarded are the denominator's entire
 *     point: excluding them describes only the schools that already succeeded
 *     (`analytics.service.js:934-936`).
 *
 *   - **Time to first payment** is computed **only over schools that have taken one**,
 *     and the endpoint censors the rest rather than counting them as zero
 *     (`analytics.service.js:866-899`). That is a real statistical decision with a
 *     direction: a school created nine days ago that has not paid has a time-to-first
 *     payment of *at least* nine and no upper bound this window can see, so including
 *     it as `0` would make onboarding look faster the more recently the cohort signed
 *     up — the exact inverse of the truth, and a bias that grows with the window.
 *     `firstPaymentCoveragePercent` is therefore shown beside the mean and the median,
 *     because it is the confidence interval nobody would otherwise have: on a young
 *     platform it is often small, and a mean over three schools is not a mean.
 *
 *   - **Churn** is inferred from `suspendedAt` / `subscription.cancelledAt` because the
 *     schema has no status history, so a school that churned and came back inside the
 *     window is indistinguishable from one that never churned. The endpoint says so in
 *     `churn.note` and the screen says it too.
 *
 * **The signups chart is derived here, and that is disclosed on it.**
 *
 * Unlike every other series in this console, `getSchoolsAnalytics` returns no time
 * series at all — it returns a roster of up to 200 school documents
 * (`analytics.service.js:959-973`). So the bars are counted in the browser from
 * `schools[].createdAt`, and two consequences are stated on the card rather than hidden:
 *
 *   - the roster is **capped at 200** and the response carries `schoolsTruncated`, which
 *     is rendered as a badge. A capped roster means the chart can undercount, and a
 *     chart that quietly undercounts is worse than no chart.
 *   - months with no signup are drawn as **zero bars**, from a calendar walk between the
 *     payload's own `period.from` and `period.to`. Same rule as the revenue series: a
 *     month that is omitted from the axis is indistinguishable from a month that did not
 *     happen, and on a signup chart that reads as steady acquisition.
 */
const SchoolsAnalytics = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [reloadKey, setReloadKey] = useState(0);

  const from = searchParams.get('from') || '';
  const to = searchParams.get('to') || '';

  const setFilter = useCallback(
    (key, value) => {
      setSearchParams(
        (current) => {
          const params = new URLSearchParams(current);
          if (!value) params.delete(key);
          else params.set(key, value);
          return params;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const [state, setState] = useState({ data: null, loading: true, error: null });

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: null }));
    getSchoolsAnalytics({ from, to })
      .then((data) => active && setState({ data, loading: false, error: null }))
      .catch((error) => active && setState({ data: null, loading: false, error }));
    return () => {
      active = false;
    };
  }, [from, to, reloadKey]);

  const data = state.data || {};
  const signups = data.signups || {};
  const ttft = data.timeToFirstPayment || {};

  /**
   * Signups per month, from the roster and the payload's own window.
   *
   * `monthKeysBetween` walks the calendar rather than the rows, so a month with no
   * signup is an explicit `0` and the axis keeps its spacing. Capped at 240 keys inside
   * the helper; a longer window than that is not a chart anybody reads, and the cap
   * cannot be reached silently because `period.from`/`to` bound the walk.
   */
  const monthly = useMemo(() => {
    const schools = Array.isArray(data.schools) ? data.schools : [];
    const counts = new Map();

    schools.forEach((school) => {
      const created = school.createdAt ? new Date(school.createdAt) : null;
      if (!created || Number.isNaN(created.getTime())) return;
      const key = `${created.getUTCFullYear()}-${String(created.getUTCMonth() + 1).padStart(2, '0')}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    const keys = data.period?.from && data.period?.to
      ? monthKeysBetween(data.period.from, data.period.to)
      : [...counts.keys()].sort();

    return keys.map((key) => ({ period: key, count: counts.get(key) || 0 }));
  }, [data.schools, data.period]);

  const chartMax = monthly.reduce((max, point) => Math.max(max, point.count), 0);
  const activationDefined = rateIsDefined(signups.activationRatePercent);
  const churnDefined = rateIsDefined(signups.churnRatePercent);

  return (
    <>
      <PageHeader
        eyebrow="Platform console"
        title="Signups and activation"
        description="Who joined, who completed onboarding, who left, and how long a new school takes to take its first payment."
        actions={
          <button
            type="button"
            onClick={() => setReloadKey((key) => key + 1)}
            disabled={state.loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[13px] font-extrabold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
          >
            <RefreshCw className={`h-4 w-4 ${state.loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            Refresh
          </button>
        }
      />

      <AnalyticsTabs />

      <Card padding="p-4">
        <DateRangeField from={from} to={to} onChange={setFilter} idPrefix="schools-analytics" />
      </Card>

      {state.error ? (
        <div className="mt-4">
          <EmptyState
            icon={ServerCrash}
            title="School analytics could not be loaded"
            description={state.error.message || 'The request did not complete.'}
            action={
              <button
                type="button"
                onClick={() => setReloadKey((key) => key + 1)}
                className="rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
              >
                Try again
              </button>
            }
          />
        </div>
      ) : state.loading ? (
        <div className="mt-4 space-y-4">
          <div className="h-32 animate-pulse rounded-2xl bg-slate-200/70" />
          <div className="h-72 animate-pulse rounded-2xl bg-slate-200/70" />
        </div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Card padding="p-5">
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                New schools
              </p>
              <p className="mt-2 text-[28px] font-extrabold leading-none tracking-tight text-ink">
                {formatCount(signups.newSchools)}
              </p>
              <p className="mt-1.5 text-[10px]/[15px] font-semibold text-slate-400">
                {data.period?.from
                  ? `${new Date(data.period.from).toLocaleDateString('en-GB')} – ${new Date(
                      data.period.to
                    ).toLocaleDateString('en-GB')}`
                  : 'Window not reported'}
              </p>
            </Card>

            <Card padding="p-5">
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                Churned
              </p>
              <p className="mt-2 text-[28px] font-extrabold leading-none tracking-tight text-ink">
                {formatCount(signups.churnedSchools)}
              </p>
              <p className="mt-1.5 text-[10px]/[15px] font-semibold text-slate-400">
                {churnDefined
                  ? `${formatPercent(signups.churnRatePercent)} of signups + churn in the window`
                  : 'No denominator — nothing to be a share of'}
              </p>
            </Card>

            <Card padding="p-5">
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                Net change
              </p>
              <p
                className={`mt-2 text-[28px] font-extrabold leading-none tracking-tight ${
                  Number(signups.netChange) < 0 ? 'text-red-600' : 'text-ink'
                }`}
              >
                {Number(signups.netChange) < 0 ? '' : '+'}
                {formatCount(signups.netChange)}
              </p>
              <p className="mt-1.5 text-[10px]/[15px] font-semibold text-slate-400">
                Signups minus churn, in this window
              </p>
            </Card>

            <Card padding="p-5">
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                Activation rate
              </p>
              <p className="mt-2 text-[28px] font-extrabold leading-none tracking-tight text-ink">
                {activationDefined ? formatPercent(signups.activationRatePercent) : '—'}
              </p>
              <p className="mt-1.5 text-[10px]/[15px] font-semibold text-slate-400">
                {activationDefined
                  ? `${formatCount(signups.activatedSchools)} of ${formatCount(signups.newSchools)} finished onboarding`
                  : 'No schools were created in this window, so there is no rate'}
              </p>
            </Card>
          </div>

          <Card padding="p-5" className="mt-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-[15px] font-extrabold tracking-tight text-ink">
                  Activation among schools created in this window
                </h2>
                <p className="mt-1 text-[12px]/[18px] font-medium text-slate-500">
                  Schools that signed up and never finished onboarding are in the
                  denominator. Without them this rate describes only the schools that
                  already succeeded.
                </p>
              </div>
            </div>

            <div className="mt-4">
              <ProgressBar
                value={signups.activationRatePercent || 0}
                label="Share of schools in this window that completed onboarding"
                barClassName={
                  activationDefined && signups.activationRatePercent < 40 ? 'bg-amber-500' : 'bg-brand-600'
                }
              />
              <div className="mt-2 flex flex-wrap items-baseline justify-between gap-3">
                <p className="text-[12px] font-extrabold text-ink">
                  {activationDefined ? formatPercent(signups.activationRatePercent) : '—'}
                </p>
                <p className="text-[11px] font-semibold text-slate-500">
                  {`${formatCount(signups.activatedSchools)} activated · ${formatCount(
                    signups.newSchools
                  )} created`}
                </p>
              </div>
            </div>

            {/*
              The field path is on the payload because it is the one thing about this
              number a reader is likely to be wrong about. The activation stamp lives
              *inside* `subscription`, not at the top level of the school document
              (`analytics.service.js:816-827` explains the schema history), so a reader
              checking the database for `onboardingCompletedAt` finds nothing and concludes
              the rate is broken. It is not; the query is right.
            */}
            {signups.activationFieldPath && (
              <p className="mt-3 text-[11px]/[16px] font-medium text-slate-400">
                {`Activation is read from `}
                <code className="font-mono font-bold text-slate-500">
                  {signups.activationFieldPath}
                </code>
                {`, which sits inside the school’s subscription block rather than at the top level of its document.`}
              </p>
            )}
          </Card>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card padding="p-5" className="lg:col-span-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-[15px] font-extrabold tracking-tight text-ink">
                    Signups over time
                  </h2>
                  <p className="mt-1 text-[12px]/[18px] font-medium text-slate-500">
                    Counted in the browser from the schools this endpoint returned, over the
                    window it applied. Months with no signup are drawn as zero.
                  </p>
                </div>
                {data.schoolsTruncated && <Badge tone="amber">Roster capped at 200</Badge>}
              </div>

              {monthly.length === 0 ? (
                <p className="mt-6 rounded-xl bg-slate-50 px-4 py-6 text-center text-[13px] font-semibold text-slate-500">
                  No schools were created in this window.
                </p>
              ) : (
                <div className="mt-5">
                  {/*
                    Bars rather than `AreaChart`'s line, for a reason that is specific to
                    this data: a signup count is a discrete event per month and it is
                    frequently zero. A smoothed monotone line through a series with real
                    zeros implies intermediate values that were never measured — the same
                    objection that stops the revenue chart interpolating, in a place where
                    the underlying series is only ever plotted at its own points.
                  */}
                  <div className="flex h-40 items-end gap-1" role="img" aria-label={`Signups per month. ${monthly
                    .map((point) => `${periodAxisLabel(point.period)}: ${point.count}`)
                    .join('. ')}.`}>
                    {monthly.map((point) => {
                      const height = chartMax ? (point.count / chartMax) * 100 : 0;
                      return (
                        <div
                          key={point.period}
                          className="group relative flex h-full flex-1 items-end"
                          title={`${periodAxisLabel(point.period)}: ${formatCount(point.count)} schools`}
                        >
                          {point.count > 0 ? (
                            <div
                              className="w-full rounded-t bg-brand-600 transition-[height] duration-300 group-hover:bg-brand-700"
                              style={{ height: `${Math.max(height, 2)}%` }}
                            />
                          ) : (
                            /*
                              A zero month is a one-pixel line on the baseline, not an
                              absent column: the period happened and produced nothing, and
                              the axis must say so. `StackedBar`'s 1.5% minimum does the
                              same job here for the same reason.
                            */
                            <div className="w-full rounded-t bg-slate-200" style={{ height: '2px' }} />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-[11px] font-bold text-slate-400">
                      {periodAxisLabel(monthly[0].period)}
                    </span>
                    <span className="text-[11px] font-extrabold text-slate-500">
                      {`peak ${formatCount(chartMax)}/month`}
                    </span>
                    <span className="text-[11px] font-bold text-slate-400">
                      {periodAxisLabel(monthly[monthly.length - 1].period)}
                    </span>
                  </div>
                </div>
              )}

              {data.schoolsTruncated && (
                <p className="mt-3 flex items-start gap-2 text-[11px]/[16px] font-semibold text-amber-700">
                  <Timer className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    The endpoint returns at most 200 schools and
                    {` ${formatCount(signups.newSchools)} signed up in this window, so this chart is a floor rather than a total. `}
                    The headline count above comes from a database aggregation and is exact.
                  </span>
                </p>
              )}
            </Card>

            <Card padding="p-5">
              <h2 className="text-[15px] font-extrabold tracking-tight text-ink">
                Time to first payment
              </h2>
              <p className="mt-1 text-[12px]/[18px] font-medium text-slate-500">
                From signup to the school&rsquo;s first completed payment.
              </p>

              <dl className="mt-4 space-y-3">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-[12px] font-semibold text-slate-500">Median</dt>
                  <dd className="text-[15px] font-extrabold tabular-nums text-ink">
                    {ttft.medianDays === null || ttft.medianDays === undefined
                      ? '—'
                      : `${ttft.medianDays} days`}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-[12px] font-semibold text-slate-500">Mean</dt>
                  <dd className="text-[15px] font-extrabold tabular-nums text-ink">
                    {ttft.meanDays === null || ttft.meanDays === undefined
                      ? '—'
                      : `${ttft.meanDays} days`}
                  </dd>
                </div>
              </dl>

              <div className="mt-4 rounded-xl bg-slate-50 p-3">
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  How much weight these carry
                </p>
                <p className="mt-1.5 text-[12px]/[18px] font-semibold text-slate-600">
                  {`${formatCount(ttft.schoolsWithAPayment)} of ${formatCount(
                    signups.newSchools
                  )} schools have taken a payment · ${formatPercent(ttft.firstPaymentCoveragePercent)} coverage`}
                </p>
                <p className="mt-2 text-[11px]/[16px] font-medium text-slate-500">
                  Schools that have not paid yet are <strong>excluded</strong>, not counted
                  as zero. A school created nine days ago has a time-to-first-payment of at
                  least nine with no upper bound this window can see, so counting it as
                  zero would make onboarding look faster the more recently the cohort joined.
                </p>
              </div>

              {ttft.note && (
                <p className="mt-3 text-[11px]/[16px] font-medium text-slate-400">{ttft.note}</p>
              )}
            </Card>
          </div>

          <Card padding="p-0" className="mt-4 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
              <div>
                <h2 className="text-[13px] font-extrabold text-ink">Schools in this window</h2>
                <p className="mt-0.5 text-[11px]/[16px] font-semibold text-slate-500">
                  Newest first, with the onboarding stamp and the first payment beside each.
                </p>
              </div>
              <Badge tone="slate">{formatCount((data.schools || []).length)} shown</Badge>
            </div>

            {(data.schools || []).length === 0 ? (
              <div className="p-5">
                <EmptyState
                  icon={Building2}
                  title="No schools created in this window"
                  description="Widen the date range, or clear both dates to use the endpoint's own default window."
                />
              </div>
            ) : (
              <div className="max-h-[28rem] overflow-auto">
                <table className="w-full min-w-[42rem] border-collapse text-left">
                  <caption className="sr-only">
                    Schools created in the selected window, with onboarding and first payment
                  </caption>
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b border-slate-100 bg-slate-50/95">
                      <th scope="col" className="px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        School
                      </th>
                      <th scope="col" className="px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        Signed up
                      </th>
                      <th scope="col" className="px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        Onboarding
                      </th>
                      <th scope="col" className="px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        First payment
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.schools || []).map((school) => (
                      <tr key={school.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                        <td className="px-5 py-3">
                          <Link
                            to={`${ROUTES.ADMIN_SCHOOLS}/${school.id}`}
                            className="text-[13px] font-extrabold text-ink underline-offset-2 hover:text-brand-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
                          >
                            {school.name}
                          </Link>
                          <span className="block text-[11px] font-semibold text-slate-400">
                            {school.region || 'No region'}
                            {school.plan ? ` · ${school.plan}` : ''}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-[12px] font-semibold text-slate-600">
                          {school.createdAt
                            ? new Date(school.createdAt).toLocaleDateString('en-GB')
                            : '—'}
                        </td>
                        <td className="px-5 py-3">
                          {school.onboardingCompletedAt ? (
                            <Badge tone="green">Completed</Badge>
                          ) : (
                            <Badge tone="amber">Not yet</Badge>
                          )}
                        </td>
                        <td className="px-5 py-3 text-[12px] font-semibold text-slate-600">
                          {school.firstPaymentAt
                            ? new Date(school.firstPaymentAt).toLocaleDateString('en-GB')
                            : 'None yet'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </>
  );
};

export default SchoolsAnalytics;
