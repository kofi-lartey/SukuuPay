/**
 * Vocabulary and derivations shared by the four analytics screens.
 *
 * Deliberately a `.js` file with no JSX in it, so `utils/constants.js` and this one
 * stay importable from a module that must not pull JSX through a transform — the same
 * reason `hooks/useToast.js` and `utils/constants.js` are both JSX-free. The two
 * components the analytics screens share live in `AnalyticsControls.jsx` beside it.
 *
 * Everything here is derived from the *response*, not from a hand-typed list, and the
 * comments say why at each place it matters. That is not tidiness: the four payloads
 * are written by `Backend/src/services/admin/analytics.service.js`, and the enum-like
 * things in them are derived there from constants this file cannot import.
 */

/**
 * The revenue sources, in the order they stack.
 *
 * **An ordering, not a whitelist.** `GET /admin/analytics/revenue` derives its keys
 * from `PLATFORM_REVENUE_TYPES` (`analytics.service.js:6,759`), which is
 * `markup | platform_fee | subscription | sms | gateway_fee` — five values, not the four
 * the brief names. Hard-coding four here would mean the day somebody adds a revenue
 * type to that constant, a fifth column appears in the API, the chart silently drops it,
 * and the two screens that must agree disagree — the exact drift
 * `PLATFORM_REVENUE_TYPES` exists to prevent, reintroduced at the client.
 *
 * So this is a *sort order*: the four named types lead, in the order the owner reads
 * them, and anything else the server sends follows in alphabetical order so it is still
 * visible. `revenueTypesOf` below is what actually decides the set.
 */
export const REVENUE_TYPE_ORDER = ['markup', 'platform_fee', 'subscription', 'sms'];

/**
 * How each revenue source is worded, and coloured.
 *
 * The colours are taken from the product's own palette rather than invented: the three
 * greens are `brand-700/500/400` from `tailwind.config.js` and the fourth is the same
 * amber the MoMo MTN network uses, so the SMS column and an MTN pill on another screen
 * are the same colour rather than two similar ones. `getGatewayMixAnalytics` returns the
 * same five-rail vocabulary, so the labels are shared deliberately.
 */
export const REVENUE_TYPE_LABELS = {
  markup: 'Markup',
  platform_fee: 'Platform fee',
  subscription: 'Subscription',
  sms: 'SMS',
  gateway_fee: 'Gateway fee',
};

export const REVENUE_TYPE_COLOURS = {
  markup: '#0F5132',
  platform_fee: '#12B76A',
  subscription: '#32D583',
  sms: '#F59E0B',
  gateway_fee: '#0EA5E9',
};

/**
 * The same palette as Tailwind class names, for `charts/StackedBar.jsx`.
 *
 * `StackedBar` colours a segment from a literal `className` (`StackedBar.jsx:26`), so an
 * inline `style` is not an option and a computed `bg-[${colour}]` would not survive
 * Tailwind's content scan. A static map per type is the only way both the SVG chart and
 * the share bar can be the same colour — and them being the same colour is the point:
 * the legend's fourth swatch has to be the same green as the chart's fourth stack, or a
 * reader spends a second matching them.
 */
export const REVENUE_TYPE_CLASSES = {
  markup: 'bg-brand-700',
  platform_fee: 'bg-brand-500',
  subscription: 'bg-brand-300',
  sms: 'bg-amber-500',
  gateway_fee: 'bg-sky-500',
};

/** Tailwind class for a revenue type, falling back to a neutral slate. */
export const revenueTypeClass = (type, index = 0) =>
  REVENUE_TYPE_CLASSES[type] || ['bg-slate-400', 'bg-sky-500', 'bg-violet-500', 'bg-pink-500', 'bg-teal-500'][index % 5];

/** Readable label for a revenue type, falling back to the raw key. */
export const revenueTypeLabel = (type) => REVENUE_TYPE_LABELS[type] || String(type);

/**
 * The revenue types present in a payload, ordered for display.
 *
 * Read off the response's own `byType` map rather than off a constant, because the map
 * is the server's account of what it actually found — a type it did not return because
 * no row exists should not get a column, and a type it does return under a name this
 * file has never heard of must still be rendered. Anything unlabelled and uncoloured
 * falls through to a neutral slate, which is a legitimate answer: "we do not have a
 * colour for this yet" reads as incomplete, and "grey" reads as "reported separately".
 */
