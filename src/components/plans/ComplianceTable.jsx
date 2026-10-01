import React from 'react';
import { AlertCircle, CalendarDays, CalendarX2, Clock, Loader2 } from 'lucide-react';
import Badge from '../dashboard/ui/Badge';
import { formatCedi } from '../../utils/format';
import PlanRowActions from './PlanRowActions';

/**
 * The compliance table.
 *
 * One row per plan, and the columns are the questions a bursar asks in order:
 * whose is it, how far along is it, when is the next money, how much, and what
 * should I do about it. The action column is last and is the only one that
 * changes what the row *says* — a row in default offers a chaser, a row on track
 * offers nothing but "view", because a nudge to a family that has paid on time is
 * how a school spends the trust the reminders are meant to earn.
 */

const STATUS_TONES = {
  on_track: 'green',
  approaching_due: 'amber',
  overdue: 'red',
  pending_acceptance: 'blue',
  defaulted: 'rose',
  completed: 'slate',
};

const STATUS_LABELS = {
  on_track: 'On Track',
  approaching_due: 'Approaching Due',
  overdue: 'Overdue',
  pending_acceptance: 'Awaiting Acceptance',
  defaulted: 'Defaulted',
  completed: 'Completed',
};

/** Whole days from today to a date. Negative is in the past. */
const daysUntil = (date) => {
  if (!date) return null;
  const target = new Date(date);
  if (Number.isNaN(target.getTime())) return null;
  // Compared at day granularity in UTC. Comparing at midnight local time puts a
  // due date on "today" in the evening and "tomorrow" at breakfast, and a family
  // told their tranche is due tomorrow when it is due today is a support call.
  const todayUtc = Date.UTC(
    new Date().getUTCFullYear(),
    new Date().getUTCMonth(),
    new Date().getUTCDate()
  );
  const dueUtc = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate());
  return Math.round((dueUtc - todayUtc) / 86400000);
};

/** The date cell, coloured and iconed by how close it is. */
const DueDateCell = ({ dueDate, overdue }) => {
  const days = daysUntil(dueDate);
  const date = new Date(dueDate);
  const formatted = Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });

  const soon = !overdue && days !== null && days <= 2;
  const Icon = overdue ? CalendarX2 : soon ? Clock : CalendarDays;

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[12px] font-extrabold ${
        overdue ? 'text-red-600' : soon ? 'text-amber-600' : 'text-ink'
      }`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {formatted}
    </span>
  );
};

/**
 * "1 of 3 Paid" with a bar.
 *
 * The bar is the *paid* proportion and is red when a tranche is overdue, because a
 * half-filled green bar next to an "Overdue (5 days)" badge is a contradiction the
 * reader has to resolve. Progress here means "on schedule", not "some money
 * arrived".
 */
const PlanProgressCell = ({ plan }) => {
  const installments = plan.installments || [];
  const paid = installments.filter(
    (installment) => installment.status === 'paid' || installment.status === 'waived'
  ).length;
  const percent = installments.length ? (paid / installments.length) * 100 : 0;
  const hasOverdue = installments.some((installment) => installment.status === 'overdue');

  return (
    <div className="min-w-[150px]">
      <p className="text-[12px] font-extrabold text-ink">{plan.planName}</p>
      <div className="mt-1 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full ${hasOverdue ? 'bg-red-600' : 'bg-brand-700'}`}
            style={{ width: `${percent}%` }}
          />
        </div>
        <span className="shrink-0 text-[11px] font-bold text-slate-500">
          {paid} of {installments.length} Paid
        </span>
      </div>
    </div>
  );
};

/** The status pill, worded the way the design words it. */
const ComplianceStatusCell = ({ plan }) => {
  const status = plan.complianceStatus || plan.planStatus;
  const days = daysUntil(plan.nextInstallment?.dueDate);

  let label = STATUS_LABELS[status] || status;
  if (status === 'overdue' && days !== null) {
    label = `Overdue (${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'})`;
  } else if (status === 'approaching_due' && days !== null) {
    label = days <= 0 ? 'Due today' : `Due in ${days} day${days === 1 ? '' : 's'}`;
  }

  return (
    <Badge tone={STATUS_TONES[status] || 'slate'}>
      {label}
    </Badge>
  );
};

