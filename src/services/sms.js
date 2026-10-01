import api from './api';
import { toApiError } from './toApiError';

/**
 * SMS reminders data access.
 *
 * Every endpoint on the SMS Reminders module, in the order the page uses them.
 * Two conventions are worth stating once, because they are the traps in this
 * codebase rather than in this module:
 *
 *   - `listJobsController` and `listMessagesController` return
 *     `{ success, message, data, meta }` with `data` a **bare array**. So
 *     `data.data.rows` is undefined and every row silently disappears. The
 *     `Array.isArray` guard is not defensive noise; it is the unwrap.
 *   - Single-resource endpoints return the object in `data`, so `data.data` is
 *     the resource itself.
 *
 * The 404/405 → `SMS_SEND_NOT_SUPPORTED` translation is retained from the
 * wizard's version of this file. It is now a safety net rather than the expected
 * path — the backend routes exist — but a deployment running an older API still
 * reaches the honest "this is not wired yet" branch instead of a raw axios error
 * in the console.
 */

/** The wizard's version threw this; the button that catches it is unchanged. */
export const SMS_SEND_NOT_SUPPORTED = 'SMS_SEND_NOT_SUPPORTED';

const unwrapList = (data) => (Array.isArray(data?.data) ? data.data : []);

// ──────────────────── Credits ────────────────────

/**
 * `GET /sms/credits/:schoolId` — balance, usage and gateway readiness.
 *
 * The school-scoped endpoint `services/dashboard.js` used to say did not exist.
 * It does now: `GET /admin/sms-balance` is super-admin only and reports the
 * *platform's* master credit, so the topbar pill was reading a figure belonging
 * to nobody in particular. This one is pinned to the school whose balance it
 * reports, and the bursar is the caller.
 */
export const getSmsCredits = async (schoolId) => {
  if (!schoolId) throw new Error('A school must be in scope to read its SMS credits.');
  try {
    const { data } = await api.get(`/sms/credits/${schoolId}`);
    return data.data || data;
  } catch (error) {
    throw toApiError(error, 'Your SMS balance could not be loaded.');
  }
};

/** `POST /sms/credits/top-up` — add credit to the school. */
export const topUpSmsCredits = async (payload) => {
  try {
    const { data } = await api.post('/sms/credits/top-up', payload);
    return data.data || data;
  } catch (error) {
    throw toApiError(error, 'The credit could not be added.');
  }
};

// ──────────────────── Preview ────────────────────

/** `GET /sms/preview/:studentId` — rendered copy and cost, no send. */
export const previewSms = async (studentId, params) => {
  try {
    const { data } = await api.get(`/sms/preview/${studentId}`, { params });
    return data.data || data;
  } catch (error) {
    throw toApiError(error, 'The message could not be previewed.');
  }
};

/**
 * `POST /sms/audience/preview` — how many parents a rule reaches.
 *
 * A POST because the audience is a structured object, not a flat filter: a JSON
 * body reads and nests correctly where `?audience[type]=overdue&audience[…]` does
 * not. The name says "preview" and the verb says "read", which is the same
 * mismatch the DLR-callback API has and the right answer is to ignore it.
 */
export const previewAudience = async (audience, schoolId) => {
  try {
    const { data } = await api.post('/sms/audience/preview', { audience, schoolId });
    return data.data || data;
  } catch (error) {
    throw toApiError(error, 'The audience could not be sized.');
  }
};

// ──────────────────── Send ────────────────────

/** `POST /sms/send/:studentId` — message one student's parent. */
export const sendSms = async (studentId, payload) => {
  try {
    const { data } = await api.post(`/sms/send/${studentId}`, payload);
    return data.data || data;
  } catch (error) {
    if (error?.response?.status === 404 || error?.response?.status === 405) {
      const wrapped = toApiError(error, 'Sending SMS is not available on this server.');
      wrapped.code = SMS_SEND_NOT_SUPPORTED;
      throw wrapped;
    }
    throw toApiError(error, 'The message could not be sent.');
  }
};

/**
 * `POST /sms/bulk` — broadcast to a resolved audience.
 *
 * `body` is what goes out, not the stored template. A bursar who edits a preset
 * in the composer and presses Send means the edited text; passing only a
 * templateId would send the original and quietly ignore the edit.
 */
export const sendBulkSms = async (payload) => {
  try {
    const { data } = await api.post('/sms/bulk', payload);
    return data.data || data;
  } catch (error) {
    if (error?.response?.status === 404 || error?.response?.status === 405) {
      const wrapped = toApiError(error, 'Broadcasting SMS is not available on this server.');
      wrapped.code = SMS_SEND_NOT_SUPPORTED;
      throw wrapped;
    }
    throw toApiError(error, 'The broadcast could not be queued.');
  }
};

// ──────────────────── Jobs ────────────────────

/** `GET /sms/jobs` — broadcast history, newest first. */
export const listSmsJobs = async (params = {}) => {
  try {
    const { data } = await api.get('/sms/jobs', { params });
    return { jobs: unwrapList(data), meta: data?.meta || null };
  } catch (error) {
    throw toApiError(error, 'Broadcast history could not be loaded.');
  }
};

/** `GET /sms/jobs/:jobId` — one broadcast, with its counts. */
export const getSmsJob = async (jobId) => {
  try {
    const { data } = await api.get(`/sms/jobs/${jobId}`);
    return data.data || data;
  } catch (error) {
    throw toApiError(error, 'That broadcast could not be loaded.');
  }
};

