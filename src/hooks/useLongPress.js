import { useCallback, useEffect, useRef } from 'react';

/**
 * Long-press detection for touch, with the two failure modes that make it feel
 * broken when they are missed.
 *
 * ## It must not fire while scrolling
 *
 * A press that turns into a scroll is the most common gesture on a phone. If the
 * finger travels more than a few pixels the timer is cancelled — otherwise every
 * attempt to scroll a transcript pops a menu over the message the user was
 * scrolling past.
 *
 * ## It must swallow the click that follows
 *
 * A long press still ends in a `click` on most browsers. Without swallowing it,
 * opening the menu and then immediately opening the link the press landed on is
 * the same gesture doing two contradictory things. `didLongPress` is read and
 * reset by the click handler.
 *
 * ## Both event paths are covered
 *
 * Android Chrome fires `contextmenu` on a long press *and* `touchstart`; iOS
 * Safari fires neither and needs the timer. Handling only one of them gives a
 * menu that works on exactly one platform.
 */

const LONG_PRESS_MS = 500;

/** How far a finger may travel before the press becomes a scroll. */
const MOVE_TOLERANCE_PX = 10;

export const useLongPress = (onLongPress, { ms = LONG_PRESS_MS } = {}) => {
  const timer = useRef(null);
  const origin = useRef(null);
  const fired = useRef(false);
  const callback = useRef(onLongPress);

  useEffect(() => {
    callback.current = onLongPress;
  }, [onLongPress]);

  const clear = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  useEffect(() => clear, [clear]);

  const onTouchStart = useCallback(
    (event) => {
      // Multi-touch is a pinch, not a press.
      if (event.touches?.length !== 1) return;

      const touch = event.touches[0];
      origin.current = { x: touch.clientX, y: touch.clientY };
      fired.current = false;
      clear();

      timer.current = setTimeout(() => {
        fired.current = true;
        callback.current({ x: touch.clientX, y: touch.clientY });
      }, ms);
    },
    [clear, ms]
  );

  const onTouchMove = useCallback(
    (event) => {
      if (!origin.current) return;
      const touch = event.touches?.[0];
      if (!touch) return;

      const travelled =
        Math.abs(touch.clientX - origin.current.x) > MOVE_TOLERANCE_PX ||
        Math.abs(touch.clientY - origin.current.y) > MOVE_TOLERANCE_PX;

      if (travelled) clear();
    },
    [clear]
  );

  const onTouchEnd = useCallback(() => {
    clear();
  }, [clear]);

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onTouchCancel: onTouchEnd,
    didLongPress: () => fired.current,
    resetLongPress: () => {
      fired.current = false;
    },
  };
};

export default useLongPress;