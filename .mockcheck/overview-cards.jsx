/**
 * Renders the Overview cards against **realistic API payloads**, not skeletons.
 *
 * The `.map`-on-an-object crash could not be found by rendering the console normally:
 * every card renders a loading skeleton on mount and only renders data inside a
 * `.then`, which never runs under `renderToString`. So this harness hands each card
 * the exact shape `Backend/src/services/admin/{analytics,health}.service.js` produces,
 * with `loading: false`, and asserts it renders.
 *
 * The payloads are hand-copied from the services and the assertions check the card's
 * own numbers against them, so a card cannot pass by rendering nothing.
 */
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';
import { ToastProvider } from '../src/context/ToastContext.jsx';
import HealthCard from '../src/pages/admin/overview/HealthCard.jsx';
import EconomicsRow from '../src/pages/admin/overview/EconomicsRow.jsx';
import AtRiskCard from '../src/pages/admin/overview/AtRiskCard.jsx';
import DisbursementQueueCard, {
  TopSchoolsCard,
} from '../src/pages/admin/overview/DisbursementQueueCard.jsx';

/** Exactly what `getSystemHealth()` returns (health.service.js:751-770). */
const HEALTH = {
  success: true,
  data: {
    status: 'degraded',
    timestamp: new Date().toISOString(),
    totalMs: 42,
    // An OBJECT keyed by name — the thing `.map` was called on.
    dependencies: {
      mongodb: { name: 'MongoDB', required: true, status: 'ok', detail: 'connected' },
      cloudinary: { name: 'Cloudinary', required: false, status: 'ok', detail: 'configured' },
      hubtel: { name: 'Hubtel', required: false, status: 'degraded', detail: 'networkProbe: false' },
      sms: { name: 'Arkesel SMS', required: false, status: 'ok', detail: 'arksel' },
      cron: { name: 'Cron jobs', required: false, status: 'ok', detail: '2 registered' },
    },
    summary: [
      { name: 'MongoDB', required: true, status: 'ok', detail: 'connected' },
      { name: 'Cloudinary', required: false, status: 'ok', detail: 'configured' },
      { name: 'Hubtel', required: false, status: 'degraded', detail: 'networkProbe: false' },
      { name: 'Arkesel SMS', required: false, status: 'ok', detail: 'arksel' },
      { name: 'Cron jobs', required: false, status: 'ok', detail: '2 registered' },
    ],
    requiredDependencies: ['mongodb'],
    uptime: { seconds: 7200, memoryMb: 128 },
  },
};

/** Exactly what `getPlatformOverview()` returns (analytics.service.js:617-686). */
const OVERVIEW = {
  period: { from: '2026-10-01', to: '2026-10-31', monthLabel: '2026-10' },
  units: { money: 'integer pesewas', rates: 'percent, 0-100' },
  schools: {
    total: 42, active: 38, suspended: 3, archived: 1, onTrial: 5,
    newThisMonth: 4, newLastMonth: 2, growthPercent: 100,
  },
  students: { total: 5120, active: 4900, graduated: 220 },
  revenue: {
    arr: 21600000, arrBasis: 'projection: MRR x 12',
    collectedAllTime: 918000000, completedPaymentsAllTime: 41200,
    mrr: 1800000, mrrSchools: 12, thisMonth: 402000, thisMonthEntries: 1900,
  },
  churn: { churnedThisMonth: 1, activeAtMonthStart: 39, churnRatePercent: 2.56 },
};

/**
 * What the cards actually receive.
 *
 * Note the shape: `{ rows: [...] }`, not the server's `{ schools: [...] }`. That is
 * deliberate and is the thing being checked — `getAtRiskSchools`/`getTopSchools` in
 * `services/admin.js` run the list through `normaliseSchoolList`, and these cards read
 * `data.rows`. Passing the raw server shape here would test a payload the app never
 * delivers, and would have "passed" for `TopSchoolsCard` (which tolerates both) while
 * hiding that `AtRiskCard` depends entirely on the normaliser.
 */
const SCHOOLS = {
  rows: [
    {
      _id: '0123456789abcdef01234567', name: 'Prampram Basic School', region: 'Greater Accra',
      reasons: ['no_recent_payments'], studentCount: 412, lastPaymentAt: '2026-09-04T09:12:00.000Z',
    },
    {
      _id: '0123456789abcdef01234568', name: 'Kumasi Anglican', region: 'Ashanti',
      reasons: ['no_students'], studentCount: 0, lastPaymentAt: null,
    },
  ],
};

