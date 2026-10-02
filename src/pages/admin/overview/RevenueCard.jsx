import React from 'react';
import { ChartColumn, Info } from 'lucide-react';
import Card from '../../../components/dashboard/ui/Card';
import { formatCedi, formatCount } from '../../../utils/format';

/**
 * `GET /admin/revenue?period=…` — platform revenue for a chosen window.
 *
 * **Totals only, and that is the honest shape of the data.** `getRevenue` returns
 * a `summary`; there is no platform time series behind it. All ten
 * `/api/analytics/*` endpoints are school-scoped (`analytics.routes.js:47-112` —
 * every path ends `/:schoolId`), so `revenue-chart` can plot one school and not
 * the platform.
 *
 * That is why the chart slot below is an **empty state with the reason in it**
 * rather than a chart. The tempting move is to plot `mtdRevenue` and `ytdRevenue`
 * as two points and call it a trend; a curve through two aggregates is invented
 * data, and this codebase has already shipped a page that read as measurement
 * while being decoration. `GET /admin/revenue/series` would fix it properly.
 *
 * The period selector is in the URL (`?period=`), so a revenue window is
 * linkable and survives a reload — the same reason every other filter in the app
 * lives in the query string.
 */
const REVENUE_PERIODS = [
  { value: 'all', label: 'All time' },
  { value: 'last30', label: 'Last 30 days' },
  { value: 'mtd', label: 'This month' },
  { value: 'ytd', label: 'This year' },
];

const RevenueCard = ({ revenue, period, onPeriodChange, loading, error }) => {
  const summary = revenue?.summary || {};
  const filters = revenue?.filters || {};

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
            The empty state is load-bearing and states its own cause. A chart that
            is missing because no endpoint exists looks identical to a chart that
            failed to load unless the copy says which, and "a trend chart is coming"
            is the difference between a reviewer filing it and a reviewer assuming
            this card is finished.
          */}
          <div className="mt-auto border-t border-slate-100 pt-4">
            <p className="flex items-start gap-2 text-[11px] font-semibold leading-relaxed text-slate-400">
              <Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>
                A revenue trend needs a platform-wide time series. The analytics endpoints are
                school-scoped, so{' '}
                <code className="rounded bg-slate-100 px-1 font-mono text-[10px] text-slate-500">
                  GET /admin/revenue/series
                </code>{' '}
                does not exist yet — and a curve drawn through these totals would be invented.
                {filters.period ? ` Showing ${filters.period}.` : ''}
              </span>
            </p>
          </div>
        </>
      )}
    </Card>
  );
};

export default RevenueCard;