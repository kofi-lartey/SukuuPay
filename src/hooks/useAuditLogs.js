import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { listAuditLogs, exportAuditLogsCsv, auditCategoryOf } from '../services/auditLog';

/**
 * Drops filters the user has not set.
 *
 * `filters` holds `''` for every untouched control, because that is what an
 * uncontrolled `<select>` and a `<input type="date">` both report. Sending those
 * on is how `GET /audit-logs/:id?userId=&action=&from=` happens — six blank
 * values on the very first request, before anyone has touched a filter.
 *
 * The server now tolerates them, but a blank parameter is not a filter and should
 * not travel as one. `page` and `perPage` are always real values and pass through.
 * Same treatment as `useStudents`, for the same reason.
 */
const onlySet = (params) =>
  Object.fromEntries(Object.entries(params).filter(([, value]) => value !== '' && value != null));

/**
 * The audit trail's list state, with the URL as the source of truth.
 *
 * Same contract as `useStudents` and `useUsers`, and for the same reason: an
 * auditor's first question is specific — "who changed this student's record
 * last Tuesday" — and that has to be a link they can paste into a report. The
 * filters live in the query string, so it is.
 *
 * `setFilter` replaces the page by default, because narrowing a filter while on
 * page 9 of the old result set lands you on an empty page.
 */
export const useAuditLogs = ({ schoolId, reloadKey = 0 } = {}) => {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo(
    () => ({
      userId: searchParams.get('userId') || '',
      action: searchParams.get('action') || '',
      entity: searchParams.get('entity') || '',
      entityId: searchParams.get('entityId') || '',
      from: searchParams.get('from') || '',
      to: searchParams.get('to') || '',
      page: Number(searchParams.get('page')) || 1,
      perPage: 50,
    }),
    [searchParams]
  );

  const [state, setState] = useState({ entries: [], meta: null, loading: true, error: null });

  useEffect(() => {
    // No school, no request. `schoolId` comes from the signed-in user's own
    // record and is absent for a self-provisioned admin whose school has not
    // finished provisioning; firing anyway would spend a 403 to learn nothing.
    if (!schoolId) {
      setState({ entries: [], meta: null, loading: false, error: null });
      return undefined;
    }

    let active = true;
    setState((current) => ({ ...current, loading: true, error: null }));

    listAuditLogs({ schoolId, ...onlySet(filters) })
      .then((result) => {
        if (!active) return;
        setState({ entries: result.entries, meta: result.meta, loading: false, error: null });
      })
      .catch((error) => {
        if (!active) return;
        setState({ entries: [], meta: null, loading: false, error });
      });

    return () => {
      active = false;
    };
  }, [schoolId, filters, reloadKey]);

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
    setSearchParams(new URLSearchParams(), { replace: true });
  }, [setSearchParams]);

  const hasFilters = Boolean(
    filters.userId || filters.action || filters.entity || filters.entityId || filters.from || filters.to
  );

  return { ...state, filters, setFilter, clearFilters, hasFilters };
};

/**
 * The KPI strip's figures, counted from the loaded page.
 *
 * An honest limitation worth stating rather than hiding: these count the current
 * page, not the whole log. `meta.total` is the true unfiltered size of the
 * school's log and is the only number here that is not page-scoped.
 *
 * The alternative — four more aggregate endpoints — would be the right answer on
 * a 1,000-student school's log. It is not the right answer here yet, because
 * until the log has a category endpoint these tiles would be the *only* place
 * the page reports a total, and a screen whose headline figure silently means
 * "of the fifty most recent" is worse than one that says which fifty.
 */
export const useAuditStats = (entries, meta) =>
  useMemo(() => {
    const counts = { finance: 0, messaging: 0, academic: 0, security: 0 };
    entries.forEach((entry) => {
      // Derived from the action, not read off the row. There is no `category`
      // field on an audit log — the server sends `action` and nothing else to
      // classify by — so reading `entry.category` here counted every entry under
      // `counts[undefined]` and left all four lanes reading zero.
      const category = auditCategoryOf(entry.action);
      if (category) counts[category] += 1;
    });
    return {
      totalOnRecord: meta?.total ?? 0,
      onThisPage: entries.length,
      byCategory: counts,
    };
  }, [entries, meta]);

/**
 * The export, with the on-screen filters applied.
 *
 * `page` is dropped on purpose. The server exports every matching row and has
 * never paginated an export; passing the page number would suggest the file is
 * one page of a longer log, which is precisely the misreading that makes an
 * export useless in an audit.
 */
export const useAuditExport = ({ schoolId, filters }) => {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);

  const runExport = useCallback(async () => {
    if (!schoolId || exporting) return null;
    setExporting(true);
    setError(null);
    try {
      const { page, perPage, ...rest } = filters;
      return await exportAuditLogsCsv({ schoolId, ...onlySet(rest) });
    } catch (exportError) {
      setError(exportError);
      return null;
    } finally {
      setExporting(false);
    }
  }, [schoolId, exporting, filters]);

  return { runExport, exporting, error };
};