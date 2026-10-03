import { Card, Pill, ProgressBar, PrimaryButton, Amount, SectionHeading } from './primitives';
import { installmentDuePhrase, formatDate } from '../../utils/parentFormat';

/**
 * The status of one installment, resolved to a word and a tone.
 *
 * **Settled comes from the arithmetic first.** The backend sends a `settled` flag
 * computed from `outstanding <= 0`, and this trusts it, because a tranche whose
 * `amountPaid` equals its `amount` is fully collected whatever its stored `status`
 * says. Deriving it from `status` alone rendered a collected tranche as amber and
 * late, and offered it again as "Pay next installment".
 *
 * `waived` is treated as settled. A tranche the school forgave is not owed, and
 * showing it as outstanding would put a figure on the page that the bursar has
 * already written off.
 */
const resolveStatus = (installment) => {
  const outstanding = installment.outstanding ?? 0;

  if (installment.status === 'waived') return { tone: 'green', label: 'Waived' };
  if (installment.status === 'paid' || installment.settled || outstanding <= 0) {
    return { tone: 'green', label: 'Paid' };
  }

  if (outstanding < installment.amount) {
    return { tone: 'amber', label: `Part paid — ${outstanding / 100} left` };
  }

  if (installment.isOverdue) {
    return { tone: 'red', label: installmentDuePhrase(installment.dueDate) || 'Overdue' };
  }

  const phrase = installmentDuePhrase(installment.dueDate);
  return {
    tone: installment.isNext ? 'amber' : 'slate',
    label: installment.isNext ? `Next · ${phrase || 'due now'}` : phrase || 'Not yet due',
  };
};

/** One tranche. Numbered, dated, with what is still owed on it. */
const InstallmentRow = ({ installment }) => {
  const status = resolveStatus(installment);
  const settled = status.tone === 'green';

  return (
    <li
      className={`flex items-center gap-3 px-4 py-3 ${
        installment.isNext ? 'bg-amber-50/70' : ''
      }`}
    >
      <span
        aria-hidden="true"
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-extrabold ${
          settled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
        }`}
      >
        {settled ? (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          installment.installmentNumber
        )}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-bold text-slate-900">
          {installment.installmentNumber === 1 ? '1st' : installment.installmentNumber === 2 ? '2nd' : installment.installmentNumber === 3 ? '3rd' : `${installment.installmentNumber}th`}{' '}
          payment
        </p>
        <p className="mt-0.5 text-[12px] text-slate-500">
          {formatDate(installment.dueDate)}
          {settled ? '' : ` · ${status.label}`}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <Amount pesewas={installment.amount} size="sm" className="block font-bold" />
        {settled ? (
          <span className="mt-1 block text-[11px] font-bold text-emerald-700">{status.label}</span>
        ) : installment.outstanding < installment.amount ? (
          <span className="mt-1 block text-[11px] font-semibold tabular-nums text-amber-700">
            {(installment.outstanding / 100).toLocaleString('en-GH', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{' '}
            GHS left
          </span>
        ) : null}
      </div>
    </li>
  );
};

/**
 * The active payment plan.
 *
 * Rendered whenever a plan exists in any live state, including `pending_acceptance`
 * — a parent who asked for a plan and is waiting must still see that they asked,
 * because the alternative is submitting the request again on a page that shows no
 * trace of it. A `pending_acceptance` plan says so in place of the pay button rather
 * than hiding the whole card, since the schedule is what the parent chose and they
 * should be able to check they chose it correctly.
 *
 * The "Pay next installment" button carries the amount inline. A parent who has
 * agreed to a schedule is trying to hit a specific figure, and making them tap
 * through to a form to be told what they already agreed to is a step with no
 * purpose. It opens the payment modal pre-filled with *that tranche's outstanding*,
 * not the whole balance — which is the one case where the obvious default of
 * "pre-fill with the balance" would be wrong.
 *
 * @param {(args: { amount: number, installmentNumber: number }) => void} onPayNext
 *   Supplied by the page, which owns the modal. Passed in rather than reached for
 *   through a global event bus: the button has one caller and one modal, and a
 *   `window` event would make that relationship invisible to both.
 */
const PlanSummaryCard = ({ plan, canPay = true, onPayNext }) => {
  if (!plan) return null;

  const pending = plan.planStatus === 'pending_acceptance';
  const completed = plan.planStatus === 'completed';
  const next = plan.nextInstallment;
  const paidCount = (plan.installments || []).filter((i) => (i.outstanding ?? 0) <= 0).length;

  return (
    <section aria-labelledby="plan-heading" className="mt-4">
      <SectionHeading
        action={
          pending ? (
            <Pill tone="amber">Awaiting school</Pill>
          ) : completed ? (
            <Pill tone="green">Complete</Pill>
          ) : (
            <span className="text-[12px] font-bold tabular-nums text-slate-500">
              {plan.progressPercent}% paid
            </span>
          )
        }
      >
        <span id="plan-heading">
          {pending ? 'Your plan request' : completed ? 'Completed plan' : 'Your payment plan'}
        </span>
      </SectionHeading>

      <Card className="overflow-hidden">
        {!completed ? (
          <div className="border-b border-slate-100 px-4 pb-4 pt-4">
            <ProgressBar
              paid={plan.totalPaid}
              owed={plan.totalAmount}
              tone={pending ? 'amber' : 'brand'}
            />
            <div className="mt-2.5 flex items-baseline justify-between gap-3 text-[12px] font-semibold text-slate-500">
              <span className="tabular-nums">
                {paidCount} of {plan.numberOfInstallments} paid
              </span>
              <span className="tabular-nums">
                <Amount
                  pesewas={plan.totalRemaining}
                  size="sm"
                  className="inline text-[12px] font-bold"
                />{' '}
                left
              </span>
            </div>
          </div>
        ) : null}

        <ul className="divide-y divide-slate-100">
          {(plan.installments || []).map((installment) => (
            <InstallmentRow key={installment.installmentNumber} installment={installment} />
          ))}
        </ul>

        {pending ? (
          <p className="border-t border-slate-100 bg-amber-50 px-4 py-3.5 text-[13px] leading-relaxed text-amber-900">
            Your request has been sent to the school. They will review it and you will get an SMS
            when it is approved. You do not need to do anything else.
          </p>
        ) : null}

        {!pending && !completed && next ? (
          canPay ? (
            <div className="border-t border-slate-100 p-3.5">
              <PrimaryButton
                full
                onClick={() =>
                  onPayNext?.({
                    amount: next.outstanding,
                    installmentNumber: next.installmentNumber,
                  })
                }
              >
                Pay next installment
              </PrimaryButton>
            </div>
          ) : (
            <p className="border-t border-slate-100 px-4 py-3.5 text-[13px] leading-relaxed text-slate-500">
              Payments are paused on this account. Please contact the school.
            </p>
          )
        ) : null}
      </Card>

      {!pending && !completed && next ? (
        <p className="mt-2 px-1 text-[12px] leading-relaxed text-slate-500">
          Next payment of{' '}
          <Amount pesewas={next.outstanding} size="sm" className="inline text-[12px]" /> is due{' '}
          <span className="font-semibold">{formatDate(next.dueDate)}</span>.
        </p>
      ) : null}
    </section>
  );
};

export default PlanSummaryCard;