import React, { useId, useMemo, useState } from 'react';
import {
  periodAxisLabel,
  periodFullLabel,
  revenueTypeColour,
  revenueTypeLabel,
} from './analyticsShared';
import { formatCedi, formatCediShort } from '../../../utils/format';

/**
 * Platform revenue over time, **stacked by source**.
 *
 * Hand-rolled SVG in the same shape as `charts/AreaChart.jsx` — `viewBox` scaling rather
 * than a ResizeObserver, dashed gridlines, `formatCedi` on the labels — and it exists
 * because neither shipped chart can draw this one:
 *
 *   - `AreaChart` takes a single `series` of `{label, value}` and draws one monotone line
 *     and one gradient under it. A second series would overwrite the first, and even if
 *     it did not, four overlapping translucent areas are not a stack: they hide each
 *     other and their sum is unreadable.
 *   - `charts/StackedBar.jsx` *is* a stacked bar, but it is **one bar** — a single
 *     proportional bar of `{key, label, value}` segments, built for the Payment Channels
 *     share. It has no time axis and no stacking logic, so it cannot become a chart over
 *     periods without being a different component wearing its name.
 *
 * `StackedBar` is used instead for the *period total* share, one level up in
 * `RevenueAnalytics`, which is exactly the shape it was written for. The conventions
 * permit "these or an SVG chart in the same shape"; this is that, and the reason it was
 * necessary is recorded here rather than left as a mystery.
 *
 * **Zeros are drawn as nothing, and that is not a gap.**
 *
 * A period the ledger reports as `0` in every source produces an empty column sitting on
 * the baseline — visibly "nothing happened", which is the truth. Two things are
 * deliberately *not* done, because both would turn that into a false picture:
 *
 *   - no segment is given a minimum height. A 1.5px hairline on a zero segment is the
 *     trick `StackedBar` uses so that "0.0% share" is distinguishable from "filtered out";
 *     in a column whose *height* is the figure, a hairline would draw revenue that was
 *     never earned.
 *   - no zero column is dropped from the series. The server emits explicit zeros by
 *     contract (`buildGapFreeSeries`), and skipping them here would leave the remaining
 *     columns evenly spaced across the axis with no hint that time passed between them —
 *     a month of nothing would render identically to no month at all.
 *
 * `AreaChart`'s monotone interpolation is deliberately *not* reused. Smoothing is
 * acceptable between two measured points and unacceptable through an explicit zero,
 * because a curve that dips to the baseline and comes back is a claim about a shape the
 * data does not have; straight-edged columns make each period's figure individually
 * readable.
 */
