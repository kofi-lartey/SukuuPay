import { useEffect, useState, useRef } from 'react';

/**
 * Global loading controller.
 *
 * A framework-free singleton store that lets non-React code — the axios
 * interceptors in `services/api.js`, the router listener in `App.jsx`, any
 * service that has no component of its own — drive the one loading overlay the
 * app renders.
 *
 * The three problems it exists to solve:
 *
 *  **1. Fast requests must not flash the loader.** A 60ms fetch followed by a
 *  600ms fade reads as a stutter, not as a system loading. `show()` therefore
 *  arms a `delay` timer and only publishes once it fires; if `hide()` arrives
 *  first, the timer is disarmed and nothing was ever shown.
 *
 *  **2. Concurrent requests must not hide it early.** Ten parallel requests on
 *  a dashboard page each call `show()` and each call `hide()`; the tenth `hide`
 *  would otherwise dismiss the loader while requests 3–9 are still in flight.
 *  The in-flight counter is what makes the aggregate behaviour correct.
 *
 *  **3. A very short load must not flicker.** Once the loader is visible it
 *  stays for at least `minDuration`, so a 120ms request that still crossed the
 *  `delay` threshold produces a settled animation rather than a blink.
 */

const DEFAULT_OPTIONS = {
  variant: 'pulse',
  delay: 250,
  minDuration: 600,
  logoSrc: '/sukuupay-logo.png',
  logoAlt: 'SukuuPay',
  size: 120,
  backgroundColor: 'var(--loading-bg, #ffffff)',
};

const listeners = new Set();
let state = {
  active: false,
  finishing: false,
  options: { ...DEFAULT_OPTIONS },
  source: null,
};

let inFlight = 0;
let delayTimer = null;
let minDurationTimer = null;
let shownAt = 0;

const publish = () => {
  for (const listener of listeners) listener(state);
};

const clearTimers = () => {
  if (delayTimer) {
    clearTimeout(delayTimer);
    delayTimer = null;
  }
  if (minDurationTimer) {
    clearTimeout(minDurationTimer);
    minDurationTimer = null;
  }
};

const showNow = () => {
  if (state.active) return;
  shownAt = Date.now();
  state = { ...state, active: true, finishing: false };
  publish();
};

const hideNow = () => {
  if (!state.active) return;
  state = { ...state, active: true, finishing: true };
  publish();

  const elapsed = Date.now() - shownAt;
  const remaining = Math.max(0, state.options.minDuration - elapsed);
  minDurationTimer = setTimeout(() => {
    state = { ...state, active: false, finishing: false, source: null };
    inFlight = 0;
    publish();
  }, remaining);
};

export const loadingController = {
  /**
   * Subscribe to state changes. Returns an unsubscribe function.
   * Used by `GlobalLoading.jsx`; App code should use the hook instead.
   */
  subscribe(listener) {
    listeners.add(listener);
    listener(state);
    return () => listeners.delete(listener);
  },

  getState() {
    return state;
  },

  /**
   * Override the shared defaults (variant, delay, minDuration, branding).
   * Applies to every future `show()` that does not override them itself.
   */
  configure(options = {}) {
    state = { ...state, options: { ...state.options, ...options } };
    publish();
    return this;
  },

  /**
   * Request that the loader be shown.
   *
   * `options` may override variant/delay/minDuration for this call only, and
   * may set `immediate: true` to skip the delay — for a route change, where the
   * click already told the user something is happening, or a file upload where
   * the wait is known to be long.
   */
  show(options = {}) {
    const merged = { ...state.options, ...options };
    state = { ...state, options: merged };
    inFlight += 1;

    if (options.source) state = { ...state, source: options.source };

    if (state.active || delayTimer) return this;

    if (merged.immediate) {
      showNow();
    } else {
      delayTimer = setTimeout(() => {
        delayTimer = null;
        showNow();
      }, merged.delay);
    }
    return this;
  },

  /**
   * Release one request from the loader. The loader only dismisses when every
   * request that asked for it has released, or when `force` is passed.
   */
  hide(force = false) {
    inFlight = force ? 0 : Math.max(0, inFlight - 1);
    if (inFlight > 0) return this;

    if (delayTimer) {
      // Released before the delay elapsed: the request was fast enough that
      // nothing was ever shown, so simply disarm and keep the count consistent.
      clearTimeout(delayTimer);
      delayTimer = null;
      return this;
    }

    if (state.active) hideNow();
    return this;
  },

  /** Dismiss immediately with no fade and no minimum duration. */
  reset() {
    clearTimers();
    inFlight = 0;
    state = { ...state, active: false, finishing: false, source: null };
    publish();
    return this;
  },
};

/**
 * React binding for `loadingController`.
 *
 * Returns the live state, so a component can render its own indicator if it
 * wants one, plus `show`/`hide` that go through the same counter as the axios
 * interceptors — so a component showing the loader while a page fetch is
 * running does not dismiss the loader out from under the fetch.
 */
export function useLoadingController() {
  const [snapshot, setSnapshot] = useState(state);

  useEffect(() => {
    const unsubscribe = loadingController.subscribe(setSnapshot);
    return unsubscribe;
  }, []);

  return {
    active: snapshot.active,
    finishing: snapshot.finishing,
    options: snapshot.options,
    show: loadingController.show.bind(loadingController),
    hide: loadingController.hide.bind(loadingController),
    reset: loadingController.reset.bind(loadingController),
    configure: loadingController.configure.bind(loadingController),
  };
}

/**
 * Convenience wrapper for an async handler: shows the loader before the call,
 * releases it after, and skips the delay for navigations that read as instant.
 */
export function withLoading(fn, options = {}) {
  return async (...args) => {
    loadingController.show(options);
    try {
      return await fn(...args);
    } finally {
      loadingController.hide();
    }
  };
}

export default loadingController;