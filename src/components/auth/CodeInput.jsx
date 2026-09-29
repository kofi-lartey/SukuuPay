import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Check } from 'lucide-react';

const LENGTH = 6;

/**
 * Six-box one-time-code entry. Digits are typed, pasted, or moved between with
 * the arrow keys; the parent receives the joined code.
 */
const OtpInput = ({ value, onChange, onComplete, disabled, invalid, id }) => {
  const [digits, setDigits] = useState(() => Array(LENGTH).fill(''));
  const inputsRef = useRef([]);

  // Re-sync when the parent clears or corrects the value externally.
  useEffect(() => {
    setDigits((prev) => {
      const next = value.padEnd(LENGTH, ' ').slice(0, LENGTH).split('');
      const same = next.every((char, i) => (char === ' ' ? '' : char) === prev[i]);
      return same ? prev : next.map((char) => (char === ' ' ? '' : char));
    });
  }, [value]);

  const emit = (next) => {
    setDigits(next);
    const code = next.join('');
    onChange(code);
    if (code.length === LENGTH && !next.includes('')) onComplete?.(code);
  };

  const focusBox = (index) => inputsRef.current[index]?.focus();

  const handleChange = (index, raw) => {
    const digit = raw.replace(/\D/g, '').slice(-1);
    if (!digit) return;
    const next = [...digits];
    next[index] = digit;
    emit(next);
    if (index < LENGTH - 1) focusBox(index + 1);
  };

  const handleKeyDown = (index, event) => {
    if (event.key === 'Backspace') {
      event.preventDefault();
      const next = [...digits];
      if (next[index]) next[index] = '';
      else if (index > 0) {
        next[index - 1] = '';
        focusBox(index - 1);
      }
      emit(next);
      return;
    }

    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      focusBox(index - 1);
    }
    if (event.key === 'ArrowRight' && index < LENGTH - 1) {
      event.preventDefault();
      focusBox(index + 1);
    }
  };

  const handlePaste = (event) => {
    event.preventDefault();
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, LENGTH);
    if (!pasted) return;
    const next = Array(LENGTH - pasted.length).fill('').concat(pasted.split(''));
    emit(next);
    focusBox(Math.min(pasted.length, LENGTH - 1));
  };

  return (
    <div
      role="group"
      aria-labelledby={id ? `${id}-label` : undefined}
      className="flex justify-center gap-2"
    >
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(node) => {
            inputsRef.current[index] = node;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          disabled={disabled}
          aria-label={`Digit ${index + 1} of ${LENGTH}`}
          aria-invalid={invalid ? 'true' : undefined}
          value={digit}
          onChange={(event) => handleChange(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={handlePaste}
          onFocus={(event) => event.target.select()}
          className={`h-12 w-full max-w-[2.75rem] rounded-lg border text-center text-lg font-extrabold text-ink transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/30 ${
            invalid
              ? 'border-red-300 bg-red-50'
              : digit
                ? 'border-brand-700 bg-white'
                : 'border-slate-200 bg-white focus:border-brand-700'
          }`}
        />
      ))}
    </div>
  );
};

const LABELS = [
  { label: 'Too short', tone: 'bg-red-500', text: 'text-red-700' },
  { label: 'Weak', tone: 'bg-red-500', text: 'text-red-700' },
  { label: 'Fair', tone: 'bg-amber-500', text: 'text-amber-700' },
  { label: 'Strong', tone: 'bg-brand-600', text: 'text-brand-700' },
  { label: 'Excellent', tone: 'bg-brand-700', text: 'text-brand-700' },
];

/** Password strength, scored against the API's complexity rules. */
export const PasswordStrength = ({ password, detailed = false }) => {
  if (!password) return null;

  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-zA-Z]/.test(password) && /\d/.test(password)) score += 1;
  if (/[^a-zA-Z0-9]/.test(password)) score += 1;

  const meta = LABELS[score];
  const Icon = score >= 3 ? Check : AlertCircle;

  // Compact by default: a single line saves 20px, which matters inside a form
  // that has to keep its submit button above the fold.
  if (!detailed) {
    return (
      <p className={`mt-1 flex items-center gap-1 text-[11px] font-semibold ${meta.text}`}>
        <Icon className="h-3 w-3" />
        {meta.label} password
      </p>
    );
  }

  return (
    <div className="mt-2">
      <div className="flex gap-1" aria-hidden="true">
        {Array.from({ length: 4 }).map((_, index) => (
          <span
            key={index}
            className={`h-1.5 flex-1 rounded-full ${index < score ? meta.tone : 'bg-slate-200'}`}
          />
        ))}
      </div>
      <p className={`mt-1.5 flex items-center gap-1 text-[11px] font-semibold ${meta.text}`}>
        <Icon className="h-3 w-3" />
        {meta.label}
      </p>
    </div>
  );
};

export default OtpInput;
