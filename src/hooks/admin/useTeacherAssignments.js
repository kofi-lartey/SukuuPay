import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getTeacherAssignmentCounts,
  listTeachers,
  listTeacherStudents,
  assignTeacherStudents,
  unassignTeacherStudents,
} from '../../services/admin/academic';

/**
 * The assignment page's state: the selected teacher, that teacher's students,
 * and the two writes.
 *
 * ## Selection is keyed by id, and it survives everything
 *
 * Selection is held in a panel-level `Set` of student ids rather than as a flag
 * on the rows, because a row is a *page* of results and a selection is a
 * *choice*. Ticking three students, changing the class filter, turning the page
 * and coming back leaves the three ticked — with a flag on the row, the second
 * page's renders would throw it away, and clearing a filter would clear the
 * selection. Both are the same bug and both read as "the app lost my picks".
 *
 * ## Counts are merged, not re-derived
 *
 * The picker's `24 students` comes from an aggregation over the assignment
 * collection, merged onto the roster the caller already holds. It is never summed
 * from the paginated student list: that under-reports every teacher past page
 * one, and the number next to a teacher's name is the number they will be judged
 * on.
 *
 * ## Filter changes re-read, selection changes do not
 *
 * `applyFilters` refetches. Everything else — toggling a row, paging — never
 * touches the server. That separation is why the filters are passed in by the
 * panel (which owns the URL) rather than read from the router here: a hook that
 * reads the query string and one that writes it is a hook that can fight the
 * component using it.
 *
 * ## Both writes refresh the same three things
 *
 * The counts, the page of students, and the selection — in that order, and only
 * the parts that changed. After an assign the newly-assigned ids stay selected so
 * the bar keeps its total rather than silently resetting to zero, which reads as
 * the click having missed.
 */
const EMPTY_PAGE = { rows: [], pagination: { page: 1, perPage: 20, total: 0, pages: 1 } };

