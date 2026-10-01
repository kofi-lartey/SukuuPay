import React from 'react';
import Card from '../dashboard/ui/Card';
import { formatCediShort, formatCount, formatPercent } from '../../utils/format';

/**
 * The school's plan health, as one bar.
 *
 * Four mutually exclusive bands across a fixed width, which makes it the fastest
 * read on the page: a glance tells a bursar whether the term is in trouble before
 * any number is parsed. That is worth a whole component, and it is why the
 * filter pills to its right are *counts* and this is *proportions* — the table
 * below is for the named families, this is for the shape of the problem.
 *
 * **The bar is width-normalised to the three buckets, not to the active total.**
 * A school with 40 completed plans and 160 active ones should not see its
 * completed plans as a fifth of the health: that is the failure mode of dividing
 * by `totalPlans`, and it is why the server sends `activePlans` and
 * `complianceRate` as separate figures rather than leaving the client to divide
 * the two counts it already has.
 *
 * The target marker is a *goal*, not a status: a school at 96% shows a marker
 * fully covered and says so, and a school at 81% shows the gap. Rendering the
 * target as though it were a fourth band would imply the shortfall is a category
 * of family rather than the part of the bar that has not reached it.
 */

const BANDS = [
  { key: 'onTrack', countKey: 'onTrack', valueKey: 'onTrackValue', label: 'On Track', bar: 'bg-brand-700', dot: 'bg-brand-700' },
  { key: 'approachingDue', countKey: 'approachingDue', valueKey: 'approachingDueValue', label: 'Approaching', bar: 'bg-amber-400', dot: 'bg-amber-400' },
  { key: 'overdue', countKey: 'overdue', valueKey: 'overdueValue', label: 'In Default', bar: 'bg-red-600', dot: 'bg-red-600' },
];

const TARGET_COMPLIANCE = 95;

const PlanHealthBar = ({ summary, activeFilter, onFilter, loading }) => {
  const active = summary?.activePlans ?? 0;
  const rate = summary?.complianceRate;
  const hasRate = rate !== null && rate !== undefined;

  const segments = BANDS.map((band) => ({
    ...band,
    count: summary?.[band.countKey] ?? 0,
    value: summary?.[band.valueKey] ?? 0,
    // Proportion of the *active* plans. Guarded against a zero denominator: an
    // empty school renders an empty bar, not a NaN-width one.
    share: active ? ((summary?.[band.countKey] ?? 0) / active) * 100 : 0,
  }));

  return (
    <Card padding="p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-extrabold tracking-tight text-ink">Schoolwide Plan Health</h2>
          <p className="mt-0.5 text-[12px] font-medium text-slate-500">
            Real-time status aggregate across all active grade tiers
          </p>
        </div>

        {/* Counts, not proportions — so clicking one filters the table below to
            exactly the families the band is made of. A band that filters to
            something other than what it depicts is worse than no band. */}
        <div
          role="group"
          aria-label="Filter plans by health"
          className="inline-flex flex-wrap items-center gap-1 rounded-xl bg-slate-100 p-1"
        >
          <FilterPill
            active={activeFilter === 'all'}
            onClick={() => onFilter('all')}
            label={`All Plans (${formatCount(active)})`}
          />
          {BANDS.map((band) => (
            <FilterPill
              key={band.key}
              active={activeFilter === band.key}
              onClick={() => onFilter(band.key)}
              label={`${band.label} (${formatCount(summary?.[band.countKey] ?? 0)})`}
            />
          ))}
        </div>
      </div>

      <div className="mt-5">
        {active === 0 && !loading ? (
          <p className="text-[12px] font-semibold text-slate-500">
            No active plans yet. Create one from a student with an outstanding balance and
            this bar starts to fill.
          </p>
        ) : (
          <>
            <div
              className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100"
              role="img"
              aria-label={
                segments
                  .map((segment) => `${segment.label} ${Math.round(segment.share)}%`)
                  .join(', ')
              }
            >
              {segments.map((segment) =>
                segment.count > 0 ? (
                  <span
                    key={segment.key}
                    className={`${segment.bar} transition-[width] duration-300`}
                    style={{ width: `${segment.share}%` }}
                  />
                ) : null
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5">
              {segments.map((segment) => (
                <span
                  key={segment.key}
                  className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600"
                >
                  <span className={`h-2 w-2 rounded-full ${segment.dot}`} aria-hidden="true" />
                  {Math.round(segment.share)}% {segment.label} ({formatCediShort(segment.value)})
                </span>
              ))}

              <span className="ml-auto text-[11px] font-semibold text-slate-500">
                Target Compliance: {TARGET_COMPLIANCE}%
                {hasRate && (
                  <span className={rate >= TARGET_COMPLIANCE ? ' text-emerald-600' : ' text-slate-600'}>
                    {' '}
                    &middot; now {formatPercent(rate)}
                  </span>
                )}
              </span>
            </div>
          </>
        )}
      </div>
    </Card>
  );
};

const FilterPill = ({ active, onClick, label }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={`rounded-lg px-3 py-1.5 text-[11px] font-extrabold transition-colors ${
      active
        ? 'bg-white text-ink shadow-sm'
        : 'text-slate-600 hover:bg-white/60'
    }`}
  >
    {label}
  </button>
);

export default PlanHealthBar;
