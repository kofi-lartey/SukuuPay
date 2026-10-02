import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getAdminOverview,
  getAtRiskSchools,
  getTopSchools,
  getSystemHealth,
  listAllPayments,
} from '../services/admin';
import { listDisbursements } from '../services/finance';

/**
 * One independent request, with its own `data` / `loading` / `error`.
 *
 * The fetch function is held in a ref and deliberately **not** a dependency. Passing
 * an inline arrow from the caller — which is how every call site reads — would make
 * it a new function on every render, so listing it would re-run the effect on every
 * render and fetch in a loop. Only `deps` triggers a reload, which is the caller's
 * explicit statement of what the request depends on.
 *
 * `mounted` rather than a bare `active` flag is not a difference; the point is that
 * the response is discarded after unmount so a slow request cannot write into a
 * component that is gone. That is the failure this whole file is shaped around — a
 * request that lands after the user has moved on.
 */
const useRequest = (fetcher, deps = []) => {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: null }));

    fetcherRef
      .current()
      .then((data) => active && setState({ data, loading: false, error: null }))
      .catch((error) => active && setState({ data: null, loading: false, error }));

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
};

/**
 * The Overview's second data layer.
 *
 * Separate from `useAdminDashboard`, and not merged into it, for the same reason
 * that hook keeps its three requests apart: **a failure in one blanks only its own
 * card.** These five are a different kind of data from that hook's — a worklist, a
 * ranking, a health summary, a live feed and a payout queue — and none is a subtotal
 * of another. Merging them would mean a broken health probe blanking the school
 * count, which is exactly the coupling that once produced a school Overview showing
 * a school that did not exist.
 *
 * **Nothing here falls back to a zero.** An operator's numbers are worse when wrong
 * than when absent, so a failed card shows its error and the rest of the page is
 * unaffected.
 *
 * `pendingApprovals` fetches the `pending_approval` slice rather than paginating the
 * full disbursement list, because this is the only card here that drives a money
 * action and it has to show the *whole* queue. A payout queue showing 20 of 200
 * pending batches invites precisely the wrong confidence.
 *
 * `listDisbursements` is imported from `services/finance`, not `services/admin`.
 * That is the module that owns disbursements, and re-exporting it from the general
 * admin module to keep one import line would put a money call behind a file whose
 * subject is everything else.
 */
export const usePlatformOverview = () => {
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((value) => value + 1), []);

  const overview = useRequest(() => getAdminOverview(), [tick]);
  const atRisk = useRequest(() => getAtRiskSchools(), [tick]);
  const topSchools = useRequest(() => getTopSchools({ metric: 'revenue', limit: 5 }), [tick]);
  const health = useRequest(() => getSystemHealth(), [tick]);
  const pendingApprovals = useRequest(
    () => listDisbursements({ status: 'pending_approval', perPage: 50 }),
    [tick]
  );
  const recentPayments = useRequest(() => listAllPayments({ perPage: 8 }), [tick]);

  return useMemo(
    () => ({ overview, atRisk, topSchools, health, pendingApprovals, recentPayments, refresh }),
    [overview, atRisk, topSchools, health, pendingApprovals, recentPayments, refresh]
  );
};

export default usePlatformOverview;