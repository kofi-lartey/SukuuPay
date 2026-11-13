import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * A context menu positioned at the pointer.
 *
 * ## Why fixed rather than absolute
 *
 * The menu has to appear under the finger on a phone and under the cursor on a
 * desktop, and both are viewport coordinates. An absolutely-positioned menu is
 * placed relative to the message, which means a right-click near the right edge
 * opens a menu that runs off the screen, and a long press near the bottom opens
 * one underneath the composer.
 *
 * ## Why the position is measured, not estimated
 *
 * The menu is placed at the pointer, then measured, then shifted so it fits. The
 * height is not known in advance — it depends on which actions the caller
 * supplied, and "Delete" appears only for the author — so a fixed guess would
 * either clip a real menu or leave a gap for a short one.
 *
 * ## Dismissal
 *
 * Outside click, Escape, scroll, and resize. Scroll matters most: a menu that
 * survives a scroll points at a message that has moved out from under it.
 */

const MARGIN = 8;

const ContextMenu = ({ open, x, y, actions, onClose, ariaLabel = 'Message actions' }) => {
  const ref = useRef(null);
  const [position, setPosition] = useState({ left: x, top: y });

  // Place first at the pointer, then correct against the real size.
  useLayoutEffect(() => {
    if (!open || !ref.current) return;

    const { offsetWidth: width, offsetHeight: height } = ref.current;
    const maxLeft = window.innerWidth - width - MARGIN;
    const maxTop = window.innerHeight - height - MARGIN;

    setPosition({
      left: Math.max(MARGIN, Math.min(x, maxLeft)),
      // Open upward when there is no room below: a message at the bottom of the
      // transcript is exactly where a reply is most likely to be wanted.
      top: y + height + MARGIN > window.innerHeight ? Math.max(MARGIN, y - height) : y,
    });
  }, [open, x, y, actions.length]);

  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event) => {
      if (ref.current && !ref.current.contains(event.target)) onClose?.();
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', onClose, true);
    window.addEventListener('resize', onClose);

    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', onClose, true);
      window.removeEventListener('resize', onClose);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={ariaLabel}
      style={{ left: position.left, top: position.top }}
      className="fixed z-50 min-w-[150px] rounded-xl border border-slate-200 bg-white p-1 shadow-lg"
    >
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          role="menuitem"
          onClick={() => {
            onClose?.();
            action.onSelect?.();
          }}
          className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12px] font-bold hover:bg-slate-100 ${
            action.danger ? 'text-red-600 hover:bg-red-50' : 'text-slate-600'
          }`}
        >
          {action.icon}
          {action.label}
        </button>
      ))}
    </div>
  );
};

export default ContextMenu;