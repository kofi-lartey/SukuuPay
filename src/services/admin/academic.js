import api from '../api';
import { toApiError } from '../toApiError';
import { listUsers } from '../user';

/**
 * The headmaster's academic console, against `/api/admin/*` routes.
 *
 * Mounted at `/admin` on the server (see `Backend/src/routes/index.js`), but
 * rendered under `/dashboard/academics/*` on the client: the frontend `/admin`
 * shell is gated to `super_admin` by `AdminGuard`, while these endpoints are the
 * school's — gated on the server by `requireSchoolAdmin`. The path on the wire is
 * the backend's; the path in the address bar is the school console's. That split
 * is intentional and already exists: the teacher portal calls `/admin/records/*`
 * from `/teacher/*`.
 *
 * Every endpoint here is `requireSchoolAdmin` on the backend. The
 * `requireTeacher`-gated reads — the report review queue and the timetable
 * list/read — are deliberately NOT wired here: a headmaster would receive a 403,
 * and the teacher-facing versions of those surfaces already live in the teacher
 * portal (`EnterGrades`, `CompileReports`, `TeacherSchedule`).
 *
 * `className` is a URL path segment, so it is `encodeURIComponent`-ed at every
 * call site — a class name like `JHS 2/A` contains a slash and would otherwise
 * split the route. This mirrors the teacher portal's `TEACHER_ROUTES` factories.
 */

export const getAcademicOverview = async ({ term, academicYear } = {}) => {
  try {
    const { data } = await api.get('/admin/academic/overview', {
      params: { term, academicYear },
      timeout: 15000,
    });
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, 'The academic overview could not be loaded.');
  }
};

// ── Grade approval ────────────────────────────────────────────────────────────

/** The queue of submitted grade blocks awaiting the headmaster's approval. */
export const getGradeApprovalQueue = async ({ term, academicYear } = {}) => {
  try {
    const { data } = await api.get('/admin/grades/approval-queue', {
      params: { term, academicYear },
      timeout: 15000,
    });
    return data?.data || { queue: [] };
  } catch (error) {
    throw toApiError(error, 'The grade approval queue could not be loaded.');
  }
};

/** Approve one or more submitted grade blocks. `ids` narrows to a subset. */
export const approveGrades = async (payload) => {
  try {
    const { data } = await api.post('/admin/grades/approve', payload, { timeout: 30000 });
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, 'The grades could not be approved.');
  }
};

/** Reject a submitted block back to the teacher, with a required reason. */
export const rejectGrades = async (payload) => {
  try {
    const { data } = await api.post('/admin/grades/reject', payload, { timeout: 30000 });
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, 'The grades could not be rejected.');
  }
};

// ── Report cards ──────────────────────────────────────────────────────────────
//
// Only the headmaster's surface. The review-queue read (`requireTeacher`) and the
// compile step (`requireTeacher`) are in the teacher portal; this console owns
// the disclosure boundary — head remark, publish, unpublish — which is what
// makes a card visible to a parent.

export const setHeadRemark = async (payload) => {
  try {
    const { data } = await api.post('/admin/reports/head-remark', payload, { timeout: 30000 });
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, 'The head remark could not be saved.');
  }
};

export const publishReports = async (payload) => {
  try {
    const { data } = await api.post('/admin/reports/publish', payload, { timeout: 60000 });
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, 'The report cards could not be published.');
  }
};

export const unpublishReports = async (payload) => {
  try {
    const { data } = await api.post('/admin/reports/unpublish', payload, { timeout: 60000 });
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, 'The report cards could not be unpublished.');
  }
};

// ── Classes ───────────────────────────────────────────────────────────────────

export const listClasses = async ({ search } = {}) => {
  try {
    const { data } = await api.get('/admin/classes', {
      params: { search },
      timeout: 15000,
    });
    return data?.data || { classes: [] };
  } catch (error) {
    throw toApiError(error, 'The class list could not be loaded.');
  }
};

export const createClass = async (payload) => {
  try {
    const { data } = await api.post('/admin/classes', payload, { timeout: 15000 });
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, 'The class could not be created.');
  }
};

/** Retire a class name. Refused server-side if it still has active students. */
export const archiveClass = async (className) => {
  try {
    const { data } = await api.delete(`/admin/classes/${encodeURIComponent(className)}`, {
      timeout: 15000,
    });
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, 'The class could not be archived.');
  }
};

export const getClassAssignments = async (className) => {
  try {
    const { data } = await api.get(`/admin/classes/${encodeURIComponent(className)}/assignments`, {
      timeout: 15000,
    });
    return data?.data || { className, assignments: [] };
  } catch (error) {
    throw toApiError(error, 'The class assignments could not be loaded.');
  }
};

