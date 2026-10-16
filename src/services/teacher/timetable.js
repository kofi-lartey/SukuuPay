import apiClient from './apiClient';

/**
 * Teacher timetables — draft, submit for approval, withdraw, and read.
 *
 * All endpoints are teacher-scoped: the server resolves the caller's classes
 * from the JWT, so a teacher can only touch timetables for classes they are
 * assigned to. Drafts are saved through the shared `PUT /admin/timetables`
 * endpoint (gated to `teacher`), because the write shape is identical to the
 * admin console's; only the submit / withdraw / read actions live here.
 *
 * Response shape: `{ success, message, data }`; the interceptor unwraps to
 * `response.data`, so each function returns the envelope's `data`.
 */
export const fetchMyTimetables = ({ term, academicYear } = {}) =>
  apiClient.get('/teacher/timetables', {
    params: term || academicYear ? { term, academicYear } : undefined,
  });

export const fetchMyTimetable = (className, { term, academicYear } = {}) =>
  apiClient.get(
    `/teacher/timetables/${encodeURIComponent(className)}`,
    { params: term || academicYear ? { term, academicYear } : undefined }
  );

/**
 * Save (or create) a draft timetable for one of the teacher's classes.
 *
 * Reuses the admin console's `PUT /admin/timetables`, which is gated to
 * `teacher` and already enforces the edit lock: a submitted, approved or
 * published timetable cannot be overwritten. The server stamps `submittedBy`
 * from the JWT, so the teacher need not send it.
 */
export const saveTimetableDraft = (payload) =>
  apiClient.put('/admin/timetables', payload);

/**
 * Send a draft to the administrator for review. Locks the timetable until the
 * administrator approves, rejects, or the teacher withdraws it.
 */
export const submitTimetable = (className, { term, academicYear }) =>
  apiClient.post(`/teacher/timetables/${encodeURIComponent(className)}/submit`, {
    term,
    academicYear,
  });

/**
 * Pull a submitted timetable back before the administrator acts on it.
 * Returns it to `draft` and re-enables editing.
 */
export const withdrawTimetable = (className, { term, academicYear }) =>
  apiClient.post(`/teacher/timetables/${encodeURIComponent(className)}/withdraw`, {
    term,
    academicYear,
  });
