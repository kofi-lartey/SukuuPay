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
    onMutate: (notificationId) => {
      // Optimistic update: mark read immediately so the UI responds before the
      // server round-trip. On failure we roll back by invalidating.
      queryClient.setQueriesData(
        { queryKey: ['parent-notifications', token] },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            data: old.data.map((n) =>
              String(n._id) === String(notificationId)
                ? { ...n, readAt: n.readAt || new Date().toISOString() }
                : n
            ),
          };
        }
      );
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ['parent-notifications', token] });
    },
    onSuccess: () =>
      // Invalidate all filter variants so filtered views (Payments, Messages, etc.)
      // also reflect the read state — the query key carries the filter suffix.
      queryClient.invalidateQueries({
        queryKey: ['parent-notifications', token],
        exact: false,
      }),
  });
};

export const useMarkAllNotificationsRead = (token) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => markAllNotificationsRead(token),
    onMutate: () => {
      queryClient.setQueriesData(
        { queryKey: ['parent-notifications', token] },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            data: old.data.map((n) => ({
              ...n,
              readAt: n.readAt || new Date().toISOString(),
            })),
          };
        }
      );
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ['parent-notifications', token] });
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ['parent-notifications', token],
        exact: false,
      }),
  });
};