/** Replace the class teacher for one class. `payload` is `{ teacherId }`. */
export const assignClassTeacher = async (className, payload) => {
  try {
    const { data } = await api.put(`/admin/classes/${encodeURIComponent(className)}/teacher`, payload, {
      timeout: 15000,
    });
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, 'The class teacher could not be assigned.');
  }
};

/** Assign (or replace) the teacher for one subject in one class. */
export const assignSubjectTeacher = async (className, subject, teacherId, canMarkAttendance = false) => {
  try {
    const { data } = await api.post(
      `/admin/classes/${encodeURIComponent(className)}/subject-teacher`,
      { subject, teacherId, canMarkAttendance },
      { timeout: 15000 }
    );
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, 'The subject teacher could not be assigned.');
  }
};

/** Remove the subject teacher for one subject in one class. Idempotent. */
export const unassignSubjectTeacher = async (className, subject) => {
  try {
    const { data } = await api.delete(
      `/admin/classes/${encodeURIComponent(className)}/subject-teacher/${encodeURIComponent(subject)}`,
      { timeout: 15000 }
    );
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, 'The subject teacher could not be removed.');
  }
};

// ── Timetables ────────────────────────────────────────────────────────────────
//
// Only the school-admin write: publishing a class's timetable. Reading the list
// and editing the grid are teacher-gated (`requireTeacher`) and live in the
// teacher portal, so this console never calls them.

export const publishTimetable = async (payload) => {
  try {
    const { data } = await api.post('/admin/timetables/publish', payload, { timeout: 15000 });
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, 'The timetable could not be published.');
  }
};

export const deactivateTimetable = async (payload) => {
  try {
    const { data } = await api.post('/admin/timetables/deactivate', payload, { timeout: 15000 });
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, 'The timetable could not be deactivated.');
  }
};

export const republishTimetable = async (payload) => {
  try {
    const { data } = await api.post('/admin/timetables/republish', payload, { timeout: 15000 });
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, 'The timetable could not be republished.');
  }
};

export const removeTimetable = async (className, { term, academicYear } = {}) => {
  try {
    const params = Object.fromEntries(
      Object.entries({ term, academicYear }).filter(([, value]) => value !== '' && value !== null && value !== undefined)
    );
    const { data } = await api.delete(`/admin/timetables/${encodeURIComponent(className)}/remove`, { params, timeout: 15000 });
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, 'The timetable could not be removed.');
  }
};

export const listRemovalRequests = async () => {
  try {
    const { data } = await api.get('/admin/timetables/removal-requests', { timeout: 15000 });
    return data?.data || { requests: [] };
  } catch (error) {
    throw toApiError(error, 'The removal requests could not be loaded.');
  }
};

export const confirmRemoval = async (className, { term, academicYear } = {}) => {
  try {
    const { data } = await api.post(
      `/admin/timetables/${encodeURIComponent(className)}/confirm-removal`,
      { term, academicYear },
      { timeout: 15000 }
    );
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, 'The removal request could not be confirmed.');
  }
};

export const rejectRemovalRequest = async (className, { term, academicYear } = {}) => {
  try {
    const { data } = await api.post(
      `/admin/timetables/${encodeURIComponent(className)}/reject-removal`,
      { term, academicYear },
      { timeout: 15000 }
    );
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, 'The removal request could not be rejected.');
  }
};

export const listTimetables = async ({ term, academicYear, status } = {}) => {
  try {
    const params = Object.fromEntries(
      Object.entries({ term, academicYear, status }).filter(([, value]) => value !== '' && value !== null && value !== undefined)
    );
    const { data } = await api.get('/admin/timetables', { params, timeout: 15000 });
    return data?.data || { timetables: [] };
  } catch (error) {
    throw toApiError(error, 'The timetables could not be loaded.');
  }
};

export const getTimetable = async (className, { term, academicYear } = {}) => {
  try {
    const params = Object.fromEntries(
      Object.entries({ term, academicYear }).filter(([, value]) => value !== '' && value !== null && value !== undefined)
    );
    const { data } = await api.get(`/admin/timetables/${encodeURIComponent(className)}`, { params, timeout: 15000 });
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, 'The timetable could not be loaded.');
  }
};

export const saveTimetable = async (payload) => {
  try {
    const { data } = await api.put('/admin/timetables', payload, { timeout: 30000 });
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, 'The timetable could not be saved.');
  }
};

