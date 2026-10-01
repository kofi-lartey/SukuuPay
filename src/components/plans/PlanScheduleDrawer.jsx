import React, { useState } from 'react';
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  HandCoins,
  Loader2,
  Send,
  Wallet,
} from 'lucide-react';
import Modal from '../common/Modal';
import Badge from '../dashboard/ui/Badge';
import Button from '../common/Button';
import { Field } from '../common/FormField';
import { cancelPaymentPlan, updateInstallment } from '../../services/paymentPlans';
import { useToast } from '../../hooks/useToast';
import { formatCedi, formatCedis, formatCount } from '../../utils/format';

/**
 * One plan, as a vertical timeline.
 *
 * The reason this module's original scaffold insisted on a timeline: a plan is a
 * sequence, and a table row cannot answer "what happens next on the 12th" without
 * being expanded. The drawer is what the compliance table opens, and it is the
 * only place in the app where a *single* installment can be acted on.
 *
 * **Every mutation here states what it does not do.** `mark_paid` records the
 * money as settled on the plan and creates **no** `Payment` record — so the
 * school's collections total will not move, and a bursar reconciling the day
 * needs to know that before they click. That is not a footnote: it is the single
 * most surprising thing about this screen, and a button labelled "Mark paid"
 * implies the opposite.
 */

const STATUS_META = {
  pending: { label: 'Pending', tone: 'slate', Icon: Clock },
  partial: { label: 'Part paid', tone: 'blue', Icon: CircleDollarSign },
  paid: { label: 'Paid', tone: 'green', Icon: CheckCircle2 },
  overdue: { label: 'Overdue', tone: 'red', Icon: AlertCircle },
  waived: { label: 'Waived', tone: 'slate', Icon: Ban },
};

/**
 * "1st", "2nd", "3rd", "4th".
 *
 * Hand-rolled rather than `Intl.PluralRules`, because the design's copy needs the
 * ordinal to read as a position in a sequence ("3rd Installment (Final)") and a
 * plural rule would give "3 installments" — the wrong part of speech entirely.
 */
const ordinal = (n) => {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;
};

const TrancheRow = ({ installment, plan, onActed, busy }) => {
  const meta = STATUS_META[installment.status] || STATUS_META.pending;
  const { Icon } = meta;
  const outstanding = Math.max((installment.amount || 0) - (installment.amountPaid || 0), 0);
  const due = new Date(installment.dueDate);
  const locked = ['completed', 'cancelled', 'expired'].includes(plan.planStatus);

  return (
    <li className="relative flex gap-3 pb-5 last:pb-0">
      {/* The spine. Drawn behind the marker so a paid tranche reads as a
          continuous line through it. */}
      <span
        aria-hidden="true"
        className="absolute left-[15px] top-8 h-full w-0.5 bg-slate-100"
      />
      <span
        className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          installment.status === 'paid'
            ? 'bg-emerald-100 text-emerald-700'
            : installment.status === 'overdue'
              ? 'bg-red-100 text-red-600'
              : installment.status === 'waived'
                ? 'bg-slate-100 text-slate-500'
                : 'bg-amber-50 text-amber-600'
        }`}
      >
        <Icon className="h-4 w-4" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[13px] font-extrabold text-ink">
            {ordinal(installment.installmentNumber)} Installment
            {installment.installmentNumber === plan.numberOfInstallments && ' (Final)'}
          </p>
          <span className="text-[14px] font-extrabold tabular-nums text-ink">
            {formatCedi(installment.amount)}
          </span>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-slate-500">
          <span>
            Due:{' '}
            {Number.isNaN(due.getTime())
              ? '—'
              : due.toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  timeZone: 'UTC',
                })}
          </span>
          <Badge tone={meta.tone}>{meta.label}</Badge>
          {outstanding > 0 && installment.status !== 'paid' && (
            <span className="text-red-600">{formatCedi(outstanding)} outstanding</span>
          )}
        </div>

        {installment.notes && (
          <p className="mt-1.5 text-[11px] font-medium italic text-slate-500">{installment.notes}</p>
        )}

        {!locked && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {installment.status === 'paid' || installment.status === 'waived' ? (
              <ActionButton
                onClick={() => onActed(plan._id, installment.installmentNumber, { action: 'mark_unpaid' })}
                disabled={busy}
                label="Reopen as unpaid"
              />
            ) : (
              <ActionButton
                primary
                onClick={() => onActed(plan._id, installment.installmentNumber, { action: 'mark_paid' })}
                disabled={busy}
                label="Mark paid at desk"
                icon={HandCoins}
              />
            )}

            {installment.status !== 'waived' && (
              <ActionButton
                onClick={() => onActed(plan._id, installment.installmentNumber, { action: 'waive' })}
                disabled={busy}
                label="Waive"
              />
            )}
          </div>
        )}
      </div>
    </li>
  );
};

const ActionButton = ({ primary, icon: Icon, label, onClick, disabled }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-extrabold transition-colors disabled:opacity-50 ${
      primary
        ? 'bg-brand-700 text-white hover:bg-brand-800'
        : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
    }`}
  >
    {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
    {label}
  </button>
);

