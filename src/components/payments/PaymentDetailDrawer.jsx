import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { ExternalLink, RotateCcw, X } from 'lucide-react';
import Button from '../common/Button';
import { PaymentChannelBadge, PaymentStatusBadge } from './PaymentBadges';
import { getPayment } from '../../services/payments';
import { resendPaymentSms } from '../../services/payments';
import { formatCedi } from '../../utils/format';
import { formatGhanaPhone } from '../../utils/ghanaPhone';
import { formatDateTime, paymentTimestamp } from '../../utils/dates';
import { ROUTES } from '../../utils/constants';

/** A label/value row. `mono` is for references, which are read aloud character by character. */
const Row = ({ label, value, mono = false }) => (
  <div className="flex items-start justify-between gap-4 border-b border-slate-50 py-2 last:border-b-0">
    <dt className="shrink-0 text-[11px] font-semibold text-slate-500">{label}</dt>
    <dd
      className={`min-w-0 break-words text-right text-[13px] font-bold text-ink ${
        mono ? 'font-mono text-[12px]' : ''
      }`}
    >
      {value || '—'}
    </dd>
  </div>
);

/**
 * One payment, in full.
 *
 * Loads through `GET /payments/:paymentId` rather than rendering the row it was
 * opened from. The list projection is deliberately thin — it omits
 * `moolreReference`, `feesBreakdown` and the provider reference — so a
 * drawer built from the row would either show blanks in exactly the fields a
 * bursar opens it to check, or would push those fields into every page of the
 * list to make them available.
 *
 * **The raw webhook payload is not loaded.** `includeWebhookData` carries the
 * provider callback, including the payer's handset number in the clear and
 * whatever else the gateway chose to send. It is on the endpoint for debugging a
 * specific failed payment, deliberately behind a flag, and this drawer does not
 * pass it.
 */
const PaymentDetailDrawer = ({ paymentId, onClose, onRefund }) => {
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!paymentId) return undefined;

    let active = true;
    setLoading(true);
    setError(null);

    getPayment(paymentId)
      .then((result) => {
        if (active) setPayment(result);
      })
      .catch((apiError) => {
        if (active) setError(apiError);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [paymentId]);

  useEffect(() => {
    if (!paymentId) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [paymentId, onClose]);

  if (!paymentId) return null;

  const student = payment?.studentId || {};
  const school = payment?.schoolId || {};
  const guardians = student.parents || [];
  const isRefund = Number(payment?.amount) < 0;

  return createPortal(
    <div className="fixed inset-0 z-[95] flex justify-end">
      <div
        className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Payment details"
        className="relative flex h-full w-full max-w-md flex-col bg-white shadow-soft"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
              Transaction
            </p>
            <h2 className="truncate text-base font-extrabold tracking-tight text-ink">
              {payment?.paymentId || paymentId}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close payment details"
            className="-mr-1 shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {loading && (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-10 animate-pulse rounded-lg bg-slate-100" />
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
              <p className="text-[13px] font-semibold text-red-700">{error.message}</p>
            </div>
          )}

          {!loading && !error && payment && (
            <div className="space-y-5">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
                  {isRefund ? 'Refunded' : 'Amount received'}
                </p>
                <p
                  className={`mt-1 text-2xl font-extrabold tracking-tight tabular-nums ${
                    isRefund ? 'text-red-600' : 'text-ink'
                  }`}
                >
                  {isRefund ? `−${formatCedi(Math.abs(payment.amount))}` : formatCedi(payment.amount)}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <PaymentStatusBadge status={payment.status} />
                  <PaymentChannelBadge
                    network={payment.momoNetwork}
                    paymentMethod={payment.paymentMethod}
                  />
                </div>
              </div>

              <section>
                <h3 className="mb-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  Payment
                </h3>
                <dl>
                  <Row label="Date" value={formatDateTime(paymentTimestamp(payment))} />
                  <Row label="Method" value={payment.paymentMethod} />
                  <Row label="Provider" value={payment.provider} />
                  <Row label="Network" value={payment.momoNetwork} />
                  <Row label="Transaction ref" value={payment.paymentId} mono />
                  <Row
                    label="Gateway reference"
                    value={payment.moolreReference || payment.moolreTransactionId}
                    mono
                  />
                  <Row label="Receipt" value={payment.receiptNumber} mono />
                  <Row label="Description" value={payment.description} />
                  {payment.failureReason && (
                    <Row label="Failure reason" value={payment.failureReason} />
                  )}
                  {payment.refundedAt && (
                    <Row label="Refunded on" value={formatDateTime(payment.refundedAt)} />
                  )}
                </dl>
              </section>

              <section>
                <h3 className="mb-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  Student
                </h3>
                <dl>
                  <Row label="Name" value={student.studentName} />
                  <Row label="Student ID" value={student.studentId} mono />
                  <Row label="Class" value={student.studentClass} />
                </dl>
                {guardians.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {guardians.map((guardian) => (
                      <li
                        key={`${guardian.parentName}-${guardian.phone}`}
                        className="flex items-center justify-between gap-3 text-[12px]"
                      >
                        <span className="font-semibold text-slate-600">
                          {guardian.parentName}
                          {guardian.isPrimary && (
                            <span className="ml-1.5 rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-extrabold text-brand-800">
                              Primary
                            </span>
                          )}
                        </span>
                        {/* Unmasked, unlike the roster. This drawer is opened by
                            one admin about one named student, and a bursar
                            confirming a payment by phone needs the real number. */}
                        <span className="font-semibold tabular-nums text-ink">
                          {formatGhanaPhone(guardian.phone)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {school.name && (
                <section>
                  <h3 className="mb-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                    School
                  </h3>
                  <dl>
                    <Row label="Name" value={school.name} />
                    <Row label="Code" value={school.schoolCode} mono />
                  </dl>
                </section>
              )}

              {/* The roster reads `?q=` as its search filter, so this links
                  straight to the student rather than opening a second drawer.
                  Navigating within the page would have to lift the roster's
                  drawer state out of `pages/dashboard/Students.jsx`, and a link
                  that the bursar can share with a colleague is worth more than
                  one that keeps the drawer open. */}
              {student.studentId && (
                <Link
                  to={`${ROUTES.DASHBOARD_STUDENTS}?q=${encodeURIComponent(student.studentId)}`}
                  className="inline-flex items-center gap-1.5 text-[13px] font-extrabold text-brand-700 transition-colors hover:text-brand-800"
                >
                  Open {student.studentName || 'this student'} on the roster
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              )}
            </div>
          )}
        </div>

{payment?.status === 'completed' && (
  <footer className="border-t border-slate-100 px-5 py-4 flex gap-2">
    <Button
      variant="secondary"
      className="flex-1"
      disabled={resending}
      onClick={async () => {
        setResending(true);
        try {
          await resendPaymentSms(payment._id || paymentId);
          alert('SMS resend attempted');
        } catch (e) {
          alert(e?.message || 'Failed');
        } finally {
          setResending(false);
        }
      }}
    >
      {resending ? 'Sending…' : 'Resend SMS'}
    </Button>
    {onRefund && (
      <Button
        variant="danger"
        className="flex-1"
        onClick={() => onRefund(payment)}
      >
        <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
        Refund
      </Button>
    )}
  </footer>
)}
      </aside>
    </div>,
    document.body
  );
};

export { Row as PaymentDetailRow };
export default PaymentDetailDrawer;