import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * Accessible dialog.
 *
 * ## The stability rule
 *
 * The portal target is created **once** and never replaced. The panel is a
 * single flex column whose children — header, body, footer — are always
 * rendered in the same order, with `null` where a slot is unused. React
 * only reconciles structure when the tree shape is identical between
 * renders; if the header or footer is conditionally absent one render and
 * present the next, React unmounts everything below it, and any input
 * that had focus is destroyed.
 *
 * That is the exact bug the invite form hit: the panel conditionally
 * rendered `{footer && ...}` inside a flex column, and when the parent
 * re-rendered with new form state, the footer jumped in and out of the
 * tree, remounting the children between them. Focus died.
 *
 * The fix: always render the footer container, and put `null` inside it
 * when there is nothing to show. The tree shape never changes; only the
 * contents of the slot do.
 *
 * ## Focus handling
 *
 * Focus moves to the panel on open, not to an arbitrary child. This is
 * what makes the dialog keyboard-reachable without a full focus trap — a
 * short onboarding flow does not need one, but it does need to not leave
 * the keyboard user at the top of the document behind the modal.
 *
 * The panel has `tabIndex={-1}` so it can receive focus programmatically
 * without appearing in the tab order.
 *
 * ## Scroll handling
 *
 * The panel is a flex column with `max-h-[92vh]`. The header and footer
 * have `shrink-0`, the middle has `flex-1 overflow-y-auto overscroll-
 * contain`. This is the reverse of an earlier version where the panel
 * itself scrolled and the header and footer scrolled with it — on a
 * 320px phone the submit button could sit 500px below the fold with
 * nothing telling the user it existed.
 */

const Modal = ({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  hideTitle = false,
  bodyClassName = '',
}) => {
  const panelRef = useRef(null);
  const titleId = useId();
  const descId = useId();

  const wasOpen = useRef(false);

  useEffect(() => {
    if (!open) {
      wasOpen.current = false;
      return undefined;
    }

    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Focus the panel once on open. Refocusing on every render (e.g. when
    // inline handlers change identity) steals focus from inputs inside the dialog.
    if (!wasOpen.current) {
      const raf = requestAnimationFrame(() => {
        panelRef.current?.focus();
      });
      wasOpen.current = true;
      return () => {
        document.removeEventListener('keydown', onKeyDown);
        document.body.style.overflow = previousOverflow;
        cancelAnimationFrame(raf);
      };
    }

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const widths = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

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
        aria-labelledby={hideTitle ? undefined : titleId}
        aria-describedby={description ? descId : undefined}
        aria-label={hideTitle ? title : undefined}
        className={`relative flex max-h-[92vh] w-full flex-col overflow-hidden ${
          widths[size] || widths.md
        } rounded-t-2xl bg-white shadow-soft outline-none sm:rounded-2xl`}
      >
        {/* Header — always rendered. When `hideTitle` is true the header
            collapses to just the close button, positioned top-right, so
            the tree shape is identical between the two modes. */}
        <div
          className={`flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6 ${
            hideTitle ? 'border-b-0 py-3' : ''
          }`}
        >
          <div className={`min-w-0 ${hideTitle ? 'sr-only' : ''}`}>
            <h2
              id={titleId}
              className="text-base font-extrabold tracking-tight text-ink"
            >
              {title}
            </h2>
            {description && (
              <p
                id={descId}
                className="mt-1 text-[13px] font-medium leading-snug text-slate-500"
              >
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="-mr-1 shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Body — the flex-1 middle that scrolls. `bodyClassName` lets a
            caller opt into presentation tweaks (e.g. `scrollbar-none`)
            without changing every dialog. */}
        <div
          className={`overscroll-contain flex-1 overflow-y-auto px-5 py-5 sm:px-6 ${bodyClassName}`}
        >
          {children}
        </div>

        {/* Footer — always rendered. Empty when there is nothing to show.
            This is the tree-shape invariant that keeps inputs stable. */}
        <div
          className={`flex shrink-0 flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-4 sm:flex-row sm:justify-end sm:px-6 ${
            footer ? '' : 'hidden'
          }`}
        >
          {footer || null}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default Modal;