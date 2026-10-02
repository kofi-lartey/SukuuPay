/**
 * Finance vocabulary shared by every page and dialog in the platform console's
 * finance section.
 *
 * **A `.js` file, not a `.jsx` one, and deliberately.** The same argument
 * `hooks/useToast.js` makes for living outside the JSX graph: this module is
 * imported by pages *and* by plain logic, and keeping it JSX-free means a future
 * caller can reach for the status vocabulary from a `.js` file without pulling
 * the transform's JSX handling into that bundle's dependency graph.
 *
 * ### Why one module and not four copies
 *
 * A batch status maps to three things at once: the label a person reads, the
 * `Badge` tone that colour-codes it, and whether it is *actionable* — the list
 * offers Approve from `pending_approval` and Retry from `failed`, and both
 * readings come from the same enum the server validates against
 * (`listDisbursementsQuerySchema`). Four files each with their own copy of that
 * map is how the disbursements list ends up offering Retry on a `paid` batch,
 * or the detail screen colouring a `failed` batch in the pending colour. The
 * labels are ours to word; the values are not ours to choose, so they live beside
 * the wording and change together.
 *
 * ### The status table is a lifecycle, not a list
 *
 * `draft` → `pending_approval` → `approved` → `processing` → `paid`, with
 * `failed` reachable from `approved` and `cancelled` terminal
 * (`Backend/src/models/DisbursementBatch.js:85-96`). Two consequences the UI
 * leans on:
 *
 *   - **`paid` is the only state in which money has left.** `approved` means a
 *     human said yes and nothing has moved yet — which is the *current* real
 *     state of this platform, because `executePayoutProviderCall` throws
 *     `PayoutProviderNotWiredError` and the batch is parked at `approved` with
 *     `payoutReference: null` (`disbursements.service.js:120-161`). A UI that
 *     treats `approved` as "paid" would be wrong about every batch on the
 *     platform today, so `MONEY_MOVED_STATUSES` below is deliberately one entry.
 *   - **`attempts` is not a count of transfers sent.** It is incremented once on
 *     entering `processing` and again when a provider call fails
 *     (`disbursements.service.js:783`, `:279`), so the parked-`approved` case
 *     reads one attempt and zero calls. Both readings are correct; the column is
 *     for "has this been tried more than once", not for "how many transfers".
 */

/** `Badge` tones, from `components/dashboard/ui/Badge.jsx`. */
export const DISBURSEMENT_STATUS_TONES = {
  draft: 'slate',
  pending_approval: 'amber',
  approved: 'blue',
  processing: 'blue',
  paid: 'green',
  failed: 'red',
  cancelled: 'slate',
};

