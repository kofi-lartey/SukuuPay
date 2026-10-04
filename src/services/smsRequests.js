import api from './api';
import { toApiError } from './toApiError';

/**
 * Regulated SMS credit purchase — the school's side.
 *
 * Three calls, and the order they are used in matters: quote, create, then poll. The
 * quote exists so the cost is on screen *before* anything is committed, which is the
 * whole requirement, and it is a separate request rather than a `?dryRun` because a
 * quote is a thing a bursar may legitimately re-open several times while deciding.
 *
 * Not `services/sms.js`, which is about *sending* messages and reading the balance.
 * Buying the credit is a different concern with a different permission (money), and
 * merging the two would put a purchase button next to a send button on the same screen.
 */

/**
 * Prices a purchase. Writes nothing.
 *
 * `canRequest: false` is not an error — it is the answer. The console can be short on
 * Arkesel credit while every endpoint is healthy, and a bursar deserves to be told that
 * before they commit rather than after a MoMo prompt they have already approved.
 */
export const quoteSmsRequest = async (units) => {
  try {
    const { data } = await api.post('/sms-requests/quote', { units });
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, 'We could not work out the price. Please try again.');
  }
};

/**
 * Creates the request and triggers the MTN prompt.
 *
 * `phoneNumber` is passed explicitly rather than read from the profile, and the reason
 * is worth keeping: the person approving a purchase at a school is often not the person
 * holding the MoMo wallet, and prompting the account holder for a purchase they are not
 * aware of is how a school ends up with a paid request nobody can explain.
 */
export const createSmsRequest = async ({ units, phoneNumber }) => {
  try {
    const { data } = await api.post('/sms-requests', { units, phoneNumber });
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, 'We could not start this purchase. Please try again.');
  }
};

/** The school's own purchase history, newest first. */
export const listSmsRequests = async ({ page = 1, perPage = 20, status = 'all' } = {}) => {
  try {
    const { data } = await api.get('/sms-requests', {
      params: { page, perPage, status: status || undefined },
    });
    return {
      rows: Array.isArray(data?.data) ? data.data : [],
      meta: {
        page: Number(data?.meta?.page) || 1,
        perPage: Number(data?.meta?.perPage) || perPage,
        total: Number(data?.meta?.total) || 0,
        totalPages: Math.max(1, Number(data?.meta?.totalPages) || 1),
      },
    };
  } catch (error) {
    throw toApiError(error, 'Your SMS purchases could not be loaded.');
  }
};

/**
 * One request, for the status poll.
 *
 * Polled rather than pushed because the state that changes — `awaiting_payment` →
 * `awaiting_approval` — is driven by an MTN webhook arriving independently of the
 * browser, and a school admin is not holding a page open at the moment they approve the
 * prompt on their phone. Polling on page focus is the honest version of that.
 */
export const getSmsRequest = async (requestId) => {
  try {
    const { data } = await api.get(`/sms-requests/${requestId}`);
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, 'That purchase could not be loaded.');
  }
};

export default {
  quoteSmsRequest,
  createSmsRequest,
  listSmsRequests,
  getSmsRequest,
};