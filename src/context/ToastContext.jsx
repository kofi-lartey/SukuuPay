import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react';

/**
 * Minimal toast system. The app had no notification layer before, but the
 * onboarding wizard needs one and the brief rules out `alert()`.
 *
 * Mounted once in `App` (inside `AuthProvider`) so any page can raise a toast
 * without prop drilling.
 */

const ToastContext = createContext(null);

const TONES = {
  success: {
    icon: CircleCheck,
    ring: 'border-brand-200 bg-brand-50 text-brand-800',
    iconClass: 'text-brand-600',
  },
  error: {
    icon: CircleAlert,
    ring: 'border-red-200 bg-red-50 text-red-800',
    iconClass: 'text-red-600',
  },
  warning: {
    icon: TriangleAlert,
    ring: 'border-amber-200 bg-amber-50 text-amber-800',
    iconClass: 'text-amber-600',
  },
  info: {
    icon: Info,
    ring: 'border-slate-200 bg-slate-50 text-slate-700',
    iconClass: 'text-slate-500',
  },
};

const DISMISS_AFTER_MS = 5000;

let nextId = 0;

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  // Timers are kept outside React state so a re-render never restarts a countdown.
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (message, tone = 'info') => {
      const id = `toast_${(nextId += 1)}`;
      setToasts((current) => [...current, { id, message, tone }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), DISMISS_AFTER_MS)
      );
      return id;
    },
    [dismiss]
  );

  // Clear every pending timer if the provider unmounts (e.g. HMR) so a stale
  // setState never fires against a dead tree.
  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((timer) => clearTimeout(timer));
      pending.clear();
    };
  }, []);

  const value = useMemo(
    () => ({
      toast: push,
      success: (message) => push(message, 'success'),
      error: (message) => push(message, 'error'),
      warning: (message) => push(message, 'warning'),
      info: (message) => push(message, 'info'),
      dismiss,
    }),
    [push, dismiss]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 top-20 z-[100] flex flex-col items-center gap-2 px-4 sm:items-end sm:px-6"
        role="region"
        aria-label="Notifications"
      >
        {toasts.map(({ id, message, tone }) => {
          const { icon: Icon, ring, iconClass } = TONES[tone] || TONES.info;
          return (
            <div
              key={id}
              role="status"
              aria-live="polite"
              className={`pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-xl border px-3.5 py-3 shadow-soft ${ring}`}
            >
              <Icon className={`mt-px h-4 w-4 shrink-0 ${iconClass}`} aria-hidden="true" />
              <p className="min-w-0 flex-1 text-[13px] font-semibold leading-snug">{message}</p>
              <button
                type="button"
                onClick={() => dismiss(id)}
                aria-label="Dismiss notification"
                className="-mr-1 shrink-0 rounded-md p-0.5 opacity-60 transition-opacity hover:opacity-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export default ToastContext;