/** What `listDisbursements()` returns for the payout queue. */
const DISBURSEMENTS = {
  rows: [
    {
      _id: '0123456789abcdef01234569', batchNumber: 'DISB-2026-000123',
      schoolId: '0123456789abcdef01234567', schoolName: 'Prampram Basic School',
      netAmount: 2500000, paymentCount: 143, status: 'pending_approval',
    },
  ],
  meta: { page: 1, perPage: 50, total: 1, totalPages: 1 },
};

let failures = 0;

const check = (label, Card, state, mustContain = []) => {
  try {
    const html = renderToString(
      <ToastProvider>
        <MemoryRouter initialEntries={['/admin']}>
          <Card state={state} />
        </MemoryRouter>
      </ToastProvider>
    );

    const text = String(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    if (!text) {
      failures += 1;
      console.log(`EMPTY  ${label} — rendered nothing`);
      return;
    }

    for (const phrase of mustContain) {
      if (!text.includes(phrase)) {
        failures += 1;
        console.log(`MISSING ${label} — expected "${phrase}"`);
        console.log(`        got: ${text.slice(0, 200)}`);
        return;
      }
    }

    console.log(`ok     ${label}`);
  } catch (error) {
    failures += 1;
    console.log(`THREW  ${label} — ${error.message.split('\n')[0]}`);
  }
};

/**
 * The regression that started this. `data.dependencies` is an object; calling `.map`
 * on it throws `dependencies.map is not a function` and took the whole Overview with
 * it, because `AdminOverview` renders this card directly.
 */
check('HealthCard with the real health payload', HealthCard, { data: HEALTH.data, loading: false, error: null }, [
  'MongoDB', 'Hubtel', 'Arkesel', 'Up 2h 0m',
]);

check('EconomicsRow with the real overview payload', EconomicsRow, { data: OVERVIEW, loading: false, error: null }, [
  '18,000',   // mrr 1,800,000 pesewas → GHS 18,000
  '216,000',  // arr 21,600,000 pesewas → GHS 216,000
  'projected',
]);

/**
 * The inverse check, because "renders nothing" is sometimes the *correct* answer.
 *
 * `EconomicsRow` returns `null` when the request failed, on purpose: four zero tiles
 * would read as "MRR is zero, churn is zero", and "churn zero" in particular reads as
 * wonderful rather than as unknown. So for this one case an empty render is the pass
 * condition, and a harness that only ever asserts "something rendered" would flag the
 * behaviour it was written to protect.
 */
const checkEmpty = (label, Card, state) => {
  try {
    const html = renderToString(
      <ToastProvider>
        <MemoryRouter initialEntries={['/admin']}>
          <Card state={state} />
        </MemoryRouter>
      </ToastProvider>
    );

    if (String(html).replace(/<[^>]+>/g, '').replace(/\s/g, '')) {
      failures += 1;
      console.log(`RENDERED ${label} — should have rendered nothing`);
      return;
    }
    console.log(`ok     ${label}`);
  } catch (error) {
    failures += 1;
    console.log(`THREW  ${label} — ${error.message.split('\n')[0]}`);
  }
};

checkEmpty('EconomicsRow hides itself when the request failed', EconomicsRow, {
  data: null,
  loading: false,
  error: new Error('boom'),
});

check('AtRiskCard with the real schools payload', AtRiskCard, { data: SCHOOLS, loading: false, error: null }, [
  'Prampram Basic School', 'Kumasi Anglican', 'No payment in 14+ days', 'No students',
]);

check('TopSchoolsCard with the real schools payload', TopSchoolsCard, { data: SCHOOLS, loading: false, error: null }, [
  'Prampram Basic School',
]);

check(
  'DisbursementQueueCard with the real disbursements payload',
  DisbursementQueueCard,
  { data: DISBURSEMENTS, loading: false, error: null },
  ['Prampram Basic School', 'DISB-2026-000123', '25,000']
);

console.log(failures ? `\n${failures} failed` : '\nall cards rendered with real payloads');
process.exit(failures ? 1 : 0);