const PlanScheduleDrawer = ({ plan, open, onClose, onChanged }) => {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  if (!plan) return null;

  const student = plan.student || {};
  const installments = [...(plan.installments || [])].sort(
    (a, b) => a.installmentNumber - b.installmentNumber
  );
  const paidCount = installments.filter(
    (installment) => installment.status === 'paid' || installment.status === 'waived'
  ).length;
  const cancellable = ['active', 'pending_acceptance'].includes(plan.planStatus);

  const act = async (planId, installmentNumber, payload) => {
    setBusy(true);
    try {
      const updated = await updateInstallment(planId, installmentNumber, payload);
      toast.success(
        payload.action === 'mark_paid'
          ? 'Tranche marked paid. No payment record was created — record it in Payments for the collections total.'
          : 'Tranche updated.'
      );
      onChanged(updated);
    } catch (error) {
      toast.error(error?.message || 'That tranche could not be updated.');
    } finally {
      setBusy(false);
    }
  };

  const confirmCancel = async () => {
    setCancelling(true);
    try {
      await cancelPaymentPlan(plan._id, cancelReason.trim());
      toast.success('Plan cancelled. The record stays readable for the family’s history.');
      setCancelling(false);
      setCancelReason('');
      onClose();
      onChanged(null);
    } catch (error) {
      toast.error(error?.message || 'The plan could not be cancelled.');
      setCancelling(false);
    }
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        size="lg"
        title={plan.planName}
        description={`${student.studentName || 'Student'} · ${student.studentClass || '—'} · ${student.studentId || ''}`}
        footer={
          <>
            {cancellable && (
              <Button
                variant="danger"
                onClick={() => setCancelling(true)}
                disabled={busy}
                className="mr-auto"
              >
                Cancel plan
              </Button>
            )}
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <Figure label="Plan total" value={formatCedi(plan.totalAmount)} icon={Wallet} />
          <Figure
            label="Outstanding"
            value={formatCedis(plan.outstandingAmount ?? plan.totalRemaining ?? 0)}
            icon={CircleDollarSign}
            tone={(plan.outstandingAmount ?? 0) > 0 ? 'text-red-600' : 'text-emerald-600'}
          />
          <Figure
            label="Tranches settled"
            value={`${formatCount(paidCount)} of ${formatCount(installments.length)}`}
            icon={CheckCircle2}
          />
        </div>

        {plan.adminNotes && (
          <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2.5 text-[12px] font-medium italic text-slate-600">
            {plan.adminNotes}
          </p>
        )}

        <p className="mt-5 mb-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
          Installment timeline
        </p>

        <ul>
          {installments.map((installment) => (
            <TrancheRow
              key={installment.installmentNumber}
              installment={installment}
              plan={plan}
              busy={busy}
              onActed={act}
            />
          ))}
        </ul>

        <p className="mt-4 flex items-start gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[11px] font-semibold leading-relaxed text-slate-600">
          <Send className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
          Marking a tranche paid settles it against the plan only. It does not create a
          payment, so the school&rsquo;s collections total is unchanged — record the money in
          Payments as well if it was taken at the desk.
        </p>
      </Modal>

      {/* Cancellation is a decision with a future, so it asks for the reason and
          says what the outcome is. A soft cancel is recoverable in principle and
          visible to the family in principle, which is why it is not a bare confirm. */}
      <Modal
        open={cancelling}
        onClose={() => setCancelling(false)}
        title="Cancel this payment plan?"
        description="The schedule stops. Payments already made are not affected."
        footer={
          <>
            <Button variant="secondary" onClick={() => setCancelling(false)}>
              Keep the plan
            </Button>
            <Button variant="danger" onClick={confirmCancel}>
              Cancel the plan
            </Button>
          </>
        }
      >
        <p className="mb-3 text-[13px] font-medium leading-relaxed text-slate-600">
          {student.studentName || 'This student'} will be told the plan has stopped by SMS. The
          record stays readable so the family can be told why their schedule ended.
        </p>

        <Field
          label="Reason (shared with the family)"
          value={cancelReason}
          onChange={(event) => setCancelReason(event.target.value)}
          placeholder="Parent requested a single payment instead"
        />
      </Modal>
    </>
  );
};

const Figure = ({ label, value, icon: Icon, tone = 'text-ink' }) => (
  <div className="rounded-xl bg-slate-50 p-3">
    <p className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </p>
    <p className={`mt-1 text-[15px] font-extrabold ${tone}`}>{value}</p>
  </div>
);

export default PlanScheduleDrawer;
