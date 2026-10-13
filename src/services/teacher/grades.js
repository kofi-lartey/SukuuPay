import apiClient from './apiClient';

/**
 * Grades and report cards.
 *
 * The same split as `attendance.js`: reading a class's marks is the teacher's
 * own work (`/teacher/grades`), while compiling and publishing terminal
 * reports is a school-wide act that already lives in the records controller at
 * `/admin/records/*` — and that controller is where the `teacher` may compile
 * but only an admin may publish boundary is drawn
 * (`Backend/src/routes/admin.records.routes.js`). The UI mirrors that split
 * rather than re-deciding it: `CompileReports` offers both steps and lets the
 * server refuse the second one.
 *
 * `subject` is passed through as-is. A teacher entering "Maths" and a
 * headteacher expecting "Mathematics" is a data-quality problem for the school
 * to solve in settings, not something a query param should silently normalise.
 */
export const fetchClassGrades = (className, { term, academicYear, subject } = {}) =>
  apiClient.get('/teacher/grades', {
    params: { className, term, academicYear, subject },
  });

export const fetchStudentGrades = (studentId, { term, academicYear } = {}) =>
  apiClient.get(`/teacher/students/${studentId}/grades`, {
    params: { term, academicYear },
  });

/** One student, one score. */
export const saveGrade = (payload) =>
  apiClient.post('/teacher/grades/single', payload);

/**
 * The whole class in one call.
 *
 * The single-grade endpoint above exists for a correction after the fact; the
 * bulk one is the working path, because a teacher with thirty students and one
 * flaky connection should not end the term with a half-saved column. Sending
 * the class as one payload also means the server can reject the batch on a
 * validation error before any of it lands.
 */
export const saveGradesBulk = (payload) =>
  apiClient.post('/teacher/grades/bulk', payload);

/** Turns the class's grades into report cards. Does not show them to anyone. */
export const compileClassReportCards = (payload) =>
  apiClient.post('/admin/records/compile', payload);

/** Makes compiled reports visible to parents. Irreversible from the UI. */
export const publishClassReportCards = (payload) =>
  apiClient.post('/admin/records/publish', payload);
