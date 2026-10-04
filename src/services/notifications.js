import api from './api';
import { toApiError } from './toApiError';

/**
 * The in-app notification inbox.
 *
 * ## Why this module exists at all
 *
 * `Notification` rows have been written by services since before there was any screen
 * to read them — `plan.requested`, `school.join_request`, `parent.message` and
 * `system.alert` all insert into a collection that had no client. The bell in
 * `DashboardTopbar` was a hard-disabled `<button>` carrying the note "Notifications
 * arrive with the SMS Reminders module", which was not true of anything.
 *
 * The consequence was concrete and is the reason a parent message never reached a
 * school: `POST /pay/:token/notify-school` wrote one notification per admin, answered
 * 200, and the bursar was never shown anything. The parent was told the school had
 * been notified. It had been *recorded*, and recording is not receipt.
 *
 * Every notification type is therefore rendered by the same panel rather than by
 * per-type pages, because the alternative is a bell that only works for whichever
 * module happened to build a route first.
 */

/** Human wording and tone per type, so the panel is not a list of dotted strings. */
export const NOTIFICATION_META = {
  'payment.received': { tone: 'green', label: 'Payment' },
  'plan.created': { tone: 'blue', label: 'Plan' },
  'plan.accepted': { tone: 'green', label: 'Plan' },
  'plan.overdue': { tone: 'amber', label: 'Arrears' },
  'student.imported': { tone: 'slate', label: 'Roster' },
  'sms.sent': { tone: 'blue', label: 'SMS' },
  'subscription.expiring': { tone: 'amber', label: 'Subscription' },
  'school.join_request': { tone: 'amber', label: 'Access' },
  'plan.requested': { tone: 'amber', label: 'Needs action' },
  'parent.message': { tone: 'blue', label: 'Parent' },
  'parent.audio_message': { tone: 'blue', label: 'Parent · voice' },
  'system.alert': { tone: 'red', label: 'System' },
};

/** Falls back to `system.alert` so a new backend type is never an unrendered blank. */
export const notificationMeta = (type) =>
  NOTIFICATION_META[type] || NOTIFICATION_META['system.alert'];

/**
 * The list.
 *
 * `read` is sent as `false` or `true` explicitly rather than omitted, because the
 * bell's default view is the unread tab and the badge count has to agree with what the
 * panel shows. The backend returns `unreadCount` inside `meta` for exactly this, and it
 * is authoritative — the client does not count rows it happens to have loaded.
 */
export const listNotifications = async ({
  page = 1,
  perPage = 20,
  read,
  type,
} = {}) => {
  try {
    const { data } = await api.get('/notifications', {
      params: {
        page,
        perPage,
        read: read === undefined || read === null ? undefined : String(Boolean(read)),
        type: type || undefined,
      },
    });
    return {
      rows: Array.isArray(data?.data) ? data.data : [],
      meta: {
        page: Number(data?.meta?.page) || 1,
        perPage: Number(data?.meta?.perPage) || perPage,
        total: Number(data?.meta?.total) || 0,
        totalPages: Math.max(1, Number(data?.meta?.totalPages) || 1),
        // The count is deliberately read from the server on every load rather than
        // derived from `rows`. A bell that says "3 unread" while the panel lists five
        // is worse than one that is briefly blank, because a bursar triages on it.
        unreadCount: Number(data?.meta?.unreadCount) || 0,
      },
    };
  } catch (error) {
    throw toApiError(error, 'Your notifications could not be loaded.');
  }
};

/** The badge count alone — one small request for the topbar. */
export const fetchUnreadCount = async () => {
  try {
    const { data } = await api.get('/notifications', {
      params: { read: 'false', perPage: 1, page: 1 },
    });
    return Number(data?.meta?.unreadCount) || 0;
  } catch (error) {
    // Never throws. A badge is not worth an error boundary, and a school admin whose
    // session has just expired is handled by the axios interceptor, not here.
    return 0;
  }
};

/**
 * Marks one read.
 *
 * Optimistic on the caller's side (see `useNotifications`) but this returns the updated
 * row so the panel can replace its copy rather than guess at the new `readAt`.
 */
export const markNotificationRead = async (notificationId) => {
  try {
    const { data } = await api.put(`/notifications/${notificationId}/read`);
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, 'That notification could not be marked as read.');
  }
};

/**
 * Marks everything read.
 *
 * `PUT /notifications/read-all` is declared after `/:id/read` in the router and both
 * are two-segment paths under `/notifications`, which is safe because they differ in
 * method-segment position — but it is worth naming, because reordering those two lines
 * is the kind of edit that silently turns "mark all" into "mark the one whose id is
 * literally `read-all`".
 */
export const markAllNotificationsRead = async () => {
  try {
    const { data } = await api.put('/notifications/read-all');
    return Number(data?.data?.updatedCount) || 0;
  } catch (error) {
    throw toApiError(error, 'Your notifications could not be cleared.');
  }
};

export const deleteNotification = async (notificationId) => {
  try {
    await api.delete(`/notifications/${notificationId}`);
    return true;
  } catch (error) {
    throw toApiError(error, 'That notification could not be deleted.');
  }
};

/** A relative "2m ago". Kept here rather than in the panel so both panels agree. */
export const notificationAge = (iso) => {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};