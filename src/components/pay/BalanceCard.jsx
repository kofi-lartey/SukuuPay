import React from 'react';
import { CalendarClock } from 'lucide-react';
import Card from '../dashboard/ui/Card';
import { formatCedi } from '../../utils/format';

/**
 * What is owed, who it is owed for, and by when.
 *
 * The balance is the largest thing on the page and the only figure in red when
 * money is outstanding. A parent scanning this on a phone needs one number, and
 * the two supporting figures are there to be checked against a notice rather than
 * read first.
 *
 * The deadline carries the consequence in words ("8 days left") rather than only
 * a date, because a date on its own does not tell a parent whether to act
 * today.
 */
const BalanceCard = ({ student }) => {
  const balance = student.balance || 0;
  const settled = balance <= 0;

  const deadlineNote = () => {
    if (!student.deadline) return null;
    const deadline = new Date(student.deadline);
    if (Number.isNaN(deadline.getTime())) return null;

    const days = Math.ceil((deadline.getTime() - Date.now()) / 86400000);
    if (settled) return 'Fees fully paid';
    if (days < 0) {
      return `Overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'}`;
    }
    if (days === 0) return 'Due today';
    return `${days} day${days === 1 ? '' : 's'} left to pay`;
  };

  const note = deadlineNote();
  const overdue = note?.startsWith('Overdue');

  return (
    <Card padding="p-5" className={settled ? 'border-emerald-200' : overdue ? 'border-red-200' : ''}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-extrabold tracking-tight text-ink">
            {student.studentName}
          </h2>
          <p className="mt-0.5 text-[12px] font-semibold text-slate-500">
            {student.studentClass} · {student.studentId}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${
            settled ? 'bg-emerald-100 text-emerald-800' : 'bg-red-50 text-red-700'
          }`}
        >
          {settled ? 'Paid in full' : 'Balance due'}
        </span>
      </div>

      <p
        className={`mt-5 text-4xl font-extrabold leading-none tracking-tight ${
          settled ? 'text-emerald-600' : 'text-red-600'
        }`}
      >
        {formatCedi(balance)}
      </p>

      <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">
        <div>
          <dt className="text-[11px] font-extrabold uppercase tracking-wide text-slate-400">
            Total fees
          </dt>
          <dd className="mt-0.5 text-sm font-extrabold tabular-nums text-ink">
            {formatCedi(student.totalOwed || 0)}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-extrabold uppercase tracking-wide text-slate-400">
            Paid so far
          </dt>
          <dd className="mt-0.5 text-sm font-extrabold tabular-nums text-brand-700">
            {formatCedi(student.totalPaid || 0)}
          </dd>
        </div>
      </dl>

      {note && (
        <p
          className={`mt-4 flex items-center gap-2 text-[13px] font-extrabold ${
            settled ? 'text-emerald-700' : overdue ? 'text-red-600' : 'text-slate-600'
          }`}
        >
          <CalendarClock className="h-4 w-4 shrink-0" aria-hidden="true" />
          {note}
          {deadlineLabel(student.deadline)}
        </p>
      )}
    </Card>
  );
};

const deadlineLabel = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return <span className="font-semibold text-slate-400">· {d.toLocaleDateString('en-GB')}</span>;
};

export default BalanceCard;
