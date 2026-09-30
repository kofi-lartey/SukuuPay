import api from './api';
import { toApiError } from './toApiError';
import { gh } from '../utils/format';

/**
 * Every student endpoint, one function each.
 *
 * **The money boundary lives here.** `totalOwed` is an integer number of
 * *pesewas* on every write path — 100 pesewas is GH₵ 1.00. The one exception is
 * the bulk CSV, which is in cedis because a spreadsheet column a bursar types
 * into says `850`; the server converts that at the file boundary. So
 * `bulkImport` takes cedis and every other function takes pesewas, and the two
 * are named accordingly. `MoneyInput` in the UI is the only other place that
 * crosses this line.
 *
 * `listStudents` returns `{ data, meta }`, not a bare array — the same unwrap
 * trap the school module documents.
 */

// ── Read ────────────────────────────────────────────────────────────────────

export const listStudents = async (params = {}) => {
  try {
    const { data } = await api.get('/students', { params, timeout: 15000 });
    return {
      // `listStudentsController` returns `{ success, data, meta }` with `data`
      // the page of rows.
      rows: Array.isArray(data?.data) ? data.data : [],
      meta: data?.meta || { page: 1, perPage: 20, total: 0, totalPages: 0 },
      offline: false,
    };
  } catch (error) {
    // A request that never reached the server degrades to an empty list rather
    // than throwing. The onboarding wizard previews a roster before a school is
    // fully set up, and a dead network must not block it.
    //
    // "Never reached the server" is checked two ways, because the two shapes
    // differ: real axios gives a network error with no `response` at all, while
    // the dev mock wraps every failure in an axios shape and so reports
    // `code: 'ERR_NETWORK'` with `response.status === 0`. Checking only
    // `!error.response` works against a real backend and silently does not work
    // under `npm run dev:mock`, which is the worst place for a divergence.
    const neverReachedServer =
      !error?.response || error?.code === 'ERR_NETWORK' || error?.response?.status === 0;

    if (neverReachedServer) {
      return {
        rows: [],
        meta: { page: 1, perPage: params.perPage || 20, total: 0, totalPages: 0 },
        offline: true,
      };
    }
    throw toApiError(error, 'The student roster could not be loaded.');
  }
};

/** The roster aggregates behind the module's KPI band. One call, not a client sum. */
export const getStudentStats = async (params = {}) => {
  try {
    const { data } = await api.get('/students/stats', { params, timeout: 15000 });
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, 'Roster totals could not be loaded.');
  }
};

/**
 * The full profile, in one request.
 *
 * The drawer shows the student, guardians, plan, payments and history at once.
 * Assembled client-side that is five requests resolving at different times, and
 * the screen shows a balance of GH₵ 0.00 for as long as the payments that
 * explain it are still loading.
 *
 * `id` may be the Mongo id or the human `studentId` — the backend accepts both.
 */
export const getStudentProfile = async (id) => {
  try {
    const { data } = await api.get(`/students/${encodeURIComponent(id)}/profile`, {
      timeout: 15000,
    });
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, 'This student could not be loaded.');
  }
};

export const getStudent = async (id) => {
  try {
    const { data } = await api.get(`/students/${encodeURIComponent(id)}`, { timeout: 15000 });
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, 'This student could not be loaded.');
  }
};

/**
 * Download the roster.
 *
 * A blob rather than JSON, because the response is a file. `api.js` is skipped
 * deliberately — going through it would JSON-parse a CSV and hand back a
 * `SyntaxError` for a request that actually succeeded.
 */
export const exportStudents = async (params = {}) => {
  try {
    const response = await api.get('/students/export', {
      params: { ...params, format: params.format || 'csv' },
      responseType: 'blob',
      timeout: 60000,
    });

    // The server sets `Content-Disposition` with the real filename.
    const disposition = response.headers?.['content-disposition'] || '';
    const match = disposition.match(/filename="?([^"]+)"?/);
    const filename = match ? match[1] : `students.${params.format || 'csv'}`;

    const url = URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Revoked on the next tick: Safari cancels an in-flight download if the
    // object URL disappears synchronously after the click.
    setTimeout(() => URL.revokeObjectURL(url), 0);

    return { filename };
  } catch (error) {
    throw toApiError(error, 'The roster could not be exported.');
  }
};

export const listAlumni = async (params = {}) => {
  try {
    const { data } = await api.get(`/alumni/${params.schoolId}`, {
      params: {
        page: params.page,
        limit: params.limit,
        graduationYear: params.graduationYear,
        honors: params.honors,
        search: params.search,
        sortBy: params.sortBy,
        sortOrder: params.sortOrder,
      },
      timeout: 15000,
    });
    const result = data?.data || {};
    return { rows: result.alumni || [], meta: result.pagination || null };
  } catch (error) {
    throw toApiError(error, 'The alumni list could not be loaded.');
  }
};

