import React, { forwardRef, useId, useState } from 'react';
import { ChevronDown, Eye, EyeOff } from 'lucide-react';

/**
 * Form controls.
 *
 * ## The one rule that matters here
 *
 * Every control below renders **the same element tree on every render**.
 * Only props and class names change; never structure. React compares
 * element types and positions, not props, when deciding whether to
 * reconcile or remount — so as long as the `<input>` sits at the same
 * position in the tree on every render, React updates the existing DOM
 * node in place.
 *
 * This is what keeps focus through a keystroke. The old version passed
 * `{...props}` and, in some wrappers, conditionally swapped a `<div>` for
 * a `<span>` or reordered siblings. When the parent re-rendered with a
 * new value, the tree shifted, React remounted the input, and the caret
 * vanished. Every version here is written so that cannot happen.
 *
 * ## Why `forwardRef`
 *
 * Callers need to focus a field programmatically (the invite dialog
 * focuses the email input on open). Without `forwardRef` the ref would
 * land on the wrapper `<div>` and focusing it would do nothing.
 *
 * ## Why `useId` and not a `key`
 *
 * React's `useId()` gives a stable id across renders — the label's
 * `htmlFor` and the input's `id` are the same on every render, so the
 * `<label>` never points at a node that just disappeared. Do not replace
 * this with a `key={value}` (a common shortcut that would break focus)
 * or with `Math.random()` (which changes every render and would defeat
 * the entire point of this file).
 */

// Compact control sizing. `py-2` + explicit line-height gives a 36px
// control. Under 44px is below iOS HIG but this is a dense admin form,
// not a mobile tap target; the fields are still comfortably above
// WCAG 2.5.8's 24px floor.
const baseControl =
  'w-full rounded-lg border border-slate-200 bg-white py-2 text-[13px]/[18px] font-medium text-ink placeholder:font-normal placeholder:text-slate-500 transition-colors focus:border-brand-700 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/30 disabled:bg-slate-50 disabled:text-slate-400';

const errorControl = 'border-red-300 focus:border-red-500 focus-visible:ring-red-500/30';

// ─────────────────────────────────────────────────────────────────────────────
// Label
// ─────────────────────────────────────────────────────────────────────────────

