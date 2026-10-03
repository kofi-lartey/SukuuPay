import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useParentPay } from '../../layouts/ParentLayout';
import StudentCard from '../../components/parent/StudentCard';
import BalanceCard from '../../components/parent/BalanceCard';
import PlanSummaryCard from '../../components/parent/PlanSummaryCard';
import { ReceiptList } from '../../components/parent/ReceiptCard';
import PaymentModal from '../../components/parent/PaymentModal';
import {
  Card,
  Pill,
  PrimaryButton,
  SectionHeading,
  Reassurance,
  Amount,
} from '../../components/parent/primitives';
import { PARENT_ROUTES } from '../../utils/constants';

/**
 * The page a parent lands on from an SMS.
 *
 * ## The order below is the argument
 *
 * School, then child, then what is owed, then the button, then the plan, then the
 * history, then how to reach a human. Each section exists to make the next one
 * safe: nothing asks for money before saying whose child it is and how much is owed,
 * and nothing offers a plan before the plain "pay now" has had its turn. A parent
 * with money in hand sees a button within one scroll of the figure that justifies it.
 *
 * ## The primary action is sticky
 *
 * Because on a 360×640 screen — which is the common case, not the edge case — the
 * figure and the button cannot both be comfortably visible at once, and a parent who
 * has scrolled to read the detail should not have to scroll back to act on it. The
 * bar is hidden only while there is nothing to pay, so it cannot sit there inviting
 * a tap that would fail.
 */