export const useTeacherAssignments = (filters = {}, reloadKey = 0) => {
  const [teachers, setTeachers] = useState([]);
  const [teachersLoading, setTeachersLoading] = useState(true);
  const [rosterError, setRosterError] = useState(null);
  const [counts, setCounts] = useState({});
  const [selectedTeacherId, setSelectedTeacherId] = useState('');

  const [page, setPage] = useState(EMPTY_PAGE);
  const [pageLoading, setPageLoading] = useState(false);
  const [pageError, setPageError] = useState(null);

  const [selected, setSelected] = useState(() => new Set());
  const [busy, setBusy] = useState(null); // 'assign' | 'unassign'
  const [lastResult, setLastResult] = useState(null);

  /**
   * A serial number, so a response for a teacher the admin has already navigated
   * away from is dropped rather than rendered. Two slow requests on a 3G school
   * connection landing out of order is the commonest silent data bug in a
   * two-panel page like this.
   */
  const requestRef = useRef(0);

  /** The teacher roster, once, for the picker. */
  const loadRoster = useCallback(async () => {
    setTeachersLoading(true);
    setRosterError(null);
    try {
      const [items, countMap] = await Promise.all([listTeachers(), getTeacherAssignmentCounts()]);
      setTeachers(items);
      setCounts(countMap);
      // The first teacher, selected by default. An empty right panel reads as a
      // broken page, and an admin landing here has a teacher in mind within a
      // second — picking for them costs nothing and saves a click.
      setSelectedTeacherId((current) => current || (items[0]?.id ?? ''));
    } catch (error) {
      setRosterError(error);
      setTeachers([]);
    } finally {
      setTeachersLoading(false);
    }
  }, []);

  /** Refresh only the counts, after either write. */
  const loadCounts = useCallback(async () => {
    try {
      setCounts(await getTeacherAssignmentCounts());
    } catch {
      // A failed count refresh is not worth an error banner: the page's own rows
      // are still correct, and the tally is decoration around them.
    }
  }, []);

  useEffect(() => {
    loadRoster();
  }, [loadRoster, reloadKey]);

  /** The selected teacher's page of students. */
  const loadPage = useCallback(async (teacherId, currentFilters) => {
    if (!teacherId) {
      setPage(EMPTY_PAGE);
      return;
    }

    const ticket = ++requestRef.current;
    setPageLoading(true);
    setPageError(null);
    try {
      const result = await listTeacherStudents(teacherId, currentFilters);
      if (ticket !== requestRef.current) return;
      setPage(result);
    } catch (error) {
      if (ticket !== requestRef.current) return;
      setPageError(error);
      setPage(EMPTY_PAGE);
    } finally {
      if (ticket === requestRef.current) setPageLoading(false);
    }
  }, []);

  // The page is read whenever the teacher or the filters change — and on nothing
  // else, which is what keeps toggling a checkbox from refetching.
  useEffect(() => {
    if (selectedTeacherId) loadPage(selectedTeacherId, filters);
  }, [selectedTeacherId, filters, loadPage]);

  const selectTeacher = useCallback((teacherId) => {
    setSelectedTeacherId(teacherId);
    setSelected(new Set());
    setLastResult(null);
  }, []);

  const toggleStudent = useCallback((studentId) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }, []);

  const selectPage = useCallback(
    (checked) => {
      setSelected((current) => {
        const next = new Set(current);
        for (const row of page.rows) {
          const id = String(row._id);
          if (checked) next.add(id);
          else next.delete(id);
        }
        return next;
      });
    },
    [page.rows]
  );

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  const assign = useCallback(
    async ({ studentIds, className } = {}) => {
      if (!selectedTeacherId) return { ok: false, error: new Error('Pick a teacher first.') };
      if (!className && !studentIds?.length) {
        return { ok: false, error: new Error('Pick at least one student.') };
      }

      setBusy('assign');
      setLastResult(null);
      try {
        const result = await assignTeacherStudents(selectedTeacherId, { studentIds, className });
        // Refresh in the order the admin watches: the tally next to every teacher,
        // then the rows. The class path clears the selection because "all of JHS 2"
        // is not a set of rows anybody meant to hold.
        await loadCounts();
        await loadPage(selectedTeacherId, filters);
        if (className) setSelected(new Set());
        else setSelected(new Set((studentIds || []).map(String)));
        setLastResult({ action: 'assign', ...result });
        return { ok: true, result };
      } catch (error) {
        setLastResult({ action: 'assign', error });
        return { ok: false, error };
      } finally {
        setBusy(null);
      }
    },
    [selectedTeacherId, loadCounts, loadPage, filters]
  );

  const unassign = useCallback(
    async ({ force = false } = {}) => {
      if (!selectedTeacherId) return { ok: false, error: new Error('Pick a teacher first.') };
      const ids = [...selected];
      if (!ids.length) return { ok: false, error: new Error('Pick at least one student.') };

      setBusy('unassign');
      setLastResult(null);
      try {
        const result = await unassignTeacherStudents(selectedTeacherId, ids, { force });
        await loadCounts();
        await loadPage(selectedTeacherId, filters);

        // Rows the server refused to touch keep their tick: the admin can see
        // what is still assigned and why, instead of wondering whether the click
        // landed. Everything else is dropped, because the rows are gone.
        const removed = new Set((result.removedIds || []).map(String));
        setSelected((current) => new Set([...current].filter((id) => !removed.has(id))));
        setLastResult({ action: 'unassign', ...result });
        return { ok: true, result };
      } catch (error) {
        setLastResult({ action: 'unassign', error });
        return { ok: false, error };
      } finally {
        setBusy(null);
      }
    },
    [selectedTeacherId, selected, loadCounts, loadPage, filters]
  );

  const teachersWithCounts = useMemo(
    () =>
      teachers.map((teacher) => ({
        ...teacher,
        studentCount: counts[teacher.id]?.count ?? 0,
        classMediatedCount: counts[teacher.id]?.classMediated ?? 0,
      })),
    [teachers, counts]
  );

  const selectedTeacher = useMemo(
    () => teachersWithCounts.find((teacher) => teacher.id === selectedTeacherId) || null,
    [teachersWithCounts, selectedTeacherId]
  );

  return {
    teachers: teachersWithCounts,
    teachersLoading,
    rosterError,

    selectedTeacher,
    selectedTeacherId,
    selectTeacher,

    page: page.rows,
    pagination: page.pagination,
    pageLoading,
    pageError,

    selected,
    toggleStudent,
    selectPage,
    clearSelection,

    assign,
    unassign,
    busy,
    lastResult,
  };
};

export default useTeacherAssignments;
