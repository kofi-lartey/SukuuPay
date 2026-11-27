import { useEffect, useRef, useCallback, useState } from 'react';

/**
 * PIN Input Component
 *
 * An 8-digit numeric PIN entry with auto-focus and auto-submit.
 * Designed for the DDMMYYYY PIN format (e.g., 09062020 for 9th June 2020).
 *
 * Features:
 * - Single input with visual 8-digit separation
 * - Auto-focus on mount
 * - Only accepts digits
 * - Calls onComplete when all 8 digits entered
 * - Paste support (auto-fills from clipboard)
 * - Accessible with proper ARIA labels
 */
const PinInput = ({
  length = 8,
  placeholder = 'DDMMYYYY',
  onComplete,
  onChange,
  autoFocus = true,
  disabled = false,
  error = false,
  className = '',
  'aria-label': ariaLabel = 'Enter your 8-digit PIN',
  'aria-describedby': ariaDescribedBy,
}) => {
  const inputRef = useRef(null);
  const [value, setValue] = useState('');

  // Auto-focus on mount
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleChange = useCallback(
    (e) => {
      let newValue = e.target.value.replace(/\D/g, '').slice(0, length);
      setValue(newValue);
      onChange?.(newValue);

      if (newValue.length === length) {
        onComplete?.(newValue);
      }
    },
    [length, onChange, onComplete]
  );

  const handlePaste = useCallback(
    (e) => {
      e.preventDefault();
      const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
      if (pasted) {
        setValue(pasted);
        onChange?.(pasted);
        if (pasted.length === length) {
          onComplete?.(pasted);
        }
      }
    },
    [length, onChange, onComplete]
  );

  const handleKeyDown = useCallback(
    (e) => {
      // Allow navigation keys
      if (
        ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End'].includes(
          e.key
        )
      ) {
        return;
      }
      // Only allow digits
      if (!/^\d$/.test(e.key)) {
        e.preventDefault();
      }
    },
    []
  );

  // Format value for display with subtle separation
  const displayValue = value.padEnd(length, ' ');

  return (
    <div className={`relative ${className}`}>
      <label htmlFor="pin-input" className="sr-only">
        {ariaLabel}
      </label>
      <input
        ref={inputRef}
        id="pin-input"
        type="tel"
        inputMode="numeric"
        autoComplete="off"
        value={value}
        onChange={handleChange}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
        maxLength={length}
        placeholder={placeholder}
        disabled={disabled}
        className={`
          w-full px-4 py-3.5 text-center text-[22px] font-mono tabular-nums tracking-[0.4em]
          bg-white border-2 rounded-xl
          placeholder:text-slate-400 placeholder:tracking-normal
          focus:outline-none focus:ring-2 focus:ring-offset-2
          transition-all duration-200
          ${
            error
              ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
              : 'border-slate-200 focus:border-emerald-500 focus:ring-emerald-200'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        aria-invalid={error}
      />
      {/* Visual digit separators */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        aria-hidden="true"
      >
        {Array.from({ length }).map((_, i) => (
          <span
            key={i}
            className={`
              flex-1 text-center text-slate-300 font-mono text-[22px]
              ${i < value.length ? 'text-slate-900' : ''}
              ${i === length - 1 ? 'pr-0' : 'border-r border-slate-200'}
            `}
          >
            {value[i] || '○'}
          </span>
        ))}
      </div>
    </div>
  );
};

export default PinInput;