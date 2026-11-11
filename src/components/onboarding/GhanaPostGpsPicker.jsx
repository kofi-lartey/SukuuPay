import React, { useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, MapPin } from 'lucide-react';
import { FormAlert } from '../common/FormField';
import {
  AREA_CODE_SUGGESTIONS,
  composeDigitalAddress,
  isValidDigitalAddress,
  toParts,
} from '../../utils/ghanaPostGps';

/**
 * Segmented Ghana Post GPS digital address entry.
 *
 * Why three inputs instead of one free-text box: the format is fixed and
 * positional (`AA-XXX-XXXX`), and a single field invites exactly the typo that
 * matters here — a transposed digit in the last group still looks like a valid
 * address. Segmenting makes the mistake impossible to make silently, and the
 * live preview shows the assembled value before anything is saved.
 *
 * Why the area code is a free input with suggestions rather than a `<select>`:
 * Ghana Post's district list is ~260 entries and was reorganised when the regions
 * were split in 2019. A `<select>` implies completeness it does not have, and
 * deriving the code from the school's region would silently stamp the wrong
 * district onto an official document. Suggestions the user can ignore degrade
 * gracefully; an incomplete dropdown does not.
 */
const GhanaPostGpsPicker = ({ value, onChange, error, touched }) => {
  // Local draft for editing: the segmented inputs are controlled by this so a
  // partial entry (e.g. just "GA") stays on screen instead of being wiped.
  const [draft, setDraft] = useState(() => toParts(value));

  // Re-seed the draft when the parent supplies a new value (e.g. form restore),
  // but never clobber a mid-edit draft — the parent only updates on commit.
  useEffect(() => {
    setDraft(toParts(value));
  }, [value]);

  const complete = isValidDigitalAddress(value);
  const isLegacy = value && !complete;
  const showError = error || (touched && isLegacy ? 'That is not a valid digital address.' : '');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Clipboard is permission-gated. The value is visible and selectable, so a
      // failed copy is not worth an error.
    }
  };

  const emit = (patch) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    const composed = composeDigitalAddress(next);
    if (composed) {
      // All three segments complete — commit the canonical address to the form.
      onChange(composed);
    } else if (!next.areaCode && !next.postalCode && !next.uniqueAddress) {
      // User cleared every segment — propagate the empty so the form clears too.
      onChange('');
    }
    // Partial entry: keep editing locally; do not clobber the parent value.
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-[12px] font-bold text-ink">Ghana Post GPS address</p>
            <p className="mt-0.5 text-[11px] font-medium leading-snug text-slate-500">
              Your official digital address. Optional, but it is what couriers and Ghana Post
              quote.
            </p>
          </div>
        </div>

        {complete && (
          <button
            type="button"
            onClick={copy}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-600 transition-colors hover:bg-slate-50"
          >
            <Copy className="h-3 w-3" aria-hidden="true" />
            Copy
          </button>
        )}
      </div>

      {/* Grouped so a screen reader announces which part is being entered, and
          the dashes are decorative rather than four separate fields. */}
      <div className="flex items-end gap-1.5">
        <Segment
          label="Area code"
          value={draft.areaCode}
          onChange={(event) =>
            emit({
              areaCode: event.target.value
                .toUpperCase()
                .replace(/[^A-Z]/g, '')
                .slice(0, 2),
            })
          }
          placeholder="GA"
          maxLength={2}
          className="w-[4.5rem]"
          list="gps-area-codes"
          autoComplete="off"
          spellCheck={false}
        />
        <span className="pb-3 text-sm font-bold text-slate-400" aria-hidden="true">
          -
        </span>
        <Segment
          label="Post office zone"
          value={draft.postalCode}
          onChange={(event) =>
            emit({ postalCode: event.target.value.replace(/\D/g, '').slice(0, 3) })}
          placeholder="183"
          inputMode="numeric"
          maxLength={3}
          className="w-[5rem]"
        />
        <span className="pb-3 text-sm font-bold text-slate-400" aria-hidden="true">
          -
        </span>
        <Segment
          label="Digital address"
          value={draft.uniqueAddress}
          onChange={(event) =>
            emit({ uniqueAddress: event.target.value.replace(/\D/g, '').slice(0, 4) })}
          placeholder="8164"
          inputMode="numeric"
          maxLength={4}
          className="w-[6rem]"
        />
      </div>

      {/* Suggestions only. Never a hard mapping — see the note above. */}
      <datalist id="gps-area-codes">
        {AREA_CODE_SUGGESTIONS.map((entry) => (
          <option key={entry.code} value={entry.code}>
            {entry.district}
          </option>
        ))}
      </datalist>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-medium text-slate-500">
          {complete ? (
            <span className="inline-flex items-center gap-1 font-bold text-brand-700">
              <Check className="h-3 w-3" aria-hidden="true" />
              {value}
            </span>
          ) : (
            'Format: 2 letters, then 3 digits, then 4 digits.'
          )}
        </p>
        <a
          href="https://www.ghanapostgps.com/"
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-700 underline"
        >
          Find my digital address
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </a>
      </div>

      {showError && <FormAlert tone="error">{showError}</FormAlert>}
    </div>
  );
};

/**
 * One segment of the address.
 *
 * The label sits above rather than inside so the three inputs stay aligned while
 * their placeholder text differs in length, and each carries its own
 * `aria-label` so the full address reads sensibly out of context.
 */
const Segment = ({ label, className = '', inputMode, ...props }) => (
  <div className={className}>
    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">
      {label}
    </label>
    <input
      type="text"
      aria-label={label}
      inputMode={inputMode}
      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-center font-mono text-[13px] font-bold tracking-wide text-ink placeholder:font-normal placeholder:text-slate-300 focus:border-brand-700 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/30"
      {...props}
    />
  </div>
);

export default GhanaPostGpsPicker;
