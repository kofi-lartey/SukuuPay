import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchPortalView, verifyPayment } from '../services/parentPay';

/**
 * The pay link's read model, and the polling that watches a payment land.
 *
 * ## Why this is a hook and not a `useEffect` in each page
 *
 * Four parent screens read the same student, and a parent moves between them — the
 * landing page, the plan request, the history, the support form. If each fetched
 * itself, walking from one to another would re-read the student on every tap, which
 * on the 3G connection this is built for means a visible blank frame between every
 * screen. So the read model is fetched once per token and shared through React
 * context by `ParentLayout`, and this hook is the piece that owns it.
 *
 * ## The cache is in memory, on purpose
 *
 * Not `localStorage`, not `sessionStorage`. The prompt forbids both and the reason
 * is the product, not the rule: a pay link is routinely opened on a shared family
 * handset, and a token persisted in storage outlives the session that read it. A
 * second person picking up the phone would land on the first person's child's fees
 * with no indication anything had changed. An in-memory cache dies with the tab,
 * which is exactly the lifetime we want.
 *
 * ## Refetching after a payment
 *
 * `refresh()` is explicit rather than automatic. The balance on screen is the number
 * a parent is about to act on, so silently replacing it while they are mid-form
 * would be worse than showing a value that is one payment out of date — and the
 * caller knows precisely when a payment settled, which a background poller does not.
 */

/** One read model per token, for the lifetime of the tab. */
const cache = new Map();

const readCache = (token) => cache.get(token) || null;

const writeCache = (token, value) => {
  cache.set(token, value);
  return value;
};

/** Drops a token's entry. Used when a payment settles and the figures change. */
export const invalidatePayToken = (token) => {
  cache.delete(token);
};

/**
 * Watches a payment until it settles.
 *
 * The parent is standing on a modal that has already told them a prompt was sent.
 * They cannot be left to guess, and they cannot be left to stare at a spinner
 * forever either — so there are three exits, and all three have to be deliberate:
 *
 *   - **Settled** (`success` / `failed`) → stops, calls `onSettled`.
 *   - **Timeout** → stops, calls `onTimeout`. Sixty seconds is not arbitrary: it is
 *     the parent's attention span for standing still on a phone, and it is also
 *     roughly how long a network round trip on a bad 3G connection can take. Past
 *     it, the honest message is "this is taking a while, check your phone" — the
 *     prompt may well have arrived and been missed, and a parent who is told to
 *     wait indefinitely will assume the app is broken.
 *   - **Unmount / token change** → stops. No `setState` on an unmounted component.
 *
 * The interval is the server's `retryAfter`, not a local constant, because the
 * verify endpoint is rate limited per token and a client polling harder than it was
 * told earns the 429 — which would surface on the one screen where the parent is
 * watching money leave their account.
 *
 * @param {object} options
 * @param {string} options.token
 * @param {string|null} options.reference the payment being watched, or null to idle
 * @param {(state: object) => void} options.onState called on every status change
 * @param {(state: object) => void} [options.onSettled]
 * @param {(state: object) => void} [options.onTimeout]
 * @param {number} [options.timeoutMs]
 */
