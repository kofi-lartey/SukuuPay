import React from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  CreditCard,
  LogOut,
  MessageSquare,
  PencilLine,
  Search,
} from 'lucide-react';
import Card from '../dashboard/ui/Card';
import Button from '../common/Button';
import EmptyState from '../dashboard/EmptyState';
import { FeeStatusBadge, PlanStatusBadge } from './StudentBadges';
import Pagination from './Pagination';
import StudentAvatar from './StudentAvatar';
import { formatCedis, formatCount } from '../../utils/format';
import { maskGhanaPhone } from '../../utils/ghanaPhone';

// The avatar's monogram and tone now live in `StudentAvatar`, shared with the
// drawer, the alumni list, the cohorts list and the promotion wizard so a
// student looks the same in all of them. The row-index tone this replaced made
// a student's colour change whenever the list was re-sorted or filtered.

const COLUMNS = [
  { key: 'studentName', label: 'Student', sortable: true },
  { key: 'studentClass', label: 'Class', sortable: false },
  { key: 'totalOwed', label: 'Fee / Paid', sortable: true },
  { key: 'balance', label: 'Balance', sortable: true },
  { key: 'plan', label: 'Installment', sortable: false },
  { key: 'fee', label: 'Fee Status', sortable: false },
];

/**
 * The roster table.
 *
 * **Money is right-aligned with `tabular-nums` throughout.** That is not a
 * flourish: it is the only column a reader actually compares across rows, and
 * proportional digits make a column of cedi look ragged and measurably slower
 * to scan. Every figure comes from `utils/format`, which takes pesewas — the
 * wire format — so no cell can be a hundred-fold out by being hand-formatted.
 *
 * **The table scrolls sideways rather than truncating.** A payment reference and
 * a student number are both long enough to need their full width, and a
 * truncated ID is an ID that cannot be read aloud over the phone.
 */
