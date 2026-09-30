import api from './api';
import { toApiError } from './toApiError';

/**
 * The public, parent-facing pay surface.
 *
 * **No token.** These four functions are the only ones in the app that are
 * unauthenticated, and they are reached by a link a parent received by SMS. The
 * pay token in the URL *is* the credential: anyone holding the link can see that
 * child's balance and pay it, which is the point and also why the backend
 * returns a deliberately narrow student record rather than a full one.
 *
 * `api.js` is used rather than bare `fetch` so the base URL, timeouts and
 * interceptors stay in one place — with one exception worth knowing about: there
 * is no `Authorization` header here, and adding one would be a mistake, because a
 * parent with an expired session must still be able to pay.
 */

export const getPayView = async (token) => {
  try {
    const { data } = await api.get(`/pay/${encodeURIComponent(token)}`, { timeout: 20000 });
    return data?.data || data;
  } catch (error) {
    throw toApiError(error, 'This payment link could not be opened.');
  }
};

/**
 * Start a Mobile Money payment.
 *
 * `network` and `phone` are the parent's choice, not the school's: the number is
 * the one on the SIM in front of them, and the network decides which prompt they
 * get. A wrong network here is the difference between a prompt that arrives and
 * one that does not.
 */
export const initiatePay = async (token, payload) => {
  try {
    const { data } = await api.post(
      `/pay/${encodeURIComponent(token)}/initiate`,
      payload,
      { timeout: 30000 }
    );
    return data?.data || data;
  } catch (error) {
    throw toApiError(error, 'The payment could not be started.');
  }
};

/** Poll for the gateway's answer after the prompt. */
export const verifyPay = async (token, payload) => {
  try {
    const { data } = await api.post(
      `/pay/${encodeURIComponent(token)}/verify`,
      payload,
      { timeout: 20000 }
    );
    return data?.data || data;
  } catch (error) {
    throw toApiError(error, 'The payment status could not be checked.');
  }
};

/** The receipt, as a file. */
export const downloadPayReceipt = async (token, paymentId) => {
  try {
    const response = await api.get(
      `/pay/${encodeURIComponent(token)}/receipt/${encodeURIComponent(paymentId)}`,
      { responseType: 'blob', timeout: 30000 }
    );
    const disposition = response.headers?.['content-disposition'] || '';
    const match = disposition.match(/filename="?([^"]+)"?/);
    const filename = match ? match[1] : `receipt-${paymentId}.pdf`;

    const url = URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    return { filename };
  } catch (error) {
    throw toApiError(error, 'The receipt could not be downloaded.');
  }
};

export default { getPayView, initiatePay, verifyPay, downloadPayReceipt };
