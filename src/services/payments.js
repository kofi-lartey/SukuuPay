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
 * `meta` in the shape `components/students/Pagination.jsx` already reads.
 *
 * `listPaymentsController` returns `{ page, limit, total, totalPages }` — `limit`,
 * where the pager wants `perPage`. Normalising here rather than in the pager is
 * the point: the pager is shared with the roster, whose controller *does* return
 * `perPage`, and teaching the shared component to accept two spellings of the
 * same field would put a payment-route detail into the Students module.
 */
const normaliseMeta = (meta) => ({
  page: Number(meta?.page) || 1,
  perPage: Number(meta?.perPage ?? meta?.limit) || 20,
  total: Number(meta?.total) || 0,
  totalPages: Number(meta?.totalPages) || 0,
});

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
      meta: normaliseMeta(data?.meta),
    };
  } catch (error) {
    throw toApiError(error, 'Payments could not be loaded.');
  }
};

/**
 * One payment in full, with the student and school populated.
 *
 * `includeWebhookData` is off by default and stays off here. It carries the raw
 * provider callback — the payer handset number in the clear, plus whatever else
 * the gateway decided to send — so it is a debugging aid an admin asks for, not
 * something a drawer loads on open.
 */
export const getPayment = async (paymentId, { includeWebhookData = false } = {}) => {
  try {
    const { data } = await api.get(`/payments/${encodeURIComponent(paymentId)}`, {
      params: includeWebhookData ? { includeWebhookData: true } : undefined,
      timeout: 15000,
    });
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, 'That payment could not be loaded.');
  }
};

/**
 * The aggregates behind the module's KPI band.
 *
 * A separate request, never a client-side sum over the visible page: the list is
 * capped at 100 rows per page, so summing page one of a school with 3,000
 * transactions would report page one as the term. The band and the table below it
 * are driven by the same filter, so they cannot disagree.
 *
 * There is deliberately **no escrow or bank-sweep figure** here. Nothing in this
 * backend records when collected money reached a bank — `Payment.settlement`
 * marks the moment a student's *balance* was credited, not a settlement batch —
 * so any "pending sweep" number would be invented. The band shows what is
 * actually measured instead: inflow, the network split, and the payments still
 * waiting on a gateway callback.
 */
export const getPaymentSummary = async (params = {}) => {
  try {
    const { data } = await api.get('/payments/summary', { params, timeout: 20000 });
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, 'The payment summary could not be loaded.');
  }
};

/**
 * Download the transactions the filter currently matches.
 *
 * A blob, because the response is a file — going through the `data` unwrap would
 * hand back a `SyntaxError` for a request that actually succeeded. The server
 * shares the list's filter builder, so "export what I am looking at" cannot
 * return a different set of rows than the screen it was exported from.
 */
export const exportPayments = async (params = {}) => {
  try {
    const response = await api.get('/payments/export', {
      params: { ...params, format: params.format || 'csv' },
      responseType: 'blob',
      timeout: 60000,
    });

    const disposition = response.headers?.['content-disposition'] || '';
    const match = disposition.match(/filename="?([^"]+)"?/);
    const filename = match ? match[1] : `payments.${params.format || 'csv'}`;

    const url = URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Revoked on the next tick: Safari cancels an in-flight download if the
    // object URL disappears synchronously after the click.
    setTimeout(() => URL.revokeObjectURL(url), 0);

    return { filename };
  } catch (error) {
    throw toApiError(error, 'The transactions could not be exported.');
  }
};

/**
 * Reverse a payment against the student's balance.
 *
 * `amount` is pesewas and optional — omitted, the server refunds the payment in
 * full. A partial refund leaves the original `completed` and is recorded as its
 * own negative payment row, so the two never overwrite each other.
 *
 * Admin-only server-side (`authorize('super_admin', 'school_admin')` on the
 * route), which is why the UI gates the action on the caller's role rather than
 * discovering it through a 403.
 */
export const refundPayment = async (paymentId, payload) => {
  try {
    const { data } = await api.post(`/payments/${encodeURIComponent(paymentId)}/refund`, payload, {
      timeout: 20000,
    });
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, 'The payment could not be refunded.');
  }
};

/**
 * One student's payments, for the profile drawer's history tab.
 *
 * Shares `GET /payments` rather than taking a second route, so a student's
 * history is filtered by exactly the rules the module's table uses.
 */
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

/**
 * The receipt for a payment.
 *
 * **This returns JSON, not a PDF.** `generateReceipt` builds and returns the
 * receipt document and its number; it does not render a file. The previous
 * version of this function asked for `responseType: 'blob'`, so axios handed the
 * JSON body to `URL.createObjectURL` as if it were a PDF — the download landed on
 * a bursar's machine as a corrupt file named `receipt-*.pdf`, and the failure was
 * invisible because the request genuinely succeeded.
 *
 * `generateReceipt` is also the only endpoint that mints `receiptNumber`, so
 * calling it is what makes a receipt exist for a payment that predates the
 * number. The caller renders or prints the returned document; it is not a file
 * until someone turns it into one.
 */
export const getReceipt = async (paymentId) => {
  try {
    const { data } = await api.get(`/payments/${encodeURIComponent(paymentId)}/receipt`, {
      timeout: 20000,
    });
    return data?.data?.receipt || null;
  } catch (error) {
    throw toApiError(error, 'The receipt could not be loaded.');
  }
};

export default {
  recordManualPayment,
  listPayments,
  getPayment,
  getPaymentSummary,
  exportPayments,
  refundPayment,
  listStudentPayments,
  getReceipt,
};