const RevenueSplitChart = ({ points = [], types = [], height = 280 }) => {
  const clipId = useId();
  const [hover, setHover] = useState(null);

  const width = 800;
  const pad = { top: 28, right: 16, bottom: 34, left: 16 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const { max, ticks, columns, empty } = useMemo(() => {
    if (!points.length) return { max: 0, ticks: [], columns: [], empty: true };

    const rawMax = Math.max(...points.map((p) => Number(p.total) || 0), 0);
    // Headroom so the tallest column does not touch the top edge, which is where the
    // gridline labels sit. A flat all-zero series divides by zero without it.
    const ceiling = rawMax === 0 ? 1 : rawMax * 1.1;

    const slot = plotW / points.length;
    const barW = Math.max(2, Math.min(slot * 0.72, 44));

    const built = points.map((point, index) => {
      const centreX = pad.left + slot * index + slot / 2;
      const byType = point.byType || {};
      let cursor = 0;

      // Bottom-up in `types` order, so the biggest source (markup, first in the ordering
      // in `analyticsShared.js`) sits on the baseline and the small ones read as slices
      // of it rather than as a second baseline of their own.
      const segments = types.map((type, typeIndex) => {
        const value = Number(byType[type]) || 0;
        if (value <= 0) return null;
        const y0 = pad.top + plotH - (cursor / ceiling) * plotH;
        cursor += value;
        const y1 = pad.top + plotH - (cursor / ceiling) * plotH;
        return {
          type,
          label: revenueTypeLabel(type),
          value,
          colour: revenueTypeColour(type, typeIndex),
          y: y1,
          height: Math.max(y0 - y1, 0.5),
        };
      }).filter(Boolean);

      return {
        index,
        period: point.period,
        total: Number(point.total) || 0,
        segments,
        x: centreX - barW / 2,
        width: barW,
        centreX,
      };
    });

    const gridCount = 4;
    const grid = Array.from({ length: gridCount + 1 }, (_, i) => ({
      y: pad.top + plotH * (1 - i / gridCount),
      value: ceiling * (i / gridCount),
    }));

    return { max: ceiling, ticks: grid, columns: built, empty: false };
  }, [points, types, plotH, plotW]);

  if (empty) {
    return (
      <div className="flex items-center justify-center py-14 text-sm font-semibold text-slate-400">
        No revenue analytics for this period.
      </div>
    );
  }

  const active = hover === null ? null : columns[hover];

  // X labels are thinned rather than rotated: a 400-point daily series cannot carry 400
  // labels, and overlapping text is less readable than fewer labels. The hovered column
  // names its own period in full, so the thinning never hides what is being looked at.
  const labelStride = Math.max(1, Math.ceil(columns.length / 8));

  const onMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = ((event.clientX - rect.left) / rect.width) * width;
    const slot = plotW / columns.length;
    const index = Math.floor((ratio - pad.left) / slot);
    setHover(index < 0 || index >= columns.length ? null : index);
  };

  const summary = `Platform revenue by source. ${points
    .map(
      (point) =>
        `${periodFullLabel(point.period)}: ${formatCedi(
          types.reduce((sum, type) => sum + (Number(point.byType?.[type]) || 0), 0)
        )}`
    )
    .join('. ')}.`;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full touch-pan-y"
        role="img"
        aria-label={summary}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          {/*
            A hit rectangle rather than a per-column `<rect>` handler: `onMouseMove` on
            one full-width surface means the hover target is the column the pointer is
            over even in the gaps between two narrow daily bars, which a per-column
            target would silently miss.
          */}
          <clipPath id={clipId}>
            <rect x={pad.left} y={pad.top} width={plotW} height={plotH} />
          </clipPath>
        </defs>

        {ticks.map((tick) => (
          <g key={tick.y}>
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={tick.y}
              y2={tick.y}
              stroke="#E2E8F0"
              strokeWidth="1"
              strokeDasharray="4 5"
            />
            <text x={pad.left} y={tick.y - 6} fill="#94A3B8" fontSize="11" fontWeight="700">
              {formatCediShort(tick.value)}
            </text>
          </g>
        ))}

        <g clipPath={`url(#${clipId})`}>
          {columns.map((column) => (
            <g key={column.period}>
              {column.segments.map((segment) => (
                <rect
                  key={segment.type}
                  x={column.x}
                  y={segment.y}
                  width={column.width}
                  height={segment.height}
                  fill={segment.colour}
                  opacity={hover === null || hover === column.index ? 1 : 0.45}
                >
                  <title>{`${periodFullLabel(column.period)} · ${segment.label}: ${formatCedi(segment.value)}`}</title>
                </rect>
              ))}
            </g>
          ))}
        </g>

        {columns.map((column, index) =>
          index % labelStride === 0 ? (
            <text
              key={column.period}
              x={column.centreX}
              y={height - 10}
              textAnchor="middle"
              fill={hover === index ? '#0F5132' : '#64748B'}
              fontSize="11"
              fontWeight={hover === index ? '800' : '600'}
            >
              {periodAxisLabel(column.period)}
            </text>
          ) : null
        )}
      </svg>

      {/*
        The breakdown for one period, as HTML rather than another SVG overlay: it has to
        be selectable text for a screen reader, and it sits below the chart rather than
        on it so it cannot cover the columns it is describing.
      */}
      {active && (
        <div className="mt-3 rounded-xl bg-slate-50 p-3">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
            {periodFullLabel(active.period)}
          </p>
          <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
            {active.segments.length === 0 ? (
              <p className="text-[12px] font-semibold text-slate-500">
                No ledger entries in this period — shown as zero, not omitted.
              </p>
            ) : (
              active.segments.map((segment) => (
                <div key={segment.type} className="flex items-baseline justify-between gap-3">
                  <dt className="flex items-center gap-1.5 text-[12px] font-bold text-slate-600">
                    <span
                      className="h-2 w-2 shrink-0 rounded-sm"
                      style={{ background: segment.colour }}
                      aria-hidden="true"
                    />
                    {segment.label}
                  </dt>
                  <dd className="text-[12px] font-extrabold tabular-nums text-ink">
                    {formatCedi(segment.value)}
                  </dd>
                </div>
              ))
            )}
          </dl>
          <p className="mt-2 text-[11px] font-extrabold text-slate-500">
            Total {formatCedi(active.total)}
          </p>
        </div>
      )}
    </div>
  );
};

export default RevenueSplitChart;