export const revenueTypesOf = (byType) => {
  const present = Object.keys(byType || {});
  const known = REVENUE_TYPE_ORDER.filter((type) => present.includes(type));
  const unknown = present.filter((type) => !REVENUE_TYPE_ORDER.includes(type)).sort();
  return [...known, ...unknown];
};

export const revenueTypeColour = (type, index = 0) =>
  REVENUE_TYPE_COLOURS[type] || ['#64748B', '#0EA5E9', '#8B5CF6', '#EC4899', '#14B8A6'][index % 5];

/**
 * An axis label for one period key.
 *
 * The server's keys are `YYYY-MM` (month), `YYYY-MM-DD` (day) and the **Monday** of the
 * week for `groupBy: 'week'` (`analytics.service.js:85`, `buildPeriodKeys`). Three
 * shapes, so this cannot be `slice(0, 7)` with a `Date` — the week key is a day and the
 * month key is not a date at all.
 *
 * The week label says `w/c`. A Monday's date rendered bare is a date on which nothing
 * happened; the label's job is to say the column is the whole week beginning then, and
 * the Ghanaian school week does start on Monday, so the label is the fact rather than a
 * convenience.
 */
export const periodAxisLabel = (period = '') => {
  const [year, month, day] = period.split('-').map(Number);
  if (!year || !month) return period;
  const monthName = new Date(year, month - 1, 1).toLocaleString('en-GB', { month: 'short' });
  if (!day) return monthName;
  return `w/c ${day} ${monthName}`;
};

/** `2026-03-01` / `2026-03` / `2026-03-02` → `1 Mar 2026`, for a tooltip or a caption. */
export const periodFullLabel = (period = '') => {
  const [year, month, day] = period.split('-').map(Number);
  if (!year || !month) return period;
  if (!day) return new Date(year, month - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  return new Date(year, month - 1, day).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

/** Every month key from `from` to `to` inclusive, as `YYYY-MM`. */
export const monthKeysBetween = (from, to) => {
  const start = new Date(from);
  const end = new Date(to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
  const keys = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  while (cursor <= end && keys.length < 240) {
    keys.push(`${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return keys;
};

/** First day of the current month as `YYYY-MM-DD` — the window the Overview reports on. */
export const thisMonthStart = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);
};

/**
 * Why a null is rendered as an em dash rather than `0%`.
 *
 * Every rate on these payloads comes from the service's `percent()`, which returns
 * **`null` when the denominator is zero** and a real number otherwise
 * (`analytics.service.js:200-211`) — the opposite of the school console's `rate()`,
 * which returns `0`. The distinction is the whole point of the function: "no school in
 * this window churned" and "there were no schools to churn" are different facts, and
 * collapsing them to `0%` is how a young platform reports zero churn forever.
 *
 * `expected` is the companion figure that disambiguates them, so the guard is on the
 * denominator and never on the rate — a genuine 0% with a non-zero denominator must
 * still print `0%`. Mirrors `Rate` in `pages/dashboard/Reports.jsx`.
 */
export const rateIsDefined = (value) => value !== null && value !== undefined;

/**
 * The reasons `getAtRiskSchools` can report, worded for a person.
 *
 * Mirrors the codes at `analytics.service.js:1740-1751` and the `definitions` block the
 * endpoint returns alongside the rows. Written here rather than read from
 * `data.definitions` because the definitions are prose sentences and these are labels
 * that sit inside a `<li>` next to a school's name; showing "A school with nobody on it
 * is not a churn risk, it is an unfinished setup, and the fix is a different person
 * being called" as a row badge is worse than useless.
 *
 * `zero_students` is the one the panel's design turns on, and the reason is the
 * difference between two conversations: no payments **with** a roster is a live school
 * whose parents have stopped paying; no payments **without** a roster is a signup that
 * never started, and calling them to chase fees wastes both their time and the operator's.
 */
export const AT_RISK_REASONS = {
  no_payment_14d: {
    label: 'No payment in 14+ days',
    tone: 'amber',
    meaning: 'Nothing has completed on this school’s account for two weeks. With students on the roster this is a collection problem.',
  },
  subscription_past_due: {
    label: 'Subscription past due',
    tone: 'red',
    meaning: '`subscription.status` is `expired`. This is a billing conversation, not a support one.',
  },
  zero_students: {
    label: 'No students',
    tone: 'slate',
    meaning: 'The roster is empty. Nothing has been billed because nothing has been set up — the fix is finishing onboarding, not chasing fees.',
  },
};

export const atRiskReason = (code) =>
  AT_RISK_REASONS[code] || { label: String(code), tone: 'slate', meaning: '' };
