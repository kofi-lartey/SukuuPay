import api from './api';
import { toApiError } from './toApiError';

export const quoteSmsRequest = async (units) => {
  try {
    const { data } = await api.post('/sms-requests/quote', { units });
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, 'We could not work out the price. Please try again.');
  }
};

export const createSmsRequest = async ({ units, phoneNumber, paymentMethod = 'mtn', paymentReference }) => {
  try {
    const payload =
      paymentMethod === 'manual'
        ? { units, paymentMethod: 'manual', ...(paymentReference ? { paymentReference } : {}) }
        : { units, phoneNumber, paymentMethod: 'mtn' };
    const { data } = await api.post('/sms-requests', payload);
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, 'We could not start this purchase. Please try again.');
  }
};

export const submitSmsPaymentProof = async (requestId, { submittedReference, payerName, proofNote }) => {
  try {
    const { data } = await api.post(`/sms-requests/${requestId}/submit-payment`, {
      submittedReference,
      payerName: payerName || undefined,
      proofNote: proofNote || undefined,
    });
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, 'Payment reference could not be submitted. Please try again.');
  }
};

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
  submitSmsPaymentProof,
  listSmsRequests,
  getSmsRequest,
};