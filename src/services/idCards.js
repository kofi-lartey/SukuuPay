import api from './api';
import { toApiError } from './toApiError';

/**
 * The ID card print surface.
 *
 * Creating a batch answers **202**, not 200. The PDF is rendered by a background
 * job, so the request that starts it cannot also return the file. Anything built on
 * this service has to treat "started" and "ready" as two genuinely different states,
 * and polling is part of the contract rather than an optimisation.
 */

/** Save a binary response to a download, using the server's own filename. */
const saveBlob = (response, fallbackName) => {
  const disposition = response.headers?.['content-disposition'] || '';
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = match ? match[1] : fallbackName;

  const url = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoked after the click rather than immediately: Safari cancels an
  // in-flight download whose object URL is released in the same tick.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return filename;
};

/**
 * Start a print batch. Returns `{ batchId, status }` — `status` is
 * `"pending"`, and the file does not exist yet.
 *
 * `studentIds` must be Mongo `_id`s, not the human `studentId`: the schema
 * validates each entry against a 24-hex ObjectId pattern, so the visible
 * student number is a 422 on every card.
 */
export const createIdCardBatch = async (studentIds, options = {}) => {
  try {
    const { data } = await api.post(
      '/id-cards/batch',
      {
        studentIds,
        includeQr: options.includeQr !== false,
        includePhoto: options.includePhoto !== false,
        useSchoolSettings: options.useSchoolSettings !== false,
        templateId: options.templateId || null,
      },
      { timeout: 60000 }
    );
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, 'The print batch could not be started.');
  }
};

/**
 * Merge multiple existing batches into a single new batch.
 * Returns `{ batchId, status }`.
 */
export const mergeIdCardBatches = async (batchIds) => {
  try {
    const { data } = await api.post(
      '/id-cards/batch/merge',
      { batchIds },
      { timeout: 60000 }
    );
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, 'The batches could not be merged.');
  }
};

/**
 * Get full preview data for a batch (cards, school, batch metadata).
 * Used by the print preview page to render React card components.
 */
export const getIdCardBatchPreviewData = async (batchId) => {
  try {
    const { data } = await api.get(
      `/id-cards/batch/${encodeURIComponent(batchId)}/preview-data`,
      { timeout: 30000 }
    );
    return data?.data;
  } catch (error) {
    throw toApiError(error, 'The preview data could not be loaded.');
  }
};

/**
 * Poll batch status. Returns `{ status, ... }`.
 */
export const getIdCardBatchStatus = async (batchId) => {
  try {
    const { data } = await api.get(
      `/id-cards/batch/${encodeURIComponent(batchId)}/status`,
      { timeout: 15000 }
    );
    return data?.data;
  } catch (error) {
    throw toApiError(error, 'The batch status could not be loaded.');
  }
};

/**
 * Download a generated batch PDF.
 *
 * Polls the same way the preview does, and for the same reason: a 202 here
 * means the job is still running, so it returns a pending marker the caller
 * retries rather than throwing a download failure.
 */
export const downloadIdCardBatchPdf = async (batchId) => {
  try {
    const response = await api.get(
      `/id-cards/batch/${encodeURIComponent(batchId)}/pdf`,
      { responseType: 'blob', timeout: 120000 }
    );

    if (response.status === 202) {
      return { status: 'pending' };
    }

    return saveBlob(response, 'id-cards.pdf');
  } catch (error) {
    if (error.response?.status === 409) {
      const body = await parseMaybeJson(error.response.data);
      throw new Error(body?.message || 'This batch could not be generated.');
    }
    throw toApiError(error, 'The print file could not be downloaded.');
  }
};

/** One student's card, generated on the fly. Opened inline by the server. */
export const downloadStudentIdCard = async (studentId) => {
  try {
    const response = await api.get(
      `/id-cards/${encodeURIComponent(studentId)}`,
      { responseType: 'blob', timeout: 60000 }
    );
    return saveBlob(response, 'student-id-card.pdf');
  } catch (error) {
    throw toApiError(error, "This student's card could not be generated.");
  }
};

/** Every student's pay-link and QR image URL, as a CSV for the card printer. */
export const exportQrLinks = async (schoolId, params = {}) => {
  try {
    const response = await api.get(
      `/id-cards/qr-links/${encodeURIComponent(schoolId)}`,
      { params, responseType: 'blob', timeout: 60000 }
    );
    return saveBlob(response, 'qr-links.csv');
  } catch (error) {
    throw toApiError(error, 'The QR links export could not be downloaded.');
  }
};

/** List recent batches for a school. */
export const listBatches = async (schoolId, params = {}) => {
  try {
    const { data } = await api.get(
      `/id-cards/batches/${encodeURIComponent(schoolId)}`,
      { params, timeout: 15000 }
    );
    return {
      batches: data?.data || [],
      meta: data?.meta,
    };
  } catch (error) {
    throw toApiError(error, 'Could not load ID card batches.');
  }
};

/** Get the latest ready batch for preview. */
export const getLatestBatch = async (schoolId) => {
  try {
    const { data } = await api.get(
      `/id-cards/batches/latest`,
      { params: { schoolId }, timeout: 15000 }
    );
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, 'Could not load the latest batch.');
  }
};

/**
 * A response body is JSON or a Blob depending on how it failed — a JSON error
 * against a `text`/`blob` request arrives as a Blob, and reading it blind gives
 * "[object Blob]" in place of the server's actual message.
 */
const parseMaybeJson = async (body) => {
  if (!body) return null;
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return null;
    }
  }
  if (typeof body?.text === 'function') {
    try {
      return JSON.parse(await body.text());
    } catch {
      return null;
    }
  }
  return body;
};

export default {
  createIdCardBatch,
  getIdCardBatchPreviewData,
  getIdCardBatchStatus,
  downloadIdCardBatchPdf,
  downloadStudentIdCard,
  exportQrLinks,
  listBatches,
  getLatestBatch,
  mergeIdCardBatches,
};
