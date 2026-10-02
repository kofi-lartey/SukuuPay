import React, { useMemo } from 'react';
import { Info } from 'lucide-react';
import Card from '../../../components/dashboard/ui/Card';
import AreaChart from '../../../components/dashboard/charts/AreaChart';
import { formatCedi, formatCediShort, formatCount } from '../../../utils/format';

/**
 * `GET /admin/revenue?period=…` plus `GET /admin/revenue/series` — platform revenue
 * for a chosen window, and its shape over time.
 *
 * **The trend is real, and that took an endpoint.** The card previously showed the
 * totals and an empty state explaining that a trend needed a platform-wide time
 * series — `GET /admin/revenue` returns aggregates and every `/api/analytics/*` route
 * is school-scoped, so nothing in the API could plot platform revenue. The
 * alternative was a curve through `mtdRevenue` and `ytdRevenue`, which is invented
 * data wearing a chart's clothes.
 *
 * **Gaps come back as zeros and are plotted as such.** The server's
 * `buildCalendarSeries` walks the calendar rather than mapping its aggregation rows,
 * so a month nobody paid is an explicit `0` and renders as a dip to the baseline
 * instead of a straight line across the hole. That distinction is the reason the
 * chart is trustworthy, so nothing here "smooths over" a zero — and `peakIndex` is
 * computed from the real maximum rather than assumed to be the last point.
 *
 * The period selector is in the URL (`?period=`), so a revenue window is linkable
 * and survives a reload — the same reason every other filter in the app lives in
 * the query string.
 */
const REVENUE_PERIODS = [
  { value: 'mtd', label: 'This month', bucket: 'day' },
  { value: 'last30', label: 'Last 30 days', bucket: 'day' },
  { value: 'ytd', label: 'This year', bucket: 'month' },
  { value: 'all', label: 'All time', bucket: 'month' },
];

/** `2026-03` → `Mar`, `2026-03-01` → `1 Mar`. The axis is a date, not an id. */
const axisLabel = (period, bucket) => {
  const [year, month, day] = period.split('-').map(Number);
  const monthName = new Date(year, month - 1, 1).toLocaleString('en-GB', { month: 'short' });
  return bucket === 'day' ? `${day} ${monthName}` : monthName;
};

const RevenueCard = ({ revenue, series, period, onPeriodChange, loading, seriesLoading, error }) => {
  const summary = revenue?.summary || {};
  const filters = revenue?.filters || {};

  // The active period decides the bucket, so "this month" and "last 30 days" are
  // daily and "this year"/"all time" are monthly. Chosen from the same table that
  // renders the buttons, so the two cannot disagree.
  const active = REVENUE_PERIODS.find((option) => option.value === period) || REVENUE_PERIODS[2];
  const bucket = active.bucket;

  const points = useMemo(() => {
    const rows = Array.isArray(series?.series) ? series.series : [];
    return rows.map((row) => ({ label: axisLabel(row.period, bucket), value: Number(row.totalRevenue) || 0 }));
  }, [series, bucket]);

  const peakIndex = useMemo(() => {
    if (points.length === 0) return -1;
    let best = 0;
    points.forEach((point, index) => {
      if (point.value > points[best].value) best = index;
    });
    return best;
  }, [points]);

  // A series where every point is zero is not a trend, and drawing a flat line along
  // the axis as though it were one is the same mistake as drawing a line through two
  // aggregates. It gets a sentence instead.
  const isFlat = points.length > 1 && points.every((point) => point.value === 0);

  return (
    <Card padding="p-5" className="flex flex-col">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[13px] font-extrabold leading-tight text-ink">Platform revenue</h2>
          <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
            Aggregated across every school
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Revenue period">
          {REVENUE_PERIODS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onPeriodChange(option.value)}
              aria-pressed={period === option.value}
              className={`rounded-lg px-2.5 py-1.5 text-[11px] font-extrabold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40 ${
                period === option.value
                  ? 'bg-brand-700 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <p className="mt-6 text-[13px] font-semibold text-red-600">
          {error.message || 'Platform revenue could not be loaded.'}
        </p>
      ) : loading ? (
        <div className="mt-6 space-y-3">
          <div className="h-9 w-56 animate-pulse rounded-lg bg-slate-200/70" />
          <div className="h-4 w-40 animate-pulse rounded bg-slate-200/70" />
        </div>
      ) : (
        <>
          <p className="mt-5 text-[28px] font-extrabold leading-none tracking-tight text-ink">
            {formatCedi(summary.totalRevenue)}
          </p>

          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
            <div>
              <dt className="text-[11px] font-semibold text-slate-500">Payments</dt>
              <dd className="text-[13px] font-extrabold text-ink">{formatCount(summary.totalPayments)}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold text-slate-500">Average payment</dt>
              <dd className="text-[13px] font-extrabold text-ink">{formatCedi(summary.avgPayment)}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold text-slate-500">Markup earned</dt>
              <dd className="text-[13px] font-extrabold text-brand-700">
                {formatCedi(summary.platformMarkupRevenue)}
              </dd>
            </div>
          </dl>

          {/*
            The chart, or the sentence saying why there isn't one.

            Two states are handled separately and neither is "no endpoint yet" any
            more: a flat series (real data, nothing collected in the window) and a
            missing one (the request failed or is still in flight). A failed request
            renders nothing at all here rather than an empty axis, because an axis
            with no points behind it reads as "revenue was zero" and is not the same
            fact.
          */}
          <div className="mt-auto border-t border-slate-100 pt-4">
            {seriesLoading && points.length === 0 ? (
              <div className="h-[180px] animate-pulse rounded-xl bg-slate-200/50" />
            ) : isFlat ? (
              <p className="flex items-start gap-2 text-[11px] font-semibold leading-relaxed text-slate-400">
                <Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>
                  No completed payments in this {bucket === 'day' ? 'window' : 'period'}. The figures
                  above are the same totals, not a missing reading.
                </span>
              </p>
            ) : points.length > 1 ? (
              <>
                <div className="mb-1 flex items-center justify-between gap-3">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                    Collected per {bucket === 'day' ? 'day' : 'month'}
                  </span>
                  <span className="text-[11px] font-extrabold text-ink">
                    {formatCediShort(series?.totals?.totalRevenue)}
                  </span>
                </div>
                <AreaChart
                  series={points}
                  formatValue={(value) => formatCedi(value)}
                  formatAxis={(value) => formatCediShort(value)}
                  peakIndex={peakIndex}
                />
                <p className="mt-2 text-[10px] font-semibold text-slate-400">
                  A month or day with no completed payment is shown as zero, not omitted.
                </p>
              </>
            ) : null}
          </div>

          {filters.period ? (
            <p className="mt-3 text-[10px] font-semibold text-slate-400">
              Server applied period <code className="font-mono">{filters.period}</code>, bucket{' '}
              <code className="font-mono">{bucket}</code>.
            </p>
          ) : null}
        </>
      )}
    </Card>
  );
};

export default RevenueCard;