import apiClient from './apiClient';

/**
 * Attendance reads and writes.
 *
 * Two different servers are behind this file and the split is deliberate.
 * The reads are the teacher's own roster and their own marks — `/teacher/*`
 * scopes them to the signed-in teacher, so no teacher can pull another's
 * class list by guessing a name. The two writes are `/admin/attendance/*`,
 * which is where the school's attendance controller already lives and already
 * authorises `teacher` (see `Backend/src/routes/admin.attendance.routes.js`).
 * Pointing them at a second, teacher-flavoured copy of the same validator
 * would buy nothing and cost a second schema to keep in step.
 */

/** Every student the teacher is responsible for in one class. */
export const fetchClassRoster = (className) =>
  apiClient.get('/teacher/classes/roster', { params: { className } });

/** The marks already recorded for a class on one date, if any. */
export const fetchAttendanceForDate = (className, date) =>
  apiClient.get('/teacher/attendance', { params: { className, date } });

/** One call for the whole class. `marks` is the array built by `TakeAttendance`. */
export const markAttendanceBulk = (payload) =>
  apiClient.post('/admin/attendance/bulk', payload);

/**
 * Server-side "everyone in, no exceptions".
 *
 * The teacher can do this locally in one tap, so why the round trip: the
 * controller is the only place that knows a student who has already been
 * marked absent today, or who transferred out since the roster was cached.
 * A local mark-all would happily overwrite both.
 */
export const autoMarkPresent = (payload) =>
  apiClient.post('/admin/attendance/auto-present', payload);

/**
 * One student's attendance history, for the per-student view.
 *
 * `term` is omitted from the query string rather than sent as `undefined`,
 * which axios would serialise as the literal string `term=undefined` and the
 * server would read as a term nobody has heard of.
 */
export const fetchStudentAttendance = (studentId, { term } = {}) =>
  apiClient.get(`/teacher/students/${studentId}/attendance`, {
    params: term ? { term } : undefined,
  });
