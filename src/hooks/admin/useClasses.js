import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useToast } from '../useToast';
import { listClasses, getClassAssignments } from '../../services/admin/academic';

/**
 * The class roster for the academy console, with the URL as the source of truth
 * (the `q` search is deep-linkable, like `useStudents`). A class is a name —
 * the list endpoint returns `{ className, ...counts }[]`, and the class detail
 * is reached with its URL-encoded name as a param, matching the teacher portal.
 */
export const useClasses = (reloadKey = 0) => {
  const { error: toastError } = useToast();
  const [searchParams] = useSearchParams();

  const search = useMemo(() => searchParams.get('q') || '', [searchParams]);

  const [state, setState] = useState({ items: [], loading: true, error: null });

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: null }));

    listClasses({ search: search || undefined })
      .then((result) => {
        if (!active) return;
        const classes = Array.isArray(result?.classes) ? result.classes : [];
        setState({ items: classes, loading: false, error: null });
      })
      .catch((error) => {
        if (!active) return;
        toastError(error.message);
        setState({ items: [], loading: false, error });
      });

    return () => {
      active = false;
    };
  }, [search, reloadKey, toastError]);

  return { ...state, search };
};

/**
 * The class-detail data: its subject-teacher assignments and aggregates.
 * `className` is a URL segment (the React Router param), so it is already
 * decoded here; the service re-encodes it on the wire.
 */
export const useClassAssignments = (className, reloadKey = 0) => {
  const { error: toastError } = useToast();

  const [state, setState] = useState({
    className: className || null,
    assignments: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!className) {
      setState({ className: null, assignments: [], loading: false, error: null });
      return;
    }

    let active = true;
    setState((current) => ({
      ...current,
      className,
      loading: true,
      error: null,
    }));

    getClassAssignments(className)
      .then((result) => {
        if (!active) return;
        const assignments = Array.isArray(result?.assignments) ? result.assignments : [];
        setState({ className, assignments, loading: false, error: null });
      })
      .catch((error) => {
        if (!active) return;
        toastError(error.message);
        setState({ className, assignments: [], loading: false, error });
      });

    return () => {
      active = false;
    };
  }, [className, reloadKey, toastError]);

  const reload = useCallback(() => {
    // No-op body: the parent bumps `reloadKey` to invalidate, matching the
    // pattern in `useStudents` (where `reloadKey` is the invalidation handle).
  }, []);

  return { ...state, reload };
};

export default useClasses;
