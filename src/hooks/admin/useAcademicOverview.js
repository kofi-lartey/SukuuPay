import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useToast } from '../useToast';
import { getAcademicOverview } from '../../services/admin/academic';
import { academicSummary } from '../../utils/academicSummary';
import { ACADEMIC_TERMS } from '../../utils/constants';

/**
 * School-wide academic posture, scoped by the URL.
 *
 * `term` and `academicYear` live in the query string (not component state) so a
 * headmaster can hand a colleague a link — `/dashboard/academics?term=Term 2` —
 * and the back button walks the scope. The shape follows `useStudents`: a URL
 * filter source of truth, a `reloadKey` invalidation handle, and the server's
 * envelope unwrapped to `data?.data` (see `services/api.js`).
 *
 * The raw payload is kept, but a derived `summary` is returned too: the overview
 * page renders counts that the server does not send (a single pending-approvals
 * total across statuses, a publish-ready count), and those must be computed once
 * and tested in isolation — so the pure normalizer lives in
 * `utils/academicSummary.js` and this hook just consumes it.
 */
export const useAcademicOverview = (reloadKey = 0) => {
  const { error: toastError } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const scope = useMemo(
    () => ({
      term: searchParams.get('term') || null,
      academicYear: searchParams.get('year') || null,
    }),
    [searchParams]
  );

  const [state, setState] = useState({ data: null, loading: true, error: null });

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: null }));

    getAcademicOverview(scope)
      .then((data) => {
        if (!active) return;
        setState({ data, loading: false, error: null });
      })
      .catch((error) => {
        if (!active) return;
        toastError(error.message);
        setState({ data: null, loading: false, error });
      });

    return () => {
      active = false;
    };
  }, [scope, reloadKey, toastError]);

  const setScope = useCallback(
    (patch, { replace = true } = {}) => {
      const next = new URLSearchParams(searchParams);
      Object.entries(patch).forEach(([key, value]) => {
        const k = key === 'academicYear' ? 'year' : key;
        if (value === '' || value === null || value === undefined) next.delete(k);
        else next.set(k, String(value));
      });
      setSearchParams(next, { replace });
    },
    [searchParams, setSearchParams]
  );

  const summary = useMemo(() => academicSummary(state.data), [state.data]);

  return {
    ...state,
    summary,
    scope,
    term: scope.term,
    academicYear: scope.academicYear,
    setScope,
    terms: ACADEMIC_TERMS,
  };
};

export default useAcademicOverview;
