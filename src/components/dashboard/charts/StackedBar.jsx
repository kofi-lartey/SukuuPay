import React from 'react';

/**
 * A single stacked bar, used for the Payment Channels share.
 *
 * Renders as a flex row of proportional segments rather than a chart library:
 * it is one bar of three numbers, and a dependency for that would cost more in
 * bundle than the whole Overview page.
 *
 * `segments` are `{ key, label, value }`. Widths are percentages of the total,
 * so the bar always fills exactly — a channel with a 0.0% share gets a
 * hairline rather than disappearing, which matters because "no AT Money
 * payments this term" and "AT Money was filtered out" look identical otherwise.
 */
const StackedBar = ({ segments = [], className = '' }) => {
  const total = segments.reduce((sum, s) => sum + (Number(s.value) || 0), 0);
  if (!total) return null;

  return (
    <div className={`flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100 ${className}`}>
      {segments.map((segment) => {
        const share = ((Number(segment.value) || 0) / total) * 100;
        return (
          <div
            key={segment.key}
            className={segment.className || 'bg-slate-300'}
            style={{ width: `${Math.max(share, 1.5)}%` }}
            title={`${segment.label}: ${share.toFixed(1)}%`}
          />
        );
      })}
    </div>
  );
};

export default StackedBar;
