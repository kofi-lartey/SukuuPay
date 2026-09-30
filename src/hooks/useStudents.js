import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { listStudents, getStudentStats } from '../services/students';

/**
 * The roster's list state, with the URL as the source of truth.
 *
 * Filters live in the query string rather than in component state because a
 * bursar needs to send a colleague a link: "JHS 2A, overdue, this term" has to
 * be a URL that reproduces the screen, and the back button has to walk the
 * filters. A `useState` filter set satisfies neither, and a `?q=` deep link from
 * the topbar search arrives here pre-filled for free.
 *
 * `setFilter` merges by default and replaces the page, because changing a filter
 * while on page 7 of the old result set lands you on an empty page — the classic
 * pagination bug.
 *
 * `reloadKey` is the invalidation handle: a caller bumps it after a mutation and
 * the list re-fetches without the caller having to reconstruct the filters. That
 * matters because three separate surfaces mutate the roster — the row actions,
 * the bulk bar and the profile drawer — and each would otherwise need its own
 * copy of "reload the roster".
 */
export const useStudents = (reloadKey = 0) => {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo(
    () => ({
      search: searchParams.get('q') || '',
      class: searchParams.get('class') || '',
      status: searchParams.get('status') || 'active',
      feeStatus: searchParams.get('feeStatus') || '',
      planStatus: searchParams.get('planStatus') || '',
      gender: searchParams.get('gender') || '',
      sortBy: searchParams.get('sortBy') || 'createdAt',
      sortOrder: searchParams.get('sortOrder') || 'desc',
      page: Number(searchParams.get('page')) || 1,
      perPage: Number(searchParams.get('perPage')) || 20,
    }),
    [searchParams]
  );

  const [state, setState] = useState({ rows: [], meta: null, loading: true, error: null });

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: null }));

    // Empty strings are dropped rather than sent: `?class=` would otherwise
    // reach the API as a filter for the empty class name.
    const params = Object.fromEntries(
      Object.entries(filters).filter(([, value]) => value !== '' && value !== null)
    );

    listStudents(params)
      .then((result) => {
        if (!active) return;
        // `offline` is surfaced as an error rather than an empty roster: the
        // service degrades to `[]` so the onboarding wizard is not blocked, but a
        // bursar looking at the roster must not read "0 students" when the
        // server was simply unreachable.
        if (result.offline) {
          setState({
            rows: [],
            meta: null,
            loading: false,
            error: Object.assign(
              new Error('Could not reach the server. Showing no students — this is a connection problem, not an empty roster.'),
              { offline: true }
            ),
          });
          return;
        }
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
        // Anything equal to the default is removed, so a shared link carries
        // only the choices that differ from the starting point.
        if (value === '' || value === null || value === undefined) next.delete(key);
        else next.set(key, String(value));
      });
      if (resetPage) next.delete('page');
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const clearFilters = useCallback(() => {
    // `q` is not cleared: it is how the topbar search arrived, and clearing the
    // class filter should not silently discard the name someone typed.
    const next = new URLSearchParams();
    if (filters.search) next.set('q', filters.search);
    setSearchParams(next, { replace: true });
  }, [filters.search, setSearchParams]);

  const hasFilters = Boolean(
    filters.class || filters.feeStatus || filters.planStatus || filters.gender || filters.status !== 'active'
  );

  return { ...state, filters, setFilter, clearFilters, hasFilters };
};

/**
 * The KPI band's aggregates.
 *
 * A separate request rather than something derived from `rows`, because the list
 * is paginated and capped at 100 rows: a bursar looking at page one of a
 * 1,000-student school would see the first twenty counted as the school. The
 * stats request also runs against the same filter, so the band and the table
 * below it always agree.
 */
export const useStudentStats = (filters) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const scope = useMemo(
    () => ({
      class: filters.class || undefined,
      status: filters.status || undefined,
    }),
    [filters.class, filters.status]
  );

  useEffect(() => {
    let active = true;
    setLoading(true);

    getStudentStats(scope)
      .then((result) => {
        if (active) {
          setStats(result);
          setLoading(false);
        }
      })
      .catch(() => {
        // The band is context, not the page. A failure here leaves the roster
        // usable, so it is swallowed rather than surfaced as a page error.
        if (active) {
          setStats(null);
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [scope]);

  return { stats, loading };
};

/**
 * Row selection across pages.
 *
 * Two modes, and the difference matters: selecting the visible page sends ids,
 * while selecting everything matching the filter sends the filter. A school with
 * 1,000 students cannot send 1,000 ids, so "select all" cannot mean "all of
 * them" — and a user who believes it archived 1,000 people when they archived
 * 20 is a support ticket and a restore.
 *
 * `allMatching` is tracked explicitly rather than inferred, so the action bar can
 * say which of the two is about to happen.
 */
export const useRosterSelection = (rows, filters) => {
  const [selected, setSelected] = useState(() => new Set());
  const [allMatching, setAllMatching] = useState(false);

  // Selection is scoped to a query. Changing the filter with rows selected would
  // otherwise archive students the user cannot see.
  useEffect(() => {
    setSelected(new Set());
    setAllMatching(false);
  }, [filters.search, filters.class, filters.status, filters.feeStatus, filters.planStatus, filters.gender]);

  const visibleIds = useMemo(() => rows.map((row) => String(row._id || row.id)), [rows]);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));

  const toggleRow = (id) =>
    setSelected((current) => {
      const next = new Set(current);
      const key = String(id);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const toggleAllVisible = () =>
    setSelected((current) => {
      const next = new Set(current);
      if (allVisibleSelected) visibleIds.forEach((id) => next.delete(id));
      else visibleIds.forEach((id) => next.add(id));
      return next;
    });

  const selectAllMatching = () => {
    setAllMatching(true);
    setSelected(new Set());
  };

  const clear = () => {
    setSelected(new Set());
    setAllMatching(false);
  };

  /**
   * What a bulk action will target.
   *
   * `ids` when the selection is on-screen rows; `filter` when the whole filtered
   * set is selected. Exactly one is ever present — the server rejects both.
   */
  const target = useMemo(() => {
    if (allMatching) return { filter: { ...filters, ids: undefined } };
    return { ids: [...selected] };
  }, [allMatching, selected, filters]);

  return {
    selected,
    selectedCount: allMatching ? null : selected.size,
    allMatching,
    allVisibleSelected,
    hasSelection: allMatching || selected.size > 0,
    toggleRow,
    toggleAllVisible,
    selectAllMatching,
    clear,
    target,
  };
};
