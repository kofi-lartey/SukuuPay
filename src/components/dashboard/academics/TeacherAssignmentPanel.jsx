import React, { useMemo } from 'react';
import { CheckSquare, Users } from 'lucide-react';
import { SelectField } from '../../common/FormField';
import StudentAssignmentRow from './StudentAssignmentRow';
import BulkAssignBar from './BulkAssignBar';
import EmptyState from '../EmptyState';

/**
 * The assignment browser: a roster with each row's assignment state, plus the
 * controls that change it.
 *
 * One component rather than a page plus a table, because the selection, the
 * filters, the page of rows and the two mutations are one mental model. Split
 * across files they end up disagreeing about what is selected — the classic bug
 * here is a filter that clears the selection, or a paging control that keeps a
 * tick on a row that is no longer on screen.
 *
 * ## The three actions
 *
 *   - **Tick rows, Assign** — the individual path.
 *   - **Select all N in <class>** — `Workflow C`, the whole class in one write.
 *   - **Remove** — the inverse, with class rows left alone unless forced.
 *
 * All three send the same request shape: the panel resolves the selection to ids
 * and the server decides what it means. There is no client-side decision about
 * whether a row "can" be removed — the server owns that, because it owns the
 * `classMediated` flag the decision rests on.
 */
const TeacherAssignmentPanel = ({
  teacher,
  page,
  pagination,
  loading,
  error,
  assignedCount,
  selected,
  onToggleStudent,
  onSelectPage,
  onAssign,
  onUnassign,
  onAssignClass,
  busy,
  lastResult,
  filters,
  onFilterChange,
  onPageChange,
  classroomOptions,
}) => {
  const rows = useMemo(() => page || [], [page]);

  /**
   * How many of the ticked rows came from a class assignment.
   *
   * The server refuses to remove those without `force`, so the confirmation has
   * to be able to say "14 of these 14 were assigned with a class" rather than
   * pressing Remove and being told nothing happened. On this page that is the
   * common case: a class assignment produces twenty class-mediated rows and the
   * admin's next instinct is to remove one of them.
   */
  const classMediatedSelected = useMemo(
    () => [...selected].filter((id) => rows.find((row) => String(row._id) === id)?.classMediated).length,
    [selected, rows]
  );

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-6 text-center">
        <p className="text-[13px] font-bold text-red-700">
          {error.message || "That teacher's students could not be loaded."}
        </p>
        {error.offline && (
          <p className="mt-1 text-[12px] font-semibold text-red-600">
            This looks like a connection problem rather than an empty roster.
          </p>
        )}
      </div>
    );
  }

  if (!teacher) {
    return (
      <EmptyState
        icon={Users}
        title="Pick a teacher"
        description="Choose a teacher on the left to see their students and assign new ones."
      />
    );
  }

  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {/*
        The filters, and why this is not `RosterFilterBar`.

        The roster's bar carries Fee Status and Plan Status, which this endpoint's
        query schema deliberately refuses: filtering "who a teacher looks after"
        by whether a parent owes fees is a question with an easy way to be
        misread. Reusing it would mean either sending a filter the server rejects
        or quietly adding a filter nobody asked for. So this is the same idiom —
        `SelectField`, the same styling, the same labels — minus the two dropdowns
        that do not belong, plus the class action that does.
      */}
      <div className="border-b border-slate-200 bg-slate-50/60 p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="relative lg:max-w-xs lg:flex-1">
            <label htmlFor="assignment-search" className="mb-0.5 block text-[11px] font-semibold text-slate-700">
              Search
            </label>
            <Users className="pointer-events-none absolute bottom-2.5 left-3 h-4 w-4 text-slate-400" aria-hidden="true" />
            <input
              id="assignment-search"
              type="search"
              value={filters.q || ''}
              onChange={(event) => onFilterChange({ q: event.target.value })}
              placeholder="Student name, ID, or parent phone…"
              className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-[13px] font-semibold text-ink placeholder:font-medium placeholder:text-slate-400 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
            />
          </div>

          <SelectField
            label="Class"
            value={filters.class || ''}
            onChange={(event) => onFilterChange({ class: event.target.value, page: 1 })}
            className="lg:w-40"
          >
            <option value="">All Classes</option>
            {(classroomOptions || []).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Status"
            value={filters.status || 'active'}
            onChange={(event) => onFilterChange({ status: event.target.value, page: 1 })}
            className="lg:w-36"
          >
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="graduated">Graduated</option>
            <option value="transferred">Transferred Out</option>
            <option value="all">All Records</option>
          </SelectField>

          <SelectField
            label="Gender"
            value={filters.gender || ''}
            onChange={(event) => onFilterChange({ gender: event.target.value, page: 1 })}
            className="lg:w-32"
          >
            <option value="">All</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </SelectField>

          {/*
            "Select all in <class>", beside the class dropdown because that is
            where the hand already is. Hidden when no class is chosen: offering it
            against the whole roster would assign everybody, which is the one
            action that must never be a single click.
          */}
          {filters.class ? (
            <button
              type="button"
              onClick={() => onAssignClass(filters.class)}
              disabled={busy !== null}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12.5px] font-extrabold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              <CheckSquare className="h-4 w-4" aria-hidden="true" />
              Select all in {filters.class}
            </button>
          ) : (
            <span className="h-9" aria-hidden="true" />
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="sticky top-0 bg-white">
            <tr className="border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
              <th className="w-10 px-4 py-2.5">
                {/*
                  Select-page, and a real `onChange` so the indeterminate state
                  is announced rather than implied. The tick means "every row on
                  this page", which is why the label says the page and not the
                  filter — a selection that silently covers more rows than are
                  visible is how somebody assigns a whole school by accident.
                */}
                <label className="flex cursor-pointer items-center justify-center">
                  <span className="sr-only">Select every student on this page</span>
                  <input
                    type="checkbox"
                    checked={rows.length > 0 && rows.every((row) => selected.has(String(row._id)))}
                    ref={(node) => {
                      if (node) {
                        const some = rows.some((row) => selected.has(String(row._id)));
                        node.indeterminate = some && !rows.every((row) => selected.has(String(row._id)));
                      }
                    }}
                    onChange={(event) => onSelectPage(event.target.checked)}
                    disabled={busy !== null || !rows.length}
                    className="h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-2 focus:ring-brand-700/30 disabled:opacity-50"
                  />
                </label>
              </th>
              <th className="px-4 py-2.5">Student</th>
              <th className="px-4 py-2.5">Class</th>
              <th className="px-4 py-2.5">Parent phone</th>
              <th className="px-4 py-2.5">Assignment</th>
              <th className="px-4 py-2.5 text-right">Action</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {loading ? (
              // Skeletons in the row's own shape, so the table does not collapse
              // into a two-line blob and jump back into five columns.
              [0, 1, 2, 3, 4, 5].map((i) => (
                <tr key={i}>
                  <td className="px-4 py-2.5">
                    <span className="block h-4 w-4 animate-pulse rounded bg-slate-100" />
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="block h-3 w-40 animate-pulse rounded bg-slate-100" />
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="block h-3 w-16 animate-pulse rounded bg-slate-100" />
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="block h-3 w-24 animate-pulse rounded bg-slate-100" />
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="block h-3 w-20 animate-pulse rounded bg-slate-100" />
                  </td>
                  <td className="px-4 py-2.5" />
                </tr>
              ))
            ) : !rows.length ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center">
                  <p className="text-[13px] font-bold text-ink">No students match these filters.</p>
                  <button
                    type="button"
                    onClick={() => onFilterChange({ class: '', status: 'active', gender: '', q: '' })}
                    className="mt-1 text-[12px] font-extrabold text-brand-700 hover:underline"
                  >
                    Clear the filters
                  </button>
                </td>
              </tr>
            ) : (
              rows.map((student) => (
                <StudentAssignmentRow
                  key={student._id}
                  student={student}
                  selected={selected.has(String(student._id))}
                  disabled={busy !== null}
                  onToggle={onToggleStudent}
                  onRemove={(id) => onUnassign([id], { force: false })}                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/*
        Pagination, and it is page-based rather than infinite scroll. An admin
        assigning students is counting: "24 on this page" is a number they can
        hold in their head, and an endless list is a number nobody ever finishes
        counting.
      */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-4 py-2.5">
          <p className="text-[12px] font-semibold text-slate-500">
            Page {pagination.page} of {pagination.pages} · {pagination.total} students
          </p>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1 || busy !== null}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-extrabold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.pages || busy !== null}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-extrabold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}

      <BulkAssignBar
        selectedIds={[...selected]}
        busy={busy}
        teacherName={teacher?.name || 'this teacher'}
        assignedCount={assignedCount}
        classMediatedCount={classMediatedSelected}
        onAssign={onAssign}
        onRemove={onUnassign}
      />

      {/*
        The result of the last write.

        `skipped` is the interesting case: the server refused to drop rows that a
        class assignment put there, and an admin who pressed Remove and saw three
        rows disappear and two stay needs to be told why rather than assume the
        button half-worked.
      */}
      {lastResult?.action === 'unassign' && lastResult.skipped > 0 && (
        <p className="border-t border-amber-200 bg-amber-50 px-4 py-2.5 text-[12px] font-bold text-amber-900">
          {lastResult.skipped} left alone — {lastResult.skippedReason || 'assigned with a class'}.
        </p>
      )}
    </section>
  );
};

export default TeacherAssignmentPanel;
