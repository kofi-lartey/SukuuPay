import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../../services/parent/notifications';

export const useNotifications = (token, { filter } = {}) =>
  useQuery({
    queryKey: ['parent-notifications', token, filter || 'all'],
    queryFn: () => fetchNotifications(token, { filter }),
    enabled: Boolean(token),
    select: (response) => response.data,
  });

export const useMarkNotificationRead = (token) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notificationId) => markNotificationRead(token, notificationId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['parent-notifications', token] }),
  });
};

export const useMarkAllNotificationsRead = (token) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => markAllNotificationsRead(token),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['parent-notifications', token] }),
  });
};
