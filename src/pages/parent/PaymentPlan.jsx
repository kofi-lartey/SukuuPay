import { useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useParentPay } from '../../layouts/ParentLayout';
import {
  usePaymentPlan,
  useRequestPaymentPlan,
  useCancelPaymentPlan,
} from '../../hooks/parent/usePaymentPlan';
import { formatCedi, formatDate } from '../../utils/parentFormat';
import StudentRow from '../../components/parent/shared/StudentRow';
import SectionLabel from '../../components/parent/shared/SectionLabel';
import StatusPill from '../../components/parent/shared/StatusPill';
import EmptyState from '../../components/parent/shared/EmptyState';
import ErrorBanner from '../../components/parent/shared/ErrorBanner';
import Modal from '../../components/common/Modal';
import { SkeletonCard } from '../../components/parent/shared/Skeleton';
import useToast from '../../hooks/useToast';

const InstallmentRow = ({ installment }) => {
  const tone =
    installment.status === 'paid'
      ? 'green'
      : installment.status === 'overdue'
        ? 'red'
        : installment.status === 'pending'
          ? 'amber'
          : 'slate';

  return (
    <li className="flex items-center justify-between border-b border-slate-100 py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="truncate text-[13px] font-bold text-ink">
          {installment.installmentNumber === 1
            ? '1st payment'
            : installment.installmentNumber === 2
              ? '2nd payment'
              : installment.installmentNumber === 3
                ? '3rd payment'
                : `${installment.installmentNumber}th payment`}
        </p>
        <p className="mt-0.5 text-[11.5px] text-slate-500">
          {formatCedi(installment.amount)}
          {installment.dueDate ? ` · due ${formatDate(installment.dueDate)}` : ''}
        </p>
      </div>
      <StatusPill tone={tone}>{installment.status}</StatusPill>
    </li>
  );
};

const PlanSummary = ({ token, plan, onCancel }) => {
  const paid = plan.totalPaid || 0;
  const total = plan.totalAmount || 0;
  const pct = total > 0 ? Math.round((paid / total) * 100) : 0;
  const remaining = Math.max(total - paid, 0);

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <SectionLabel>Active plan</SectionLabel>
          <StatusPill tone="green">{plan.planStatus}</StatusPill>
        </div>
        <p className="mt-2 text-[16px] font-extrabold text-ink">
          {plan.numberOfInstallments}-installment plan
        </p>

        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-[#0A5C36]"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-[11.5px] font-bold text-slate-500">
          <span>{pct}% paid</span>
          <span>{formatCedi(remaining)} remaining</span>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <SectionLabel className="mb-2">Installments</SectionLabel>
        <ul>
          {(plan.installments || []).map((i) => (
            <InstallmentRow key={i.installmentNumber} installment={i} />
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <SectionLabel className="mb-2">Actions</SectionLabel>
        <button
          type="button"
          onClick={onCancel}
          className="w-full rounded-xl border border-slate-200 py-3 text-[13.5px] font-extrabold text-slate-700 transition-colors hover:bg-slate-50"
        >
          Ask to cancel this plan
        </button>
      </div>
    </section>
  );
};

const RequestForm = ({ token, owed, onClose }) => {
  const toast = useToast();
  const request = useRequestPaymentPlan(token);

  const [count, setCount] = useState(3);
  const [interval, setIntervalValue] = useState('monthly');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  });

  const preview = useMemo(() => {
    const base = Math.floor(owed / count);
    const last = owed - base * (count - 1);
    return Array.from({ length: count }, (_, i) => ({
      number: i + 1,
      amount: i === count - 1 ? last : base,
    }));
  }, [owed, count]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await request.mutateAsync({
        numberOfInstallments: count,
        interval,
        startDate,
      });
      toast.success('Plan request sent to the school');
      onClose();
    } catch (err) {
      toast.error(err.message || 'Could not submit the request.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
          Total to cover
        </p>
        <p className="mt-1 text-[20px] font-extrabold tabular-nums text-ink">
          {formatCedi(owed)}
        </p>
      </div>

      <div>
        <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
          Number of installments
        </p>
        <div className="mt-2 flex gap-2">
          {[2, 3, 4, 6].map((n) => {
            const active = n === count;
            return (
              <button
                key={n}
                type="button"
                onClick={() => setCount(n)}
                className={`h-10 w-12 rounded-xl border text-[13.5px] font-extrabold transition-colors ${
                  active
                    ? 'border-[#0A5C36] bg-[#EAF7F0] text-[#0A5C36]'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                {n}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
          Interval
        </p>
        <select
          value={interval}
          onChange={(e) => setIntervalValue(e.target.value)}
          className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-[14px]"
        >
          <option value="weekly">Weekly</option>
          <option value="biweekly">Every two weeks</option>
          <option value="monthly">Monthly</option>
        </select>
      </div>

      <div>
        <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
          Start date
        </p>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-[14px]"
        />
      </div>

      <div className="rounded-xl bg-slate-50 p-3">
        <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
          Preview
        </p>
        <ul className="mt-2 space-y-1.5">
          {preview.map((p) => (
            <li key={p.number} className="flex justify-between text-[12.5px]">
              <span className="text-slate-600">Payment {p.number}</span>
              <span className="font-extrabold tabular-nums text-ink">
                {formatCedi(p.amount)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-slate-200 px-4 py-2.5 text-[13px] font-extrabold text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={request.isPending}
          className="rounded-xl bg-[#0A5C36] px-4 py-2.5 text-[13px] font-extrabold text-white hover:bg-[#084a2b] disabled:opacity-50"
        >
          {request.isPending ? 'Submitting…' : 'Submit request'}
        </button>
      </div>
    </form>
  );
};

const PaymentPlan = () => {
  const { token, student, school } = useParentPay();
  const [requesting, setRequesting] = useState(false);
  const toast = useToast();
  const { data, isLoading, error, refetch } = usePaymentPlan(token);
  const cancel = useCancelPaymentPlan(token);

  const handleCancel = async () => {
    try {
      await cancel.mutateAsync({ reason: 'Parent asked to cancel' });
      toast.success('Cancellation request sent to the school');
    } catch (err) {
      toast.error(err.message || 'Could not send the cancellation.');
    }
  };

  if (error) {
    return (
      <div className="space-y-4">
        <StudentRow student={student} school={school} />
        <ErrorBanner message={error.message} onRetry={refetch} />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <StudentRow student={student} school={school} />
        <SkeletonCard />
      </div>
    );
  }

  const plan = data?.plan;
  const owed = student?.balance || student?.totalOwed || 0;

  return (
    <div className="space-y-5">
      <StudentRow student={student} school={school} />

      {plan && (plan.planStatus === 'active' || plan.planStatus === 'pending_acceptance') ? (
        <PlanSummary token={token} plan={plan} onCancel={handleCancel} />
      ) : (
        <>
          <EmptyState
            icon={Sparkles}
            title="No active payment plan"
            description="Can't pay the full amount today? Set up a plan to split your child's fees into smaller payments."
          />
          <button
            type="button"
            onClick={() => setRequesting(true)}
            className="h-11 w-full rounded-xl bg-[#0A5C36] text-[13.5px] font-extrabold text-white transition-colors hover:bg-[#084a2b]"
          >
            Request a payment plan
          </button>
        </>
      )}

      <Modal
        open={requesting}
        onClose={() => setRequesting(false)}
        title="Request a payment plan"
      >
        <RequestForm token={token} owed={owed} onClose={() => setRequesting(false)} />
      </Modal>
    </div>
  );
};

export default PaymentPlan;
