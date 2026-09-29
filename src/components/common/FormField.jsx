import React, { useId } from 'react';
import { ChevronDown } from 'lucide-react';

const baseControl =
  'w-full rounded-lg border border-slate-200 bg-white py-2.5 text-sm font-medium text-ink placeholder:font-normal placeholder:text-slate-500 transition-all focus:border-brand-700 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/30';

const Label = ({ htmlFor, children, hint, required = false }) => (
  <div className="mb-1 flex items-baseline justify-between gap-3">
    <label htmlFor={htmlFor} className="text-[12px] font-semibold text-slate-700">
      {children}
      {required && <span className="ml-0.5 text-red-600">*</span>}
    </label>
    {hint && <span className="shrink-0 text-[11px] font-medium text-slate-500">{hint}</span>}
  </div>
);

/** Text-like input with a leading icon. */
export const Field = ({
  label,
  hint,
  icon: Icon,
  error,
  trailing,
  className = '',
  ...props
}) => {
  const generatedId = useId();
  const controlId = props.id || generatedId;

  return (
    <div className={className}>
      <Label htmlFor={controlId} hint={hint} required={props.required}>
        {label}
      </Label>
      <div className="relative">
        {Icon && (
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
            <Icon className="h-4 w-4" />
          </span>
        )}
        <input
          id={controlId}
          aria-invalid={error ? 'true' : undefined}
          className={`${baseControl} ${Icon ? 'pl-9' : 'pl-3'} pr-9 ${
            error ? 'border-red-300' : ''
          }`}
          {...props}
        />
        {trailing && (
          <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500">
            {trailing}
          </span>
        )}
      </div>
      {error && <p className="mt-1 text-[11px] font-semibold text-red-600">{error}</p>}
    </div>
  );
};

/** Native select styled to match `Field`. */
export const SelectField = ({
  label,
  hint,
  icon: Icon,
  error,
  children,
  className = '',
  ...props
}) => {
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
            <Icon className="h-4 w-4" />
          </span>
        )}
        <select
          id={controlId}
          aria-invalid={error ? 'true' : undefined}
          className={`${baseControl} cursor-pointer appearance-none pr-9 ${
            Icon ? 'pl-9' : 'pl-3'
          } ${error ? 'border-red-300' : ''}`}
          {...props}
        >
          {children}
        </select>
        <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500">
          <ChevronDown className="h-4 w-4" />
        </span>
      </div>
      {error && <p className="mt-1 text-[11px] font-semibold text-red-600">{error}</p>}
    </div>
  );
};

/** Text input with a fixed leading adornment, e.g. a +233 phone prefix. */
export const PrefixedField = ({
  label,
  hint,
  error,
  prefix,
  className = '',
  ...props
}) => {
  const generatedId = useId();
  const controlId = props.id || generatedId;

  return (
    <div className={className}>
      <Label htmlFor={controlId} hint={hint} required={props.required}>
        {label}
      </Label>
      <div className="flex">
        <span className="flex select-none items-center gap-1.5 rounded-l-lg border border-r-0 border-slate-200 bg-slate-50 px-3 py-2.5 text-[13px] font-bold text-slate-700">
          {prefix}
        </span>
        <input
          id={controlId}
          aria-invalid={error ? 'true' : undefined}
          className={`${baseControl} rounded-l-none rounded-r-lg pl-3 pr-3 ${
            error ? 'border-red-300' : ''
          }`}
          {...props}
        />
      </div>
      {error && <p className="mt-1 text-[11px] font-semibold text-red-600">{error}</p>}
    </div>
  );
};

export const FormAlert = ({ tone = 'error', children }) => {
  if (!children) return null;
  const tones = {
    error: 'border-red-200 bg-red-50 text-red-700',
    success: 'border-brand-200 bg-brand-50 text-brand-800',
    info: 'border-slate-200 bg-slate-50 text-slate-700',
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
