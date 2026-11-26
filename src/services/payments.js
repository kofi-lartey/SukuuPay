import api from './api.js';
import { toApiError } from './toApiError';

const CURRENCY = "GHc";
const money = (value) => `${CURRENCY} ${((Number(value) || 0) / 100).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Record a manual (cash/cheque/bank) payment at the desk.
 * POST /payments/record
 */
export const recordManualPayment = async (payload) => {
  const { data } = await api.post("/payments/record", payload);
  return data?.data ?? data;
};

/**
 * Confirm a manual payment by reference code.
 * POST /admin/manual-payments/confirm
 */
export const confirmManualPayment = async ({ referenceCode, amountReceived }) => {
  const { data } = await api.post("/admin/manual-payments/confirm", {
    referenceCode,
    amountReceived,
  });
  return data?.data ?? data;
};

/**
 * Download an admin receipt PDF as a blob.
 * GET /payments/:paymentId/receipt.pdf
 */
export const downloadReceiptPdf = async (paymentId, receiptNumber) => {
  const response = await api.get(
    `/payments/${encodeURIComponent(paymentId)}/receipt.pdf`,
    { responseType: 'blob' }
  );

  const disposition = response.headers?.['content-disposition'] || '';
  const match = disposition.match(/filename="?([^"]+)"?/i);
  const filename = match?.[1] || `${receiptNumber || 'receipt'}.pdf`;

  const blob = new Blob([response.data], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return filename;
};

/**
 * Download a parent-scoped receipt PDF as a blob.
 * GET /pay/:token/receipt/:paymentId
 */
export const downloadParentReceiptPdf = async (token, paymentId) => {
  const response = await api.get(
    `/pay/${encodeURIComponent(token)}/receipt/${encodeURIComponent(paymentId)}`,
    { responseType: 'blob' }
  );

  const disposition = response.headers?.['content-disposition'] || '';
  const match = disposition.match(/filename="?([^"]+)"?/i);
  const filename = match?.[1] || `${paymentId || 'receipt'}.pdf`;

  const blob = new Blob([response.data], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return filename;
};

/**
 * Send the receipt to the parent by email (mailto:).
 * POST /payments/:paymentId/receipt/email
 */
export const emailReceipt = async (paymentId, email) => {
  try {
    const { data } = await api.post(
      `/payments/${encodeURIComponent(paymentId)}/receipt/email`,
      email ? { email } : {},
      { timeout: 30000 }
    );
    const payload = data?.data || null;
    if (payload?.mailtoUrl) {
      const a = document.createElement('a');
      a.href = payload.mailtoUrl;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
    return payload;
  } catch (error) {
    throw toApiError(error, 'The receipt could not be emailed.');
  }
};

/**
 * Send the receipt to the parent on WhatsApp.
 * POST /payments/:paymentId/receipt/whatsapp
 */
export const whatsappReceipt = async (paymentId) => {
  try {
    const { data } = await api.post(
      `/payments/${encodeURIComponent(paymentId)}/receipt/whatsapp`,
      {},
      { timeout: 30000 }
    );
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, 'The receipt could not be sent on WhatsApp.');
  }
};

/**
 * Fetch receipt details (JSON).
 * GET /payments/:paymentId/receipt
 */
export const getReceipt = async (paymentId) => {
  const { data } = await api.get(`/payments/${encodeURIComponent(paymentId)}/receipt`);
  return data?.data ?? data;
};

/**
 * Fetch payment detail.
 * GET /payments/:paymentId
 */
export const getPayment = async (paymentId) => {
  const { data } = await api.get(`/payments/${encodeURIComponent(paymentId)}`);
  return data?.data ?? data;
};

/**
 * List payments with filters.
 * GET /payments
 */
export const listPayments = async (params = {}) => {
  const { data } = await api.get("/payments", { params });
  // Backend wraps as { success, message, data: rows[], meta }
  return { rows: data?.data ?? [], meta: data?.meta ?? null };
};

/**
 * Get collection KPIs summary.
 * GET /payments/summary
 */
export const getPaymentSummary = async (params = {}) => {
  const { data } = await api.get("/payments/summary", { params });
  return data?.data ?? data;
};

/**
 * Export filtered payments as CSV.
 * GET /payments/export
 */
export const exportPayments = async (params = {}) => {
  const response = await api.get("/payments/export", {
    params,
    responseType: 'blob',
  });
  return response;
};

/**
 * List payments for a specific student.
 * GET /students/:studentId/payments
 */
export const listStudentPayments = async (studentId, params = {}) => {
  const { data } = await api.get(`/students/${encodeURIComponent(studentId)}/payments`, { params });
  return data?.data ?? data;
};

/**
 * Refund a payment.
 * POST /payments/:paymentId/refund
 */
export const refundPayment = async (paymentId, payload = {}) => {
  const { data } = await api.post(`/payments/${encodeURIComponent(paymentId)}/refund`, payload);
  return data?.data ?? data;
};

/**
 * Resend a manual payment receipt SMS.
 * POST /payments/:id/resend-sms
 */
export const resendPaymentSms = async (paymentId) => {
  const { data } = await api.post(`/payments/${encodeURIComponent(paymentId)}/resend-sms`);
  return data?.data ?? data;
};

export default {
  recordManualPayment,
  listPayments,
  getPayment,
  getPaymentSummary,
  exportPayments,
  listStudentPayments,
  getReceipt,
  downloadReceiptPdf,
  downloadParentReceiptPdf,
  emailReceipt,
  whatsappReceipt,
  refundPayment,
  resendPaymentSms,
  confirmManualPayment,
  money,
};
