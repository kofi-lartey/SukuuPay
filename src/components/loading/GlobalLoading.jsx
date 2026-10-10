import React, { useEffect, useState } from 'react';
import LoadingScreen from './LoadingScreen';
import loadingController from './loadingController';

/**
 * The single loading overlay for the whole app.
 *
 * Rendered once, near the root, and driven by `loadingController` — the axios
 * interceptors, the router listener and any component that calls `show()` all
 * feed the same store, so exactly one overlay exists and it reflects every
 * in-flight request at once.
 *
 * Why the overlay outlives the controller's `visible` status
 * ----------------------------------------------------------
 * `LoadingScreen` owns a 600ms fade-out. Dropping it from the tree the moment
 * the controller went quiet would cut that fade off at its first frame — the
 * overlay would vanish rather than dissolve. So it stays mounted through the
 * `exiting` state and only unmounts when `LoadingScreen` reports the fade
 * finished, via `onComplete`.
 *
 * `exit` is latched locally rather than derived, because a controller state can
 * move from `exiting` back to `visible` (a new request arriving mid-fade) or on
 * to `idle` (the fade completed) — and in both cases the *currently mounted*
 * instance must keep finishing its exit, not snap open again. A new `show()`
 * instead mounts a fresh instance, keyed on the controller's `token`.
 */
function GlobalLoading() {
  // Seeded from the controller rather than from `false`, because the startup
  // loader is armed in `main.jsx` *before* the first `root.render`. Deriving
  // these lazily means the very first paint already includes the overlay;
  // starting from `false` would render one frame of the bare app behind a
  // loader that then pops in.
  const initialState = loadingController.getState();

  const [mounted, setMounted] = useState(initialState.status !== 'idle');
  const [exiting, setExiting] = useState(initialState.status === 'exiting');
  const [token, setToken] = useState(initialState.token);
  const [options, setOptions] = useState(initialState.options);

  useEffect(() => {
    const unsubscribe = loadingController.subscribe((next) => {
      setOptions(next.options);

      if (next.status === 'idle') return;

      setMounted(true);

      if (next.status === 'exiting') {
        setExiting(true);
        return;
      }

      // A request arriving while a previous one is fading: swap in a fresh
      // instance so it does not inherit a half-finished exit.
      setExiting(false);
      setToken(next.token);
    });
    return unsubscribe;
  }, []);

  if (!mounted) return null;

  return (
    <LoadingScreen
      key={token}
      variant={options.variant}
      logoSrc={options.logoSrc}
      logoAlt={options.logoAlt}
      size={options.size}
      backgroundColor={options.backgroundColor}
      exit={exiting}
      onComplete={() => {
        setMounted(false);
        setExiting(false);
      }}
    />
  );
}

export default React.memo(GlobalLoading);