const EmptyRow = ({ colSpan, children }) => (
  <tr>
    <td colSpan={colSpan} className="px-4 py-12 text-center text-[12px] font-semibold text-slate-500">
      {children}
    </td>
  </tr>
);

const ComplianceTable = ({
  rows,
  loading,
  error,
  hasFilters,
  onView,
  onChase,
  onViewSchedule,
  busyPlanId,
  onSort,
  sortBy,
  sortOrder,
}) => (
  <div className="overflow-x-auto">
    <table className="w-full min-w-[900px] border-collapse">
      <thead>
        <tr className="border-b border-slate-100 text-left">
          {[
            { key: null, label: 'Student' },
            { key: null, label: 'Class & ID' },
            { key: null, label: 'Plan Progress' },
            { key: 'endDate', label: 'Next Due Date' },
            { key: 'totalAmount', label: 'Tranche Amount' },
            { key: 'complianceStatus', label: 'Compliance Status' },
            { key: null, label: 'Action' },
          ].map((column) => (
            <th
              key={column.label}
              scope="col"
              className="px-4 py-2.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400"
            >
              {column.key && onSort ? (
                <button
                  type="button"
                  onClick={() => onSort(column.key)}
                  className="inline-flex items-center gap-1 hover:text-slate-600"
                >
                  {column.label}
                  {sortBy === column.key && (
                    <span aria-hidden="true">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                  )}
                </button>
              ) : (
                column.label
              )}
            </th>
          ))}
        </tr>
      </thead>

      <tbody>
        {loading && (
          <EmptyRow colSpan={7}>
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Loading plan compliance…
            </span>
          </EmptyRow>
        )}

        {!loading && error && (
          <EmptyRow colSpan={7}>
            <span className="inline-flex items-center gap-2 text-red-600">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              {error.message}
            </span>
          </EmptyRow>
        )}

        {!loading && !error && !rows.length && (
          <EmptyRow colSpan={7}>
            {hasFilters
              ? 'No plans match these filters.'
              : 'No payment plans yet. Create one from a student with an outstanding balance to start tracking compliance.'}
          </EmptyRow>
        )}

        {!loading &&
          !error &&
          rows.map((plan) => {
            const student = plan.student || {};
            const next = plan.nextInstallment;
            const outstanding = next ? Math.max(next.amount - (next.amountPaid || 0), 0) : 0;
            const isOverdue = plan.complianceStatus === 'overdue';

            return (
              <tr key={plan._id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                <td className="px-4 py-3">
                  <p className="text-[13px] font-extrabold text-ink">
                    {student.studentName || 'Unknown student'}
                  </p>
                  {student.parentName && (
                    <p className="text-[11px] font-semibold text-slate-500">
                      Parent: {student.parentName}
                    </p>
                  )}
                </td>

                <td className="px-4 py-3">
                  <p className="text-[12px] font-extrabold text-ink">
                    {student.studentClass || '—'}
                  </p>
                  <p className="text-[11px] font-semibold text-slate-500">{student.studentId}</p>
                </td>

                <td className="px-4 py-3">
                  <PlanProgressCell plan={plan} />
                </td>

                <td className="px-4 py-3">
                  {next ? (
                    <DueDateCell dueDate={next.dueDate} overdue={isOverdue} />
                  ) : (
                    <span className="text-[12px] font-semibold text-slate-400">
                      {plan.planStatus === 'completed' ? 'Fully settled' : '—'}
                    </span>
                  )}
                </td>

                <td className="px-4 py-3">
                  <span
                    className={`text-[13px] font-extrabold ${isOverdue ? 'text-red-600' : 'text-ink'}`}
                  >
                    {formatCedi(outstanding || plan.totalAmount || 0)}
                  </span>
                </td>

                <td className="px-4 py-3">
                  <ComplianceStatusCell plan={plan} />
                </td>

                <td className="px-4 py-3">
                  <PlanRowActions
                    plan={plan}
                    busy={busyPlanId === plan._id}
                    onView={() => onViewSchedule(plan)}
                    onChase={() => onChase(plan)}
                  />
                </td>
              </tr>
            );
          })}
      </tbody>
    </table>
  </div>
);

export default ComplianceTable;
