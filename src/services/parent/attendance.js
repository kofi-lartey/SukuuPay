import apiClient from './apiClient';

/**
 * Attendance for one student in one term.
 *
 * Returns the summary (rate, present/late/absent counts) plus the
 * per-month breakdown and the recent log entries, so the Attendance page
 * can render everything from one call.
 */
export const fetchAttendance = (token, { term } = {}) =>
  apiClient.get(`/pay/${encodeURIComponent(token)}/attendance`, {
    params: term ? { term } : undefined,
  });

/**
 * Single-student attendance detail. Called from the parent portal's
 * profile screen when a sibling is linked.
 */
export const fetchStudentAttendance = (token, studentId, { term } = {}) =>
  apiClient.get(
    `/pay/${encodeURIComponent(token)}/students/${encodeURIComponent(studentId)}/attendance`,
    { params: term ? { term } : undefined }
  );