export const usePaymentPoller = ({
  token,
  reference,
  onState,
  onSettled,
  onTimeout,
  timeoutMs = 60000,
}) => {
  const timer = useRef(null);
  const deadline = useRef(null);
  const stopped = useRef(false);

  // Held in refs so a caller passing an inline arrow does not tear the poller down
  // and restart it on every parent render — which would reset the timeout to
  // sixty seconds on each tick and make it unable to ever fire.
  const handlers = useRef({ onState, onSettled, onTimeout });
  handlers.current = { onState, onSettled, onTimeout };

  const stop = useCallback(() => {
    stopped.current = true;
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  useEffect(() => {
    if (!token || !reference) return undefined;

    stopped.current = false;
    deadline.current = Date.now() + timeoutMs;

    // Indexed by name, because the caller passes a string. The obvious-looking
    // `handlers.current.handlerName(state)` reads as a call and silently does
    // nothing — `handlerName` is `'onSettled'`, not a function — and the symptom is
    // the worst one available on this screen: a parent who approved their MoMo
    // prompt watches a spinner forever because the payment settled and nothing
    // told the modal about it.
    const finish = (state, handlerName) => {
      if (stopped.current) return;
      stop();
      handlers.current[handlerName]?.(state);
    };

    const tick = async () => {
      if (stopped.current) return;

      if (Date.now() >= deadline.current) {
        finish({ status: 'timeout', reference }, 'onTimeout');
        return;
      }

      let state;
      try {
        state = await verifyPayment(token, reference);
      } catch (error) {
        // A failed poll is not a failed payment. The webhook may have been
        // delivered and this is only the read path failing — on a 3G connection a
        // dropped request mid-poll is routine, not exceptional. The parent is told
        // to keep waiting and the next tick tries again; only the timeout or a real
        // terminal status ends the wait.
        handlers.current.onState?.({
          status: 'pending',
          reference,
          transientError: error?.message || null,
        });

        if (!stopped.current) timer.current = setTimeout(tick, 3000);
        return;
      }

      handlers.current.onState?.(state);

      if (state?.status === 'success' || state?.status === 'failed') {
        finish(state, 'onSettled');
        return;
      }

      const wait = Number(state?.retryAfter) > 0 ? Number(state.retryAfter) * 1000 : 3000;
      timer.current = setTimeout(tick, wait);
    };

    timer.current = setTimeout(tick, 0);

    return stop;
    // `reference` is the identity of the payment being watched; restarting for any
    // other change would abandon a live poll mid-approval.
  }, [token, reference, timeoutMs, stop]);

  /**
 * Stops the poll.
 *
 * **`stop` is returned on its own, not wrapped in an object.** `{ stop }` is a new
 * object on every render, so a caller writing
 * `useEffect(() => () => poller.stop(), [poller])` tears the poller down on every
 * single render — including the one caused by its own first state update — and the
 * parent is left watching a spinner that has already been cancelled. `stop` is a
 * `useCallback` with `[]` and so is referentially stable, which makes it safe to
 * list in a dependency array.
 */
return stop;
};

/**
 * Fetches — and shares — the pay link's read model.
 *
 * Mounted once by `ParentLayout`; every parent page reads it through
 * `usePayTokenContext` rather than each calling this, which is what makes moving
 * between pages instant instead of a fetch per tap.
 *
 * @param {string} token
 */
export const usePayToken = (token) => {
  const cached = readCache(token);

  const [view, setView] = useState(cached?.data || null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(!cached);

  const load = useCallback(
    async ({ force = false } = {}) => {
      if (!token) {
        setError({ message: 'This payment link is invalid.', code: 'PAY_LINK_INVALID' });
        setLoading(false);
        return null;
      }

      // A cached read model is shown immediately and only refetched when asked, or
      // when there is nothing to show. `loading` therefore stays false for a cache
      // hit, so the page does not flash a skeleton over data it already has.
      if (!force && readCache(token)) {
        setLoading(false);
        return readCache(token).data;
      }

      setLoading(true);
      try {
        const data = await fetchPortalView(token);
        writeCache(token, { data, at: Date.now() });
        setView(data);
        setError(null);
        return data;
      } catch (caught) {
        setError({
          message: caught?.message || 'We could not load this payment page.',
          code: caught?.code,
          status: caught?.status,
        });
        return null;
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Re-reads after something changed the figures — a settled payment, above all.
   *
   * The stale cache entry is dropped *before* the request rather than after, so two
   * screens mounting during the round trip cannot both read the old balance and
   * paint it.
   */
  const refresh = useCallback(async () => {
    invalidatePayToken(token);
    return load({ force: true });
  }, [token, load]);

  return { view, error, loading, refresh, reload: load };
};

/** The live browser/online flag, so the portal can say so rather than just hanging. */
export const useOnlineStatus = () => {
  const [online, setOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine !== false
  );

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return online;
};

export default usePayToken;