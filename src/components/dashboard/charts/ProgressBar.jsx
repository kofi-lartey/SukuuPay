import React from 'react';

/**
 * A determinate progress bar for the collection rate.
 *
 * `role="progressbar"` with the real ARIA values, because this figure is read by
 * a bursar reconciling a target rather than by a sighted glance alone — a
 * screen reader should be able to answer "how far along is collection?" without
 * the bar.
 */
const ProgressBar = ({ value = 0, label, className = '', barClassName = 'bg-brand-600' }) => {
  const percent = Math.min(100, Math.max(0, Number(value) || 0));

  return (
    <div className={className}>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2 w-full overflow-hidden rounded-full bg-slate-200"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${barClassName}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
};

export default ProgressBar;
