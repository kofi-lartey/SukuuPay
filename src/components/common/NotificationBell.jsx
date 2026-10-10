import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCheck, Inbox, Loader2, Trash2 } from 'lucide-react';
import useNotifications from '../../hooks/useNotifications';

/**
 * The notification bell.
 *
 * Replaces a hard-disabled `<button>` in the dashboard topbar that carried the note
 * "Notifications arrive with the SMS Reminders module". That was not accurate: services
 * had been writing `Notification` rows — including `parent.message`, one per
 * `school_admin` and `accountant`, every time a parent used the pay portal — since
 * before any client read them. The rows were correct, the endpoints worked, and nothing
 * displayed them. So a parent could send a message about an unpaid bill, be told the
 * school had been notified, and the bursar would never see it.
 *
 * ## Why this is not a `Popover`
 *
 * `components/dashboard/ui/Popover.jsx` owns its own open state, and this panel has to
 * close from the outside: tapping a row marks it read, and a `parent.message` row then
 * navigates to the inbox, which must dismiss the panel rather than leave it floating
 * over the page it just opened. Extending `Popover` to accept a controlled `open` would
 * have been the tidier change and would have touched three other topbar popovers to
 * serve one. The click-away and Escape handling below is ~15 lines and local.
 *
 * ## Parent messages get a dedicated row
 *
 * A `parent.message` or `parent.audio_message` is the one type that is a *person
 * waiting for an answer*, not a system fact. It renders the verbatim message from
 * `meta.message`, a play control when `meta.audioUrl` is set, and the callback number —
 * because the whole point of the alert is that the bursar picks up the phone. Every
 * other type renders title plus body and nothing more.
 */
