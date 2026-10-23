import apiClient from './apiClient';

/**
 * Teacher attendance — register reads/writes plus punctuality acceptance.
 *
 * The register itself is written through the shared `/admin/attendance/*`
 * endpoints (gated to teacher/school_admin), because the write shape is
 * identical to the school console's. Reads stay on the teacher surface so the
 * UI never has to cross into `/admin`.
 *
 * Response shape: `{ success, message, data }`; the interceptor unwraps to
 * `response.data`, so each function returns the envelope's `data`.
 */

export const fetchClassRoster = (className) =>
  apiClient.get('/teacher/classes/roster', { params: { className } });

export const fetchAttendanceForDate = (className, date) =>
  apiClient.get('/teacher/attendance', { params: { className, date } });

export const fetchStudentAttendance = (studentId, { term } = {}) =>
  apiClient.get(`/teacher/students/${encodeURIComponent(studentId)}/attendance`, {
    params: term ? { term } : undefined,
  });

export const markAttendanceBulk = (payload) =>
  apiClient.post('/admin/attendance/bulk', payload);

export const autoMarkPresent = (payload) =>
  apiClient.post('/admin/attendance/auto-present', payload);

/**
 * Teacher punctuality — accepting the current period.
 *
 * The teacher's dashboard shows a "Current Period" widget while a period is
 * running. Tapping "Accept Class" posts to `/teacher/accept-period`, which
 * writes a `present` or `late` row to `TeacherAttendance`. The server decides
 * the status from the wall-clock start time of the period against the moment
 * the teacher accepted, so a teacher who accepts more than ten minutes after
 * the period began is marked late.
 */
export const acceptCurrentPeriod = (payload) =>
  apiClient.post('/teacher/accept-period', payload);