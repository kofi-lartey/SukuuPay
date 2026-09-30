import React, { useId, useMemo, useState } from 'react';

/**
 * Fritsch–Carlson monotone cubic interpolation.
 *
 * The obvious way to draw a smooth line through points is Catmull-Rom, and it
 * is the wrong tool for money. Catmull-Rom overshoots: between a tall week and a
 * short one the curve bulges past both, so the chart shows a peak the school
 * never had and a trough below the axis. On a collections chart a bursar will
 * read that bulge as a real weekly figure.
 *
 * Monotone cubic solves the tangent for each point so the curve can never
 * reverse direction between two points it passes through. It is the standard
 * fix and it is what makes the smoothing safe to use here.
 */
const monotonePath = (points) => {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  // Secant slopes between consecutive points.
  const secants = points.slice(0, -1).map((p, i) => {
    const next = points[i + 1];
    return (next.y - p.y) / (next.x - p.x);
  });

  // Initial tangents, then the Fritsch–Carlson rule for the interior ones:
  // opposite-signed secants force the tangent to zero (that is the point where
  // the curve is allowed to turn), and otherwise it is the weighted harmonic
  // mean, which stays inside the neighbouring secants and so cannot overshoot.
  const tangents = new Array(points.length);
  tangents[0] = secants[0];
  tangents[points.length - 1] = secants[secants.length - 1];
  for (let i = 1; i < points.length - 1; i += 1) {
    const before = secants[i - 1];
    const after = secants[i];
    if (before * after <= 0) {
      tangents[i] = 0;
    } else {
      const w1 = 2 * (points[i + 1].x - points[i].x) + (points[i].x - points[i - 1].x);
      const w2 = (points[i + 1].x - points[i].x) + 2 * (points[i].x - points[i - 1].x);
      tangents[i] = (w1 + w2) / (w1 / before + w2 / after);
    }
  }

  // Hermite to Bezier: each segment is a cubic with control points a third of
  // the way along, displaced by the tangents.
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const h = (p1.x - p0.x) / 3;
    d += ` C ${p0.x + h} ${p0.y + tangents[i] * h}, ${p1.x - h} ${p1.y - tangents[i + 1] * h}, ${p1.x} ${p1.y}`;
  }
  return d;
};

/**
 * Collections area chart.
 *
 * Dependency-free SVG, matching the design: a smoothed green line over a fading
 * area, a dot per data point, dashed gridlines, and a callout on the peak.
 *
 * Two decisions worth stating:
 *
 * - It scales through `viewBox` with a fixed aspect, rather than measuring the
 *   container. A chart that needs a ResizeObserver re-renders on every resize
 *   and cannot be server-rendered; this one is a pure function of its props.
 *   The cost is that stroke widths scale too, which is why the stroke is
 *   expressed in viewBox units and the viewBox is close to real pixel size.
 *
 * - Pointer tracking maps client coordinates through the element's own bounding
 *   rect rather than assuming a scale factor, so the callout lands on the right
 *   point at any width. Hovering is an enhancement: the peak callout is rendered
 *   from props, so the chart says something useful before anyone touches it.
 */
const AreaChart = ({
  series = [],
  formatValue,
  formatAxis,
  peakIndex = -1,
  height = 260,
  className = '',
}) => {
  const gradientId = useId();
  const [hover, setHover] = useState(null);

  const width = 800;
  const pad = { top: 28, right: 16, bottom: 30, left: 16 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const { points, linePath, areaPath, ticks, max } = useMemo(() => {
    if (!series.length) {
      return { points: [], linePath: '', areaPath: '', ticks: [], max: 0 };
    }

    const values = series.map((d) => d.value);
    const rawMax = Math.max(...values, 0);
    // A flat series would divide by zero below; headroom on the real case keeps
    // the peak dot off the top edge, which is where the callout has to sit.
    const max = rawMax === 0 ? 1 : rawMax * 1.08;

    const pts = series.map((d, i) => ({
      x: pad.left + (series.length === 1 ? plotW / 2 : (i / (series.length - 1)) * plotW),
      y: pad.top + plotH - (d.value / max) * plotH,
      label: d.label,
      value: d.value,
    }));

    const line = monotonePath(pts);
    const area = `${line} L ${pts[pts.length - 1].x} ${pad.top + plotH} L ${pts[0].x} ${pad.top + plotH} Z`;

    // Four gridlines reads as a chart; five starts competing with the data.
    const gridCount = 4;
    const grid = Array.from({ length: gridCount + 1 }, (_, i) => {
      const ratio = i / gridCount;
      return {
        y: pad.top + plotH * (1 - ratio),
        value: max * ratio,
      };
    });

    return { points: pts, linePath: line, areaPath: area, ticks: grid, max };
  }, [series, plotH, plotW]);

  if (!series.length) {
    return (
      <div className={`flex items-center justify-center text-sm font-semibold text-slate-400 ${className}`}>
        No collection data for this period.
      </div>
    );
  }

  const activeIndex = hover ?? (peakIndex >= 0 ? peakIndex : -1);
  const active = activeIndex >= 0 ? points[activeIndex] : null;

  const onMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    // clientX → viewBox units. The rect already accounts for the CSS scaling, so
    // this stays correct at any rendered width.
    const vbX = ((event.clientX - rect.left) / rect.width) * width;
    const ratio = (vbX - pad.left) / plotW;
    const index = Math.round(ratio * (points.length - 1));
    setHover(Math.min(points.length - 1, Math.max(0, index)));
  };

  return (
    <div className={`relative ${className}`}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full touch-pan-y"
        role="img"
        aria-label={`Collections by week. ${series
          .map((d) => `${d.label}: ${formatValue(d.value)}`)
          .join(', ')}.`}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#12B76A" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#12B76A" stopOpacity="0.02" />
          </linearGradient>
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
            <text
              x={pad.left}
              y={tick.y - 6}
              fill="#94A3B8"
              fontSize="11"
              fontWeight="700"
            >
              {formatAxis ? formatAxis(tick.value) : tick.value}
            </text>
          </g>
        ))}

        <path d={areaPath} fill={`url(#${gradientId})`} />
        <path
          d={linePath}
          fill="none"
          stroke="#0F5132"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {points.map((p, i) => (
          <circle
            key={p.label}
            cx={p.x}
            cy={p.y}
            r={i === activeIndex ? 5 : 3.5}
            fill={i === activeIndex ? '#0F5132' : '#FFFFFF'}
            stroke="#0F5132"
            strokeWidth="2"
          />
        ))}

        {points.map((p, i) => (
          <text
            key={p.label}
            x={p.x}
            y={height - 8}
            textAnchor="middle"
            fill={i === activeIndex ? '#0F5132' : '#64748B'}
            fontSize="12"
            fontWeight={i === activeIndex ? '800' : '600'}
          >
            {p.label}
          </text>
        ))}
      </svg>

      {active && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-lg bg-ink px-2.5 py-1.5 text-[11px] font-extrabold text-white shadow-lift"
          style={{
            left: `${(active.x / width) * 100}%`,
            top: `${(active.y / height) * 100}%`,
            marginTop: '-8px',
          }}
        >
          {formatValue(active.value)}
        </div>
      )}
    </div>
  );
};

export { monotonePath };
export default AreaChart;