// ── Teacher picker for class assignments ──────────────────────────────────────
//
// `GET /users` is school-scoped (the server resolves the school from the token)
// and accepts a `role` filter, so the teacher picker is a page all rather than a
// per-class call. The assign endpoints take a `teacherId` ObjectId — the picker
// surfaces the teacher's display name and carries the id on the wire.

export const listTeachers = async () => {
  try {
    const result = await listUsers({ role: 'teacher', limit: 100 });
    const users = Array.isArray(result?.users) ? result.users : [];
    return users.map((u) => ({
      id: u._id || u.id,
      name: u.name || u.email || '',
      role: u.role || 'teacher',
      assignedClasses: Array.isArray(u.assignedClasses) ? u.assignedClasses : [],
    }));
  } catch (error) {
    throw toApiError(error, 'The teacher list could not be loaded.');
  }
};

// ── Teacher assignment (student → teacher) ───────────────────────────────────
//
// A different link from the class assignments above: `User.assignedClasses` says
// *who teaches JHS 2 Mathematics*, these endpoints say *which children this
// teacher is responsible for*. See `Backend/src/models/TeacherAssignment.js` for
// why that is a collection and not another array on the user.
//
// All four are `requireSchoolAdmin` — the school scope is the token's, never the
// caller's, so there is no `schoolId` to pass and nothing here a caller could
// point at another school's roster.

/**
 * `GET /admin/users/teacher-assignment-counts` — the picker's live tally.
 *
 * The response carries `drift` alongside the counts: teachers who have
 * class-mediated rows but no matching `assignedClasses` slot, which is the exact
 * state a teacher's portal is empty in while this console says they have children.
 * It is read on the same load as the counts because the two views of one
 * assignment are the only place the contradiction is visible.
 */
export const getTeacherAssignmentCounts = async () => {
  try {
    const { data } = await api.get('/admin/users/teacher-assignment-counts');
    const counts = data?.data?.counts || [];
    const drift = data?.data?.drift || [];
    return {
      counts: counts.reduce((map, row) => {
        map[row.teacherId] = { count: row.count || 0, classMediated: row.classMediated || 0 };
        return map;
      }, {}),
      drift,
    };
  } catch (error) {
    throw toApiError(error, 'The assignment counts could not be loaded.');
  }
};

/**
 * `POST /admin/users/teacher-assignment-drift/repair` — write the missing
 * `assignedClasses` slots.
 *
 * The fix for rows committed by an earlier version of this module, or against
 * service code from before `syncClassTeacher` shipped. Idempotent: a school with
 * no drift gets `repaired: 0` and a message that says so, rather than an error.
 */
export const repairAssignmentDrift = async (teacherId) => {
  try {
    const { data } = await api.post('/admin/users/teacher-assignment-drift/repair', {
      ...(teacherId ? { teacherId } : {}),
    });
    return data?.data || { repaired: 0, classes: 0, teachers: [] };
  } catch (error) {
    throw toApiError(error, 'We could not sync those assignments.');
  }
};

/**
 * `GET /admin/users/:teacherId/students` — one teacher's students, with the
 * roster's filters applied.
 *
 * The `assignedToTeacher` flag on every row is what the checkbox column renders,
 * and it is the point of returning the roster rather than only the assigned
 * subset: the admin's question is "who else can I add?" as much as "who is
 * already there?", and a list of only the assigned shows nothing to add.
 */
export const listTeacherStudents = async (teacherId, filters = {}) => {
  try {
    const params = Object.fromEntries(
      Object.entries(filters).filter(([, value]) => value !== '' && value !== null && value !== undefined)
    );
    const { data } = await api.get(`/admin/users/${teacherId}/students`, { params });
    return {
      teacher: data?.data?.teacher || null,
      rows: data?.data?.rows || [],
      pagination: data?.data?.pagination || { page: 1, perPage: 20, total: 0, pages: 1 },
    };
  } catch (error) {
    throw toApiError(error, "That teacher's students could not be loaded.");
  }
};

/**
 * `POST /admin/users/:teacherId/students` — assign, by list or by class.
 *
 * One endpoint for both selectors, exactly as the route is written: the request
 * names either `studentIds` or `className`, and the server resolves a class
 * roster itself. A body naming both is a 422 — which is why this function takes
 * one shape or the other and never both.
 *
 * `assigned` in the response is the count it *actually* wrote, not the count the
 * caller asked for, so a row archived mid-session is reported truthfully rather
 * than silently.
 */