const StudentTable = ({
  rows,
  loading,
  error,
  meta,
  filters,
  onSort,
  onPageChange,
  onPerPageChange,
  onOpenProfile,
  onEdit,
  onClearFilters,
  hasFilters,
  selection,
  onMessage,
  onRegeneratePayLink,
  onTransferOut,
}) => {
  const toggleSort = (key) => {
    if (!key) return;
    if (filters.sortBy === key) {
      onSort({ sortBy: key, sortOrder: filters.sortOrder === 'asc' ? 'desc' : 'asc' });
    } else {
      onSort({ sortBy: key, sortOrder: 'asc' });
    }
  };

  if (error) {
    return (
      <Card padding="p-0">
        <div className="p-5">
          <p className="text-sm font-bold text-red-700">{error.message}</p>
        </div>
      </Card>
    );
  }

  if (!loading && !rows.length) {
    return (
      <EmptyState
        icon={Search}
        title={hasFilters ? 'No students match these filters' : 'No students on the roster yet'}
        description={
          hasFilters
            ? 'Try widening the class or fee status. A filter that matches nothing usually means the school is ahead of schedule, not that the data is missing.'
            : 'Add a student one at a time, or import the whole roster from a spreadsheet.'
        }
        action={
          hasFilters && (
            <Button variant="secondary" onClick={onClearFilters}>
              Clear filters
            </Button>
          )
        }
      />
    );
  }

  return (
    <Card padding="p-0" className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[60rem] border-collapse text-left">
          <caption className="sr-only">
            Students on the roster. {meta?.total ? formatCount(meta.total) : 0} students.
          </caption>
          <thead>
            <tr className="bg-slate-50">
              <th scope="col" className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={selection.allVisibleSelected}
                  onChange={selection.toggleAllVisible}
                  aria-label="Select all students on this page"
                  disabled={!rows.length}
                  className="h-4 w-4 cursor-pointer rounded border-slate-300 text-brand-700 focus:ring-brand-700/30"
                />
              </th>

              {COLUMNS.map((column) => (
                <th
                  key={column.label}
                  scope="col"
                  aria-sort={
                    filters.sortBy === column.key
                      ? filters.sortOrder === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                  className="whitespace-nowrap px-4 py-3 text-[11px] font-extrabold uppercase tracking-wide text-slate-500"
                >
                  {column.sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(column.key)}
                      className="inline-flex items-center gap-1 transition-colors hover:text-ink"
                    >
                      {column.label}
                      {filters.sortBy === column.key &&
                        (filters.sortOrder === 'asc' ? (
                          <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                        ))}
                    </button>
                  ) : (
                    column.label
                  )}
                </th>
              ))}

              <th scope="col" className="w-24 px-4 py-3 text-right text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
                Actions
              </th>
            </tr>
          </thead>

          <tbody>
            {loading
              ? Array.from({ length: 6 }).map((_, index) => (
                  <tr key={`skeleton-${index}`} className="border-t border-slate-100">
                    <td colSpan={COLUMNS.length + 2} className="px-4 py-4">
                      <div className="h-6 animate-pulse rounded bg-slate-100" />
                    </td>
                  </tr>
                ))
              : rows.map((student, index) => {
                  const id = String(student._id || student.id);
                  const primaryParent =
                    (student.parents || []).find((p) => p.isPrimary) || student.parents?.[0];
                  const isOverdue = student.balance > 0 && student.deadline < new Date();

                  return (
                    <tr
                      key={id}
                      className="border-t border-slate-100 transition-colors hover:bg-slate-50/70"
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selection.selected.has(id)}
                          onChange={() => selection.toggleRow(id)}
                          aria-label={`Select ${student.studentName}`}
                          className="h-4 w-4 cursor-pointer rounded border-slate-300 text-brand-700 focus:ring-brand-700/30"
                        />
                      </td>

                      <th scope="row" className="px-4 py-3 font-normal">
                        <button
                          type="button"
                          onClick={() => onOpenProfile(student)}
                          className="group flex items-center gap-3 text-left"
                        >
                          <StudentAvatar student={student} size="md" />
                          <span className="min-w-0">
                            <span className="block truncate text-[13px] font-extrabold text-ink group-hover:text-brand-700">
                              {student.studentName}
                            </span>
                            <span className="block text-[11px] font-semibold text-slate-500">
                              {student.studentId}
                              {primaryParent?.phone && (
                                <>
                                  {' · '}
                                  {/* Masked. The profile drawer and the export both
                                      show the real number; a roster is a browsing
                                      surface, and this is not the number being
                                      called from it. */}
                                  {maskGhanaPhone(primaryParent.phone)}
                                </>
                              )}
                            </span>
                          </span>
                        </button>
                      </th>

                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="inline-block rounded-md bg-slate-100 px-2 py-1 text-[12px] font-extrabold text-slate-700">
                          {student.studentClass}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <span className="block text-[13px] font-extrabold tabular-nums text-ink">
                          {formatCedis(student.totalOwed)}
                        </span>
                        <span className="block text-[11px] font-semibold tabular-nums text-slate-500">
                          paid {formatCedis(student.totalPaid)}
                        </span>
                      </td>

                      <td
                        className={`whitespace-nowrap px-4 py-3 text-right text-[13px] font-extrabold tabular-nums ${
                          student.balance > 0
                            ? isOverdue
                              ? 'text-red-600'
                              : 'text-amber-600'
                            : 'text-emerald-600'
                        }`}
                      >
                        {formatCedis(student.balance)}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3">
                        {student.planStatus && student.planStatus !== 'none' ? (
                          <PlanStatusBadge status={student.planStatus} />
                        ) : (
                          <span className="text-[12px] font-semibold text-slate-400">—</span>
                        )}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3">
                        <FeeStatusBadge student={student} />
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => onMessage(student)}
                            aria-label={`Send a reminder to the guardian of ${student.studentName}`}
                            title="Send fee reminder"
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-brand-700"
                          >
                            <MessageSquare className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onRegeneratePayLink(student)}
                            aria-label={`Regenerate the pay link for ${student.studentName}`}
                            title="Regenerate pay link"
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-brand-700"
                          >
                            <CreditCard className="h-4 w-4" aria-hidden="true" />
                          </button>
                          {onTransferOut && (
                            <button
                              type="button"
                              onClick={() => onTransferOut(student)}
                              aria-label={`Record a transfer out for ${student.studentName}`}
                              title="Record transfer out (GES TS-4)"
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-brand-700"
                            >
                              <LogOut className="h-4 w-4" aria-hidden="true" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onEdit(student)}
                            aria-label={`Edit ${student.studentName}`}
                            title="Edit student"
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-brand-700"
                          >
                            <PencilLine className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenProfile(student)}
                            aria-label={`Open the profile of ${student.studentName}`}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-brand-700"
                          >
                            <ChevronRight className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>

      {meta?.total > 0 && (
        <Pagination
          meta={meta}
          onPageChange={onPageChange}
          onPerPageChange={onPerPageChange}
          itemLabel="students"
        />
      )}
    </Card>
  );
};

export default StudentTable;
