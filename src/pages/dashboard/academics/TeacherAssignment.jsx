import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { UserCheck, LoaderCircle } from 'lucide-react';
import PageHeader from '../../../components/dashboard/PageHeader';
import TeacherPicker from '../../../components/dashboard/academics/TeacherPicker';
import TeacherAssignmentPanel from '../../../components/dashboard/academics/TeacherAssignmentPanel';
import { useTeacherAssignments } from '../../../hooks/admin/useTeacherAssignments';
import { listClasses } from '../../../services/admin/academic';
import { useToast } from '../../../hooks/useToast';
import { ACADEMICS_ROUTES } from '../../../utils/constants';

/**
 * Teacher Assignment — which students each teacher looks after.
 *
 * ## The layout is the feature
 *
 * Teachers on the left, students on the right, and the teacher is known the
 * moment the page opens. The two panels read each other: the count beside a name
 * is the same number the table below reports as assigned, so an admin never
 * reconciles two screens to find out whether a write landed.
 *
 * A class-mediated assignment path sits beside the class filter rather than on a
 * separate page, because "this teacher takes JHS 2" is the commonest real
 * operation and the two-to-three-clicks version of it is the one people would
 * use. Per-student assignment is the other path, and it exists because a form
 * teacher, a remedial teacher and a house master can all hold the same child and
 * no class structure expresses that.
 *
 * ## No role check on this page
 *
 * `TeacherGuard` decides who reaches `/dashboard`, and the server refuses every
 * one of the four endpoints here to anything except `school_admin`. The page
 * renders for a bursar as an error banner rather than pretending to work, which
 * is the honest outcome and the same one every Academics module gives.
 */
