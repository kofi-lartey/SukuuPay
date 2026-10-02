import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RefreshCw, ServerCrash } from 'lucide-react';
import PageHeader from '../../../components/dashboard/PageHeader';
import Card from '../../../components/dashboard/ui/Card';
import Badge from '../../../components/dashboard/ui/Badge';
import EmptyState from '../../../components/dashboard/EmptyState';
import StackedBar from '../../../components/dashboard/charts/StackedBar';
import AnalyticsTabs, { DateRangeField } from './AnalyticsControls';
import RevenueSplitChart from './RevenueSplitChart';
import { revenueTypeClass, revenueTypeColour, revenueTypeLabel, revenueTypesOf } from './analyticsShared';
import { getRevenueAnalytics } from '../../../services/admin';
import { formatCedi, formatCediShort, formatCount, formatPercent } from '../../../utils/format';

/**
 * Revenue over time, **split by source**.
 *
 * `GET /admin/analytics/revenue`. The split is the entire reason this screen exists: a
 * platform owner's revenue question is "where does the money come from", and one
 * undifferentiated line cannot answer it. If markup is 90% of revenue then subscription
 * churn is a rounding error and the subscription product is a rounding error; if it is
 * 30% then it is the business. The same total looks like two different companies.
 *
 * Four decisions, each of which is a way to be wrong here:
 *
 *   - **`groupBy` is sent explicitly and is a `select`, not a toggle the server
 *     guesses at.** 30 daily points and 24 monthly points are different charts, and the
 *     screen states which one it is showing. The server's own default is `month`
 *     (`admin.analytics.validation.js:60`) while `admin.js` types the parameter's default
 *     as `day` — an ambiguity that only shows up as "why is this chart not what I asked
 *     for", so the value here is never left to either default.
 *
 *   - **The source list comes from the response, not from a constant.** See
 *     `revenueTypesOf` in `analyticsShared.js`: the server derives its keys from
 *     `PLATFORM_REVENUE_TYPES`, which has five members, and a client hard-coded to four
 *     would silently drop the fifth.
 *
 *   - **Reversals are shown, not netted into a period.** The endpoint reports negative
 *     entries of income types separately as `totals.reversalAmount`
 *     (`analytics.service.js:786`). Folding them into the month they were posted would
 *     restate a period that has already been reported, so they are named below the
 *     totals with their own label — a correction belongs next to the thing it corrects.
 *
 *   - **`truncated` is surfaced.** A daily request over two years is capped at 400 points
 *     and the response says `truncated: true` (`buildGapFreeSeries`). A chart that stops
 *     early without saying so is a chart that ends mid-year and looks complete.
 *
 * Filters live in `useSearchParams`, so a window an owner pasted into a support thread is
 * a URL that opens the same chart, and any filter change returns to the first period
 * implicitly — there is no page control here, so there is nothing to reset.
 */
const GROUPINGS = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