/** How a batch status is written for a person. */
export const DISBURSEMENT_STATUS_LABELS = {
  draft: 'Draft',
  pending_approval: 'Awaiting approval',
  approved: 'Approved — not yet sent',
  // Deliberately longer than the enum value. `approved` above already means
  // "signed off, nothing sent", and an operator who reads both as "Approved"
  // will conclude the second one moved the money.
  processing: 'Processing',
  paid: 'Paid',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

/**
 * The statuses in which money has actually left the gateway.
 *
 * One entry, mirroring `SETTLED_DISBURSEMENT_STATUSES`
 * (`Backend/src/models/DisbursementBatch.js`). The platform's own dashboard keys
 * `disbursedThisMonth` off this exact set and off `processedAt`
 * (`disbursements.service.js:1042-1050`), so the trend chart buckets on the same
 * rule — otherwise the chart and the KPI tile above it could disagree, which is
 * the specific thing this section exists to prevent.
 */
export const MONEY_MOVED_STATUSES = ['paid'];

/** `true` when this batch's `status` may be approved. */
export const canApprove = (status) => status === 'pending_approval';

/**
 * `true` when this batch may be retried.
 *
 * `failed` only, and the reason is worth keeping in view: retry re-uses the same
 * row (`disbursements.service.js:865-880`) precisely so it cannot create a second
 * batch over the same payments. A Retry control on any other status is a button
 * that can only return a 409 naming the status it found.
 */
export const canRetry = (status) => status === 'failed';

/** Status, plus whether it is still owed to the school. */
export const DISBURSEMENT_TONE = (status) => DISBURSEMENT_STATUS_TONES[status] || 'slate';
export const DISBURSEMENT_LABEL = (status) => DISBURSEMENT_STATUS_LABELS[status] || status || 'unknown';

/**
 * Ledger `type` → the label and tone a table cell uses.
 *
 * The tones are signed deliberately: `markup`/`platform_fee`/`subscription` are
 * credits and `refund`/`payout` are debits, so a ledger where the platform gave
 * money back reads as mostly red. That is the correct reading — `PlatformLedger`
 * is signed (`PlatformLedger.js:63-74`) and a refund is a reversal of something
 * that was counted, so it must stay visible in a "what did we earn" view rather
 * than being filtered out of it by virtue of being a refund.
 */
export const LEDGER_TYPE_TONES = {
  markup: 'green',
  platform_fee: 'green',
  subscription: 'green',
  sms: 'brand',
  gateway_fee: 'amber',
  refund: 'rose',
  payout: 'slate',
  adjustment: 'slate',
};

export const LEDGER_TYPE_LABELS = {
  markup: 'Markup',
  platform_fee: 'Platform fee',
  subscription: 'Subscription',
  sms: 'SMS',
  gateway_fee: 'Gateway fee',
  refund: 'Refund',
  payout: 'Payout',
  adjustment: 'Adjustment',
};

export const LEDGER_TONE = (type) => LEDGER_TYPE_TONES[type] || 'slate';
export const LEDGER_LABEL = (type) => LEDGER_TYPE_LABELS[type] || type || 'unknown';

/**
 * `true` when a ledger `type` normally credits the platform.
 *
 * Used only for the sign glyph's colour; the **sign itself always comes from the
 * stored `amount`**, never from this. A `refund` that somehow arrived positive
 * would be rendered green by this map and still print its `+`, because the glyph
 * and the colour are computed from different facts on purpose: the colour is
 * about intent, the sign is about arithmetic.
 */
export const LEDGER_TYPE_IS_CREDIT = (type) =>
  ['markup', 'platform_fee', 'subscription', 'sms', 'gateway_fee'].includes(type);

/**
 * `'2026-03-01'` for a `Date`, an ISO string, or `new Date()`.
 *
 * `toISOString().slice(0, 10)` rather than `getDate()`: Ghana is permanently
 * UTC+0 with no daylight saving (`utils/dateHelpers.js`), which is why
 * `utils/dates.js` formats everything in `Africa/Accra` — a named zone that
 * happens to equal UTC. Reading a date off a local calendar would be wrong for
 * every operator west of Greenwich and right for everyone else, which is the
 * worst kind of wrong: it is correct on the machine that wrote the fixture.
 */
export const isoDay = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
};

/** Today in Accra, as `YYYY-MM-DD`. The default for every date filter here. */
export const todayIsoDay = () => isoDay(new Date());

/** `shiftIsoDay('2026-03-01', -7)` → `'2026-02-22'`. */
export const shiftIsoDay = (day, days) => {
  const date = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return '';
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

/** The Monday of the week `day` falls in, as `YYYY-MM-DD`. */
export const mondayOfWeek = (day) => {
  const date = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return '';
  // `getUTCDay()` is 0 for Sunday; shifting by 6 makes Monday the origin.
  const offset = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - offset);
  return date.toISOString().slice(0, 10);
};

/** `'2026-03-02'` → `'2 Mar'`. Short, because these sit under a 1px-wide axis. */
export const weekLabel = (day) => {
  const date = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getUTCDate()} ${date.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' })}`;
};