const NotificationBell = ({ className = '' }) => {
  const {
    rows,
    loading,
    error,
    open,
    unreadCount,
    toggle,
    close,
    read,
    readAll,
    remove,
    metaFor,
    ageFor,
  } = useNotifications();

  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) close();
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') close();
    };

    // `pointerdown`, not `mousedown`: on a touch device the browser synthesizes
    // `mousedown` *after* `touchend`, so a tap is only acknowledged late and a
    // tap that navigates (a row link) races the close. `pointerdown` fires at
    // touch start and covers mouse, touch, and pen with one listener.
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, close]);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={
          unreadCount > 0
            ? `Notifications, ${unreadCount} unread`
            : 'Notifications'
        }
        className="relative flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {unreadCount > 0 ? (
          <span
            aria-hidden="true"
            className="absolute right-1.5 top-1.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-extrabold leading-none text-white"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        /*
          Mobile: `fixed`, not `absolute`. The bell lives inside the `sticky`
          topbar, and a sticky ancestor drags its absolutely-positioned
          children along as the page scrolls — the panel never moves relative
          to the viewport, so anything below the fold stayed below the fold
          forever and the last notifications were unreachable. pinning to the
          viewport makes the panel's on-screen position independent of the
          header and of any scroll. The height cap leaves room for the 4rem
          header plus its margin, and `100dvh` (not `100vh`) measures the
          *visual* viewport, which is what shrinks when mobile browser chrome
          appears.

          `lg:` restores the absolute dropdown anchored to the bell, where the
          page is wide enough that the panel never approaches the fold.
        */
        <div
          role="dialog"
          aria-label="Notifications"
          className="fixed right-3 top-[4.5rem] z-50 flex max-h-[min(26rem,calc(100dvh-5.5rem))] w-[min(24rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-soft lg:absolute lg:right-0 lg:top-auto lg:mt-2"
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
            <p className="text-[13px] font-extrabold text-ink">Notifications</p>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={readAll}
                className="inline-flex items-center gap-1.5 text-[12px] font-bold text-brand-700 transition-colors hover:text-brand-800"
              >
                <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Mark all read
              </button>
            ) : null}
          </div>

          {/*
            The flexible scroller. The panel owns the height cap, so this div
            fills what is left of it and scrolls: `min-h-0` releases the flex
            item's automatic minimum size, without which `overflow-y-auto`
            never engages and the list overflows the panel instead — the
            mid-row cut in the bug report. `max-h-[26rem]` stays as the
            fallback cap for browsers without `dvh`.

            `overscroll-contain` stops the touch scroll chaining to the page
            behind the panel. `touch-pan-y` and `-webkit-overflow-scrolling`
            keep the list swipeable on touch, where this inner scroller was
            the part that silently failed.
          */}
          <div
            className="min-h-0 max-h-[26rem] flex-1 touch-pan-y overflow-y-auto overscroll-contain"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {loading && rows.length === 0 ? (
              <div className="flex items-center justify-center gap-2 px-4 py-10 text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span className="text-[13px]">Loading…</span>
              </div>
            ) : null}

            {error ? (
              <p className="px-4 py-6 text-center text-[13px] font-semibold text-red-600">
                {error.message}
              </p>
            ) : null}

            {!loading && !error && rows.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <Inbox className="h-6 w-6 text-slate-300" aria-hidden="true" />
                <p className="text-[13px] font-semibold text-slate-500">
                  Nothing new right now.
                </p>
                <p className="text-[12px] text-slate-400">
                  A parent message or a fee request will appear here.
                </p>
              </div>
            ) : null}

            <ul className="divide-y divide-slate-100">
              {rows.map((row) => {
                const meta = metaFor(row.type);
                const isParentMessage =
                  row.type === 'parent.message' || row.type === 'parent.audio_message';

                return (
                  <li key={row._id}>
                    <div
                      className={`flex gap-3 px-4 py-3 transition-colors hover:bg-slate-50 ${
                        row.read ? '' : 'bg-brand-50/40'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                          row.read ? 'bg-transparent' : 'bg-brand-700'
                        }`}
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="min-w-0 text-[13px] font-extrabold leading-snug text-ink">
                            {row.title}
                          </p>
                          <span className="shrink-0 text-[11px] font-semibold text-slate-400">
                            {ageFor(row.createdAt)}
                          </span>
                        </div>

                        <p className="mt-1 text-[12px] font-semibold text-slate-500">
                          {meta.label}
                        </p>

                        {/*
                          The parent's own words, from `meta.message`, which is
                          unbounded — the notification `message` is capped at 500
                          characters and carries a *summary*, so a long message
                          truncated around a parent's actual complaint is exactly the
                          wrong thing to show the person meant to answer it.
                        */}
                        {isParentMessage && row.meta?.message ? (
                          <p className="mt-1.5 rounded-lg bg-white px-2.5 py-2 text-[13px] leading-relaxed text-slate-700 ring-1 ring-inset ring-slate-200">
                            {row.meta.message}
                          </p>
                        ) : (
                          <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
                            {row.message}
                          </p>
                        )}

                        {row.meta?.audioUrl ? (
                          <audio
                            controls
                            preload="none"
                            src={row.meta.audioUrl}
                            className="mt-2 h-9 w-full max-w-[16rem]"
                          >
                            <a href={row.meta.audioUrl} download>
                              Download the voice note
                            </a>
                          </audio>
                        ) : null}

                        {isParentMessage && row.meta?.parentPhone ? (
                          <a
                            href={`tel:${row.meta.parentPhone}`}
                            className="mt-1.5 inline-block text-[12px] font-extrabold text-brand-700 hover:underline"
                          >
                            Call {row.meta.parentName} · {row.meta.parentPhone}
                          </a>
                        ) : null}

                        <div className="mt-2 flex flex-wrap items-center gap-3">
                          <Link
                            to={row.link || '/dashboard/messages'}
                            onClick={() => {
                              if (!row.read) read(row._id);
                              close();
                            }}
                            className="text-[12px] font-extrabold text-brand-700 hover:underline"
                          >
                            {isParentMessage ? 'Open inbox' : 'Open'}
                          </Link>
                          {!row.read ? (
                            <button
                              type="button"
                              onClick={() => read(row._id)}
                              className="text-[12px] font-bold text-slate-500 hover:text-slate-700"
                            >
                              Mark read
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => remove(row._id)}
                            aria-label={`Delete notification: ${row.title}`}
                            className="inline-flex items-center gap-1 text-[12px] font-bold text-slate-400 hover:text-red-600"
                          >
                            <Trash2 className="h-3 w-3" aria-hidden="true" />
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default NotificationBell;