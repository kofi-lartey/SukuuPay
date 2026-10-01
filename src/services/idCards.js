import api from './api';
import { toApiError } from './toApiError';

/**
 * The ID card print surface.
 *
 * Four endpoints, and the shape of the flow is dictated by the server: creating
 * a batch answers **202**, not 200. The PDF is rendered by a background job, so
 * the request that starts it cannot also return the file. Anything built on this
 * service has to treat "started" and "ready" as two genuinely different states,
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
        cardTemplate: 'default',
      },
      { timeout: 60000 }
    );
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, 'The print batch could not be started.');
  }
};

/**
 * The batch preview, which is also the readiness signal.
 *
 * `responseType: 'text'` is explicit because the 200 response is HTML and the
 * default JSON transform would either mangle it or throw on it.
 *
 * **202 is checked on the resolved response, not in the catch.** Axios rejects
 * on 4xx and 5xx only; 202 is a success, so it resolves. Branching on
 * `error.response.status` here would never fire, and the studio would take the
 * "ready" path on a batch that has not been generated — showing HTML that does
 * not exist and handing back a download that 404s.
 */
export const getIdCardBatchPreview = async (batchId) => {
  try {
    const response = await api.get(
      `/id-cards/batch/${encodeURIComponent(batchId)}`,
      { responseType: 'text', timeout: 30000 }
    );

    if (response.status === 202) {
      const body = await parseMaybeJson(response.data);
      return { status: 'pending', retryAfter: body?.retryAfter || 15 };
    }

    return { status: 'ready', html: response.data };
  } catch (error) {
    // 4xx/5xx do reject. A failed batch is a 500 carrying
    // `data.status === "failed"`, which is a terminal answer rather than a
    // transport problem — surfaced as a failure state, not thrown.
    if (error.response?.data?.code === 'BATCH_FAILED') {
      const body = await parseMaybeJson(error.response.data);
      return { status: 'failed', error: body?.error || 'Batch generation failed.' };
    }
    throw toApiError(error, 'The preview could not be loaded.');
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
  getIdCardBatchPreview,
  downloadIdCardBatchPdf,
  downloadStudentIdCard,
  exportQrLinks,
};