const Label = ({ htmlFor, children, hint, required = false }) => (
  <div className="mb-0.5 flex items-baseline justify-between gap-3">
    <label
      htmlFor={htmlFor}
      className="text-[11px]/[15px] font-semibold text-slate-700"
    >
      {children}
      {required && <span className="ml-0.5 text-red-600">*</span>}
    </label>
    {hint && (
      <span className="shrink-0 text-[10px]/[14px] font-medium text-slate-500">
        {hint}
      </span>
    )}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Field
// ─────────────────────────────────────────────────────────────────────────────

export const Field = forwardRef(
  (
    {
      label,
      hint,
      icon: Icon,
      error,
      trailing,
      className = '',
      type = 'text',
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const controlId = props.id || generatedId;

    // Only passwords get the show/hide toggle. Any other type renders the
    // toggle slot as `null` — the wrapper around it stays, so the tree is
    // structurally identical regardless of type.
    const isPassword = type === 'password';
    const [showPassword, setShowPassword] = useState(false);
    const effectiveType = isPassword && showPassword ? 'text' : type;

    return (
      <div className={className}>
        <Label htmlFor={controlId} hint={hint} required={props.required}>
          {label}
        </Label>
        <div className="relative">
          {Icon && (
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
          )}
          <input
            ref={ref}
            id={controlId}
            type={effectiveType}
            aria-invalid={error ? 'true' : undefined}
            className={`${baseControl} ${Icon ? 'pl-9' : 'pl-3'} pr-9 ${error ? errorControl : ''
              }`}
            {...props}
          />
          {/* Trailing slot is always rendered so the input's `pr-9` is
              always justified. If the slot is empty, nothing shows. */}
          <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500">
            {isPassword && !trailing ? (
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="text-slate-400 transition-colors hover:text-slate-700"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            ) : (
              trailing || null
            )}
          </span>
        </div>
        {error && (
          <p className="mt-1 text-[11px] font-semibold text-red-600">{error}</p>
        )}
      </div>
    );
  }
);
Field.displayName = 'Field';

// ─────────────────────────────────────────────────────────────────────────────
// SelectField
// ─────────────────────────────────────────────────────────────────────────────

export const SelectField = forwardRef(
  ({ label, hint, icon: Icon, error, children, className = '', ...props }, ref) => {
    const generatedId = useId();
    const controlId = props.id || generatedId;

    return (
      <div className={className}>
        <Label htmlFor={controlId} hint={hint} required={props.required}>
          {label}
        </Label>
        <div className="relative">
          {Icon && (
            <span className="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center pl-3 text-slate-500">
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
          )}
          <select
            ref={ref}
            id={controlId}
            aria-invalid={error ? 'true' : undefined}
            className={`${baseControl} cursor-pointer appearance-none pr-9 ${Icon ? 'pl-9' : 'pl-3'
              } ${error ? errorControl : ''}`}
            {...props}
          >
            {children}
          </select>
          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500">
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </span>
        </div>
        {error && (
          <p className="mt-1 text-[11px] font-semibold text-red-600">{error}</p>
        )}
      </div>
    );
  }
);
SelectField.displayName = 'SelectField';

// ─────────────────────────────────────────────────────────────────────────────
// PrefixedField
// ─────────────────────────────────────────────────────────────────────────────

export const PrefixedField = forwardRef(
  ({ label, hint, error, prefix, className = '', ...props }, ref) => {
    const generatedId = useId();
    const controlId = props.id || generatedId;

    return (
      <div className={className}>
        <Label htmlFor={controlId} hint={hint} required={props.required}>
          {label}
        </Label>
        <div className="flex">
          <span className="flex select-none items-center gap-1.5 rounded-l-lg border border-r-0 border-slate-200 bg-slate-50 px-3 py-2 text-[12px]/[18px] font-bold text-slate-700">
            {prefix}
          </span>
          <input
            ref={ref}
            id={controlId}
            aria-invalid={error ? 'true' : undefined}
            className={`${baseControl} rounded-l-none rounded-r-lg pl-3 pr-3 ${error ? errorControl : ''
              }`}
            {...props}
          />
        </div>
        {error && (
          <p className="mt-1 text-[11px] font-semibold text-red-600">{error}</p>
        )}
      </div>
    );
  }
);
PrefixedField.displayName = 'PrefixedField';

// ─────────────────────────────────────────────────────────────────────────────
// Textarea
// ─────────────────────────────────────────────────────────────────────────────

export const TextareaField = forwardRef(
  ({ label, hint, error, rows = 3, className = '', ...props }, ref) => {
    const generatedId = useId();
    const controlId = props.id || generatedId;

    return (
      <div className={className}>
        <Label htmlFor={controlId} hint={hint} required={props.required}>
          {label}
        </Label>
        <textarea
          ref={ref}
          id={controlId}
          rows={rows}
          aria-invalid={error ? 'true' : undefined}
          className={`${baseControl} resize-y px-3 ${error ? errorControl : ''
            }`}
          {...props}
        />
        {error && (
          <p className="mt-1 text-[11px] font-semibold text-red-600">{error}</p>
        )}
      </div>
    );
  }
);
TextareaField.displayName = 'TextareaField';

// ─────────────────────────────────────────────────────────────────────────────
// FormAlert
// ─────────────────────────────────────────────────────────────────────────────

export const FormAlert = ({ tone = 'error', children }) => {
  if (!children) return null;

  const tones = {
    error: 'border-red-200 bg-red-50 text-red-700',
    success: 'border-brand-200 bg-brand-50 text-brand-800',
    info: 'border-slate-200 bg-slate-50 text-slate-700',
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
  };

  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`rounded-lg border px-3 py-2.5 text-[13px] font-semibold ${tones[tone]}`}
    >
      {children}
    </div>
  );
};

export default Field;