const RevenueAnalytics = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [reloadKey, setReloadKey] = useState(0);

  const from = searchParams.get('from') || '';
  const to = searchParams.get('to') || '';
  const groupBy = searchParams.get('groupBy') || '';

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
    // `groupBy` is always sent, never omitted, so the screen's selector and the request
    // cannot disagree about the chart's shape.
    getRevenueAnalytics({ from, to, groupBy: groupBy || 'month' })
      .then((data) => active && setState({ data, loading: false, error: null }))
      .catch((error) => active && setState({ data: null, loading: false, error }));
    return () => {
      active = false;
    };
  }, [from, to, groupBy, reloadKey]);

  const data = state.data || {};
  const totals = data.totals || {};
  const effectiveGroupBy = data.groupBy || groupBy || 'month';

  const types = useMemo(() => revenueTypesOf(totals.byType), [totals.byType]);

  const points = useMemo(() => {
    const series = Array.isArray(data.series) ? data.series : [];
    return series.map((point) => ({
      period: point.period,
      total: Number(point.total) || 0,
      byType: point.byType || {},
    }));
  }, [data.series]);

  const shareSegments = useMemo(
    () =>
      types.map((type, index) => ({
        key: type,
        label: revenueTypeLabel(type),
        value: Number(totals.byType?.[type]) || 0,
        className: revenueTypeClass(type, index),
      })),
    [types, totals.byType]
  );

  const allZero = points.length > 0 && points.every((point) => point.total === 0);

  return (
    <>
      <PageHeader
        eyebrow="Platform console"
        title="Revenue by source"
        description="What SukuuPay itself earned, split by where it came from. Every figure is a ledger entry — not a parent payment."
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
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <DateRangeField from={from} to={to} onChange={setFilter} idPrefix="revenue-analytics" />

          <div>
            <div
              className="mb-0.5 text-[11px]/[15px] font-semibold text-slate-700"
              id="revenue-group-label"
            >
              Group each period by
            </div>
            <div
              className="flex flex-wrap gap-1.5"
              role="group"
              aria-labelledby="revenue-group-label"
            >
              {GROUPINGS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFilter('groupBy', option.value)}
                  aria-pressed={(groupBy || 'month') === option.value}
                  className={`rounded-lg px-3 py-2 text-[12px] font-extrabold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40 ${
                    (groupBy || 'month') === option.value
                      ? 'bg-brand-700 text-white shadow-lift'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px]/[16px] font-semibold text-slate-500">
              Thirty daily points and twelve monthly points are different charts, so this is
              sent explicitly rather than left to a default.
            </p>
          </div>
        </div>
      </Card>

      {state.error ? (
        <div className="mt-4">
          <EmptyState
            icon={ServerCrash}
            title="Revenue analytics could not be loaded"
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
          <div className="h-80 animate-pulse rounded-2xl bg-slate-200/70" />
        </div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Card padding="p-5" accent>
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                Total platform revenue
              </p>
              <p className="mt-2 text-[28px] font-extrabold leading-none tracking-tight text-ink">
                {formatCediShort(totals.total)}
              </p>
              <p className="mt-1.5 text-[10px]/[15px] font-semibold text-slate-400">
                {`${formatCount(totals.entries)} ledger entries`}
              </p>
            </Card>

            <Card padding="p-5">
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                Settled
              </p>
              <p className="mt-2 text-[28px] font-extrabold leading-none tracking-tight text-ink">
                {formatCediShort(totals.settledAmount)}
              </p>
              <p className="mt-1.5 text-[10px]/[15px] font-semibold text-slate-400">
                Entries whose disbursement has settled
              </p>
            </Card>

            <Card padding="p-5">
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                Periods covered
              </p>
              <p className="mt-2 text-[28px] font-extrabold leading-none tracking-tight text-ink">
                {formatCount(points.length)}
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
                Reversals
              </p>
              <p className="mt-2 text-[28px] font-extrabold leading-none tracking-tight text-ink">
                {formatCediShort(totals.reversalAmount)}
              </p>
              <p className="mt-1.5 text-[10px]/[15px] font-semibold text-slate-400">
                {`${formatCount(totals.reversalEntries)} negative entries, reported not netted`}
              </p>
            </Card>
          </div>

          <Card padding="p-5" className="mt-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-[15px] font-extrabold tracking-tight text-ink">
                  Revenue stacked by source
                </h2>
                <p className="mt-1 text-[12px]/[18px] font-medium text-slate-500">
                  {`One column per ${effectiveGroupBy}, split into the sources that made it up. Hover a column for its breakdown.`}
                </p>
              </div>
              {data.truncated && (
                <Badge tone="amber">
                  {`Showing ${formatCount(points.length)} of ${formatCount(data.periodsAvailable || points.length)} periods`}
                </Badge>
              )}
            </div>

            {/*
              An all-zero series is not a chart and must not be drawn as one. It is real
              data — nothing was earned in this window — so it gets a sentence rather than
              a flat line along the axis, which would read as "steady" rather than "none".
            */}
            {allZero ? (
              <p className="mt-6 rounded-xl bg-slate-50 px-4 py-6 text-center text-[13px] font-semibold text-slate-500">
                Every period in this window returned zero. The series is gap-free by
                contract, so these are explicit zeros — no revenue was earned, rather than
                the reading being missing.
              </p>
            ) : (
              <div className="mt-4">
                <RevenueSplitChart points={points} types={types} />
              </div>
            )}

            <p className="mt-3 text-[10px]/[16px] font-semibold text-slate-400">
              A period with no ledger entries is drawn as an empty column at zero. It is
              never omitted, because a line drawn across the omission would present a month
              of no revenue as steady growth.
            </p>
          </Card>

          <Card padding="p-5" className="mt-4">
            <h2 className="text-[15px] font-extrabold tracking-tight text-ink">
              Totals per source
            </h2>
            <p className="mt-1 text-[12px]/[18px] font-medium text-slate-500">
              The whole window, so the share bar and the chart above are two views of one
              set of numbers.
            </p>

            {Number(totals.total) > 0 && (
              <div className="mt-4">
                {/*
                  `StackedBar` unmodified: this is the shape it was written for — a single
                  proportional bar of segments — and the per-segment `title` it already
                  renders gives the share on hover for free. The per-source table below
                  carries the cedi figures, because a bar can show a share but not an
                  amount.
                */}
                <StackedBar segments={shareSegments} />
                <div className="mt-3 space-y-1.5">
                  {shareSegments.map((segment, index) => (
                    <div
                      key={segment.key}
                      className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-sm"
                          style={{ background: revenueTypeColour(segment.key, index) }}
                          aria-hidden="true"
                        />
                        <span className="text-[13px] font-extrabold text-ink">{segment.label}</span>
                        <code className="font-mono text-[10px] font-bold text-slate-400">
                          {segment.key}
                        </code>
                      </span>
                      <span className="flex items-baseline gap-3">
                        <span className="text-[13px] font-extrabold tabular-nums text-ink">
                          {formatCedi(segment.value)}
                        </span>
                        <span className="w-14 text-right text-[11px] font-bold tabular-nums text-slate-500">
                          {formatPercent(totals.shareByType?.[segment.key])}
                        </span>
                        <span className="w-16 text-right text-[11px] font-semibold text-slate-400">
                          {`${formatCount(totals.entriesByType?.[segment.key])} entries`}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.note && (
              <p className="mt-4 text-[11px]/[16px] font-medium leading-relaxed text-slate-500">
                {data.note}
              </p>
            )}
          </Card>

          {/*
            MRR and ARR are deliberately absent from this screen.

            `revenue.monthlyFee` on a school is a recurring rate and `subscriptions`
            collected inside a window is a flow; ARR is `MRR × 12`
            (`analytics.service.js:642`). Rendering `subscriptions × 12` under an "ARR"
            heading would be arithmetically valid, semantically wrong, and exactly the
            kind of number that gets quoted in a board deck with the framing left behind
            in a comment. The subscription *income in this window* is already the
            `subscription` segment of the totals above, and the recurring figures belong
            on the Platform Overview, which carries them with the projection sentence
            attached.
          */}
        </>
      )}
    </>
  );
};

export default RevenueAnalytics;
