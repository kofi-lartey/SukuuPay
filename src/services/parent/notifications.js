import apiClient from './apiClient';

export const fetchNotifications = (token, { filter, page = 1, perPage = 30 } = {}) =>
  apiClient.get(`/pay/${encodeURIComponent(token)}/notifications`, {
    params: { filter: filter && filter !== 'all' ? filter : undefined, page, perPage },
  });

export const markNotificationRead = (token, notificationId) =>
  apiClient.put(
    `/pay/${encodeURIComponent(token)}/notifications/${encodeURIComponent(notificationId)}/read`
  );

export const markAllNotificationsRead = (token) =>
  apiClient.put(`/pay/${encodeURIComponent(token)}/notifications/read-all`);
