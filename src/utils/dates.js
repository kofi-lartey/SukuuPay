/**
 * Date and time formatting, in Accra time.
 *
 * The Payments module is the first surface that has to render a timestamp a
 * bursar reconciles against a provider statement, and it needs the answer to be
 * right — "29 Oct 2026, 10:42 AM" has to be the Ghanaian wall-clock time of the
 * payment, not the browser's. A bursar in London looking at a payment the school
 * banked at 10:42 must read 10:42.
 *
 * Ghana is UTC+0 all year with no daylight saving, so `Africa/Accra` is exactly
 * UTC. That is spelled as a named zone rather than a hardcoded `+00:00` offset
 * anyway: it is self-documenting, and it is what the backend does in
 * `utils/dateHelpers.js` (`startOfDayAccra`, `endOfDayAccra`), which is what
 * `startDate`/`endDate` are bucketed against.
 *
 * `formatDateTime` is the default for anything a person will compare against a
 * statement or read aloud. `formatDateShort` is for dense cells where the year
 * is noise.
 */

const ACCRA = 'Africa/Accra';

const parse = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * `formatDateTime('2026-10-29T10:42:00Z')` → `"29 Oct 2026, 10:42 AM"`.
 *
 * Returns an em dash for anything unparseable rather than "Invalid Date": a
 * payment with a missing timestamp should read as missing, and "Invalid Date"
 * in a table cell reads as a bug in the app rather than in the data.
 */
export const formatDateTime = (value) => {
  const date = parse(value);
  if (!date) return '—';

  const day = new Intl.DateTimeFormat('en-GB', {
    timeZone: ACCRA,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);

  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: ACCRA,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date);

  return `${day}, ${time}`;
};

/** `formatDate('2026-10-29T10:42:00Z')` → `"29 Oct 2026"`. */
export const formatDate = (value) => {
  const date = parse(value);
  if (!date) return '—';

  return new Intl.DateTimeFormat('en-GB', {
    timeZone: ACCRA,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

/** Relative age, for the "how stale is this?" question a table invites. */
export const formatRelative = (value) => {
  const date = parse(value);
  if (!date) return '—';

  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';

  const units = [
    ['minute', 60],
    ['hour', 3600],
    ['day', 86_400],
    ['week', 604_800],
  ];

  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  for (let i = units.length - 1; i >= 0; i -= 1) {
    const [unit, secondsPerUnit] = units[i];
    const count = Math.round(seconds / secondsPerUnit);
    if (count >= 1) return formatter.format(-count, unit);
  }

  return 'just now';
};

/**
 * Which timestamp a payment should be sorted and read by.
 *
 * A completed payment has a real `completedAt`; a pending one has `initiatedAt`
 * and often nothing else. Falling back to `createdAt` rather than showing a blank
 * keeps the column meaningful for every row — a payment row exists because
 * *something* happened at `createdAt`.
 */
export const paymentTimestamp = (payment) =>
  payment?.completedAt || payment?.initiatedAt || payment?.createdAt || null;

export default { formatDateTime, formatDate, formatRelative, paymentTimestamp };