import api from './api';
import { toApiError } from './toApiError';

/**
 * The Activity Log's three endpoints.
 *
 * Read-only by construction, and this module adds nothing that could write: no
 * create, no update, no delete. That is deliberate rather than a gap — a log its
 * own product can edit is not evidence of anything, so the absence of those
 * functions is the feature.
 */

/** `GET /audit-logs/:schoolId` — the filtered, paginated list. */
export const listAuditLogs = async ({ schoolId, ...params } = {}) => {
  try {
    const { data } = await api.get(`/audit-logs/${schoolId}`, { params });
    return {
      entries: data.data || [],
      meta: data.meta || { page: 1, perPage: 20, total: 0, totalPages: 0 },
    };
  } catch (error) {
    throw toApiError(error, 'Failed to load the audit trail.');
  }
};

/**
 * `GET /audit-logs/user/:userId` — one person's activity.
 *
 * Only a date range is accepted: the endpoint deliberately offers no action
 * filter, because on a per-user view there is one actor already and filtering by
 * action there is a question about time, not about who.
 */
export const listUserAuditLogs = async ({ userId, ...params } = {}) => {
  try {
    const { data } = await api.get(`/audit-logs/user/${userId}`, { params });
    return {
      entries: data.data || [],
      meta: data.meta || { page: 1, perPage: 20, total: 0, totalPages: 0 },
    };
  } catch (error) {
    throw toApiError(error, 'Failed to load that user’s activity.');
  }
};

/**
 * `GET /audit-logs/:schoolId/export` — the filtered log as CSV.
 *
 * Two things this deliberately does *not* do, and both matter more than they
 * look:
 *
 * It does not pass the filters through as a string. The query is rebuilt from the
 * caller's object, so a filter cannot be smuggled in as a raw query string.
 *
 * And it hands the *browser* the download rather than fetching it through axios
 * and reassembling a Blob. A CSV assembled in JS is a CSV that can be silently
 * truncated by the client, and the failure is a file that opens and is short —
 * which for an audit export is the worst possible way to be wrong. Letting the
 * browser stream the response means a partial file is not producible.
 *
 * The service still owns the filters: `streamCsv` on the server honours the same
 * `from`/`to`/`action`/`entity` the screen is showing, so the export answers the
 * question on screen rather than a different and unstated one.
 */
export const exportAuditLogsCsv = async ({ schoolId, ...filters } = {}) => {
  try {
    const response = await api.get(`/audit-logs/${schoolId}/export`, {
      params: filters,
      responseType: 'blob',
    });

    // The server names the file `audit-log-<slug>-<date>.csv`. Read it back off
    // the header so a bursar's downloaded file carries the school's slug rather
    // than `download`, which matters when several schools' exports end up in one
    // folder during a review.
    const disposition = response.headers?.['content-disposition'] || '';
    const match = /filename="?([^"]+)"?/.exec(disposition);
    const filename = match ? match[1] : `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;

    const href = URL.createObjectURL(response.data);
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    // Revoked on the next tick rather than immediately: revoking synchronously
    // races the click in some browsers and produces an empty download.
    setTimeout(() => URL.revokeObjectURL(href), 0);

    return { filename };
  } catch (error) {
    throw toApiError(error, 'Could not export the audit trail.');
  }
};

/**
 * The action list for the filter dropdown.
 *
 * Mirrors the model's enum, and is kept here rather than hardcoded in the
 * component so a filter that offers a value the API rejects is a visible diff
 * rather than a 422 discovered by a user. The backend now validates against the
 * same array (it previously held a stale 14-item copy that rejected 13 of the
 * actions the system actually writes).
 */
export const AUDIT_ACTIONS = [
  'student.create',
  'student.update',
  'student.delete',
  'payment.success',
  'payment.failed',
  'plan.create',
  'plan.accept',
  'plan.cancel',
  'sms.send',
  'school.update',
  'user.login',
  'user.invite',
  'settings.update',
  'markup.update',
  'gateway_mode.update',
  'whatsapp.send',
  'whatsapp.bulk_send',
  'whatsapp.template_create',
  'webhook.received',
  'sms.dlr_update',
  'sms.bulk_send',
  'sms.job_cancel',
  'sms.template_create',
  'sms.template_update',
  'sms.template_delete',
  'sms.credit_topup',
  'sms.test_send',
  'report.viewed',
];

/**
 * Groups an action into the four lanes the ledger stream legend uses.
 *
 * Derived from the action's prefix rather than from a lookup table, so a new
 * `sms.*` action colours correctly the day it is added to the backend instead of
 * falling through to an unnamed grey.
 */
export const AUDIT_CATEGORY = {
  finance: 'Finance',
  messaging: 'Messaging',
  academic: 'Academic',
  security: 'Security',
};

export const auditCategoryOf = (action = '') => {
  const [domain, verb] = action.split('.');
  if (action.startsWith('payment.') || action.startsWith('plan.') || action.startsWith('markup.')) {
    return 'finance';
  }
  if (action.startsWith('sms.') || action.startsWith('whatsapp.') || action.startsWith('webhook.')) {
    return 'messaging';
  }
  if (action.startsWith('student.')) return 'academic';
  // Sign-ins, invites, school config and gateway switches. A school admin reading
  // the Security lane is reading "who got in and who got given what".
  if (domain === 'user' || domain === 'school' || domain === 'settings' || domain === 'gateway_mode') {
    return 'security';
  }
  return null;
};

export default { listAuditLogs, listUserAuditLogs, exportAuditLogsCsv };