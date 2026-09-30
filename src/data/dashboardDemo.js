import { gh } from '../utils/format';

/**
 * The dashboard's demo dataset — **not real data**.
 *
 * It exists so the Overview can be designed, reviewed and screenshotted against
 * realistic magnitudes before the reports endpoints are consumed. Every card
 * that renders it says so: `useDashboardOverview` returns `isDemo`, and the
 * header swaps "LIVE SYNC ACTIVE" for a demo marker. Nothing here is presented
 * as a school's real position.
 *
 * The numbers are internally consistent rather than arbitrary, because a
 * reviewer adds them up and inconsistent fixtures get "fixed" into fiction:
 *   - the ten weekly inflows sum to exactly the GH₵ 318,000 headline
 *   - each week's three network splits sum to that week's total
 *   - the three network totals sum to 318,000, matching the headline
 *   - 680 + 220 + 100 accounts equals the 1,000 student headline
 *   - 8 + 11 + 4 scheduled tranches equals 23, and 2,400 + 3,300 + 1,200
 *     equals the GH₵ 6,900 expected inflow
 *   - collection rate 74.8% is 318,000 / 425,000
 * Changing one of these without the others is a bug.
 *
 * Amounts are pesewas, written through `gh()` so the literals stay readable
 * while the values stay wire-accurate. See `utils/format.js`.
 */

export const DEMO_SCHOOL = {
  name: 'Prampram Basic School',
  campus: 'Basic & JHS Campus',
  shortName: 'Prampram Basic Sch…',
};

export const DEMO_TERM = {
  term: 'Term 1',
  academicYear: '2025/2026',
  label: 'Academic Term 1',
  week: 10,
  weeksElapsed: 10,
  weekLabel: 'Week 10 Current',
  peakInflow: { week: 'Week 4', note: 'Re-opening week' },
  targetThreshold: gh(380000),
};

export const DEMO_SMS_CREDIT = { units: 1420, label: '1,420 SMS left' };

export const DEMO_KPIS = {
  totalStudents: {
    value: 1000,
    enrollmentPercent: 98,
    enrollmentNote: 'Enrolled in MoMo direct billing',
  },
  expectedOwed: {
    amount: gh(425000),
    scopeNote: 'Across all classes (P1 to JHS 3)',
  },
  collected: {
    amount: gh(318000),
    deltaPercent: 12,
    deltaLabel: 'vs L/T',
    ratePercent: 74.8,
    rateLabel: 'Collection Rate',
  },
  overdue: {
    students: 87,
    onGrace: 11,
    graceNote: 'on Installment grace',
    amount: gh(41200),
  },
};

/**
 * Weekly inflow, per network, in pesewas.
 *
 * `total` is carried explicitly rather than summed at render time: the KPI
 * headline and the chart's last point must be the same number, and computing
 * one of them by summing while the other is a stored field is how they drift.
 */
export const DEMO_WEEKLY_INFLOW = [
  { week: 'Wk 1', total: gh(12000), mtn: gh(8160), telecel: gh(2640), at: gh(1200) },
  { week: 'Wk 2', total: gh(22500), mtn: gh(15300), telecel: gh(4950), at: gh(2250) },
  { week: 'Wk 3', total: gh(38900), mtn: gh(26450), telecel: gh(8558), at: gh(3892) },
  { week: 'Wk 4', total: gh(76400), mtn: gh(51950), telecel: gh(16808), at: gh(7642) },
  { week: 'Wk 5', total: gh(31200), mtn: gh(21210), telecel: gh(6864), at: gh(3126) },
  { week: 'Wk 6', total: gh(34600), mtn: gh(23530), telecel: gh(7612), at: gh(3458) },
  { week: 'Wk 7', total: gh(28400), mtn: gh(19310), telecel: gh(6248), at: gh(2842) },
  { week: 'Wk 8', total: gh(41500), mtn: gh(28220), telecel: gh(9130), at: gh(4150) },
  { week: 'Wk 9', total: gh(19800), mtn: gh(13460), telecel: gh(4356), at: gh(1984) },
  { week: 'Wk 10', total: gh(12700), mtn: gh(8650), telecel: gh(2794), at: gh(1256) },
];

