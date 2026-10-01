import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { listPayments, getPaymentSummary } from '../services/payments';

/**
 * The Payments module's list state, with the URL as the source of truth.
 *
 * Same reasoning as `useStudents`, and for the same reason: a bursar answering
 * "did this parent actually pay?" needs to send a colleague a link — "Term 1,
 * MTN, JHS 2A, completed" has to be a URL that reproduces the screen, and the
 * back button has to walk the filters. A `useState` filter set satisfies
 * neither, and the topbar's `?q=` search arrives here pre-filled for free.
 *
 * `setFilter` merges by default and resets the page, because changing a filter
 * while on page 7 of the old result set lands you on an empty page.
 *
 * `reloadKey` is the invalidation handle: a caller bumps it after a mutation and
 * both the list and the summary re-fetch, without the caller reconstructing the
 * filters. That matters because three surfaces mutate payments — the manual
 * payment dialog, the refund dialog and the row actions — and each would
 * otherwise keep its own copy of "reload the payments".
 */

/** Defaults live here, not in the call sites, so one place defines "no filter". */
const DEFAULTS = {
  search: '',
  class: '',
  status: 'all',
  paymentMethod: '',
  network: '',
  provider: '',
  startDate: '',
  endDate: '',
  sortBy: 'createdAt',
  sortOrder: 'desc',
  page: 1,
  perPage: 20,
};

export const usePayments = (reloadKey = 0) => {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo(
    () => ({
      search: searchParams.get('q') || DEFAULTS.search,
      class: searchParams.get('class') || DEFAULTS.class,
      status: searchParams.get('status') || DEFAULTS.status,
      paymentMethod: searchParams.get('paymentMethod') || DEFAULTS.paymentMethod,
      network: searchParams.get('network') || DEFAULTS.network,
      provider: searchParams.get('provider') || DEFAULTS.provider,
      startDate: searchParams.get('startDate') || DEFAULTS.startDate,
      endDate: searchParams.get('endDate') || DEFAULTS.endDate,
      sortBy: searchParams.get('sortBy') || DEFAULTS.sortBy,
      sortOrder: searchParams.get('sortOrder') || DEFAULTS.sortOrder,
      page: Number(searchParams.get('page')) || DEFAULTS.page,
      perPage: Number(searchParams.get('perPage')) || DEFAULTS.perPage,
    }),
    [searchParams]
  );

  const [state, setState] = useState({ rows: [], meta: null, loading: true, error: null });

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: null }));

    // Empty strings are dropped rather than sent: `?class=` would otherwise reach
    // the API as a filter for the empty class name. `perPage` is renamed to
    // `limit` because that is the parameter `paymentsQuerySchema` validates.
    const params = Object.fromEntries(
      Object.entries(filters).filter(([, value]) => value !== '' && value !== null)
    );
    params.limit = params.perPage;
    delete params.perPage;

    listPayments(params)
      .then((result) => {
        if (!active) return;
        setState({ rows: result.rows, meta: result.meta, loading: false, error: null });
      })
      .catch((error) => {
        if (!active) return;
        setState({ rows: [], meta: null, loading: false, error });
      });

    return () => {
      active = false;
    };
  }, [filters, reloadKey]);

  const setFilter = useCallback(
    (patch, { resetPage = true } = {}) => {
      const next = new URLSearchParams(searchParams);
      Object.entries(patch).forEach(([key, value]) => {
        // Anything equal to the default is removed, so a shared link carries only
        // the choices that differ from the starting point.
        if (value === '' || value === null || value === undefined || value === DEFAULTS[key]) {
          next.delete(key);
        } else {
          next.set(key, String(value));
        }
      });
      if (resetPage) next.delete('page');
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const clearFilters = useCallback(() => {
    // `q` survives, exactly as in the roster: it is how the topbar search
    // arrived, and clearing the channel filter should not silently discard the
    // reference someone typed.
    const next = new URLSearchParams();
    if (filters.search) next.set('q', filters.search);
    setSearchParams(next, { replace: true });
  }, [filters.search, setSearchParams]);

  const hasFilters = Boolean(
    filters.class ||
      filters.status !== DEFAULTS.status ||
      filters.paymentMethod ||
      filters.network ||
      filters.provider ||
      filters.startDate ||
      filters.endDate
  );

  return { ...state, filters, setFilter, clearFilters, hasFilters };
};

/**
 * The scope the KPI band aggregates over.
 *
 * **The band takes the scope, not the rows.** `status` and `search` are dropped
 * deliberately: "Total inflow this term" that changed every time someone typed a
 * transaction reference into the search box would be a figure no one could
 * quote. Date range, class, channel and method narrow it, because those answer
 * "whose money is this?".
 *
 * This mirrors `useStudentStats`, which likewise passes `class` and `status`
 * rather than the whole filter set.
 */
const scopeOf = (filters) => ({
  startDate: filters.startDate || undefined,
  endDate: filters.endDate || undefined,
  class: filters.class || undefined,
  network: filters.network || undefined,
  paymentMethod: filters.paymentMethod || undefined,
});

/**
 * The KPI band's aggregates.
 *
 * A failure here is swallowed rather than surfaced as a page error. The band is
 * context around the table, not the table: if the summary is unavailable the
 * transactions below it are still the thing a bursar came for, and replacing the
 * whole module with an error because four tiles could not load is the wrong
 * trade. The tiles then render their own "unavailable" state — which is why the
 * error is returned rather than discarded: it is the band's own state to render,
 * and the caller must pass *this* error and not the list's, or a table-only
 * failure would blank four figures that loaded fine.
 */
export const usePaymentSummary = (filters) => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const scope = useMemo(() => scopeOf(filters), [filters]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    getPaymentSummary(scope)
      .then((result) => {
        if (active) {
          setSummary(result);
          setLoading(false);
        }
      })
      .catch((apiError) => {
        if (active) {
          setSummary(null);
          setError(apiError);
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [scope]);

  return { summary, loading, error };
};

export { DEFAULTS as PAYMENT_FILTER_DEFAULTS };
