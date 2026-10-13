import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, BellOff, CheckCheck } from 'lucide-react';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  notificationAge,
  notificationMeta,
} from '../../services/notifications';
import { SkeletonCard } from '../../components/parent/shared/Skeleton';
import EmptyState from '../../components/parent/shared/EmptyState';
import StatusPill from '../../components/parent/shared/StatusPill';
import useToast from '../../hooks/useToast';

/**
 * `services/notifications.js` tones against `StatusPill`'s tones.
 *
 * The service names a type "blue"; the shared pill has no blue and would render
 * `undefined` as a class, which silently produces an uncoloured, invisible
 * pill. Mapping here keeps the two vocabularies in step without editing the
 * shared component the admin console already renders.
 */
const PILL_TONES = { green: 'green', amber: 'amber', red: 'red', slate: 'slate', blue: 'sky' };

/**
 * The teacher's notifications.
 *
 * ## Why this is not one of the `/teacher/*` queries
 *
 * `Notification` rows are addressed to a `userId`, not to a role — the route is
 * `authenticate` only (`Backend/src/routes/notification.routes.js`) — so the
 * inbox this reads is the authenticated user's own, and it works for a teacher
 * exactly as it works for a bursar. Duplicating the three service functions
 * under `services/teacher/` for the sake of a folder would have produced two
 * copies of one endpoint and no new behaviour.
 *
 * ## Why React Query here and not the admin console's hook
 *
 * `hooks/useNotifications.js` polls every 60s and owns its own panel state. That
 * is right for a bell in a header that stays open all day, and wrong for a full
 * page: a teacher opens this, reads six rows, and leaves. The portal's contract
 * is that every page loads through React Query, so this one does too, and it
 * stops asking when it is unmounted.
 *
 * Marking read is optimistic — the row settles under the tap — and the invalidate
 * puts the server's authoritative count back rather than trusting the local
 * decrement.
 */
const TeacherNotifications = () => {
  const queryClient = useQueryClient();
  const toast = useToast();

  const { data, isLoading, error } = useQuery({
    queryKey: ['teacher', 'notifications'],
    queryFn: () => listNotifications({ perPage: 30 }),
    staleTime: 30 * 1000,
  });

  const markRead = useMutation({
    mutationFn: markNotificationRead,
    onMutate: async (notificationId) => {
      // Cancel so an in-flight refetch cannot overwrite the optimistic row.
      await queryClient.cancelQueries({ queryKey: ['teacher', 'notifications'] });
      const previous = queryClient.getQueryData(['teacher', 'notifications']);
      // Counted from what the server last said, not from the row about to change,
      // so a double tap cannot decrement twice.
      const wasUnread = previous?.rows?.some(
        (row) => String(row._id) === String(notificationId) && !row.read
      );
      queryClient.setQueryData(['teacher', 'notifications'], (current) =>
        current
          ? {
              ...current,
              rows: current.rows.map((row) =>
                String(row._id) === String(notificationId)
                  ? { ...row, read: true, readAt: new Date().toISOString() }
                  : row
              ),
              meta: {
                ...current.meta,
                unreadCount: Math.max(
                  0,
                  (current.meta?.unreadCount || 0) - (wasUnread ? 1 : 0)
                ),
              },
            }
          : current
      );
      return { previous };
    },
    onError: (err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['teacher', 'notifications'], context.previous);
      }
      toast.error(err.message || 'That could not be marked as read.');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher', 'notifications'] });
    },
  });

  const markAll = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher', 'notifications'] });
      toast.success('All notifications marked as read.');
    },
    onError: (err) => {
      toast.error(err.message || 'They could not be marked as read.');
    },
  });

  const rows = data?.rows || [];
  const unread = data?.meta?.unreadCount || 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-4">
        <div className="min-w-0">
          <p className="text-[14px] font-extrabold text-ink">Notifications</p>
          <p className="mt-0.5 text-[12px] text-slate-500">
            {unread > 0 ? `${unread} unread` : 'Nothing unread'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => markAll.mutate()}
          disabled={markAll.isPending || unread === 0}
          className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-[12px] font-extrabold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
        >
          <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
          {markAll.isPending ? 'Marking…' : 'Mark all read'}
        </button>
      </div>

      {/* List */}
      {isLoading ? (
        <>
          <SkeletonCard />
          <SkeletonCard />
        </>
      ) : error ? (
        <EmptyState
          icon={Bell}
          title="Could not load your notifications"
          description={error.message || 'Check your connection and try again.'}
        />
      ) : !rows.length ? (
        <EmptyState
          icon={BellOff}
          title="No notifications yet"
          description="Updates about your classes, attendance and reports will arrive here."
        />
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => {
            const meta = notificationMeta(row.type);
            return (
              <li key={row._id}>
                <button
                  type="button"
                  onClick={() => !row.read && markRead.mutate(row._id)}
                  aria-label={`Mark "${row.title}" as read`}
                  className={`flex w-full min-h-[44px] items-start gap-3 rounded-2xl border p-4 text-left transition-colors ${
                    row.read
                      ? 'border-slate-200/80 bg-white hover:bg-slate-50'
                      : 'border-sky-200/70 bg-sky-50/60 hover:bg-sky-50'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                      row.read ? 'bg-slate-300' : 'bg-sky-600'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill tone={PILL_TONES[meta.tone] || 'slate'}>{meta.label}</StatusPill>
                      <span className="text-[10.5px] font-semibold text-slate-400">
                        {notificationAge(row.createdAt)}
                      </span>
                    </div>
                    <p
                      className={`mt-1.5 truncate text-[13.5px] ${
                        row.read ? 'font-bold text-slate-700' : 'font-extrabold text-ink'
                      }`}
                    >
                      {row.title}
                    </p>
                    <p className="mt-0.5 text-[12.5px] leading-relaxed text-slate-500">
                      {row.message}
                    </p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default TeacherNotifications;
