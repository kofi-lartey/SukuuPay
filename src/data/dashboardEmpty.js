/**
 * The Overview's empty baseline — **zeros, not figures**.
 *
 * This file replaced `data/dashboardDemo.js`, which held a complete fictional
 * school: "Prampram Basic School", 1,000 students, GH₵ 318,000 collected, a
 * ten-week collections curve and six invented payment records. It was documented
 * as a fallback and it was not one. `useDashboardOverview` only ever replaced
 * three regions from the API, so the rest rendered for every signed-in bursar on
 * a live deployment — the school name and term in the persistent header included,
 * next to a green "Live sync active" badge. The per-card "demo data" captions
 * were gated on a single page-level `isDemo` flag that flipped to false on the
 * first successful request, so they never appeared either.
 *
 * So there is nothing to fall back to. The page starts at zero and every region
 * is filled from a real endpoint, or left empty and said so.
 *
 * The shape is deliberately identical to what the cards expect, so a region that
 * cannot be loaded renders an honest empty state instead of `undefined`.
 */
export const EMPTY_SCHOOL = {
  name: '',
  city: '',
  schoolCode: '',
};

/**
 * The term comes from `school.academic` — there is no other source.
 *
 * `week`, `weeksElapsed`, `weekLabel`, `peakInflow` and `targetThreshold` are
 * gone with the fixture and are not coming back: the School model has no current
 * week, no peak, and no term revenue target, and no endpoint computes them. The
 * Collections card reads only what exists.
 */
export const EMPTY_TERM = {
  term: '',
  academicYear: '',
  label: '',
};

export const EMPTY_KPIS = {
  totalStudents: { value: 0 },
  expectedOwed: { amount: 0 },
  // `ratePercent` is the only derived figure here, and it is computed from
  // `collected / expectedOwed` in the hook — never stored.
  collected: { amount: 0, ratePercent: 0, rateLabel: 'Collection Rate' },
  overdue: { students: 0, amount: 0 },
};

/**
 * `GET /reports/payment-methods/:schoolId`.
 *
 * Populated from `rows: [{ label, amount, count, percentage }]`. Note the
 * fixture's shape was different and wrong about the world: it claimed a per
 * network split with an authorisation rate per network and a count of
 * "accounts", none of which the endpoint returns. It groups by payment method
 * and reports a count of *transactions*.
 */
export const EMPTY_CHANNELS = [];

/** `GET /payments` — empty until the school has actually taken a payment. */
export const EMPTY_TRANSACTIONS = [];

/**
 * The weekly collections series.
 *
 * `getWeeklyCollections` throws by design: teaching weeks have to be bucketed
 * against the school calendar, and a naive `date % 7` would mislabel every week
 * on a Ghanaian school timetable. There is no honest series to show, so the card
 * renders an empty state until the route lands.
 */
export const EMPTY_WEEKLY_INFLOW = [];

/**
 * Upcoming installment tranches.
 *
 * `getUpcomingInstallments` throws for the same reason — the closest route
 * returns compliance, not a dated list of the next tranches.
 */
export const EMPTY_UPCOMING = {
  horizonDays: 0,
  scheduledTranches: 0,
  expectedInflow: 0,
  days: [],
};

/**
 * The overdue broadcast.
 *
 * `recipientCount` is real — `GET /reports/outstanding/:schoolId` reports
 * `summary.studentCount`. The fixture's `templateName`, `preview` sentence and
 * `creditUnits` had no source at all: the template is a school's own SMS
 * template and the credit is a school-scoped balance that does not exist as an
 * endpoint. Both were invented numbers on a card whose button sends real,
 * billed SMS to real parents.
 */
export const EMPTY_BROADCAST = {
  recipientCount: 0,
  fullyUnpaidCount: 0,
  partiallyPaidCount: 0,
  totalOutstanding: 0,
};

export const EMPTY_OVERVIEW = {
  school: EMPTY_SCHOOL,
  term: EMPTY_TERM,
  kpis: EMPTY_KPIS,
  channels: EMPTY_CHANNELS,
  transactions: EMPTY_TRANSACTIONS,
  transactionCount: 0,
  weeklyInflow: EMPTY_WEEKLY_INFLOW,
  upcomingInstallments: EMPTY_UPCOMING,
  smsBroadcast: EMPTY_BROADCAST,
};

export default EMPTY_OVERVIEW;