export const listCohorts = async (params = {}) => {
  try {
    const { data } = await api.get(`/cohorts/${params.schoolId}`, {
      params: { page: params.page, limit: params.limit, year: params.year, search: params.search },
      timeout: 15000,
    });
    const result = data?.data || {};
    return { rows: result.cohorts || [], meta: result.pagination || null };
  } catch (error) {
    throw toApiError(error, 'Cohorts could not be loaded.');
  }
};

/**
 * One cohort's detail.
 *
 * `cohortId` is `cohort_2026` (or a bare year) — there is no Cohort collection,
 * so a cohort's identity is its graduation year. The path is two segments
 * because `/cohorts/:schoolId` would otherwise swallow it.
 */
export const getCohort = async (cohortId, params = {}) => {
  try {
    const { data } = await api.get(`/cohorts/detail/${encodeURIComponent(cohortId)}`, {
      params,
      timeout: 15000,
    });
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, 'This cohort could not be loaded.');
  }
};

// ── Create ──────────────────────────────────────────────────────────────────

/** `totalOwed` in pesewas. Use `gh(850)` for GH₵ 850. */
export const createStudent = async (payload) => {
  try {
    const { data } = await api.post('/students/single', payload, { timeout: 15000 });
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, 'The student could not be created.');
  }
};

/**
 * Bulk import. `totalOwedCedis` in the form fields is in **cedis** — the server
 * converts. This is the one place the money unit differs from every other
 * function in this file, and it is deliberate: a spreadsheet says 850.
 */
export const bulkImport = async (file, meta = {}) => {
  const form = new FormData();
  form.append('file', file);
  if (meta.schoolId) form.append('schoolId', meta.schoolId);
  if (meta.academicYear) form.append('academicYear', meta.academicYear);
  if (meta.defaultDeadline) form.append('defaultDeadline', meta.defaultDeadline);
  if (meta.defaultOwed !== undefined && meta.defaultOwed !== null && meta.defaultOwed !== '') {
    form.append('defaultOwed', String(meta.defaultOwed));
  }
  if (meta.dryRun) form.append('dryRun', 'true');

  try {
    const { data } = await api.post('/students/bulk', form, {
      timeout: 120000,
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, 'The roster could not be imported.');
  }
};

/**
 * Parse and validate a file without writing anything.
 *
 * Shares the importer's code path on the server, so the preview cannot disagree
 * with the outcome — the reason this is a dry run on the same endpoint rather
 * than a second client-side reimplementation of the rules.
 */
export const validateImport = (file, meta = {}) => bulkImport(file, { ...meta, dryRun: true });

// ── Update ──────────────────────────────────────────────────────────────────

export const updateStudent = async (id, payload) => {
  try {
    const { data } = await api.put(`/students/${encodeURIComponent(id)}`, payload, {
      timeout: 15000,
    });
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, 'The student could not be updated.');
  }
};

/** Soft delete. The student leaves the roster; payment history is preserved. */
export const archiveStudent = async (id, reason) => {
  try {
    const { data } = await api.delete(`/students/${encodeURIComponent(id)}`, {
      data: { reason },
      timeout: 15000,
    });
    return data;
  } catch (error) {
    throw toApiError(error, 'The student could not be archived.');
  }
};

export const restoreStudent = async (id) => {
  try {
    const { data } = await api.post(`/students/${encodeURIComponent(id)}/restore`, null, {
      timeout: 15000,
    });
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, 'The student could not be restored.');
  }
};

// ── Lifecycle ───────────────────────────────────────────────────────────────

export const suspendStudent = async (id, reason) => {
  try {
    const { data } = await api.put(`/students/${encodeURIComponent(id)}/suspend`, { reason });
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, 'The student could not be suspended.');
  }
};

export const reactivateStudent = async (id) => {
  try {
    const { data } = await api.put(`/students/${encodeURIComponent(id)}/reactivate`);
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, 'The student could not be reactivated.');
  }
};

export const transferClass = async (id, newClass, reason) => {
  try {
    const { data } = await api.put(`/students/${encodeURIComponent(id)}/transfer-class`, {
      newClass,
      reason,
    });
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, 'The student could not be transferred.');
  }
};

export const promoteStudent = async (id, payload) => {
  try {
    const { data } = await api.post(`/students/${encodeURIComponent(id)}/promote`, payload);
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, 'The student could not be promoted.');
  }
};

export const previewPromotion = async (payload) => {
  try {
    const { data } = await api.post('/students/promote/preview', payload, { timeout: 20000 });
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, 'The promotion preview could not be generated.');
  }
};

export const bulkPromote = async (schoolId, payload) => {
  try {
    const { data } = await api.post(`/students/bulk-promote/${schoolId}`, payload, {
      timeout: 60000,
    });
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, 'The bulk promotion could not be completed.');
  }
};

export const markRepeating = async (id, payload) => {
  try {
    const { data } = await api.post(`/students/${encodeURIComponent(id)}/repeat`, payload);
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, 'The student could not be marked as repeating.');
  }
};

