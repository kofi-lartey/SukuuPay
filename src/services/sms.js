import api from './api';
import { toApiError } from './toApiError';

/**
 * Outbound bulk SMS.
 *
 * NOTE: the API exposes no school-facing SMS send route today. The only SMS
 * endpoints are the provider delivery webhooks (see webhooks.routes.js) and
 * `GET /admin/sms-balance`; automated nudging runs server-side from the
 * `installmentReminder` cron. Until a send route lands, this throws
 * `SMS_SEND_NOT_SUPPORTED` so the wizard reports the real state instead of
 * showing a success toast for zero delivered messages.
 */
export const sendBulk = async (schoolId, filters, message) => {
  try {
    const { data } = await api.post(`/sms/bulk/${schoolId}`, { ...filters, message }, {
      timeout: 60000,
    });
    return data.data || data;
  } catch (error) {
    const status = error?.response?.status;
    if (status === 404 || status === 405) {
      const notSupported = new Error(
        'Bulk SMS sending is not available on the API yet. Reminders are queued server-side once the roster is imported.'
      );
      notSupported.status = status;
      notSupported.code = 'SMS_SEND_NOT_SUPPORTED';
      throw notSupported;
    }
    throw toApiError(error, 'The reminders could not be sent.');
  }
};


/** Platform SMS credit, for the confirmation dialog's cost estimate. */
export const getSmsBalance = async () => {
  try {
    const { data } = await api.get('/admin/sms-balance', { timeout: 8000 });
    return data.data?.balance ?? data.balance ?? null;
  } catch {
    // A super-admin-only endpoint; a null balance just means no estimate.
    return null;
  }
};

export default { sendBulk, getSmsBalance };
