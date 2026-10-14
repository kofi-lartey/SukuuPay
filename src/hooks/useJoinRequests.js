import { useCallback, useEffect, useMemo, useState } from 'react';
import { listJoinRequests, decideJoinRequest } from '../services/school';

/**
 * The approval queue: accounts that asked to join this school and are waiting
 * for a decision.
 *
 * Same contract as `useUsers` — a `reloadKey` invalidation handle, because two
 * surfaces mutate this list (an approval and a rejection) and neither should
 * own its own copy of "re-fetch the queue". Split into `pending` and `decided`
 * here rather than in the component, because that is the one distinction every
 * caller makes and both halves come off the same already-loaded page.
 *
 * The list is never filtered by request: the server returns only the caller's
 * own school, and only its requests. `GET /schools/join-requests` takes no
 * parameters for exactly that reason, so there is nothing here for a caller to
 * get wrong.
 */
export const useJoinRequests = (reloadKey = 0) => {
  const [state, setState] = useState({ rows: [], loading: true, error: null });

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: null }));

    listJoinRequests()
      .then((rows) => {
        if (!active) return;
        setState({ rows: Array.isArray(rows) ? rows : [], loading: false, error: null });
      })
      .catch((error) => {
        if (!active) return;
        setState({ rows: [], loading: false, error });
      });

    return () => {
      active = false;
    };
  }, [reloadKey]);

  const { pending, decided } = useMemo(
    () => ({
      // The server sorts newest first, which is the right order for a queue:
      // the person who has been waiting longest is at the bottom, and the admin
      // is most likely to be here because of the one that just arrived.
      pending: state.rows.filter((row) => row.status === 'pending'),
      decided: state.rows.filter((row) => row.status !== 'pending'),
    }),
    [state.rows]
  );

  return { ...state, pending, decided };
};

/**
 * The approve/reject actions.
 *
 * Returns `{ ok, error }` rather than throwing, for the same reason
 * `useUserActions` does: the caller has two different reactions to prepare and
 * collapsing them into one thrown error loses the distinction. A `409
 * ALREADY_DECIDED` in particular is not a failure of *this* admin's action —
 * somebody else got there first — so the caller is told which row to drop from
 * the queue instead of being shown a red banner.
 *
 * Each action carries its own busy key so two rows can never both be mid-decision
 * and so a double-clicked Approve is visibly ignored.
 */
export const useJoinRequestActions = ({ onDone } = {}) => {
  const [busyKey, setBusyKey] = useState(null);

  const run = useCallback(
    async (key, operation) => {
      setBusyKey(key);
      try {
        const request = await operation();
        onDone?.();
        return { ok: true, request };
      } catch (error) {
        return { ok: false, error };
      } finally {
        setBusyKey(null);
      }
    },
    [onDone]
  );

  const approve = useCallback(
    (requestId, note) => run(`approve:${requestId}`, () => decideJoinRequest(requestId, 'approved', note)),
    [run]
  );

  const reject = useCallback(
    (requestId, note) => run(`reject:${requestId}`, () => decideJoinRequest(requestId, 'rejected', note)),
    [run]
  );

  return {
    approve,
    reject,
    busyKey,
    /** True while the matching operation for `key` is in flight. */
    isBusy: (key) => busyKey === key,
  };
};
