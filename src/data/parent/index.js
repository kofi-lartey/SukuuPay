/**
 * The parent portal's new-surface fixtures, in one import.
 *
 * Pages should import from here rather than reaching into the individual
 * modules, so the fixture layout can change without touching a page — the same
 * reason `services/parentPortal.js` is the only module that knows these are
 * fixtures at all.
 */

export { DEMO_TODAY, DEMO_STUDENT, DEMO_SCHOOL, DEMO_TERMS, DEMO_CURRENT_TERM_ID } from './context';
export {
  attendanceSummary,
  attendanceLog,
  attendanceMonths,
  attendanceToday,
} from './attendance';
export { reportCards, termTabs, gradeFor, aggregateFor, subjectTrends } from './academics';
export { timetable, timetableToday, PERIODS, assignments, schoolEvents } from './timetable';
export { notices, threads } from './messages';
export { notifications, unreadNotificationCount } from './notifications';
export { profile, bill } from './profile';