export const DEMO_CHANNELS = [
  {
    key: 'mtn',
    network: 'MTN MoMo',
    sharePercent: 68,
    accounts: 680,
    amount: gh(216240),
    authRatePercent: 99.4,
  },
  {
    key: 'telecel',
    network: 'Telecel Cash',
    sharePercent: 22,
    accounts: 220,
    amount: gh(69960),
    authRatePercent: 98.9,
  },
  {
    key: 'at',
    network: 'AT Money',
    sharePercent: 10,
    accounts: 100,
    amount: gh(31800),
    authRatePercent: 97.8,
  },
];

export const DEMO_TRANSACTIONS = [
  {
    id: 'txn-1',
    studentName: 'Kwame Mensah',
    studentCode: 'PBS-24-0412',
    className: 'JHS 2A',
    amount: gh(300),
    network: 'mtn',
    networkLabel: 'MTN MoMo',
    reference: 'TXN-9842193',
    dateLabel: 'Today',
    timeLabel: '10:42 AM',
  },
  {
    id: 'txn-2',
    studentName: 'Akosua Boateng',
    studentCode: 'PBS-24-0789',
    className: 'Class 5B',
    amount: gh(450),
    network: 'telecel',
    networkLabel: 'Telecel Cash',
    reference: 'TXN-9842698',
    dateLabel: 'Today',
    timeLabel: '09:15 AM',
  },
  {
    id: 'txn-3',
    studentName: 'Yaw Owusu',
    studentCode: 'PBS-23-0104',
    className: 'JHS 1',
    amount: gh(250),
    network: 'mtn',
    networkLabel: 'MTN MoMo',
    reference: 'TXN-9841926',
    dateLabel: 'Yesterday',
    timeLabel: '04:30 PM',
  },
  {
    id: 'txn-4',
    studentName: 'Abena Asante',
    studentCode: 'PBS-25-1102',
    className: 'Nursery 2',
    amount: gh(850),
    network: 'at',
    networkLabel: 'AT Money',
    reference: 'TXN-9841804',
    dateLabel: 'Yesterday',
    timeLabel: '02:15 PM',
  },
  {
    id: 'txn-5',
    studentName: 'Kofi Darko',
    studentCode: 'PBS-22-0055',
    className: 'JHS 3B',
    amount: gh(350),
    network: 'mtn',
    networkLabel: 'MTN MoMo',
    reference: 'TXN-9841772',
    dateLabel: '28 Oct 2026',
    timeLabel: '11:05 AM',
  },
  {
    id: 'txn-6',
    studentName: 'Efua Addo',
    studentCode: 'PBS-24-0341',
    className: 'Class 3A',
    amount: gh(200),
    network: 'telecel',
    networkLabel: 'Telecel Cash',
    reference: 'TXN-9841655',
    dateLabel: '28 Oct 2026',
    timeLabel: '08:22 AM',
  },
];

export const DEMO_TRANSACTION_COUNT = 438;

export const DEMO_UPCOMING_INSTALLMENTS = {
  horizonDays: 5,
  scheduledTranches: 23,
  expectedInflow: gh(6900),
  days: [
    { dateLabel: 'Tomorrow, 31 Oct', students: 8, amount: gh(2400) },
    { dateLabel: 'Friday, 1 Nov', students: 11, amount: gh(3300) },
    { dateLabel: 'Saturday, 2 Nov', students: 4, amount: gh(1200) },
  ],
};

export const DEMO_SMS_BROADCAST = {
  templateName: 'Overdue MoMo Prompt #1',
  recipientCount: 87,
  creditUnits: 1420,
  preview:
    'Dear Parent, please approve fee balance GH₵ (AMOUNT) for (STUDENT) via your MoMo prompt or dial *713#…',
};

export const DEMO_OVERVIEW = {
  school: DEMO_SCHOOL,
  term: DEMO_TERM,
  smsCredit: DEMO_SMS_CREDIT,
  kpis: DEMO_KPIS,
  weeklyInflow: DEMO_WEEKLY_INFLOW,
  channels: DEMO_CHANNELS,
  transactions: DEMO_TRANSACTIONS,
  transactionCount: DEMO_TRANSACTION_COUNT,
  upcomingInstallments: DEMO_UPCOMING_INSTALLMENTS,
  smsBroadcast: DEMO_SMS_BROADCAST,
};

export default DEMO_OVERVIEW;
