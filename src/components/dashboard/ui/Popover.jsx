import React, { useEffect, useRef, useState } from 'react';

/**
 * A popover anchored to its trigger.
 *
 * The topbar has three of these — school, term, account — and each needs the
 * same two behaviours that are easy to forget and annoying to notice: clicking
 * away closes it, and Escape closes it. Doing that once here beats three copies
 * of the same document listener, and it is why the account menu is dismissible
 * from the keyboard rather than only by a second click.
 *
 * The panel is absolutely positioned rather than portalled. A portal is the
 * right answer when the trigger sits inside an `overflow: hidden` ancestor and
 * would be clipped; nothing in the topbar does, and a portal would buy an extra
 * stacking context to fight against the sticky header for no gain.
 */
const Popover = ({ label, align = 'left', width = 'w-64', children, panel, className = '' }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
      >
        {label}
      </button>

      {open && (
        <div
          role="menu"
          className={`absolute z-50 mt-2 ${width} ${
            align === 'right' ? 'right-0' : 'left-0'
          } overflow-hidden rounded-xl border border-slate-200 bg-white shadow-soft`}
        >
          {panel}
        </div>
      )}
    </div>
  );
};

export default Popover;
