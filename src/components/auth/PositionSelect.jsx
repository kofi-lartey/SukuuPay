import React from 'react';
import { ChevronDown } from 'lucide-react';
import { OTHER_POSITION, POSITIONS } from '../../utils/constants';

/**
 * Job title, as a select with an "Other" escape hatch.
 *
 * Picking "Other" reveals a text field *alongside* rather than instead of the
 * select, so a user who starts typing and then realises their title is on the
 * list has not lost what they wrote. Both stay editable until they pick one.
 *
 * The value handed upward is always a concrete title — the sentinel never escapes
 * this component. That matters because the sentinel is a UI affordance, not a job
 * title, and `User.position` is an unconstrained string that would otherwise store
 * the literal word "OTHER".
 *
 * The options come from `POSITIONS`, a curated list rather than an enum. Schools
 * have titles this list has never heard of, and a hard enum would force a bursar
 * into a wrong answer or a support ticket to get their own job title recorded.
 */
const PositionSelect = ({
  value,
  otherValue,
  onChange,
  onOtherChange,
  error = '',
  touched = false,
  disabled = false,
  name = 'position',
}) => {
  const showManual = value === OTHER_POSITION;

  const errorText = touched ? error : '';

  return (
    <div>
      <label
        htmlFor={`${name}-select`}
        // Matches `Label` in components/common/FormField.jsx (P4 compact sizing).
        // These classes were hand-rolled; without this the position select would
        // sit 9px taller than every neighbouring field in the same grid row.
        className="mb-0.5 flex items-center gap-1.5 text-[11px]/[15px] font-bold text-ink"
      >
        Position <span className="text-red-500" aria-hidden="true">*</span>
      </label>

      <div className="relative">
        <select
          id={`${name}-select`}
          name={`${name}-select`}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          aria-required="true"
          aria-invalid={errorText ? 'true' : undefined}
          aria-describedby={errorText ? `${name}-error` : undefined}
          className={`w-full appearance-none rounded-lg border bg-white px-4 py-2 pr-10 text-[13px]/[18px] font-semibold text-ink transition-colors focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:bg-slate-50 ${
            errorText ? 'border-red-300' : 'border-slate-200 focus:border-brand-700 focus-visible:ring-brand-700/30'
          }`}
        >
          {POSITIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <ChevronDown
          className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          aria-hidden="true"
        />
      </div>

      {/* Revealed, not switched. Keeps the typed value when the user navigates
          back to a listed option, which a swap would discard silently. */}
      {showManual && (
        <div className="mt-2.5">
          <label htmlFor={`${name}-other`} className="sr-only">
            Enter your position
          </label>
          <input
            id={`${name}-other`}
            name={`${name}-other`}
            type="text"
            // Focused on reveal so the user can type straight away; the select
            // staying put means Escape or backspacing is not a dead end.
            autoFocus
            maxLength={80}
            disabled={disabled}
            value={otherValue}
            onChange={(event) => onOtherChange(event.target.value)}
            placeholder="e.g. Deputy Headmaster, Bursar, PTA Chair"
            aria-required="true"
            className={`w-full rounded-lg border bg-white px-4 py-2 text-[13px]/[18px] font-semibold text-ink transition-colors focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:bg-slate-50 ${
              errorText
                ? 'border-red-300'
                : 'border-slate-200 focus:border-brand-700 focus-visible:ring-brand-700/30'
            }`}
          />
        </div>
      )}

      {errorText && (
        <p id={`${name}-error`} role="alert" className="mt-1.5 text-[12px] font-semibold text-red-600">
          {errorText}
        </p>
      )}
    </div>
  );
};

export default PositionSelect;
