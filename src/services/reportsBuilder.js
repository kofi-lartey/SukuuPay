import api from './api';
import { toApiError } from './toApiError';

/**
 * Campus-tier custom audit reports & MoE compliance exports — `/api/v2/reports`.
 *
 * Separate from `services/reports.js` which owns the existing nine reports
 * (`/api/reports/*`). This module owns the new report template / job flow for
 * Campus-tier schools: define a template, queue a render job, poll for completion,
 * and download a signed URL.
 */

/** `POST /api/v2/reports/templates` — create a report template. */
export const createTemplate = (data) =>
  api.post('/v2/reports/templates', data).then((r) => r.data);

/** `GET /api/v2/reports/templates` — list templates for a school. */
export const getTemplates = (params = {}) =>
  api.get('/v2/reports/templates', { params }).then((r) => r.data);

/** `POST /api/v2/reports/jobs` — queue a report export job. */
export const createJob = (data) =>
  api.post('/v2/reports/jobs', data).then((r) => r.data);

/** `GET /api/v2/reports/jobs/:id` — get job status + signed download URL. */
export const getJob = (id) =>
  api.get(`/v2/reports/jobs/${encodeURIComponent(id)}`).then((r) => r.data);

/** `GET /api/v2/reports/jobs` — list jobs for a school. */
export const listJobs = (params = {}) =>
  api.get('/v2/reports/jobs', { params }).then((r) => r.data);

/** Download a completed job's signed URL directly in the browser. */
export const downloadJob = (fileUrl) => {
  const anchor = document.createElement('a');
  anchor.href = fileUrl;
  anchor.download = '';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
};

export default {
  createTemplate,
  getTemplates,
  createJob,
  getJob,
  listJobs,
  downloadJob,
};
