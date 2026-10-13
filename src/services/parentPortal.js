/**
 * The parent portal's service layer for its new surfaces.
 *
 * ## Why this file exists rather than a `useEffect` with an import
 *
 * Every page here reads fixture data today. When the backend grows the
 * attendance, academics, timetable, notifications and message-thread endpoints,
 * the *pages must not change* — only these functions do: each becomes one
 * `api.get('/pay/:token/...')` behind the same token-first signature
 * `services/parentPay.js` already uses for the fee surfaces. A page that
 * imports fixtures directly would need editing at every one of those call
 * sites later.
 *
 * ## The latency is deliberate
 *
 * A fixture that resolves synchronously makes every skeleton and empty state
 * dead code on screen — they would exist but could never be seen, and paths
 * that are never exercised in dev are paths that break in production. So reads
 * take a moment, like the network they stand in for. Writes resolve
 * optimistically and are echoed back, which is the shape the real calls will
 * have too.
 *
 * ## The token stays first, even for fixtures
 *
 * `parentPay.js` takes the token explicitly on every call because a pay link is
 * opened on shared phones, and a service that inferred whose data to return
 * from anything other than its argument would eventually return someone
 * else's. These functions take it and pass it through untouched.
 */

import {
  attendanceLog,
  attendanceMonths,
  attendanceSummary,
  profile as profileFixture,
  bill as billFixture,
  notifications as notificationsFixture,
  reportCards,
  termTabs,
  subjectTrends,
  timetable,
  timetableToday,
  PERIODS,
  assignments,
  schoolEvents,
  notices,
  threads,
} from '../data/parent';

/** Enough of a pause to exercise the loading paths; zero in production later. */
const FIXTURE_LATENCY_MS = 220;

/**
 * Resolves fixture `data` after the standing latency.
 *
 * `endpoint` is documentation, not behaviour — the path this call will make when
 * the route exists. It is kept as the first argument so the seam is visible in
 * the one place a reader will look for it. The resolved value is the payload
 * itself, already unwrapped, exactly as `parentPay.js` returns them.
 */
const fixture = (endpoint, data) =>
  new Promise((resolve) => {
    setTimeout(() => resolve(data), FIXTURE_LATENCY_MS);
  });

// ──────────────────── Reads ────────────────────

/** Term-to-date summary, calendar months and the detailed log. */
export const fetchAttendance = (token) =>
  fixture('/pay/:token/attendance', {
    summary: attendanceSummary,
    months: attendanceMonths,
    log: attendanceLog,
  });

/** One term's report card, with the tabs that select it. */
export const fetchAcademics = (token, termId = 't2') =>
  fixture('/pay/:token/records', {
    tabs: termTabs,
    term: reportCards[termId] || reportCards.t2,
    // Per-subject term-on-term movement, keyed by subject name. Returned with
    // the card rather than imported by pages, so the subject-detail rows on
    // Records cannot drift from the card they sit under.
    trends: subjectTrends,
  });

/** The week grid, assignments and the school's dated events. */
export const fetchTimetable = (token) =>
  fixture('/pay/:token/timetable', {
    week: timetable,
    today: timetableToday,
    periods: PERIODS,
    assignments,
    events: schoolEvents,
  });

/** Notice board broadcasts and the parent's threads. */
export const fetchMessages = (token) =>
  fixture('/pay/:token/messages', { notices, threads });

/**
 * Just the notice board, for pages that surface the school's latest broadcast
 * without opening the messaging surface — Home's announcement banner reads one
 * pinned notice and should not have to load every thread to get it.
 */
export const fetchNotices = (token) => fixture('/pay/:token/notices', { notices });

/** The feed behind the bell. */
export const fetchNotifications = (token) =>
  fixture('/pay/:token/notifications', { notifications: notificationsFixture });

/** Parent identity, wards, school, preferences, saved payment methods. */
export const fetchProfile = (token) => fixture('/pay/:token/profile', profileFixture);

/** The itemised term bill. */
export const fetchBill = (token) => fixture('/pay/:token/bill', billFixture);

// ──────────────────── Writes ────────────────────

/**
 * Appends a parent message to a thread.
 *
 * Resolves with the message as the server will echo it — id, timestamp and
 * sender — so the page can render it without inventing any of those. The real
 * call is `POST /pay/:token/messages/:threadId`; the optional voice note is
 * multipart, exactly as `notifySchool` already does it.
 */
export const sendThreadMessage = (token, threadId, { body = '', voiceNote = null } = {}) =>
  fixture(`/pay/:token/messages/${threadId}`, {
    id: `m-local-${Date.now()}`,
    from: 'parent',
    body,
    voiceNote,
    at: 'Just now',
  });

/** Marks notifications read — the bell's badge count drops off this. */
export const markNotificationsRead = (token, ids = []) =>
  fixture('/pay/:token/notifications/read', { ids });

/** Persists one preference toggle. */
export const savePreference = (token, id, enabled) =>
  fixture('/pay/:token/profile/preferences', { id, enabled });

/** Marks an assignment seen. Never submitted-on-behalf; see the fixture note. */
export const markAssignmentSeen = (token, id) =>
  fixture(`/pay/:token/timetable/assignments/${id}/seen`, { id });

/**
 * The fee-surface reads the portal already had, re-exported so a page that
 * shows the new surfaces next to real fee data — Home, Fees & Bills — imports
 * one service instead of picking between two.
 */
export { fetchPaymentHistory } from './parentPay';
