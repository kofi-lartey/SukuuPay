/**
 * Attendance fixtures — the data behind the Attendance page (approved design mock).
 *
 * ## Shape, and why it is a day map rather than a list
 *
 * The calendar is the primary view and the log is secondary, so the month is
 * stored as `days` — an ISO-date → status map — and the log is derived from it
 * plus the detail rows. A live endpoint will return the same shape from the
 * roll-call service; a list of log rows would force the calendar to reconstruct
 * the month and get "was there school on this day" wrong.
 *
 * Statuses: `present` · `late` (counts as present in the rate, shown amber) ·
 * `absent` (red, the only status that triggers the parent SMS).
 */

import { DEMO_TODAY } from './context';

/** ISO date for the anchor, so fixtures never depend on the reader's clock. */
const iso = (day) => `2026-10-${String(day).padStart(2, '0')}`;
const isoSeptember = (day) => `2026-09-${String(day).padStart(2, '0')}`;

/**
 * Every weekday of September 2026 as present, except the rain-delayed 25th.
 *
 * Enumerated rather than typed so the day count (22) is a property of the data
 * instead of a constant that could disagree with it — the summary line on the
 * page reads the same map.
 */
const septemberDays = {};
for (let day = 1; day <= 30; day += 1) {
  const date = new Date(Date.UTC(2026, 8, day));
  const weekday = date.getUTCDay();
  if (weekday === 0 || weekday === 6) continue;
  septemberDays[isoSeptember(day)] = day === 25 ? 'late' : 'present';
}

/**
 * October, as the mock draws it: recorded through today (the 7th), with the
 * sick day on the 3rd, the traffic late on the 4th, and the rest present.
 */
const octoberDays = {
  [iso(1)]: 'present',
  [iso(2)]: 'present',
  [iso(3)]: 'absent',
  [iso(4)]: 'late',
  [iso(5)]: 'present',
  [iso(6)]: 'present',
  [iso(7)]: 'present',
};

/** Term-to-date summary. `rate` is present ÷ recorded days, as a whole percent. */
export const attendanceSummary = {
  termLabel: 'Term 2',
  totalDays: 50,
  present: 47,
  late: 2,
  absent: 1,
  target: 90,
};

/**
 * The log rows, newest first, with the detail the calendar cannot carry:
 * arrival time, the reason, and who marked it. `markedBy` is on every row —
 * a parent is far more likely to trust — and to report a discrepancy on — an
 * entry that says which teacher recorded it.
 */
export const attendanceLog = [
  {
    date: iso(7),
    weekday: 'Wed',
    dateLabel: 'Wed 07 Oct 2026',
    status: 'present',
    isToday: true,
    arrival: '8:15 am',
    note: 'Marked by Mrs. Evelyn Owusu',
    detail: 'Kwame arrived at JHS 2A homeroom',
  },
  {
    date: iso(4),
    weekday: 'Fri',
    dateLabel: 'Fri 04 Oct 2026',
    status: 'late',
    arrival: '8:42 am',
    note: 'Traffic on Dawhenya road',
    detail: 'Arrived 8:42 am · Traffic on Dawhenya road',
  },
  {
    date: iso(3),
    weekday: 'Thu',
    dateLabel: 'Thu 03 Oct 2026',
    status: 'absent',
    note: 'Sick, parent notified by SMS',
    detail: 'Sick, parent notified by SMS',
    notifiedBySms: true,
  },
  {
    date: iso(2),
    weekday: 'Wed',
    dateLabel: 'Wed 02 Oct 2026',
    status: 'present',
    arrival: '7:40 am',
    note: 'Regular check-in',
    detail: 'Regular check-in · 7:40 am',
  },
  {
    date: iso(1),
    weekday: 'Thu',
    dateLabel: 'Thu 01 Oct 2026',
    status: 'present',
    arrival: '7:35 am',
    note: 'Regular check-in',
    detail: 'Regular check-in · 7:35 am',
  },
  {
    date: isoSeptember(30),
    weekday: 'Wed',
    dateLabel: 'Wed 30 Sep 2026',
    status: 'present',
    arrival: '7:48 am',
    note: 'Regular check-in',
    detail: 'Regular check-in · 7:48 am',
  },
  {
    date: isoSeptember(29),
    weekday: 'Tue',
    dateLabel: 'Tue 29 Sep 2026',
    status: 'present',
    arrival: '7:39 am',
    note: 'Regular check-in',
    detail: 'Regular check-in · 7:39 am',
  },
  {
    date: isoSeptember(28),
    weekday: 'Mon',
    dateLabel: 'Mon 28 Sep 2026',
    status: 'present',
    arrival: '7:41 am',
    note: 'Regular check-in',
    detail: 'Regular check-in · 7:41 am',
  },
  {
    date: isoSeptember(25),
    weekday: 'Fri',
    dateLabel: 'Fri 25 Sep 2026',
    status: 'late',
    arrival: '8:15 am',
    note: 'Rain delay',
    detail: 'Arrived 8:15 am · Rain delay',
  },
  {
    date: isoSeptember(24),
    weekday: 'Thu',
    dateLabel: 'Thu 24 Sep 2026',
    status: 'present',
    arrival: '7:30 am',
    note: 'Regular check-in',
    detail: 'Regular check-in · 7:30 am',
  },
];

/**
 * The months the calendar renders, newest first.
 *
 * `days` drives both the grid and the per-month rate, so the "91.6%" style
 * figures on the page are computed rather than stored — two numbers that can
 * disagree are two numbers a parent can catch.
 */
export const attendanceMonths = [
  {
    monthKey: '2026-10',
    monthLabel: 'October 2026',
    days: octoberDays,
  },
  {
    monthKey: '2026-09',
    monthLabel: 'September 2026',
    days: septemberDays,
  },
];

/** The ISO date the calendar rings as today. */
export const attendanceToday = iso(7);

export { DEMO_TODAY };
