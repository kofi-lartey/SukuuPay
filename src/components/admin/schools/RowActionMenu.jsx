import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal } from 'lucide-react';

/**
 * The `⋯` menu on a schools-list row.
 *
 * **Why this exists instead of four inline icon buttons, and why it is not
 * `components/dashboard/ui/Popover.jsx`.**
 *
 * Two separate decisions, and both have a failure behind them.
 *
 * A menu rather than inline buttons: the row already carries a checkbox, a
 * clickable name and a status pill, and the actions here are consequential —
 * impersonation, a cascade that signs out a school's staff, a money change. A row
 * of five icon-only buttons next to those is a row where the destructive one is two
 * mis-clicks from the harmless one, on a control the width of a fingerprint. A
 * `⋯` costs one narrow cell and puts the whole set behind an explicit choice, which
 * is the same reasoning `AdminUsers` uses for its row actions and the same one that
 * put suspension behind `SchoolUsageDrawer` in the first place.
 *
 * Not `Popover`: that component positions its panel with `position: absolute` inside
 * a `relative` wrapper, which is right for the sticky topbar — where the trigger has
 * no scrolling ancestor — and wrong for a table row. The schools table is wrapped in
 * `overflow-x-auto`, and a computed `overflow-y: visible` on one axis is coerced to
 * `auto` on the other, so the panel would be *clipped* by the scroll container: the
 * last row's menu would be cut in half and the one above it would add a scrollbar to
 * a table that had none. Fixing that from the outside means either portal-ing the
 * panel or escaping the overflow, so this component portals and measures.
 *
 * That measurement is the whole cost of the portal, and it is worth stating what it
 * buys: the panel is `position: fixed` at the trigger's own coordinates, so it is
 * immune to every `overflow`, `transform` and stacking context between the row and
 * `document.body`. It also means the panel cannot scroll away with the table, which
 * is the correct behaviour for a menu — it belongs to the button, and it closes on
 * scroll rather than travelling with the content.
 *
 * Accessibility is not optional here. The trigger is a real `<button>` carrying
 * `aria-haspopup="menu"` / `aria-expanded`; the panel is `role="menu"`; the items
 * are `role="menuitem"` buttons, so they are reachable with Tab and activated with
 * Enter and Space without any of the roving-focusindex gymnastics a full menu needs.
 * Escape and an outside click both close it, and focus returns to the trigger on
 * Escape — a menu that closes and leaves focus on `<body>` drops a keyboard user at
 * the top of the document.
 */
const RowActionMenu = ({ label, items = [], className = '' }) => {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  const close = useCallback(() => {
    setOpen(false);
    setPosition(null);
  }, []);

  /**
   * Measure before paint.
   *
   * `useLayoutEffect` rather than `useEffect` on purpose: with `useEffect` the panel
   * is first mounted at the origin and then jumped into place, which is a visible
   * flash on a table a person is scanning. Laid out before the browser paints, the
   * menu is simply already where it belongs.
   */
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return undefined;

    const place = () => {
      const rect = triggerRef.current.getBoundingClientRect();
      const PANEL_HEIGHT = 40 * Math.max(items.length, 1) + 8;
      const below = window.innerHeight - rect.bottom;

      // Flip above the trigger when there is not enough room below, and never open
      // off the right-hand edge. Both are viewport maths rather than CSS because the
      // panel is `fixed` — its containing block is the viewport, so `bottom: 100%`
      // on the trigger's wrapper would position against the `<td>` and be clipped by
      // nothing, which is exactly the bug this component exists to avoid.
      const top = below < PANEL_HEIGHT && rect.top > below ? rect.top - PANEL_HEIGHT - 4 : rect.bottom + 4;
      const left = Math.min(rect.right - 200, window.innerWidth - 208);

      setPosition({ top: Math.max(8, top), left: Math.max(8, left) });
    };

    place();

    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open, items.length, close]);

  // Click-away and Escape. `pointerdown` rather than `click`, so the click that
  // opened the menu cannot also close it, and so a mousedown elsewhere on the page
  // dismisses the menu before that element's own handler runs.
  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event) => {
      if (panelRef.current?.contains(event.target)) return;
      if (triggerRef.current?.contains(event.target)) return;
      close();
    };

    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      close();
      // Back to the trigger. Without this the menu unmounts and focus falls to
      // `<body>`, and a keyboard user's next Tab restarts the page from the skip link.
      triggerRef.current?.focus();
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, close]);

  const run = (item) => {
    close();
    // Give the click-away handler a tick to unmount the panel before the action
    // opens a dialog over it — two overlays at once is a real focus trap.
    window.setTimeout(() => item.onSelect?.(), 0);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        className={`flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40 ${className}`}
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            role="menu"
            aria-label={label}
            style={position ? { top: position.top, left: position.left } : { top: -9999, left: -9999 }}
            className="fixed z-[95] w-52 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-soft"
          >
            {items.map((item) => (
              <button
                key={item.key}
                type="button"
                role="menuitem"
                onClick={(event) => {
                  event.stopPropagation();
                  run(item);
                }}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] font-bold transition-colors ${
                  item.danger
                    ? 'text-red-700 hover:bg-red-50'
                    : 'text-slate-700 hover:bg-slate-50 hover:text-ink'
                }`}
              >
                {item.icon && <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
                <span className="min-w-0 truncate">{item.label}</span>
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  );
};

export default RowActionMenu;