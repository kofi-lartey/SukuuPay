import React, { useEffect, useState } from 'react';
import { Field } from './FormField';
import { GHANA_PHONE_REGEX } from '../../utils/ghanaPhone';

/**
 * A Ghana phone input.
 *
 * Normalises to the `0xx` form the backend stores, and tells the user what it
 * accepted. A parent whose number is entered as `233241234567` must not be
 * rejected — that is the same person — so the three accepted spellings are
 * accepted and collapsed to one canonical form before it leaves the browser.
 *
 * This is a client-side mirror of `phoneValidator` in
 * `student.validation.js`. It exists to give immediate feedback, not to replace
 * the server's check: the server's copy is the one that decides, and this one
 * can only be as current as the last time someone edited it.
 */
const PhoneInput = ({ label, hint, error, value, onChange, className = '', ...props }) => {
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused && value) onChange(normalise(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, focused]);

  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      className={className}
      type="tel"
      inputMode="tel"
      placeholder="024 123 4567"
      maxLength={14}
      value={value || ''}
      onFocus={() => setFocused(true)}
      onChange={(event) => onChange(normalise(event.target.value))}
      onBlur={() => {
        setFocused(false);
        onChange(normalise(value));
      }}
      {...props}
    />
  );
};

/** `233241234567` / `+233241234567` / `0241234567` → `0241234567`. */
export const normalise = (raw) => {
  if (!raw) return '';
  const digits = String(raw).replace(/[\s()-]/g, '').replace(/^\+/, '');
  if (digits.startsWith('233')) return `0${digits.slice(3)}`;
  return digits;
};

export const isValidGhanaPhone = (raw) => GHANA_PHONE_REGEX.test(normalise(raw));

export default PhoneInput;
