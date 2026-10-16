import React, { forwardRef, useId } from 'react';

/**
 * A time picker control.
 *
 * Renders a native `<input type="time">`, so the browser's own time selector
 * (clock face on mobile, hh:mm spinner on desktop) is used instead of a
 * free-text field. The value is a `HH:mm` string, which is exactly what the
 * backend's period `startTime`/`endTime` strings are stored as.
 *
 * Follows the same tree-stability rule as `Field`: the label, input and
 * trailing slot always render in the same positions so focus survives a
 * re-render.
 */
const baseControl =
  'w-full rounded-lg border border-slate-200 bg-white py-2 text-[13px]/[18px] font-medium text-ink transition-colors focus:border-brand-700 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/30 disabled:bg-slate-50 disabled:text-slate-400';

const errorControl = 'border-red-300 focus:border-red-500 focus-visible:ring-red-500/30';

const Label = ({ htmlFor, children, hint }) => (
  <div className="mb-0.5 flex items-baseline justify-between gap-3">
    <label
      htmlFor={htmlFor}
      className="text-[11px]/[15px] font-semibold text-slate-700"
    >
      {children}
    </label>
    {hint && (
      <span className="shrink-0 text-[10px]/[14px] font-medium text-slate-500">
        {hint}
      </span>
    )}
  </div>
);

export const TimeField = forwardRef(
  (
    {
      label,
      hint,
      error,
      className = '',
      disabled,
      required,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const controlId = props.id || generatedId;

    return (
      <div className={className}>
        <Label htmlFor={controlId} hint={hint}>{label}</Label>
        <div className="relative">
          <input
            ref={ref}
            id={controlId}
            type="time"
            aria-invalid={error ? 'true' : undefined}
            disabled={disabled}
            required={required}
            className={`${baseControl} pl-3 pr-9 ${
              error ? errorControl : ''
            }`}
            {...props}
          />
          <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500">
            {props.trailing || null}
          </span>
        </div>
        {error && (
          <p className="mt-1 text-[11px] font-semibold text-red-600">{error}</p>
        )}
      </div>
    );
  }
);

TimeField.displayName = 'TimeField';

export default TimeField;
