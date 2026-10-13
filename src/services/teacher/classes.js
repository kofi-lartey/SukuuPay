import apiClient from './apiClient';

/**
 * Classes, schedule and dashboard.
 *
 * All three are teacher-scoped: the server resolves them from the JWT rather
 * than from a school id in the query, so no teacher can pull another's
 * timetable or a headcount they have no business seeing. Nothing here takes a
 * `schoolId` for that reason — adding one would be the first step towards a
 * roster leak.
 */
export const fetchMyClasses = () =>
  apiClient.get('/teacher/classes');

/**
 * One class's headline figures for the term.
 *
 * `encodeURIComponent` on the segment, not just the params: a Ghanaian class
 * name is routinely written "JHS 2A", and the space — plus the slash a stream
 * like "JHS 2/A" would introduce — has to be encoded before it reaches the
 * router, or React Router reads the class name as two path segments and the
 * detail page loses its own subject.
 */
export const fetchClassSummary = (className, { term } = {}) =>
  apiClient.get(`/teacher/classes/${encodeURIComponent(className)}/summary`, {
    params: term ? { term } : undefined,
  });

/** The teacher's weekly timetable, grouped by day on the client. */
export const fetchMySchedule = () =>
  apiClient.get('/teacher/schedule');

/**
 * The landing screen's single payload.
 *
 * Deliberately one call rather than five: a teacher opening the portal on a
 * phone in a classroom is on the same metered connection as the parents this
 * app was built for, and the greeting plus today's pending attendance is not
 * worth five round trips.
 */
export const fetchDashboard = () =>
  apiClient.get('/teacher/dashboard');
