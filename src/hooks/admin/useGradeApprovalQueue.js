import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useToast } from '../useToast';
import { getGradeApprovalQueue } from '../../services/admin/academic';
import { normalizeGradeQueue } from '../../utils/academicSummary';

/**
 * The grade approval queue, scoped by term/year via the URL — the same
 * "deep-linkable scope" rule as `useStudents`. Returns the raw `queue` array
 * (each entry is one teacher's submitted block for a class+subject, with
 * `submittedAt`, `entryCount` and the teacher's display name) plus a flat
 * `items` view for a table, and a `reload` invalidation handle the approve and
 * reject actions bump.
 */
export const useGradeApprovalQueue = (reloadKey = 0) => {
  const { error: toastError } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo(
    () => ({
      term: searchParams.get('term') || undefined,
      academicYear: searchParams.get('year') || undefined,
    }),
    [searchParams]
  );

  const [state, setState] = useState({ items: [], loading: true, error: null });

  const load = useCallback(() => {
    setState((current) => ({ ...current, loading: true, error: null }));
    return getGradeApprovalQueue(filters)
      .then((result) => {
        const queue = normalizeGradeQueue(result);
        setState({ items: queue, loading: false, error: null });
      })
      .catch((error) => {
        toastError(error.message);
        setState({ items: [], loading: false, error });
      });
  }, [filters, toastError]);

  useEffect(() => {
    let active = true;
    const promise = load();
    return () => {
      active = false;
      // Swallow a late settle once the hook has unmounted so a rejected promise
      // after unmount does not surface a toast against a removed screen.
      promise.catch(() => {});
    };
  }, [load, reloadKey]);

  const setFilter = useCallback(
    (patch, { replace = true } = {}) => {
      const next = new URLSearchParams(searchParams);
      Object.entries(patch).forEach(([key, value]) => {
        const k = key === 'academicYear' ? 'year' : key;
        if (value === '' || value === null || value === undefined) next.delete(k);
        else next.set(k, String(value));
      });
      if (!('term' in patch) && !('academicYear' in patch)) return;
      setSearchParams(next, { replace });
    },
    [searchParams, setSearchParams]
  );

  return { ...state, filters, setFilter, reload: load, refetch: load };
};

export default useGradeApprovalQueue;