const ParentPayPortal = () => {
  const { token, student, school, plan, recentPayments, suspended, canPay, refresh } =
    useParentPay();

  const [payOpen, setPayOpen] = useState(false);
  const [initialAmount, setInitialAmount] = useState(undefined);

  /** Opens the sheet, optionally pre-set to a specific installment. */
  const openPayment = ({ amount } = {}) => {
    setInitialAmount(amount);
    setPayOpen(true);
  };

  const settled = !student || (student.balance ?? 0) <= 0;

  return (
    <>
      {/* ── School ── */}
      <header className="border-b border-slate-200/70 bg-white">
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-3.5">
          {school?.logo ? (
            <img
              src={school.logo}
              alt=""
              loading="lazy"
              decoding="async"
              width={40}
              height={40}
              className="h-10 w-10 shrink-0 rounded-full border border-slate-200 object-cover"
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[#0A5C36]"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 10l9-7 9 7M5 9v11a1 1 0 001 1h12a1 1 0 001-1V9" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M9 21v-6h6v6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          )}

          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-extrabold leading-tight text-slate-900">
              {school?.name || 'School'}
            </p>
            <p className="mt-0.5 text-[12px] text-slate-500">Pay school fees securely</p>
          </div>

          <Pill tone="brand" className="shrink-0">
            Powered by SukuuPay
          </Pill>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 pb-32 pt-4">
        <StudentCard student={student} suspended={suspended} />

        <div className="mt-3">
          <BalanceCard student={student} />
        </div>

        {/* ── Act ── */}
        {!settled && canPay ? (
          <div className="mt-4 space-y-2.5">
            <PrimaryButton full onClick={() => openPayment()}>
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <rect x="5" y="2" width="14" height="20" rx="2" />
                <path d="M11 18h2" strokeLinecap="round" />
              </svg>
              Pay now with Mobile Money
            </PrimaryButton>

            <div className="flex items-center justify-center gap-2 text-[12px] font-semibold text-slate-500">
              <span>MTN</span>
              <span aria-hidden="true" className="text-slate-300">
                &middot;
              </span>
              <span>Telecel</span>
              <span aria-hidden="true" className="text-slate-300">
                &middot;
              </span>
              <span>AirtelTigo</span>
            </div>

            {!plan ? (
              <>
                <Link
                  to={PARENT_ROUTES.requestPlan(token)}
                  className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border-2 border-[#0A5C36] bg-white px-5 text-[15px] font-bold text-[#0A5C36] transition-colors hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A5C36]"
                >
                  Request a payment plan
                </Link>
                <Reassurance className="px-1">
                  Cannot pay it all at once? Ask the school to split it. They will review it and
                  confirm by SMS.
                </Reassurance>
              </>
            ) : null}
          </div>
        ) : null}

        {!settled && !canPay ? (
          <Card className="mt-4 p-4">
            <p className="text-[14px] font-bold text-slate-900">Payments are paused</p>
            <p className="mt-1 text-[13px] leading-relaxed text-slate-500">
              This account is not active for payment right now. Please contact the school office.
            </p>
          </Card>
        ) : null}

        {/* ── Plan ── */}
        <PlanSummaryCard plan={plan} canPay={canPay && !settled} onPayNext={openPayment} />

        {/* ── History ── */}
        <section aria-labelledby="recent-heading" className="mt-6">
          <SectionHeading
            action={
              recentPayments.length ? (
                <Link
                  to={PARENT_ROUTES.history(token)}
                  className="min-h-[32px] text-[13px] font-bold text-[#0A5C36] underline underline-offset-2"
                >
                  View all
                </Link>
              ) : null
            }
          >
            <span id="recent-heading">Recent payments</span>
          </SectionHeading>

          <Card className="overflow-hidden">
            <ReceiptList payments={recentPayments} token={token} />
          </Card>
        </section>

        {/* ── Contact ── */}
        <section aria-labelledby="contact-heading" className="mt-6">
          <SectionHeading>
            <span id="contact-heading">Need help?</span>
          </SectionHeading>

          <Card className="p-4">
            <p className="text-[14px] leading-relaxed text-slate-600">
              {school?.name
                ? `Contact ${school.name} about this fee.`
                : 'Contact the school about this fee.'}
            </p>

            <div className="mt-3.5 grid gap-2.5 sm:grid-cols-2">
              {school?.phone ? (
                <>
                  <a
                    href={`tel:${school.phone}`}
                    className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-white text-[14px] font-bold text-slate-800 transition-colors hover:bg-slate-50"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1.9.4 1.8.7 2.6a2 2 0 01-.5 2.1L8.1 9.6a16 16 0 006 6l1.2-1.2a2 2 0 012.1-.5c.8.3 1.7.6 2.6.7a2 2 0 011.7 2z" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Call the school
                  </a>

                  {/* `wa.me` needs a bare international number, with no `+` and no
                      punctuation — the school may well have stored the number the way a
                      person types it. Stripped rather than passed through, because a
                      `+233...` in the path produces a link WhatsApp silently refuses. */}
                  <a
                    href={`https://wa.me/${String(school.phone).replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-white text-[14px] font-bold text-slate-800 transition-colors hover:bg-slate-50"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4 text-emerald-600" fill="currentColor" aria-hidden="true">
                      <path d="M17.5 14.4c-.3-.2-1.7-.9-2-1-.3-.1-.5-.2-.7.1-.2.3-.7 1-.9 1.2-.2.2-.3.2-.6.1a8 8 0 01-2.4-1.5 9 9 0 01-1.6-2c-.2-.3 0-.5.1-.6l.5-.6c.1-.2.2-.3.3-.5v-.5c0-.2-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.7-.7 2-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3zM12 2a10 10 0 00-8.6 15L2 22l5.2-1.4A10 10 0 1012 2z" />
                    </svg>
                    WhatsApp
                  </a>
                </>
              ) : null}
            </div>

            <Link
              to={PARENT_ROUTES.support(token)}
              className="mt-2.5 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-slate-100 text-[14px] font-bold text-slate-700 transition-colors hover:bg-slate-200"
            >
              Send a message about this fee
            </Link>
          </Card>
        </section>
      </main>

      {/* ── Sticky act ── */}
      {!settled && canPay && !payOpen ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur">
          <div className="mx-auto flex max-w-md items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                Remaining
              </p>
              <Amount pesewas={student.balance} size="md" className="block text-[#0A5C36]" />
            </div>
            <PrimaryButton onClick={() => openPayment()} className="shrink-0 px-6">
              Pay now
            </PrimaryButton>
          </div>
        </div>
      ) : null}

      <PaymentModal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        token={token}
        student={student}
        balance={student?.balance ?? 0}
        initialAmount={initialAmount}
        onSettled={refresh}
      />
    </>
  );
};

export default ParentPayPortal;