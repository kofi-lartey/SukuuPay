/**
 * Formatting for the parent pay portal.
 *
 * **Separate from `utils/format.js` on purpose.** That module formats for an
 * authenticated bursar: tabular figures, compact `GH₵ 1,250.00`, dates that
 * disambiguate the year. A parent is not reading a ledger — they are checking what
 * they owe, on a phone, possibly in a language that is not English at the parts of
 * it that are not numerals.
 *
 * Three rules drive everything here:
 *
 *   - **Amounts always carry two decimals and a currency mark.** `550` next to a
 *     child's name reads as "five hundred cedis" to some parents and "five hundred
 *     pesewas" to others, and the second reading is an error of 100×. `.00` is not
 *     cosmetic here; it is what tells a reader the unit.
 *   - **Dates are written out, never numeric.** `2026-10-30` is unambiguous to a
 *     person reading a screen and ambiguous to a person reading it aloud to
 *     somebody else, which is how these numbers actually get passed around.
 *   - **A countdown beats a date whenever there is one.** "Due in 5 days" answers
 *     the question a parent is actually asking. "Due 30 Oct 2026" answers a
 *     different, colder question. Both are available; the countdown leads.
 */

const PESEWAS_PER_CEDI = 100;

/**
 * `55000` → `"GHS 550.00"`.
 *
 * `GHS` rather than `GH₵` on this surface. The cedi symbol is a *t* with two bars
 * through it, and it is routinely rendered as a plain `T`, dropped, or shown as a
 * box on the low-end Android handsets and older browsers this portal is built for —
 * a parent who cannot read the unit cannot trust the number. `GHS` is spelled, ASCII,
 * and unambiguous. (The admin side uses `GH₵` throughout; the divergence is
 * deliberate and is the reason this module is separate.)
 */
export const formatCedi = (pesewas, { decimals = 2, sign = false } = {}) => {
  const value = (Number(pesewas) || 0) / PESEWAS_PER_CEDI;
  const formatted = value.toLocaleString('en-GH', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  const prefix = sign && value > 0 ? '+' : '';
  return `${prefix}GHS ${formatted}`;
};

/** `85000` → `"GHS 850"`. For figures that are never edited by hand. */
export const formatCediWhole = (pesewas) => formatCedi(pesewas, { decimals: 0 });

/**
 * `2026-10-30T23:59:00Z` → `"30 Oct 2026"`.
 *
 * `en-GB` because it is the only widely available locale that puts the day first
 * with an unambiguous month name, which is what "read it aloud" needs.
 *
 * Read in **UTC**, deliberately. A deadline is `2026-10-30T23:59:00Z` because it is
 * the *end of 30 October* — it means the fees are due by the close of business on
 * that date, in the school's day. Rendered in the browser's local zone instead, a
 * phone in Accra (UTC) at 22:00 on the 30th sees "30 Oct", but the same phone at
 * 01:00 on the 31st sees "31 Oct" — a school in the Northern Region at UTC+0 that
 * *has* already closed sees the deadline as tomorrow. Since Ghana is UTC and the
 * deadline is authored as a UTC end-of-day, reading it as UTC is the only choice
 * that makes the number the school wrote come out the number the parent sees.
 */
export const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
};

/** `2026-10-29T10:42:00Z` → `"29 Oct 2026, 10:42"`, for receipts. */
export const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC',
  });
};

/**
 * Whole days from now until `value`, negative once it has passed.
 *
 * Measured against **midnight UTC**, not against the current instant, because a
 * deadline is a date rather than a moment. At 23:30 on the 29th a due date of the
 * 30th is "in 1 day" and not "in 0 days, 30 minutes" — the parent is being asked to
 * have money available by a day, and telling them it is thirty minutes away is not
 * useful and, for the last day, is wrong.
 */
export const daysUntil = (value, now = new Date()) => {
  if (!value) return null;
  const target = new Date(value);
  // Guarded, not just checked for truthiness. A malformed date string parses to an
  // Invalid Date, whose `getTime()` is `NaN`, and `Math.round(NaN / 86400000)` is
  // `NaN` — which then renders as the literal text "Overdue by NaN days". The
  // backend returns `null` for the same input, so this one was the only path that
  // could put `NaN` in front of a parent.
  if (Number.isNaN(target.getTime())) return null;

  // `now` is guarded too. It defaults to `new Date()` and so is almost always
  // valid, but it is a parameter, and an invalid one reaches
  // `Date.UTC(NaN, NaN, NaN)` — producing `NaN` out of an otherwise guarded
  // function, which is how "Overdue by NaN days" ends up on a screen.
  const reference = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(reference.getTime())) return null;

  const startOfTarget = Date.UTC(
    target.getUTCFullYear(),
    target.getUTCMonth(),
    target.getUTCDate()
  );
  const startOfToday = Date.UTC(
    reference.getUTCFullYear(),
    reference.getUTCMonth(),
    reference.getUTCDate()
  );

  return Math.round((startOfTarget - startOfToday) / 86400000);
};

/**
 * "Due in 5 days" / "Due today" / "Overdue by 5 days".
 *
 * Returns `null` when there is no deadline, so a caller can distinguish "no
 * deadline set" from "due today" — which are different situations and get different
 * treatment. A school with no deadline is common and normal; a parent shown
 * "Due today" for a school that never set one will assume they are late.
 */
export const deadlinePhrase = (value, now = new Date()) => {
  const days = daysUntil(value, now);
  if (days === null) return null;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  if (days > 1) return `Due in ${days} days`;
  if (days === -1) return 'Overdue by 1 day';
  return `Overdue by ${Math.abs(days)} days`;
};

/**
 * The same countdown for an installment, which uses "Not yet due" rather than
 * "Due in 5 days" once the date has passed.
 *
 * Separated from `deadlinePhrase` because an installment in arrears is not the same
 * event as an overdue *account*. Telling a parent "overdue by 40 days" about the
 * second tranche when they have already paid the first and the school's term has
 * ended reads as an accusation rather than a statement of fact.
 */
export const installmentDuePhrase = (value, now = new Date()) => {
  const days = daysUntil(value, now);
  if (days === null) return null;
  if (days > 0) return days === 1 ? 'Due tomorrow' : `Due in ${days} days`;
  if (days === 0) return 'Due today';
  if (days === -1) return '1 day late';
  return `${Math.abs(days)} days late`;
};

/** `MTN` / `AirtelTigo` / `UNKNOWN` → a label, or `null` for cash at the desk. */
export const networkLabel = (network) => {
  if (!network) return null;
  if (network === 'VODAFONE') return 'Telecel Cash';
  if (network === 'AIRTELTELIGO') return 'AirtelTigo Money';
  if (network === 'MTN') return 'MTN MoMo';
  return network;
};

/**
 * Initials for the avatar fallback: `"Kwame Mensah"` → `"KM"`.
 *
 * Two letters, not one. One letter renders as a circle with a speck in it at the
 * sizes used here, and a parent identifying their child by the initials in a family
 * group photo needs them to be distinguishable.
 */
export const initialsOf = (name) => {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

/**
 * How much of a bill has been paid, as a whole percentage.
 *
 * Clamped to 0–100 and guarded against a zero total, because the bar is a width
 * and a NaN there collapses the layout on the one screen that must never look
 * broken. A student with no fees owes nothing, and 0% of nothing is not a number
 * worth rendering.
 */
export const paidPercent = (paid, owed) => {
  const total = Number(owed) || 0;
  if (total <= 0) return 0;
  const percent = ((Number(paid) || 0) / total) * 100;
  return Math.min(100, Math.max(0, Math.round(percent)));
};