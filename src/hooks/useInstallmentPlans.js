import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getSchoolCompliance } from '../services/paymentPlans';
import { useAuth } from '../context/AuthContext';

/**
 * The Installment Compliance dashboard's state.
 *
 * Filters live in the URL. That is not a preference — the dashboard is the screen
 * a bursar forwards to a head teacher, and "the JHS 2A list, overdue only" is a
 * claim someone else needs to be able to open and verify. Same reasoning as every
 * other filtered module in this app.
 *
 * The class list and the term list are *not* filtered here. They are school
 * configuration, and they arrive with the school rather than with the compliance
 * response, so the filter bar is handed them as props by the page. Re-fetching
 * them per filter change would be a second request that cannot change the answer.
 */
export const useInstallmentPlans = (reloadKey = 0) => {
  const { user } = useAuth();
  const schoolId = user?.schoolId || null;
  const [searchParams, setSearchParams] = useSearchParams();

  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // The caller's `reloadKey` plus a local bump, so a page that cancels a plan can
  // force a refetch without owning the key.
  const [bump, setBump] = useState(0);
  const fetchKey = reloadKey + bump;

  // ── Filters, read from the URL ──
  const filters = useMemo(
    () => ({
      status: searchParams.get('status') || 'all',
      class: searchParams.get('class') || '',
      term: searchParams.get('term') || '',
      search: searchParams.get('q') || '',
      page: Number(searchParams.get('page')) || 1,
      perPage: Number(searchParams.get('perPage')) || 20,
      sortBy: searchParams.get('sortBy') || 'endDate',
      sortOrder: searchParams.get('sortOrder') || 'asc',
    }),
    [searchParams]
  );

  const hasFilters =
    filters.status !== 'all' || Boolean(filters.class) || Boolean(filters.term) || Boolean(filters.search);

  /**
   * Patches the query string.
   *
   * `resetPage` defaults to true because every filter change invalidates the
   * current page number: staying on page 7 of a 30-page list and then narrowing to
   * 3 pages shows an empty table, which reads as "no plans match" rather than
   * "page 7 is past the end".
   */
  const setFilter = useCallback(
    (patch, { resetPage = true } = {}) => {
      const next = new URLSearchParams(searchParams);
      Object.entries(patch).forEach(([key, value]) => {
        if (value === '' || value === null || value === undefined) next.delete(key);
        else next.set(key, String(value));
      });
      if (resetPage) next.delete('page');
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const clearFilters = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    ['status', 'class', 'term', 'q', 'page'].forEach((key) => next.delete(key));
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  // ── The fetch ──
  useEffect(() => {
    if (!schoolId) {
      setLoading(false);
      return undefined;
    }

    let active = true;
    setLoading(true);

    // Empty strings are dropped rather than sent: `?class=` would otherwise
    // reach the server as a filter that matches nothing, which is the opposite of
    // what an empty dropdown means.
    const params = {
      status: filters.status,
      page: filters.page,
      perPage: filters.perPage,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
    };
    if (filters.class) params.class = filters.class;
    if (filters.term) params.term = filters.term;
    if (filters.search) params.search = filters.search;

    getSchoolCompliance(schoolId, params)
      .then((result) => {
        if (!active) return;
        setSummary(result.summary);
        setRows(result.plans);
        setMeta(result.meta);
        setError(null);
      })
      .catch((err) => {
        if (!active) return;
        setSummary(null);
        setRows([]);
        setMeta(null);
        setError(err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [schoolId, filters, fetchKey]);

  return {
    schoolId,
    rows,
    summary,
    meta,
    loading,
    error,
    filters,
    hasFilters,
    setFilter,
    clearFilters,
    /**
     * Re-reads the compliance data.
     *
     * Used after anything that changes a plan's state — a tranche marked paid, a
     * plan cancelled. The reason it forces a refetch rather than patching a row
     * locally: the *summary* also moves, and the summary is the part a bursar
     * trusts. A locally-adjusted row count next to a server-owned compliance rate
     * is how a dashboard ends up showing 79% over a list that says 84%.
     */
    reload: useCallback(() => setBump((key) => key + 1), []),
  };
};

export default useInstallmentPlans;