export const assignTeacherStudents = async (teacherId, { studentIds, className }) => {
  try {
    const payload = className ? { className } : { studentIds };
    const { data } = await api.post(`/admin/users/${teacherId}/students`, payload);
    return data?.data || { assigned: 0 };
  } catch (error) {
    throw toApiError(error, 'Those students could not be assigned.');
  }
};

/**
 * `DELETE /admin/users/:teacherId/students` — withdraw the assignment.
 *
 * `force` is the explicit override for rows a class assignment created, and it is
 * a parameter rather than a second endpoint so the audit row records which
 * branch ran. Without it the server removes only the individual picks and says
 * how many class rows it left alone — which is the answer the panel shows as
 * "2 skipped".
 */
export const unassignTeacherStudents = async (teacherId, studentIds, { force = false } = {}) => {
  try {
    const { data } = await api.delete(`/admin/users/${teacherId}/students`, {
      data: { studentIds, force },
    });
    return data?.data || { removed: 0, skipped: 0 };
  } catch (error) {
    throw toApiError(error, 'Those students could not be removed.');
  }
};

export const importTimetable = async (
  file,
  { className, term, academicYear, status = "draft" } = {}
) => {
  try {
    const formData = new FormData();
    formData.append("file", file);
    if (className) formData.append("className", className);
    if (term) formData.append("term", term);
    if (academicYear) formData.append("academicYear", academicYear);
    if (status) formData.append("status", status);

    const { data } = await api.post("/admin/timetables/upload", formData, {
      timeout: 60000,
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, 'The timetable file could not be imported.');
  }
};

export const submitTimetable = (className, { term, academicYear } = {}) =>
  api
    .post(`/admin/timetables/${encodeURIComponent(className)}/submit`, {
      term,
      academicYear,
    })
    .then((r) => r?.data || null);

export const withdrawTimetable = (className, { term, academicYear } = {}) =>
  api
    .post(`/admin/timetables/${encodeURIComponent(className)}/withdraw`, {
      term,
      academicYear,
    })
    .then((r) => r?.data || null);

export const approveTimetable = (
  className,
  { term, academicYear, comment } = {}
) =>
  api
    .post(`/admin/timetables/${encodeURIComponent(className)}/approve`, {
      term,
      academicYear,
      comment,
    })
    .then((r) => r?.data || null);

export const rejectTimetable = (
  className,
  { term, academicYear, reason } = {}
) =>
  api
    .post(`/admin/timetables/${encodeURIComponent(className)}/reject`, {
      term,
      academicYear,
      reason,
    })
    .then((r) => r?.data || null);

export const listSubmissions = async ({ term, academicYear } = {}) => {
  try {
    const params = Object.fromEntries(
      Object.entries({ term, academicYear }).filter(([, value]) => value !== '' && value !== null && value !== undefined)
    );
    const { data } = await api.get('/admin/timetables/submissions', { params, timeout: 15000 });
    return data?.data || { submissions: [] };
  } catch (error) {
    throw toApiError(error, 'The submissions could not be loaded.');
  }
};

export const getAdminClassGrades = async ({ className, subject, term, academicYear } = {}) => {
  const { data } = await api.get('/admin/class-grades', { params: { className, subject, term, academicYear } });
  return data?.data || { grades: [] };
};
export const getTeacherAttendanceReport = async ({ className } = {}) => {
  const { data } = await api.get('/admin/reports/teacher-attendance', { params: { className } });
  return data?.data || {};
};
export const listTeacherAttendance = async ({ className, teacherId } = {}) => {
  const { data } = await api.get('/admin/teacher-attendance', { params: { className, teacherId } });
  return data?.data || { records: [] };
};
export const markTeacherAttendance = async (payload) => {
  const { data } = await api.post('/admin/teacher-attendance', payload);
  return data?.data || {};
};

export default {
  getAcademicOverview,
  getGradeApprovalQueue,
  approveGrades,
  rejectGrades,
  setHeadRemark,
  publishReports,
  unpublishReports,
  listClasses,
  createClass,
  archiveClass,
  getClassAssignments,
  assignClassTeacher,
  assignSubjectTeacher,
  unassignSubjectTeacher,
  publishTimetable,
  deactivateTimetable,
  republishTimetable,
  removeTimetable,
  listRemovalRequests,
  confirmRemoval,
  rejectRemovalRequest,
  listTimetables,
  getTimetable,
  saveTimetable,
  importTimetable,
  submitTimetable,
  withdrawTimetable,
  approveTimetable,
  rejectTimetable,
  listSubmissions,
  listTeachers,
  getTeacherAssignmentCounts,
  repairAssignmentDrift,
  listTeacherStudents,
  assignTeacherStudents,
  unassignTeacherStudents,
};