export const clearRepeating = async (id, reason) => {
  try {
    const { data } = await api.post(`/students/${encodeURIComponent(id)}/unrepeat`, { reason });
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, 'The repeat flag could not be cleared.');
  }
};

export const graduateStudent = async (id, payload) => {
  try {
    const { data } = await api.post(`/students/${encodeURIComponent(id)}/graduate`, payload);
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, 'The student could not be graduated.');
  }
};

export const bulkGraduate = async (schoolId, payload) => {
  try {
    const { data } = await api.post(`/students/bulk-graduate/${schoolId}`, payload, {
      timeout: 60000,
    });
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, 'The bulk graduation could not be completed.');
  }
};

export const transferOut = async (id, payload) => {
  try {
    const { data } = await api.post(`/students/${encodeURIComponent(id)}/transfer-out`, payload);
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, 'The transfer could not be recorded.');
  }
};

export const regeneratePayLink = async (id, { notify = false } = {}) => {
  try {
    const { data } = await api.get(`/students/${encodeURIComponent(id)}/pay-link`, {
      params: { notify },
    });
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, 'The pay link could not be regenerated.');
  }
};

// ── Guardians ───────────────────────────────────────────────────────────────
//
// All four are nested under the student. They used to live at
// `/parents/:parentId` while the server read `req.params.id` for the student,
// so none of them worked.

export const addParent = async (id, payload) => {
  try {
    const { data } = await api.post(`/students/${encodeURIComponent(id)}/parents`, payload);
    return data?.data?.student || null;
  } catch (error) {
    throw toApiError(error, 'The guardian could not be added.');
  }
};

export const getParents = async (id) => {
  try {
    const { data } = await api.get(`/students/${encodeURIComponent(id)}/parents`);
    return data?.data?.parents || [];
  } catch (error) {
    throw toApiError(error, 'Guardians could not be loaded.');
  }
};

export const updateParent = async (id, parentId, payload) => {
  try {
    const { data } = await api.put(
      `/students/${encodeURIComponent(id)}/parents/${encodeURIComponent(parentId)}`,
      payload
    );
    return data?.data?.student || null;
  } catch (error) {
    throw toApiError(error, 'The guardian could not be updated.');
  }
};

export const setPrimaryParent = async (id, parentId) => {
  try {
    const { data } = await api.put(
      `/students/${encodeURIComponent(id)}/parents/${encodeURIComponent(parentId)}/primary`,
      { isPrimary: true }
    );
    return data?.data?.student || null;
  } catch (error) {
    throw toApiError(error, 'The primary guardian could not be changed.');
  }
};

export const removeParent = async (id, parentId) => {
  try {
    const { data } = await api.delete(
      `/students/${encodeURIComponent(id)}/parents/${encodeURIComponent(parentId)}`
    );
    return data?.data?.student || null;
  } catch (error) {
    throw toApiError(error, 'The guardian could not be removed.');
  }
};

// ── Bulk writes ─────────────────────────────────────────────────────────────

/**
 * The target of a bulk write: `ids` **or** `filter`, never both.
 *
 * "Select all" across 1,000 students cannot send 1,000 ids, so the client sends
 * the filter. The server rejects both together — it would otherwise count the
 * id list while the caller believed it had targeted the filter.
 */
const bulkTarget = (target) =>
  target?.ids?.length
    ? { ids: target.ids }
    : { filter: target?.filter || { status: 'active' } };

/** A bulk action that must be previewed before it is committed. */
const bulkWrite = async (path, body, timeout = 60000) => {
  try {
    const { data } = await api.post(path, body, { timeout });
    return { ok: true, result: data?.data || null };
  } catch (error) {
    const apiError = toApiError(error, 'The bulk action could not be completed.');
    // `data` survives the throw, so a 409 OUTSTANDING_BALANCE can hand the
    // dialog the list of students it refused rather than just a message.
    apiError.details = error?.response?.data?.data || null;
    return { ok: false, error: apiError };
  }
};

export const bulkUpdateStudents = (target, update, fields, { dryRun = false } = {}) =>
  bulkWrite('/students/bulk/update', {
    ...bulkTarget(target),
    update,
    ...(fields?.length ? { fields } : {}),
    dryRun,
  });

export const bulkArchiveStudents = (target, { reason, force = false, dryRun = false } = {}) =>
  bulkWrite('/students/bulk/archive', {
    ...bulkTarget(target),
    reason,
    force,
    dryRun,
  });

export const bulkSetStatus = (target, status, { reason, dryRun = false } = {}) =>
  bulkWrite('/students/bulk/status', {
    ...bulkTarget(target),
    status,
    reason,
    dryRun,
  });

export const bulkRegeneratePayLinks = (target, { dryRun = false } = {}) =>
  bulkWrite('/students/bulk/pay-links', { ...bulkTarget(target), dryRun });

export { gh };