/** `POST /sms/jobs/:jobId/cancel` — stop a queued broadcast. */
export const cancelSmsJob = async (jobId, reason = '') => {
  try {
    const { data } = await api.post(`/sms/jobs/${jobId}/cancel`, { reason });
    return data.data || data;
  } catch (error) {
    throw toApiError(error, 'The broadcast could not be cancelled.');
  }
};

/**
 * `POST /sms/jobs/drain` — run everything currently due.
 *
 * The scheduler's manual trigger. Super-admin only, and the composer's schedule
 * picker does not offer it: a school scheduling a 7pm broadcast should not also
 * be able to run every other school's queue.
 */
export const drainSmsQueue = async () => {
  try {
    const { data } = await api.post('/sms/jobs/drain');
    return data.data || data;
  } catch (error) {
    throw toApiError(error, 'The SMS queue could not be drained.');
  }
};

// ──────────────────── History ────────────────────

/** `GET /sms/messages` — per-message delivery log. */
export const listSmsMessages = async (params = {}) => {
  try {
    const { data } = await api.get('/sms/messages', { params });
    return { messages: unwrapList(data), meta: data?.meta || null };
  } catch (error) {
    throw toApiError(error, 'The message history could not be loaded.');
  }
};

// ──────────────────── Templates ────────────────────

/** `GET /sms/templates` — the four presets plus the school's own. */
export const listSmsTemplates = async (params = {}) => {
  try {
    const { data } = await api.get('/sms/templates', { params });
    return unwrapList(data);
  } catch (error) {
    throw toApiError(error, 'Templates could not be loaded.');
  }
};

/** `POST /sms/templates` — save a new one. */
export const createSmsTemplate = async (payload) => {
  try {
    const { data } = await api.post('/sms/templates', payload);
    return data.data || data;
  } catch (error) {
    throw toApiError(error, 'The template could not be saved.');
  }
};

/** `PATCH /sms/templates/:templateId` — edit one. */
export const updateSmsTemplate = async (templateId, payload) => {
  try {
    const { data } = await api.patch(`/sms/templates/${templateId}`, payload);
    return data.data || data;
  } catch (error) {
    throw toApiError(error, 'The template could not be updated.');
  }
};

/** `DELETE /sms/templates/:templateId` — soft-delete one. */
export const deleteSmsTemplate = async (templateId) => {
  try {
    const { data } = await api.delete(`/sms/templates/${templateId}`);
    return data.data || data;
  } catch (error) {
    throw toApiError(error, 'The template could not be deleted.');
  }
};

/** `POST /sms/templates/preview` — render a draft against sample values. */
export const previewSmsTemplate = async (payload) => {
  try {
    const { data } = await api.post('/sms/templates/preview', payload);
    return data.data || data;
  } catch (error) {
    throw toApiError(error, 'The template could not be previewed.');
  }
};

// ──────────────────── Client-side mirroring ────────────────────

/**
 * Substitutes a body's tokens, for the live handset preview.
 *
 * Mirrors `renderBody` in `sms.service.js` exactly, including the rule that an
 * unmatched token is left visible rather than blanked. The composer has to
 * render as the user types without a round trip per keystroke, which means
 * duplicating one small function — and the alternative, debouncing a server
 * preview, makes the character counter and the cost flicker on every draft.
 *
 * The duplication is safe because it is 4 lines and the one behaviour worth
 * keeping identical is the one both sides document.
 */
export const renderBodyLocally = (body = '', values = {}) =>
  String(body).replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g, (match, token) =>
    values[token] === undefined || values[token] === null || values[token] === ''
      ? match
      : String(values[token])
  );

/** The `{tokens}` a body uses, in order of first appearance, deduplicated. */
export const extractTokens = (body = '') => {
  const found = [];
  const pattern = /\{([a-zA-Z][a-zA-Z0-9_]*)\}/g;
  let match = pattern.exec(String(body));
  while (match) {
    if (!found.includes(match[1])) found.push(match[1]);
    match = pattern.exec(String(body));
  }
  return found;
};

/**
 * GSM-7 segment count. Mirrors `countSmsParts` in `sms.service.js`.
 *
 * Needed on the client for the same reason as the renderer: the composer's
 * "181 / 160 characters" and "3 SMS · GHC 10.44" come from this, and they have
 * to update on every keystroke. `160` is GSM-7; `70` is UCS-2, which one emoji
 * or curly apostrophe drops the whole message into — a 2.3× cost increase the
 * bursar should see before sending, not on the invoice.
 */
export const countSegments = (body = '') => {
  const text = String(body ?? '');
  const gsm7 = /^[\x20-\x7E\n\r]*$/.test(text) || /^[\x20-\x7E\n\r@£$¥èéùìòÇØøÅå]*$/.test(text);
  const perSegment = gsm7 ? 160 : 70;
  if (text.length <= perSegment) return 1;
  // Each part after the first carries a 7-character user-data header.
  return Math.ceil((text.length - perSegment) / (perSegment - 7)) + 1;
};

/** Tokens the vocabulary does not include. The composer warns before a send. */
export const unknownTokens = (body = '', vocabulary) => {
  const known = vocabulary?.length ? vocabulary : null;
  return extractTokens(body).filter((token) => !known || !known.includes(token));
};

export default {
  getSmsCredits,
  topUpSmsCredits,
  previewSms,
  previewAudience,
  sendSms,
  sendBulkSms,
  listSmsJobs,
  getSmsJob,
  cancelSmsJob,
  drainSmsQueue,
  listSmsMessages,
  listSmsTemplates,
  createSmsTemplate,
  updateSmsTemplate,
  deleteSmsTemplate,
  previewSmsTemplate,
  renderBodyLocally,
  extractTokens,
  countSegments,
  unknownTokens,
};