const TeacherAssignment = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();

  const [classrooms, setClassrooms] = useState([]);
  const [classroomError, setClassroomError] = useState(null);

  const filters = useMemo(
    () => ({
      q: searchParams.get('q') || '',
      class: searchParams.get('class') || '',
      status: searchParams.get('status') || 'active',
      gender: searchParams.get('gender') || '',
      tag: searchParams.get('tag') || '',
      page: Number(searchParams.get('page')) || 1,
    }),
    [searchParams]
  );

  const setFilters = useCallback(
    (patch) => {
      const next = new URLSearchParams(searchParams);
      Object.entries(patch).forEach(([key, value]) => {
        if (value === '' || value === null || value === undefined) next.delete(key);
        else next.set(key, String(value));
      });
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const assignments = useTeacherAssignments(filters);

  /**
   * Class names for the filter, from the same list the Classes module writes.
   *
   * `listClasses` answers `{ classes: [...] }` — an object, not an array — which
   * is the shape `useClasses` reads on line 27. This page originally called
   * `.map()` on the response, so it threw `listClasses(...).map is not a
   * function` into a `.catch` that swallowed it, leaving the Class dropdown
   * permanently empty: the class filter existed in the UI and offered nothing
   * to select. The two bugs hide each other, which is why both are fixed here.
   */
  useEffect(() => {
    let active = true;
    listClasses()
      .then((result) => {
        if (!active) return;
        const classes = Array.isArray(result?.classes) ? result.classes : [];
        // Trimmed before filtering, not after: `'   '` is truthy, so a
        // whitespace-only name survives a bare `filter(Boolean)` and becomes an
        // `<option value="   ">` that filters for a class nobody has.
        setClassrooms(
          classes
            .map((item) => String(item?.className || '').trim())
            .filter(Boolean)
        );
        setClassroomError(null);
      })
      .catch((error) => {
        // Surfaced rather than swallowed. A silently empty dropdown is
        // indistinguishable from "this school has no classes", and the admin's
        // next move is to assume the feature is broken rather than the request.
        if (!active) return;
        setClassrooms([]);
        setClassroomError(error.message || 'The class list could not be loaded.');
      });
    return () => {
      active = false;
    };
  }, []);

  /** The result of the last write, told to the admin in their own terms. */
  useEffect(() => {
    const result = assignments.lastResult;
    if (!result) return undefined;

    if (result.error) {
      toast.error(result.error.message);
      return undefined;
    }
    if (result.action === 'assign') {
      toast.success(
        result.assigned > 0
          ? `Assigned ${result.assigned} student${result.assigned === 1 ? '' : 's'} to ${assignments.selectedTeacher?.name || 'the teacher'}.`
          : 'Those students were already assigned.'
      );
    }
    if (result.action === 'unassign') {
      toast.success(
        result.skipped > 0
          ? `Removed ${result.removed}. ${result.skipped} left alone — assigned with a class.`
          : `Removed ${result.removed} student${result.removed === 1 ? '' : 's'}.`
      );
    }
    if (result.action === 'repair') {
      toast.success(
        result.repaired > 0
          ? `Synced ${result.classes} class${result.classes === 1 ? '' : 'es'} to the teacher portal — those teachers will see them on their next sign-in.`
          : 'Everything is already in sync.'
      );
    }
    return undefined;
  }, [assignments.lastResult, toast, assignments.selectedTeacher]);

  const assignSelected = useCallback(
    async (studentIds) => {
      await assignments.assign({ studentIds });
    },
    [assignments]
  );

  const onAssignClass = useCallback(
    async (className, options = {}) => {
      await assignments.assign({ className, ...options });
    },
    [assignments]
  );

  return (
    <div>
      <PageHeader
        eyebrow="Academics"
        title="Teacher Assignment"
        description="See which students each teacher looks after, and change it. Assign a whole class at once, or pick students one by one."
        actions={
          <span className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12.5px] font-extrabold text-slate-600">
            <UserCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            {assignments.page.filter((row) => row.assignedToTeacher).length} of{' '}
            {assignments.pagination.total || 0} students shown are assigned
          </span>
        }
      />

      {/*
        The repair, shown only when drift exists.

        A teacher whose rows live only in `TeacherAssignment` — written before
        `syncClassTeacher` existed, or against service code from before it was
        deployed — shows children here and nothing on the portal, because the
        portal reads `User.assignedClasses` and this console reads the rows.
        Neither screen can see the mismatch on its own, so it is detected and
        offered rather than left for the admin to infer from a phone call.
      */}
      {assignments.drift.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
          <p className="text-[13px] font-semibold text-amber-900">
            <span className="font-extrabold">
              {assignments.drift.length} teacher
              {assignments.drift.length === 1 ? '' : 's'}
            </span>{' '}
            {assignments.drift.length === 1 ? 'has' : 'have'} students assigned here but no class on
            the teacher portal — their dashboard is empty.
          </p>
          <button
            type="button"
            onClick={() => assignments.repair()}
            disabled={assignments.busy !== null}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-3.5 py-2 text-[13px] font-extrabold text-white shadow-lift transition-colors hover:bg-amber-700 disabled:opacity-50"
          >
            {assignments.busy === 'repair' && (
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
            )}
            Sync to the teacher portal
          </button>
        </div>
      )}

      {assignments.rosterError && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-bold text-red-700">
          {assignments.rosterError.message || 'The teacher list could not be loaded.'}
        </p>
      )}

      {/*
        The class list failed, so the Class filter has nothing to offer.

        Said plainly rather than left as a dropdown reading "All Classes" with
        one entry: that looks like a school with no classes, and the admin's next
        step is to stop trusting the filter at all.
      */}
      {classroomError && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] font-bold text-amber-900">
          The class filter is unavailable — {classroomError}. Students can still be assigned
          one at a time, or by reloading once the connection is back.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[280px_1fr] lg:items-start">
        {/*
          The teacher rail is its own panel rather than a bare list, so it keeps
          its own scroll and its search while the student table moves underneath
          it. `sticky` at `lg` — a teacher picked from a long staff list must not
          scroll away while the admin is reading the students.
        */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white lg:sticky lg:top-4">
          <TeacherPicker
            teachers={assignments.teachers}
            loading={assignments.teachersLoading}
            selectedTeacherId={assignments.selectedTeacherId}
            onSelect={assignments.selectTeacher}
            className="h-[420px] lg:h-[calc(100vh-13rem)]"
          />
        </div>

        <TeacherAssignmentPanel
          teacher={assignments.selectedTeacher}
          page={assignments.page}
          pagination={assignments.pagination}
          loading={assignments.pageLoading}
          error={assignments.pageError}
          assignedCount={assignments.teachers.find((t) => t.id === assignments.selectedTeacherId)?.studentCount || 0}
          selected={assignments.selected}
          onToggleStudent={assignments.toggleStudent}
          onSelectPage={assignments.selectPage}
          onAssign={assignSelected}
          onAssignClass={onAssignClass}
          onUnassign={async (ids, options = {}) => assignments.unassign({ studentIds: ids, ...options })}
          onFilterChange={setFilters}
          onPageChange={(page) => setFilters({ page })}
          busy={assignments.busy}
          lastResult={assignments.lastResult}
          filters={filters}
          classroomOptions={classrooms}
        />
      </div>
    </div>
  );
};

export default TeacherAssignment;
