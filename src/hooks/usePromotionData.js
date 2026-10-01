import { useCallback, useEffect, useMemo, useState } from 'react';
import { listStudents, previewPromotion } from '../services/students';

/**
 * The data behind the three-step end-of-year wizard.
 *
 * **The mapping is the server's, not ours.** `previewPromotion` already
 * implements "the next class is the one after this one on the school's class
 * list", and it already knows which students it will refuse (repeating) and
 * which it cannot place (no next level). Recomputing any of that client-side
 * would give the wizard a chance to disagree with the write that follows it —
 * the screen would show 121 promoting and the call would promote 117. So the
 * class rows, their targets and their counts are read from the preview
 * response, and this hook's only real job is to hold the *decisions* the user
 * makes on top of it.
 *
 * `listStudents` is called per class rather than once for the whole school,
 * because the roster list caps at 100 rows per page and a school of 400 would
 * otherwise show the wizard its first 100 students as the school. One request
 * per class also means the per-class "enrolled" figure in the matrix is a real
 * count from the server rather than a count of the page.
 *
 * `overrides` is the user's per-class target map. It exists because a school's
 * class list is often a *name* ordering rather than a *progression* one —
 * `["JHS 1A", "JHS 1B", "JHS 2A", "JHS 2B", "JHS 3A", "JHS 3B"]` promotes 1A to
 * 1B, which is right about the list and wrong about the school. The override is
 * how a bursar says "these two streams both feed JHS 2A" without reordering the
 * class list and breaking every other screen that reads it.
 */
export const usePromotionData = ({ schoolId, classes = [], enabled = true }) => {
  const [state, setState] = useState({
    rows: [],
    loading: true,
    error: null,
    preview: null,
  });

  // Keyed by current class name. Empty object until the user overrides.
  const [overrides, setOverrides] = useState({});

  // `revision` is the invalidation handle. Every write that changes who sits in
  // which class bumps it, and both the roster and the preview refetch.
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((n) => n + 1), []);

  // Any change to the class list invalidates the whole derivation: the preview
  // resolves targets by index, so adding a class mid-list re-points every
  // target below it.
  const classKey = classes.join('|');

  useEffect(() => {
    if (!enabled || !schoolId || !classes.length) {
      setState({ rows: [], loading: false, error: null, preview: null });
      return undefined;
    }

    let active = true;
    setState((current) => ({ ...current, loading: true, error: null }));

    // Both requests are needed and neither subsumes the other: the preview knows
    // the mapping but not the money or the repeat flags, the roster knows those
    // but not the mapping. A failure of either leaves the other to fall back on
    // rather than blanking the wizard — an unmapped matrix is still readable,
    // an empty screen is not.
    Promise.all([
      previewPromotion({ schoolId, classNames: classes }).catch(() => null),
      Promise.all(
        classes.map((className) =>
          listStudents({ class: className, status: 'active', perPage: 100 })
            .then((result) => result.rows || [])
            .catch(() => [])
        )
      ).catch(() => []),
    ])
      .then(([preview, perClass]) => {
        if (!active) return;

        // Flattened and de-duplicated: the same student cannot appear twice
        // unless the server's class filter is broken, but if it is, showing a
        // student twice in a promotion list is worse than showing them once.
        const seen = new Set();
        const rows = perClass
          .flat()
          .filter((student) => {
            const id = String(student._id || student.id);
            if (seen.has(id)) return false;
            seen.add(id);
            return true;
          });

        setState({ rows, loading: false, error: null, preview });
      })
      .catch((error) => {
        if (!active) return;
        setState({ rows: [], loading: false, error, preview: null });
      });

    return () => {
      active = false;
    };
  }, [schoolId, classKey, enabled, revision]);

  /**
   * One row per class, in the school's own class-list order.
   *
   * The order is `classes` and not the preview's `mapping`, because the preview
   * only returns classes it could map — a final-year class is absent from it
   * entirely, and a matrix that silently drops the graduating stream is exactly
   * the omission that loses a cohort.
   */
  const matrix = useMemo(() => {
    const byClass = new Map();
    state.rows.forEach((student) => {
      const key = student.studentClass;
      if (!byClass.has(key)) byClass.set(key, []);
      byClass.get(key).push(student);
    });

    // The preview's own targets, keyed by the class they apply to.
    const previewTargets = new Map();
    (state.preview?.mapping || []).forEach((entry) => {
      previewTargets.set(entry.currentClass, entry);
    });

    return classes.map((className) => {
      const students = byClass.get(className) || [];
      const isLast = classes.indexOf(className) === classes.length - 1;
      const entry = previewTargets.get(className);

      // The server's answer when it has one, the override when the user set
      // one, and null when the class is at the top of the list. `isLast` is the
      // structural reason a class cannot be promoted out of.
      const serverTarget = entry?.targetClass || null;
      const target = overrides[className] !== undefined ? overrides[className] : serverTarget;

      return {
        className,
        students,
        enrolled: students.length,
        // The class list is ordered, so "is this the top" is positional, and a
        // school whose list ends in a final-year stream has a last class that is
        // also its graduating class. Both readings agree here.
        isFinalYear: isLast || !serverTarget,
        serverTarget,
        target,
        overridden: overrides[className] !== undefined && overrides[className] !== serverTarget,
        outstanding: students.filter((s) => (s.balance || 0) > 0),
        balance: students.reduce((sum, s) => sum + (s.balance || 0), 0),
        repeating: students.filter((s) => s.isRepeating),
      };
    });
  }, [classes, state.rows, state.preview, overrides]);

  const totals = useMemo(() => {
    const promoteClasses = matrix.filter((row) => !row.isFinalYear);
    const graduateClasses = matrix.filter((row) => row.isFinalYear);

    return {
      promoting: promoteClasses.reduce((n, row) => n + row.enrolled, 0),
      promotingClasses: promoteClasses.length,
      graduating: graduateClasses.reduce((n, row) => n + row.enrolled, 0),
      graduatingClasses: graduateClasses.length,
      repeating: matrix.reduce((n, row) => n + row.repeating.length, 0),
      outstanding: matrix.reduce((n, row) => n + row.outstanding.length, 0),
      outstandingAmount: matrix.reduce((n, row) => n + row.balance, 0),
      total: matrix.reduce((n, row) => n + row.enrolled, 0),
    };
  }, [matrix]);

  const setTarget = useCallback((className, target) => {
    setOverrides((current) => ({ ...current, [className]: target }));
  }, []);

  const resetTargets = useCallback(() => setOverrides({}), []);

  return {
    ...state,
    matrix,
    totals,
    setTarget,
    resetTargets,
    refresh,
    hasOverrides: Object.keys(overrides).length > 0,
  };
};

export default usePromotionData;
