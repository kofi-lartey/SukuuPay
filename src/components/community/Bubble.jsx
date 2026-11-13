import React, { useRef } from 'react';
import { useLongPress } from '../../hooks/useLongPress';

/**
 * A chat bubble that opens a menu on right-click or long-press, and opens its
 * link or file on a plain click.
 *
 * ## The gesture split
 *
 * A single click has to mean "open what this message points at" — the link in the
 * text, the card, or the attachment. Actions are therefore *not* on a click:
 *
 *  - **Desktop:** right-click (`contextmenu`) opens the menu at the cursor.
 *  - **Mobile:** a 500 ms press without movement opens it under the finger, and
 *    the click that follows is swallowed so the same gesture does not also open
 *    the link.
 *
 * Both paths are needed. Android Chrome fires `contextmenu` on a long press and
 * iOS Safari fires neither, so relying on `contextmenu` alone gives a menu that
 * works on one platform.
 *
 * ## What a click should not hijack
 *
 * A click that lands on a link, a video, an audio player or a button already does
 * something — the anchor navigates, the player toggles. Those are excluded from
 * the "open the message's link" behaviour, or a tap on a file would both play it
 * and open a second tab of it.
 */

const INTERACTIVE = 'a, button, video, audio, input, textarea, select, [role="button"]';

/** The first http(s) URL in a message body. */
const firstUrlIn = (text) => {
  if (!text || typeof text !== 'string') return null;
  const match = text.match(/https?:\/\/[^\s<>"']+/i);
  return match ? match[0].replace(/[.,;:!?)\]]+$/, '') : null;
};

/**
 * What a plain click on this message should open, if anything.
 * The card's URL first (it is the canonical link), then the first URL in the
 * text, then the first attachment.
 */
export const targetUrlFor = (message) =>
  message?.linkPreview?.url || firstUrlIn(message?.body) || message?.media?.[0]?.url || null;

const Bubble = ({ message, onOpenMenu, children }) => {
  const wrapper = useRef(null);

  const { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel, didLongPress, resetLongPress } =
    useLongPress((position) => onOpenMenu?.(position));

  const handleClick = (event) => {
    // A long press already opened the menu; do not also navigate.
    if (didLongPress()) {
      resetLongPress();
      event.preventDefault();
      return;
    }

    // Let real controls do their own job. The wrapper itself carries
    // `role="button"` for keyboard access, so it must be excluded explicitly:
    // `closest('[role="button"]')` returns the wrapper for every click inside it,
    // which made this handler bail out and the link never open.
    const interactive = event.target.closest?.(INTERACTIVE);
    if (interactive && interactive !== wrapper.current) return;

    const url = targetUrlFor(message);
    if (!url) return;

    // `noopener,noreferrer`: an untrusted page must not get a handle on this
    // window, and must not see where the click came from.
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleContextMenu = (event) => {
    event.preventDefault();
    onOpenMenu?.({ x: event.clientX, y: event.clientY });
  };

  return (
    <div
      ref={wrapper}
      role="button"
      tabIndex={0}
      // Keyboard parity: Shift+F10 and the ContextMenu key both fire this.
      onKeyDown={(event) => {
        if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
          event.preventDefault();
          const rect = wrapper.current?.getBoundingClientRect();
          onOpenMenu?.({ x: rect?.left ?? 0, y: rect?.bottom ?? 0 });
        }
      }}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchCancel}
      className="cursor-pointer"
    >
      {children}
    </div>
  );
};

export default Bubble;