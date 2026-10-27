import apiClient from './apiClient';

export const fetchPaymentHistory = (token, { filter, page = 1, perPage = 20 } = {}) =>
  apiClient.get(`/pay/${encodeURIComponent(token)}/payments`, {
    params: { filter, page, perPage },
  });

export const fetchPaymentPlan = (token) =>
  apiClient.get(`/pay/${encodeURIComponent(token)}/plan`);

export const requestPaymentPlan = (token, payload) =>
  apiClient.post(`/pay/${encodeURIComponent(token)}/plan/request`, payload);

export const cancelPaymentPlan = (token, { reason }) =>
  apiClient.post(`/pay/${encodeURIComponent(token)}/plan/cancel`, { reason });

export const initiateManualPayment = (token, payload) =>
  apiClient.post(`/pay/${encodeURIComponent(token)}/manual-initiate`, payload);

export const downloadReceiptPdf = async (token, paymentId) => {
  const response = await apiClient.get(
    `/pay/${encodeURIComponent(token)}/receipt/${encodeURIComponent(paymentId)}`,
    { responseType: 'blob' }
  );
  return response;
};
