import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CalendarCheck, FileText, MessageCircle, Wallet } from 'lucide-react';
import { useParentPay } from '../../layouts/ParentLayout';
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '../../hooks/parent/useNotifications';
import { PARENT_ROUTES } from '../../utils/constants';
import StudentRow from '../../components/parent/shared/StudentRow';
import EmptyState from '../../components/parent/shared/EmptyState';
import ErrorBanner from '../../components/parent/shared/ErrorBanner';
import { SkeletonRow } from '../../components/parent/shared/Skeleton';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'payments', label: 'Payments' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'records', label: 'Records' },
  { key: 'messages', label: 'Messages' },
];

const iconForType = (type) => {
  if (type?.includes('payment'))
    return { Icon: Wallet, bg: 'bg-emerald-100', fg: 'text-emerald-700' };
  if (type?.includes('attendance'))
    return { Icon: CalendarCheck, bg: 'bg-sky-100', fg: 'text-sky-700' };
  if (type?.includes('record'))
    return { Icon: FileText, bg: 'bg-violet-100', fg: 'text-violet-700' };
  if (type?.includes('message'))
    return { Icon: MessageCircle, bg: 'bg-amber-100', fg: 'text-amber-700' };
  return { Icon: Bell, bg: 'bg-slate-100', fg: 'text-slate-600' };
};

const routeForNotification = (token, notification) => {
  const type = notification.type || '';
  if (type.includes('payment')) return PARENT_ROUTES.history(token);
  if (type.includes('attendance')) return PARENT_ROUTES.attendance(token);
  if (type.includes('record')) return PARENT_ROUTES.records(token);
  if (type.includes('message')) return PARENT_ROUTES.messages(token);
  return PARENT_ROUTES.portal(token);
};

const NotificationRow = ({ notification, token, onRead }) => {
  const { Icon, bg, fg } = iconForType(notification.type);
  const unread = !notification.readAt;

  return (
    <Link
      to={routeForNotification(token, notification)}
      onClick={() => unread && onRead(notification._id)}
      className="flex items-start gap-3 rounded-xl border border-slate-200/80 bg-white p-3 transition-colors hover:bg-slate-50"
    >
      <span
        className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${bg}`}
      >
        <Icon className={`h-4 w-4 ${fg}`} aria-hidden="true" />
        {unread ? (
          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
        ) : null}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-extrabold text-ink">
          {notification.title}
        </p>
        <p className="mt-0.5 line-clamp-2 text-[12.5px] text-slate-500">
          {notification.message}
        </p>
        <p className="mt-1 text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">
          {notification.relativeTime || notification.createdAt}
        </p>
      </div>
    </Link>
  );
};

const Notifications = () => {
  const { token, student, school } = useParentPay();
  const [filter, setFilter] = useState('all');

  const { data, isLoading, error, refetch } = useNotifications(token, { filter });
  const markRead = useMarkNotificationRead(token);
  const markAllRead = useMarkAllNotificationsRead(token);

  const list = useMemo(() => data?.notifications || [], [data]);

  return (
    <div className="space-y-5">
      <StudentRow student={student} school={school} />

      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-2 overflow-x-auto pb-1">
          {FILTERS.map((f) => {
            const active = f.key === filter;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12.5px] font-extrabold transition-colors ${
                  active
                    ? 'bg-[#0A5C36] text-white'
                    : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
        {list.some((n) => !n.readAt) ? (
          <button
            type="button"
            onClick={() => markAllRead.mutate()}
            className="shrink-0 text-[11.5px] font-extrabold text-[#0A5C36] hover:underline"
          >
            Mark all read
          </button>
        ) : null}
      </div>

      {error ? (
        <ErrorBanner message={error.message} onRetry={refetch} />
      ) : isLoading ? (
        <div className="space-y-2">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="You're all caught up"
          description="New notices from your child's school will appear here."
        />
      ) : (
        <div className="space-y-2">
          {list.map((n) => (
            <NotificationRow
              key={n._id}
              notification={n}
              token={token}
              onRead={(id) => markRead.mutate(id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Notifications;
