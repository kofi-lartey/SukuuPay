import apiClient from './apiClient';

export const sendSupportMessage = (token, payload) =>
  apiClient.post(`/pay/${encodeURIComponent(token)}/support`, payload);
