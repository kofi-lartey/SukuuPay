import React from 'react';
import Badge from '../dashboard/ui/Badge';
import { CircleCheck, Hourglass, TriangleAlert, TrendingUp } from 'lucide-react';

/**
 * The three states a fee can be in, as the roster shows them.
 *
 * `overdue` is tested before `owing`: a student past their deadline who still
 * owes money is overdue, not merely owing, and the filter above the table treats
 * them as different rows. Reading a GH₵ 500 balance as "owing" when the deadline
 * was three weeks ago is the exact misreading this ordering prevents.
 *
 * `onGrace` is separate from `overdue` rather than folded into it: a family
 * inside an agreed grace period is being handled, not chased, and the roster
 * saying so saves a bursar a phone call they did not need to make.
 */
const feeStatusOf = (student) => {
  const balance = student.balance || 0;
  if (balance <= 0) return 'paid';
  const deadline = student.deadline ? new Date(student.deadline) : null;
  if (deadline && deadline < new Date()) return student.onGrace ? 'grace' : 'overdue';
  return 'owing';
};

const FEE = {
  paid: { label: 'Paid', tone: 'green', icon: CircleCheck },
  grace: { label: 'On Grace', tone: 'amber', icon: Hourglass },
  overdue: { label: 'Overdue', tone: 'red', icon: TriangleAlert },
  owing: { label: 'Due Soon', tone: 'amber', icon: TrendingUp },
};

export const FeeStatusBadge = ({ student, className = '' }) => {
  const key = feeStatusOf(student);
  const config = FEE[key];
  return (
    <Badge tone={config.tone} icon={config.icon} className={className}>
      {config.label}
    </Badge>
  );
};

const PLAN = {
  none: { label: 'No Plan', tone: 'slate' },
  pending: { label: 'Awaiting Parent', tone: 'amber' },
  active: { label: 'On Track', tone: 'green' },
  completed: { label: 'Completed', tone: 'brand' },
  defaulted: { label: 'Defaulted', tone: 'red' },
};

export const PlanStatusBadge = ({ status, className = '' }) => {
  const config = PLAN[status] || PLAN.none;
  return (
    <Badge tone={config.tone} className={className}>
      {config.label}
    </Badge>
  );
};

/** The lifecycle status of the record itself, distinct from the fee state. */
const STATUS = {
  active: { label: 'Active', tone: 'green' },
  suspended: { label: 'Suspended', tone: 'amber' },
  removed: { label: 'Removed', tone: 'slate' },
  graduated: { label: 'Graduated', tone: 'brand' },
  transferred_out: { label: 'Transferred Out', tone: 'blue' },
};

export const StatusBadge = ({ status, className = '' }) => {
  const config = STATUS[status] || { label: status, tone: 'slate' };
  return (
    <Badge tone={config.tone} className={className}>
      {config.label}
    </Badge>
  );
};

export { feeStatusOf };
export default FeeStatusBadge;
