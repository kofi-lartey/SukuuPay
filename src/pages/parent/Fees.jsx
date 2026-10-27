import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Clock, Sparkles, Wallet } from 'lucide-react';
import { useParentPay } from '../../layouts/ParentLayout';
import { usePaymentPlan } from '../../hooks/parent/usePaymentPlan';
import { PARENT_ROUTES } from '../../utils/constants';
import { formatCedi, formatDate } from '../../utils/parentFormat';
import StudentRow from '../../components/parent/shared/StudentRow';
import SectionLabel from '../../components/parent/shared/SectionLabel';
import StatusPill from '../../components/parent/shared/StatusPill';
import PaymentModal from '../../components/parent/PaymentModal';
import ManualPaymentModal from '../../components/parent/ManualPaymentModal';
import Modal from '../../components/common/Modal';
import { SkeletonCard } from '../../components/parent/shared/Skeleton';

const BalanceHero = ({ student, onPay }) => {
  const owed = Number(student?.totalOwed) || 0;
  const paid = Number(student?.totalPaid) || 0;
  const balance = Number(student?.balance) || Math.max(owed - paid, 0);
  const pct = owed > 0 ? Math.min(100, Math.round((paid / owed) * 100)) : 0;
  const deadline = student?.deadline ? new Date(student.deadline) : null;
  const isOverdue = Boolean(student?.isOverdue) || (deadline && deadline < new Date());

  return (
    <div className="overflow-hidden rounded-2xl bg-[#0A5C36] p-5 text-white shadow-sm">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-emerald-200">
        Term fee balance
      </p>
      <p className="mt-2 text-[34px] font-extrabold leading-none tabular-nums">
        {formatCedi(balance)}
      </p>

      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/20">
        <div className="h-full rounded-full bg-white" style={{ width: `${pct}%` }} />
      </div>

      <div className="mt-3 flex items-center justify-between text-[12px] font-semibold text-emerald-100">
        <span>Paid {formatCedi(paid)}</span>
        <span>Owed {formatCedi(owed)}</span>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${
            isOverdue ? 'bg-red-100 text-red-800' : 'bg-[#F2B705] text-[#0A5C36]'
          }`}
        >
          <Clock className="h-3 w-3" aria-hidden="true" />
          {deadline
            ? isOverdue
              ? `Overdue by ${Math.floor((Date.now() - deadline) / 86400000)} days`
              : `Due ${formatDate(deadline)}`
            : 'No deadline set'}
        </span>
      </div>

      {balance > 0 ? (
        <button
          type="button"
          onClick={onPay}
          className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white text-[14px] font-extrabold text-[#0A5C36] transition-colors hover:bg-emerald-50"
        >
          <Wallet className="h-4 w-4" aria-hidden="true" />
          Pay Now
        </button>
      ) : (
        <p className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white/15 text-[14px] font-extrabold text-white">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          All paid — thank you
        </p>
      )}
    </div>
  );
};

const FeeBreakdown = ({ lines, total }) => (
  <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
    <SectionLabel className="mb-3">Fee breakdown</SectionLabel>
    <ul className="divide-y divide-slate-100">
      {lines.map((line, i) => (
        <li
          key={`${line.label || line.description}-${i}`}
          className="flex items-center justify-between py-2.5 text-[13.5px]"
        >
          <span className="min-w-0 truncate pr-3 font-semibold text-slate-700">
            {line.label || line.description}
          </span>
          <span className="shrink-0 font-extrabold tabular-nums text-ink">
            {formatCedi(line.amount)}
          </span>
        </li>
      ))}
    </ul>
    <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-3 text-[14px]">
      <span className="font-extrabold text-ink">Total</span>
      <span className="font-extrabold tabular-nums text-ink">{formatCedi(total)}</span>
    </div>
  </section>
);

const PlanCard = ({ token, plan, loading }) => {
  if (loading) return <SkeletonCard />;

  if (!plan || plan.planStatus === 'completed') {
    return (
      <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#F2B705]" aria-hidden="true" />
          <SectionLabel className="flex-1">Payment plan</SectionLabel>
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-slate-500">
          Can&rsquo;t pay the full amount today? Split the fees into smaller
          installments that fit your budget.
        </p>
        <Link
          to={PARENT_ROUTES.plan(token)}
          className="mt-3 inline-flex h-10 items-center gap-1.5 text-[13px] font-extrabold text-[#0A5C36] hover:underline"
        >
          Request a plan
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </section>
    );
  }

  const next = plan.installments?.find((i) => i.status !== 'paid');

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <SectionLabel>Active plan</SectionLabel>
        <StatusPill tone="green">On track</StatusPill>
      </div>
      <p className="mt-2 text-[14px] font-extrabold text-ink">
        {plan.numberOfInstallments}-month plan
      </p>
      {next ? (
        <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              Next payment
            </p>
            <p className="mt-0.5 text-[14px] font-extrabold text-ink">
              {formatCedi((next.amount || 0) - (next.amountPaid || 0))}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              Due
            </p>
            <p className="mt-0.5 text-[12.5px] font-bold text-slate-700">
              {formatDate(next.dueDate)}
            </p>
          </div>
        </div>
      ) : null}
      <Link
        to={PARENT_ROUTES.plan(token)}
        className="mt-3 inline-flex h-10 items-center gap-1.5 text-[13px] font-extrabold text-[#0A5C36] hover:underline"
      >
        View plan
        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </Link>
    </section>
  );
};

const RecentPayments = ({ token, payments, loading }) => {
  if (loading) return <SkeletonCard />;

  if (!payments?.length) {
    return (
      <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <SectionLabel className="mb-2">Recent payments</SectionLabel>
        <p className="text-[13px] italic text-slate-400">No payments recorded yet.</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <SectionLabel>Recent payments</SectionLabel>
        <Link
          to={PARENT_ROUTES.history(token)}
          className="text-[11.5px] font-extrabold text-[#0A5C36] hover:underline"
        >
          View all
        </Link>
      </div>
      <ul className="divide-y divide-slate-100">
        {payments.slice(0, 3).map((p) => (
          <li key={p.paymentId} className="flex items-center gap-3 py-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 className="h-4 w-4 text-emerald-700" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold tabular-nums text-ink">
                {formatCedi(p.amount)}
              </p>
              <p className="truncate text-[11px] text-slate-500">
                {formatDate(p.completedAt || p.createdAt)} ·{' '}
                {p.receiptNumber || p.paymentId}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
};

const Fees = () => {
  const { token, student, school, recentPayments, refresh } = useParentPay();
  const [paying, setPaying] = useState(false);
  const [manualPaying, setManualPaying] = useState(false);
  const feeLines = useMemo(() => student?.feesBreakdown || [], [student]);
  const total = feeLines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0);
  const balance = Number(student?.balance) || 0;

  const { data: plan, isLoading: planLoading } = usePaymentPlan(token);
  const activePlan = plan?.plan || plan;
  const isPlanActive = activePlan && activePlan.planStatus === 'active';
  const nextInstallment = isPlanActive
    ? (activePlan.installments || []).find((i) => i.status !== 'paid')
    : null;
  const installmentAmount = nextInstallment
    ? Math.max((nextInstallment.amount || 0) - (nextInstallment.amountPaid || 0), 0)
    : null;
  const paymentAmount = isPlanActive && installmentAmount ? installmentAmount : balance;
  const paymentLocked = Boolean(isPlanActive && installmentAmount);

  return (
    <div className="space-y-5">
      <StudentRow student={student} school={school} />
      <BalanceHero student={student} onPay={() => setPaying(true)} />

      {balance > 0 ? (
        <button
          type="button"
          onClick={() => setManualPaying(true)}
          className="w-full rounded-xl border border-slate-200 bg-white py-3 text-[13px] font-extrabold text-slate-700 hover:bg-slate-50"
        >
          Pay via Manual MoMo (reference code)
        </button>
      ) : null}

      {feeLines.length ? <FeeBreakdown lines={feeLines} total={total} /> : null}

      <PlanCard token={token} plan={plan?.plan || plan} loading={planLoading} />
      <RecentPayments token={token} payments={recentPayments} />

      {/*
        The MoMo prompt, reused from the portal's payment flow. It initiates
        through `services/parentPay` and polls the settlement itself; the page
        only hears about the outcome, which is when the balance the parent is
        looking at has to change — so `onSettled` refreshes the portal payload
        the whole layout is reading.
      */}
      <PaymentModal
        open={paying}
        onClose={() => setPaying(false)}
        token={token}
        student={student}
        balance={paymentAmount}
        initialAmount={paymentAmount}
        lockAmount={paymentLocked}
        feesBreakdown={feeLines}
        onSettled={() => refresh()}
      />

      <Modal open={manualPaying} onClose={() => setManualPaying(false)} title="Manual Mobile Money Payment">
        <ManualPaymentModal
          token={token}
          student={student}
              amount={paymentAmount}
          schoolPhone={school?.phone || school?.momoNumber || 'school MoMo number'}
          onClose={() => setManualPaying(false)}
        />
      </Modal>
    </div>
  );
};

export default Fees;
