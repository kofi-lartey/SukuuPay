import { useCallback, useEffect, useRef, useState } from 'react';
import {
  listNotifications,
  fetchUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  notificationMeta,
  notificationAge,
} from '../services/notifications';
import { useToast } from './useToast';

/**
 * The state behind the notification bell.
 *
 * ## Why polling rather than sockets or a subscription
 *
 * The events this bell exists for — a parent wrote in, a parent asked for time, an
 * account asked to join — are rare and latency-tolerant. A bursar acting on one is
 * reading it seconds later. A WebSocket would mean a persistent connection on the
 * school's metered data, a reconnect story, and an authenticated socket endpoint to
 * maintain, in exchange for saving a burst of polling on a screen most bursars leave
 * open all day. So: a count poll while visible, and a full list load when the panel is
 * opened.
 *
 * `document.visibilityState` gates both. A tab left open in the background all day
 * would otherwise poll a school in Accra on a laptop in a time zone where nobody is
 * looking, and — worse — come back to a badge that counted notifications raised while
 * it was away and then never got to clear.
 *
 * ## The badge is server-authoritative
 *
 * `unreadCount` comes from the API on every load and is never derived from the rows
 * this hook happens to be holding. A count computed from a 20-row page is wrong the
 * moment there are 21 unread, and a badge that over-counts trains people to ignore it,
 * which is how the alert a parent message depends on becomes invisible again.
 */

/** How often to refresh the badge while the tab is visible. */
const POLL_MS = 60_000;

export const useNotifications = ({ enabled = true } = {}) => {
  const toast = useToast();

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, perPage: 20, total: 0, totalPages: 1, unreadCount: 0 });
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Read inside the interval without making the interval itself the effect's
  // dependency. Without this the timer is torn down and rebuilt on every list load,
  // so a bursar clicking through the panel restarts the poll each time.
  const openRef = useRef(open);
  openRef.current = open;

  const refreshBadge = useCallback(async () => {
    if (!enabled) return;
    try {
      const unreadCount = await fetchUnreadCount();
      setMeta((current) => (current.unreadCount === unreadCount ? current : { ...current, unreadCount }));
    } catch {
      // `fetchUnreadCount` never throws. Left explicit so the intent survives a later
      // edit to that function making it throw.
    }
  }, [enabled]);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const result = await listNotifications({ perPage: 20 });
      setRows(result.rows);
      setMeta(result.meta);
    } catch (caught) {
      setError(caught);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  // ── Badge poll ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return undefined;

    refreshBadge();

    const tick = () => {
      if (document.visibilityState === 'visible' && !openRef.current) {
        refreshBadge();
      }
    };

    const timer = setInterval(tick, POLL_MS);
    document.addEventListener('visibilitychange', tick);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [enabled, refreshBadge]);

  // ── Open the panel ────────────────────────────────────────────────────────
  //
  // Loads on open rather than eagerly, so the badge poll stays the only background
  // traffic and the list is never stale by the time it is read.
  const handleToggle = useCallback(() => {
    setOpen((current) => {
      const next = !current;
      if (next) load();
      return next;
    });
  }, [load]);

  /**
   * Marks one read, optimistically.
   *
   * The row flips immediately because the tap that opened a message should visibly
   * settle — the alternative is a list that looks unchanged while a request is in
   * flight, and the instinct is to tap again. A failure restores the row and says so,
   * rather than leaving the badge claiming something the server disagrees with.
   */
  const handleRead = useCallback(
    async (notificationId) => {
      const previous = rows.find((row) => String(row._id) === String(notificationId));
      if (!previous || previous.read) return;

      setRows((current) =>
        current.map((row) =>
          String(row._id) === String(notificationId) ? { ...row, read: true, readAt: new Date().toISOString() } : row
        )
      );
      setMeta((current) => ({
        ...current,
        unreadCount: Math.max(0, current.unreadCount - 1),
      }));

      try {
        await markNotificationRead(notificationId);
      } catch (caught) {
        setRows((current) =>
          current.map((row) => (String(row._id) === String(notificationId) ? previous : row))
        );
        setMeta((current) => ({
          ...current,
          unreadCount: current.unreadCount + 1,
        }));
        toast?.error?.(caught?.message || 'That could not be marked as read.');
      }
    },
    [rows, toast]
  );

  const handleReadAll = useCallback(async () => {
    if (meta.unreadCount === 0) return;
    try {
      await markAllNotificationsRead();
      await load();
      toast?.success?.('All notifications cleared.');
    } catch (caught) {
      toast?.error?.(caught?.message || 'They could not be cleared.');
    }
  }, [load, meta.unreadCount, toast]);

  const handleDelete = useCallback(
    async (notificationId) => {
      try {
        await deleteNotification(notificationId);
        setRows((current) => current.filter((row) => String(row._id) !== String(notificationId)));
      } catch (caught) {
        toast?.error?.(caught?.message || 'That could not be deleted.');
      }
    },
    [toast]
  );

  return {
    rows,
    meta,
    open,
    loading,
    error,
    unreadCount: meta.unreadCount,
    toggle: handleToggle,
    close: () => setOpen(false),
    read: handleRead,
    readAll: handleReadAll,
    remove: handleDelete,
    refresh: load,
    refreshBadge,
    // Presentation helpers passed down so the panel and any future second surface
    // render a type identically without each re-deriving the fallback.
    metaFor: notificationMeta,
    ageFor: notificationAge,
  };
};

export default useNotifications;