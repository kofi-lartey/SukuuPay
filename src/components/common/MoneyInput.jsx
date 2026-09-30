import React, { useEffect, useState } from 'react';
import { Field } from './FormField';

/**
 * A money input that speaks cedi to the user and pesewas to the API.
 *
 * The one place in the client that crosses the money boundary, and the reason
 * the student module cannot repeat the backend's original defect: the API takes
 * an integer number of pesewas, a bursar thinks in cedis, and any form that
 * takes a raw number will eventually be filled with `850` meaning GH₵ 850. That
 * is a hundred-fold overcharge on someone's bill, and nothing downstream can
 * detect it — 850 is a perfectly valid pesewa count.
 *
 * So this control takes and displays **cedis as a number**, and emits
 * **pesewas**. The alternative — making every caller remember to multiply — is
 * exactly the class of bug that caused the original mismatch between the single
 * create path and the CSV import.
 *
 * The displayed text is held as a string while the field has focus, so a
 * partially typed value ("8", "85", "850.") is not rewritten under the cursor.
 * On blur it is normalised to a fixed 2-decimal figure.
 */
const MoneyInput = ({
  label,
  hint,
  error,
  value,
  onChange,
  className = '',
  disabled = false,
  ...props
}) => {
  // The prop is pesewas; the input shows cedis.
  const toCedis = (pesewas) => (pesewas === null || pesewas === undefined ? '' : String(pesewas / 100));

  const [text, setText] = useState(() => toCedis(value));
  const [focused, setFocused] = useState(false);

  // Adopt an external change (a form reset, a loaded record) but never fight
  // the user mid-keystroke.
  useEffect(() => {
    if (!focused) setText(toCedis(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, focused]);

  const commit = (raw) => {
    // Strip anything that is not part of a number. `Number('')` is 0, which
    // would silently turn an emptied field into a GH₵ 0.00 bill, so an empty
    // string is passed through as null and the field is marked required.
    const cleaned = String(raw).replace(/[^0-9.]/g, '');
    const parsed = cleaned === '' ? null : Number(cleaned);
    onChange(parsed === null || Number.isNaN(parsed) ? null : Math.round(parsed * 100));
  };

  const onBlur = () => {
    setFocused(false);
    if (text === '') return;
    const parsed = Number(text);
    setText(Number.isNaN(parsed) ? '' : parsed.toFixed(2));
  };

  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      className={className}
      type="text"
      inputMode="decimal"
      // Left unformatted for the user: a mask that rewrites the field mid-typing
      // fights the cursor, and the cedi symbol is already in the hint.
      placeholder="0.00"
      disabled={disabled}
      value={text}
      onFocus={() => setFocused(true)}
      onChange={(event) => {
        setText(event.target.value);
        commit(event.target.value);
      }}
      onBlur={onBlur}
      trailing={<span className="text-[11px] font-extrabold">GH₵</span>}
      {...props}
    />
  );
};

export default MoneyInput;
