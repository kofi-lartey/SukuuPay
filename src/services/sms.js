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


/**
 * Removed: `getSmsBalance()`.
 *
 * It called `GET /admin/sms-balance`, which sits behind
 * `authorize("super_admin")` in `Backend/src/routes/admin.routes.js`. Step 4 of
 * onboarding called it, so every school admin received
 * `403 You do not have access to this resource` on arriving at the reminder step
 * — which is how the bug was reported, via the "Skip for Now" path into Step 4.
 *
 * The catch block returned `null`, so the failure was silent to the UI while
 * still logging a request the caller was never entitled to make. And the number
 * itself is the platform's master SMS credit, not the school's, so it was the
 * wrong figure for a cost estimate regardless. Step 4 now derives the estimate
 * from the recipient count and the per-message unit cost.
 *
 * Deliberately deleted rather than left in place: a helper whose documented
 * behaviour is to call an endpoint this role cannot reach is a footgun.
 */

export default { sendBulk };