/**
 * Weekly net disbursed, for the trend chart.
 *
 * ### Why this is computed here and not read from an endpoint
 *
 * **There is no disbursement time-series endpoint.** `getFinanceOverview`
 * returns four month-to-date aggregates, a per-school worklist capped at ten and
 * today's reconciliation (`disbursements.service.js:1158-1192`); the analytics
 * routes are all school-scoped. A curve drawn through `disbursedThisMonth` and a
 * single batch would be invented data wearing a chart's clothes, so the honest
 * alternative is to bucket real batches — which is what this does, over whatever
 * `listDisbursements` returned.
 *
 * **Bucketed on `processedAt`, filtered on `createdAt`.** Those are different
 * fields and the mismatch is the caveat this function cannot fix: the queue
 * endpoint's `from`/`to` filter `createdAt` (`disbursements.service.js:892`), so
 * a batch built before the window and paid inside it is not in the page at all
 * and cannot be counted. The consequence is stated on the chart rather than
 * hidden, because a week that dips because its batches were built in an earlier
 * window is exactly the kind of thing an operator would otherwise report as a
 * data bug.
 *
 * `weeks` consecutive buckets are always emitted, oldest first, including empty
 * ones. A missing week renders as a gap the interpolation draws a straight line
 * across, which reads as steady progress; an explicit `0` renders as a dip. The
 * `AreaChart` takes the difference seriously (`AreaChart.jsx:16-58` uses
 * Fritsch–Carlson monotone interpolation precisely so a smoothed curve cannot
 * invent a peak between two points).
 *
 * @param {Array} rows     batches from `listDisbursements`
 * @param {number} weeks   how many weeks back, inclusive of the current one
 */
export const weeklyDisbursementSeries = (rows = [], weeks = 8) => {
  const today = mondayOfWeek(todayIsoDay());
  const buckets = new Map();

  for (let back = weeks - 1; back >= 0; back -= 1) {
    const key = shiftIsoDay(today, -7 * back);
    buckets.set(key, { day: key, value: 0, batches: 0 });
  }

  (Array.isArray(rows) ? rows : []).forEach((batch) => {
    if (!MONEY_MOVED_STATUSES.includes(batch?.status)) return;
    const paid = isoDay(batch?.processedAt);
    if (!paid) return;
    const key = mondayOfWeek(paid);
    const bucket = buckets.get(key);
    if (!bucket) return; // outside the window, or already counted elsewhere
    bucket.value += Number(batch.netAmount) || 0;
    bucket.batches += 1;
  });

  return [...buckets.values()].map((bucket) => ({
    label: weekLabel(bucket.day),
    value: bucket.value,
    batches: bucket.batches,
  }));
};

/** `'2026-02-01'` → `'1 Feb 2026'`, for a period cell or a dialog subtitle. */
export const periodLabel = (start, end) => {
  const one = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? '—'
      : new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Africa/Accra',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }).format(date);
  };
  return `${one(start)} – ${one(end)}`;
};

/** The `YYYY-MM` month key the invoice endpoint requires. */
export const currentMonthKey = () => {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
};

/** Shift a `YYYY-MM` month key by whole months. `'2026-01', -1` → `'2025-12'`. */
export const shiftMonthKey = (key, months) => {
  const [year, month] = String(key || '').split('-').map(Number);
  if (!year || !month) return '';
  const date = new Date(Date.UTC(year, month - 1 + months, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
};

export default {
  DISBURSEMENT_STATUS_TONES,
  DISBURSEMENT_STATUS_LABELS,
  DISBURSEMENT_TONE,
  DISBURSEMENT_LABEL,
  MONEY_MOVED_STATUSES,
  canApprove,
  canRetry,
  LEDGER_TYPE_TONES,
  LEDGER_TYPE_LABELS,
  LEDGER_TYPE_IS_CREDIT,
  LEDGER_TONE,
  LEDGER_LABEL,
  isoDay,
  todayIsoDay,
  shiftIsoDay,
  mondayOfWeek,
  weekLabel,
  weeklyDisbursementSeries,
  periodLabel,
  currentMonthKey,
  shiftMonthKey,
};
