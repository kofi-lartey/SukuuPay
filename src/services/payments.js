import api from './api';
import { toApiError } from './toApiError';

/**
 * Payment operations the dashboard needs.
 *
 * **Amounts are integer pesewas.** 100 pesewas is GH₵ 1.00. Every function here
 * takes and returns pesewas, and the UI's `MoneyInput` is the only thing that
 * crosses into cedis — the same rule the student module follows, for the same
 * reason: a form that passes a typed `850` through to a pesewa field records a
 * one-cedi payment, and nothing downstream can tell.
 */

/**
 * Record a payment taken at the bursar's desk — cash, a cheque, a transfer into
 * the school's account.
 *
 * Settles the student in the same transaction as the payment row, so the
 * balance, the roster and every report move together. Resolves to
 * `{ payment, student }` — the student's new `totalPaid` and `balance` are
 * returned so a caller can show the result without a second fetch.
 */
export const recordManualPayment = async (payload) => {
  try {
    const { data } = await api.post('/payments/record', payload, { timeout: 20000 });
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, 'The payment could not be recorded.');
  }
};

/** The payment list, for the dashboard's recent-activity and the Payments module. */
export const listPayments = async (params = {}) => {
  try {
    const { data } = await api.get('/payments', { params, timeout: 15000 });
    return {
      // `listPaymentsController` returns `{ success, data, meta }` with `data` a
      // bare array.
      rows: Array.isArray(data?.data) ? data.data : [],
      meta: data?.meta || null,
    };
  } catch (error) {
    throw toApiError(error, 'Payments could not be loaded.');
  }
};

export const getPayment = async (paymentId) => {
  try {
    const { data } = await api.get(`/payments/${encodeURIComponent(paymentId)}`, { timeout: 15000 });
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, 'That payment could not be loaded.');
  }
};

/** One student's payments, for the profile drawer's history tab. */
export const listStudentPayments = async (studentRef, params = {}) => {
  try {
    const { data } = await api.get('/payments', {
      params: { ...params, studentId: studentRef },
      timeout: 15000,
    });
    return Array.isArray(data?.data) ? data.data : [];
  } catch (error) {
    throw toApiError(error, 'Payments could not be loaded.');
  }
};

/** Download a receipt. A blob, because the response is a file. */
export const downloadReceipt = async (paymentId) => {
  try {
    const response = await api.get(`/payments/${encodeURIComponent(paymentId)}/receipt`, {
      responseType: 'blob',
      timeout: 30000,
    });
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

export default {
  recordManualPayment,
  listPayments,
  getPayment,
  listStudentPayments,
  downloadReceipt,
};
