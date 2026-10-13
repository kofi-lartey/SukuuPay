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
export const assignSubjectTeacher = async (className, subject, teacherId) => {
  try {
    const { data } = await api.post(
      `/admin/classes/${encodeURIComponent(className)}/subject-teacher`,
      { subject, teacherId },
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
    }));
  } catch (error) {
    throw toApiError(error, 'The teacher list could not be loaded.');
  }
};
