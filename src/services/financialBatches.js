import api from './api';
import { toApiError } from './toApiError';

/**
 * School-level multi-signatory disbursement batches — `/api/v2/financial/batches`.
 *
 * Separate from `services/finance.js` which owns the platform admin disbursement
 * router (`/api/admin/finance/*`). This module is for school bursars and
 * accountants on the Campus tier who need multi-signatory approval before funds
 * move out of a campus.
 *
 * Every amount is integer pesewas.
 */

/** `POST /api/v2/financial/batches` — create a disbursement batch. */
export const createBatch = (data) =>
  api.post('/v2/financial/batches', data).then((r) => r.data);

/** `GET /api/v2/financial/batches` — list batches (query: schoolId, campusId, status). */
export const getBatches = (params = {}) =>
  api.get('/v2/financial/batches', { params }).then((r) => r.data);

/** `GET /api/v2/financial/batches/:id` — get batch detail with signatures. */
export const getBatch = (id) =>
  api.get(`/v2/financial/batches/${encodeURIComponent(id)}`).then((r) => r.data);

/** `POST /api/v2/financial/batches/:id/sign` — sign a batch. */
export const signBatch = (id) =>
  api.post(`/v2/financial/batches/${encodeURIComponent(id)}/sign`).then((r) => r.data);

/** `POST /api/v2/financial/batches/:id/approve` — approve a batch. */
export const approveBatch = (id) =>
  api.post(`/v2/financial/batches/${encodeURIComponent(id)}/approve`).then((r) => r.data);

/** `POST /api/v2/financial/batches/:id/reject` — reject a batch (body: { reason }). */
export const rejectBatch = (id, { reason } = {}) =>
  api.post(`/v2/financial/batches/${encodeURIComponent(id)}/reject`, { reason }).then((r) => r.data);

export default {
  createBatch,
  getBatches,
  getBatch,
  signBatch,
  approveBatch,
  rejectBatch,
};
