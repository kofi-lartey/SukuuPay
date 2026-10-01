import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * Accessible dialog used by the onboarding wizard (student form, bulk-import
 * confirmation, tutorial).
 *
 * Portals to `document.body` so a step's `overflow` or stacking context can
 * never clip it. Traps nothing beyond Escape and the backdrop — the flows here
 * are short and non-destructive, and a full focus trap would be more machinery
 * than the two dialogs need.
 */
const Modal = ({ open, onClose, title, description, children, footer, size = 'md' }) => {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKeyDown);

    // The page behind a dialog must not scroll away underneath it.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Move focus into the panel so keyboard and screen-reader users are not
    // left at the top of the document.
    panelRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const widths = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-3xl' };

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center p-0 sm:items-center sm:p-6">
      <div
        className="absolute inset-0 bg-ink/55 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        // A flex COLUMN with the scroll on the body, not on the panel.
        //
        // It used to be the reverse: `overflow-y-auto` on the panel itself, so the
        // header and the footer scrolled away with the content. On a phone that is
        // not a cosmetic problem. `max-h-[92vh]` on a 568px-tall screen leaves
        // ~520px, a long form is ~740px, and `document.body { overflow: hidden }`
        // above means the page behind cannot be scrolled to reach anything either.
        // A bursar tapping "Record Manual Payment" on a 320px phone got a sheet
        // with no visible title, no visible close button and no visible submit
        // button — the form simply looked broken, because the only control they
        // needed was 500px below the fold of a container they had not been told
        // scrolls.
        //
        // `shrink-0` on the header and footer is load-bearing for the same reason:
        // without it they are the first things a flex column shrinks, which would
        // re-introduce the same disappearing controls at a smaller scale.
        className={`relative flex max-h-[92vh] w-full flex-col overflow-hidden ${widths[size]} rounded-t-2xl bg-white shadow-soft outline-none sm:rounded-2xl`}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 className="text-base font-extrabold tracking-tight text-ink">{title}</h2>
            {description && (
              <p className="mt-1 text-[13px] font-medium leading-snug text-slate-500">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="-mr-1 shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/*
          `overscroll-contain` stops the scroll chaining that turns a short sheet
          into a rubber-band on the page behind it once the body reaches its end.
          The backdrop is `absolute inset-0`, so without this the drag pulls the
          whole dialog down with it.
        */}
        <div className="overscroll-contain flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>

        {footer && (
          <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default Modal;
