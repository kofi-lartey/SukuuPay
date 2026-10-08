import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  GraduationCap,
  Percent,
  Receipt,
  RotateCcw,
  ScrollText,
  TriangleAlert,
  Wallet,
} from 'lucide-react';
import PageHeader from '../../../components/dashboard/PageHeader';
import EmptyState from '../../../components/dashboard/EmptyState';
import Badge from '../../../components/dashboard/ui/Badge';
import Card from '../../../components/dashboard/ui/Card';
import { PaymentChannelBadge, PaymentStatusBadge } from '../../../components/payments/PaymentBadges';
import AdminRefundPaymentDialog from '../../../components/admin/RefundPaymentDialog';
import { useToast } from '../../../hooks/useToast';
import { getPayment, refundPayment } from '../../../services/admin';
import { ROUTES } from '../../../utils/constants';
import { formatCedi } from '../../../utils/format';
import { formatGhanaPhone } from '../../../utils/ghanaPhone';
import { formatDateTime } from '../../../utils/dates';

/**
 * One payment, on the platform, in full.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **Why the charged split and the recomputed markup are shown side by side.**
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * `GET /admin/payments/:id` returns both `feesBreakdown` — the split the parent
 * was actually charged, frozen at collection time — and the platform's *current*
 * recomputation of the same figure at the school's rate as it stands now. They are
 * two answers to "what did this cost, and what should it have cost", and they
 * differ **exactly when a school's markup rate changed after this payment was
 * taken**.
 *
 * That difference is the single most useful thing on this screen. A school that
 * looks at its ledger, works out what it should have collected, and finds a
 * mismatch against what was taken has three possible explanations: somebody typed
 * the wrong amount, a fee was missed, or the rate changed after the fact. Only the
 * third is invisible everywhere else in the product — the payment row stores the
 * charged split and nothing else, so the recomputation is the only place the
 * divergence can be seen. Showing only the charged split would make the school
 * right and the platform look wrong; showing only the recomputation would be the
 * worse lie, because it is a figure that was never charged to anybody.
 *
 * So both are rendered, each labelled with what it is, and the gap between them is
 * called out when there is one. Where they agree, the screen says so plainly rather
 * than leaving two numbers that happen to be identical.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **The refund is a new negative payment and does not touch this row.**
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * `components/admin/RefundPaymentDialog.jsx` is the adaptation of the school
 * console's dialog and it says all of this in its own confirmation wording; this
 * screen's job is to make the consequence visible in the data afterwards. The
 * button therefore only appears on a `completed` payment with a positive amount —
 * refunding a reversal would write a second reversal, and a payment that failed
 * never took money to give back.
 *
 * `refundableAmount` is read from the payload when the server supplies it, because
 * the refundable balance after a *partial* refund is smaller than the amount and
 * the client has no honest way to know it without tracking refunds itself.
 *
 * Every mutation returns `{ ok, error }` and does not throw, so a refusal leaves
 * the dialog open with the operator's amount and reason intact.
 */

/**
 * The two markups, read defensively.
 *
 * `feesBreakdown` is `[{ amount, description }]` in the receipt projection
 * (`payment.service.js:363`) and is the authoritative record of what was charged.
 * The *recomputed* figure is new with this endpoint and its key name is not fixed
 * by anything that exists yet, so the accepted spellings are listed here explicitly
 * rather than guessed at in three places: whoever builds `/admin/payments/:id`
 * should pick one, and this is the list they need to match. Absent means "not
 * supplied", which renders as an explicit gap rather than as a zero — a zero would
 * read as "the platform took nothing", which is a claim, not a gap.
 */
const readChargedSplit = (payment) => (Array.isArray(payment?.feesBreakdown) ? payment.feesBreakdown : []);

const readCurrentMarkup = (payment) => {
  const candidate =
    payment?.currentMarkup ??
    payment?.markupNow ??
    payment?.platformMarkup ??
    payment?.recomputedMarkup ??
    null;
  if (!candidate) return null;
  if (typeof candidate === 'number') return { amount: candidate, percent: null };
  const amount = candidate.amount ?? candidate.markupAmount ?? candidate.pesewas ?? null;
  const percent = candidate.percent ?? candidate.platformMarkupPercent ?? null;
  if (amount === null && percent === null) return null;
  return { amount, percent };
};

/** The platform's take inside a charged split, when the split names one. */
const readChargedMarkup = (split) => {
  const line = split.find(
    (item) => /markup|platform|fee|sukuu/i.test(String(item?.type || item?.label || item?.description || ''))
  );
  return line ?? null;
};

const sumAmounts = (lines) =>
  lines.reduce((total, line) => total + (Number(line?.amount) || 0), 0);

/** A label/value row. `mono` is for references, read aloud character by character. */
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

const PROVIDER_LABELS = {
  paystack: 'Paystack',
  hubtel: 'Hubtel',
  arke: 'Arke',
  mnotify: 'MNotify',
  manual: 'Recorded by hand',
  mtn: 'MTN direct',
};

const PaymentDetail = () => {
  const { paymentId } = useParams();
  const toast = useToast();

  const [reloadKey, setReloadKey] = useState(0);
  const [state, setState] = useState({ payment: null, loading: true, error: null });
  const [refundOpen, setRefundOpen] = useState(false);

  useEffect(() => {
    if (!paymentId) return undefined;
    let active = true;
    setState((current) => ({ ...current, loading: true, error: null }));
    getPayment(paymentId)
      .then((result) => active && setState({ payment: result, loading: false, error: null }))
      .catch((error) => active && setState({ payment: null, loading: false, error }));
    return () => {
      active = false;
    };
  }, [paymentId, reloadKey]);

  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

  /**
   * The refund, `{ ok, error }`.
   *
   * Takes `amount` in pesewas — `MoneyInput` inside the dialog is the only place
   * the client crosses that line, so nothing here divides by 100.
   */
  const confirmRefund = useCallback(
    async ({ amount, reason }) => {
      try {
        const data = await refundPayment(paymentId, { amount, reason });
        toast.success(
          `Reversal written for ${formatCedi(amount)}. The original payment is unchanged and the reversal now appears as its own row.`
        );
        setRefundOpen(false);
        refresh();
        return { ok: true, data };
      } catch (error) {
        return { ok: false, error: error.message || 'That payment could not be refunded.' };
      }
    },
    [paymentId, refresh, toast]
  );

  /**
   * The payment document.
   *
   * The endpoint may return the payment at the top level or wrapped alongside the
   * disbursement batch and ledger entries, and the service contract does not pin
   * it. `detail.payment || detail` accepts both, so the screen renders either way
   * and the shape is recorded in the build report rather than being a thing a
   * reader has to discover by breaking the page.
   */
  const detail = state.payment;
  const payment = detail?.payment || detail || null;

  const chargedSplit = useMemo(() => readChargedSplit(payment), [payment]);
  const currentMarkup = useMemo(() => readCurrentMarkup(payment), [payment]);
  const chargedMarkup = useMemo(() => readChargedMarkup(chargedSplit), [chargedSplit]);

  const chargedTotal = useMemo(() => sumAmounts(chargedSplit), [chargedSplit]);
  const chargedMarkupAmount = chargedMarkup
    ? Number(chargedMarkup.amount) || 0
    : null;
  const currentMarkupAmount = currentMarkup ? Number(currentMarkup.amount) || 0 : null;

  /**
   * The difference, and whether it is worth shouting about.
   *
   * `null` whenever either side is missing. `0` would be a claim that the two agree
   * exactly, which is a different statement from "we do not have both figures" and
   * would let a gap read as a clean reconciliation.
   */
  const markupDifference = useMemo(() => {
    if (chargedMarkupAmount === null || currentMarkupAmount === null) return null;
    return currentMarkupAmount - chargedMarkupAmount;
  }, [chargedMarkupAmount, currentMarkupAmount]);

  const batch = detail?.disbursementBatch || payment?.disbursementBatch || null;
  const ledgerEntries = detail?.ledgerEntries || payment?.ledgerEntries || [];

  const amount = Number(payment?.amount) || 0;
  const isReversal = amount < 0;
  const student = payment?.studentId || {};
  const school = payment?.schoolId || {};
  const guardians = Array.isArray(student.parents) ? student.parents : [];

  const refundable = payment?.refundableAmount ?? payment?.amount;
  const canRefund = payment?.status === 'completed' && amount > 0;

  if (!paymentId) {
    return (
      <EmptyState
        icon={Receipt}
        title="No payment was named"
        description="This page needs a payment id in the URL."
      />
    );
  }

  if (state.error) {
    return (
      <EmptyState
        icon={Receipt}
        title="This payment could not be loaded"
        description={state.error.message}
        action={
          <button
            type="button"
            onClick={refresh}
            className="rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800"
          >
            Try again
          </button>
        }
      />
    );
  }

  return (
    <>
      <Link
        to={ROUTES.ADMIN_PAYMENTS}
        className="mb-3 inline-flex items-center gap-1.5 text-[12px] font-extrabold text-brand-700 transition-colors hover:text-brand-800"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        All payments
      </Link>

      <PageHeader
        eyebrow="Platform console"
        title={payment?.paymentId || paymentId}
        description={
          payment
            ? `${school.name || 'Unknown school'} · ${student.studentName || 'unknown student'}${
                payment.receiptNumber ? ` · receipt ${payment.receiptNumber}` : ''
              }`
            : 'Loading this payment…'
        }
        actions={
          canRefund ? (
            <button
              type="button"
              onClick={() => setRefundOpen(true)}
              aria-label={`Refund ${payment?.paymentId || paymentId}`}
              className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-red-700"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Refund this payment
            </button>
          ) : null
        }
      />

      {state.loading && !payment ? (
        <div className="space-y-3">
          {[0, 1, 2].map((row) => (
            <div key={row} className="h-40 animate-pulse rounded-2xl bg-slate-200/70" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            {/* ── The amount, and what kind of row this is ── */}
            <Card padding="p-5" accent={!isReversal}>
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
                {isReversal ? 'Reversal — money returned' : 'Amount collected'}
              </p>
              <p
                className={`mt-1 text-3xl font-extrabold tracking-tight tabular-nums ${
                  isReversal ? 'text-red-600' : 'text-ink'
                }`}
              >
                {isReversal ? `−${formatCedi(Math.abs(amount))}` : formatCedi(amount)}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <PaymentStatusBadge status={payment?.status} />
                <PaymentChannelBadge
                  network={payment?.momoNetwork}
                  paymentMethod={payment?.paymentMethod}
                />
                {payment?.currency && payment.currency !== 'GHS' && (
                  <Badge tone="slate">{payment.currency}</Badge>
                )}
              </div>

              {isReversal && (
                <p className="mt-3 text-[11px] font-semibold leading-relaxed text-slate-500">
                  This row returned money. It is a separate `Payment` document with a negative
                  amount — the payment it reverses is still on the platform, unchanged, and a school
                  &rsquo;s retained total is the sum of both signs.
                </p>
              )}
            </Card>

            {/* ── Payment ── */}
            <Card>
              <h2 className="mb-2 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                Payment
              </h2>
              <dl>
                <Row label="Payment reference" value={payment?.paymentId} mono />
                <Row label="Receipt number" value={payment?.receiptNumber} mono />
                <Row
                  label="Hubtel transaction id"
                  value={payment?.hubtelTransactionId}
                  mono
                />
                <Row label="Hubtel order id" value={payment?.hubtelOrderId} mono />
                {/*
                  MTN payments carry `mtnReferenceId`, not a Hubtel id — which is
                  why every MTN payment reads as "unmatched" in the finance
                  reconciliation and why both sets of references are here rather than
                  than one column that is empty for half the platform's traffic.
                */}
                <Row label="MTN reference id" value={payment?.mtnReferenceId} mono />
                <Row
                  label="MTN financial transaction id"
                  value={payment?.mtnFinancialTransactionId}
                  mono
                />
                <Row label="Provider" value={PROVIDER_LABELS[payment?.provider] || payment?.provider} />
                <Row label="Network" value={payment?.momoNetwork} />
                <Row label="Method" value={payment?.paymentMethod} />
                <Row label="Payer number" value={payment?.momoPhoneNumber ? formatGhanaPhone(payment.momoPhoneNumber) : ''} />
                <Row label="Description" value={payment?.description} />
                <Row label="Invoice" value={payment?.invoiceNumber} mono />
                <Row label="Initiated" value={formatDateTime(payment?.initiatedAt)} />
                <Row label="Completed" value={formatDateTime(payment?.completedAt)} />
                {payment?.failedAt && <Row label="Failed" value={formatDateTime(payment.failedAt)} />}
                {payment?.refundedAt && (
                  <Row label="Marked refunded" value={formatDateTime(payment.refundedAt)} />
                )}
                {payment?.failureReason && <Row label="Failure reason" value={payment.failureReason} />}
                {payment?.hubtelResponseMessage && (
                  <Row label="Gateway message" value={payment.hubertelResponseMessage} />
                )}
              </dl>
            </Card>

            {/* ── Student and school ── */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <h2 className="mb-2 flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  <GraduationCap className="h-3.5 w-3.5" aria-hidden="true" />
                  Student
                </h2>
                <dl>
                  <Row label="Name" value={student.studentName} />
                  <Row label="Student id" value={student.studentId} mono />
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
                        {/*
                          Unmasked. This screen is opened by one operator about one
                          named payment, and confirming a Mobile Money collection by
                          phone needs the real number — the same reasoning
                          `PaymentDetailDrawer` states for the school console.
                        */}
                        <span className="font-semibold tabular-nums text-ink">
                          {formatGhanaPhone(guardian.phone)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {/*
                  Deliberately no "open the roster" link here, though the school
                  console's `PaymentDetailDrawer` has one. That link resolves
                  `${ROUTES.DASHBOARD_STUDENTS}?q=…` — the *school's* roster, and a
                  platform owner has `schoolId: null` by design, so `DashboardLayout`
                  mounts a school console around an admin with no school and the link
                  lands on a page that cannot render. A dead link on a console screen
                  reads as a bug in the console, and it is cheaper to omit it than to
                  make the platform owner impersonate a school to see a student.
                */}
              </Card>

              <Card>
                <h2 className="mb-2 flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
                  School
                </h2>
                <dl>
                  <Row label="Name" value={school.name} />
                  <Row label="Code" value={school.schoolCode} mono />
                  <Row label="Region" value={school.region} />
                </dl>
                {/*
                  Linked to the schools *list*, not to a school detail route.
                  `ADMIN_ROUTES.SCHOOL_DETAIL` exists in `constants.js` but a
                  coordinator may wire it under a different component, and a link
                  built by string-concatenating a *route pattern* (`/admin/schools/:schoolId`)
                  would resolve to a page that renders `NotFound` with no other
                  symptom. The list path is real today.
                */}
                <Link
                  to={ROUTES.ADMIN_SCHOOLS}
                  className="mt-3 inline-block text-[12px] font-extrabold text-brand-700 transition-colors hover:text-brand-800"
                >
                  See all schools →
                </Link>
              </Card>
            </div>

            {/* ── The two markups, side by side ── */}
            <Card>
              <h2 className="mb-1 flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                <Percent className="h-3.5 w-3.5" aria-hidden="true" />
                The split, then and now
              </h2>
              <p className="mb-3 text-[12px] font-semibold leading-relaxed text-slate-500">
                The charged split is what this parent actually paid, frozen at collection. The
                recomputed figure applies the school&rsquo;s <em>current</em> rate to the same amount.
                They differ exactly when the rate changed after this payment was taken — which is the
                only place that divergence is visible anywhere in the product.
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
                    Charged then
                  </p>
                  {chargedSplit.length > 0 ? (
                    <>
                      <ul className="mt-2 space-y-1.5">
                        {chargedSplit.map((line, index) => (
                          <li
                            // Fee lines carry no id and a split can legitimately hold two
                            // identically-named lines, so the index is the only stable key.
                            key={`${line?.description || line?.label || line?.type || 'item'}-${index}`}
                            className="flex items-center justify-between gap-3 text-[12px]"
                          >
                            <span className="font-semibold text-slate-600">
                              {line?.description || line?.label || line?.type || 'Fee item'}
                            </span>
                            {line?.amount !== undefined && (
                              <span className="font-extrabold tabular-nums text-ink">
                                {formatCedi(line.amount)}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                      <p className="mt-2 border-t border-slate-200 pt-2 text-[12px] font-extrabold text-slate-700">
                        Split total {formatCedi(chargedTotal)}
                        {chargedMarkup && chargedSplit.length === 1 && (
                          <span className="ml-1 font-semibold text-slate-500">
                            (this line)
                          </span>
                        )}
                      </p>
                      {chargedMarkupAmount !== null && (
                        <p className="mt-1 text-[11px] font-semibold text-slate-500">
                          Platform markup on that split: {formatCedi(chargedMarkupAmount)}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="mt-2 text-[12px] font-semibold leading-relaxed text-slate-500">
                      This payment carries no recorded breakdown. Nothing was itemised at collection,
                      so there is nothing to compare a recomputation against — which is itself the
                      answer to &ldquo;why does this payment not reconcile?&rdquo;
                    </p>
                  )}
                </div>

                <div
                  className={`rounded-xl border p-3 ${
                    markupDifference === null || markupDifference === 0
                      ? 'border-slate-100 bg-slate-50'
                      : 'border-amber-200 bg-amber-50'
                  }`}
                >
                  <p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
                    Recomputed now
                  </p>
                  {currentMarkupAmount === null ? (
                    <p className="mt-2 text-[12px] font-semibold leading-relaxed text-slate-500">
                      The platform did not return a recomputed markup for this payment. Nothing is
                      shown rather than a zero, because a zero would read as &ldquo;the platform took
                      nothing&rdquo; — a claim, not an absence.
                    </p>
                  ) : (
                    <>
                      <p className="mt-2 text-2xl font-extrabold tracking-tight tabular-nums text-ink">
                        {formatCedi(currentMarkupAmount)}
                      </p>
                      {currentMarkup.percent !== null && currentMarkup.percent !== undefined && (
                        <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
                          at the school&rsquo;s current {String(currentMarkup.percent)}%
                        </p>
                      )}
                    </>
                  )}

                  {markupDifference !== null && markupDifference !== 0 && (
                    <p className="mt-2 flex items-start gap-1.5 text-[11px] font-extrabold leading-relaxed text-amber-800">
                      <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span>
                        {formatCedi(Math.abs(markupDifference))}{' '}
                        {markupDifference > 0 ? 'more' : 'less'} than was charged. This school&rsquo;s
                        rate changed after the payment was taken — the payment itself is correct and
                        is not repriced.
                      </span>
                    </p>
                  )}
                  {markupDifference === 0 && (
                    <p className="mt-2 text-[11px] font-semibold leading-relaxed text-emerald-700">
                      Identical to the charged split. This school&rsquo;s rate has not changed since.
                    </p>
                  )}
                </div>
              </div>
            </Card>

            {/* ── Ledger ── */}
            <Card padding="p-0" className="overflow-hidden">
              <div className="border-b border-slate-100 px-5 py-4">
                <h2 className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  <ScrollText className="h-3.5 w-3.5" aria-hidden="true" />
                  Ledger entries
                </h2>
                <p className="mt-0.5 text-[12px] font-semibold text-slate-500">
                  What this payment wrote into the platform ledger. Every figure is an amount of money
                  and every line is additive.
                </p>
              </div>

              {ledgerEntries.length === 0 ? (
                <div className="px-5 py-6">
                  <p className="text-[13px] font-bold text-slate-600">No ledger entries</p>
                  <p className="mt-1 text-[12px] font-semibold leading-relaxed text-slate-500">
                    A payment on a school with a 0% markup writes no ledger lines at all — there is
                    nothing for the platform to record. That is expected, not a missing join.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[32rem] border-collapse text-left">
                    <caption className="sr-only">Ledger entries this payment produced</caption>
                    <thead>
                      <tr className="bg-slate-50/60">
                        {['Type', 'School', 'Amount', 'Status'].map((label, index) => (
                          <th
                            key={label}
                            scope="col"
                            className={`whitespace-nowrap px-5 py-2.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-400 ${
                              index === 2 ? 'text-right' : ''
                            }`}
                          >
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ledgerEntries.map((entry, index) => (
                        <tr key={entry._id || `${entry.type}-${index}`} className="border-t border-slate-50">
                          <td className="px-5 py-3 font-mono text-[12px] font-bold text-ink">
                            {entry.type}
                          </td>
                          <td className="px-5 py-3 text-[12px] font-semibold text-slate-600">
                            {entry.schoolName || entry.schoolId?.name || '—'}
                          </td>
                          <td className="whitespace-nowrap px-5 py-3 text-right text-[13px] font-extrabold tabular-nums text-ink">
                            {formatCedi(entry.amount)}
                          </td>
                          <td className="px-5 py-3">
                            <Badge tone={entry.status === 'settled' ? 'green' : 'amber'}>
                              {entry.status || 'pending'}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>

          <div className="space-y-4">
            {/* ── Disbursement ── */}
            <Card>
              <h2 className="mb-2 flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
                Disbursement
              </h2>
              {batch ? (
                <dl>
                  <Row label="Batch" value={batch.batchNumber || batch.reference || batch._id} mono />
                  <Row label="Status" value={batch.status} />
                  <Row
                    label="Batch amount"
                    value={batch.amount !== undefined ? formatCedi(batch.amount) : ''}
                  />
                  <Row label="Approved" value={batch.approvedAt ? formatDateTime(batch.approvedAt) : ''} />
                  <Row label="Processed" value={batch.processedAt ? formatDateTime(batch.processedAt) : ''} />
                  <Row label="Payout reference" value={batch.payoutReference} mono />
                </dl>
              ) : payment?.disbursementBatchId ? (
                <>
                  <p className="text-[13px] font-extrabold text-ink">Claimed by a payout batch</p>
                  <dl className="mt-1">
                    <Row label="Batch id" value={String(payment.disbursementBatchId)} mono />
                  </dl>
                  <p className="mt-2 text-[11px] font-semibold leading-relaxed text-slate-500">
                    The batch&apos;s number and status live on the finance screen; they are not on the
                    payment row, and guessing them here would let the two disagree.
                  </p>
                </>
              ) : (
                <p className="text-[12px] font-semibold leading-relaxed text-slate-500">
                  Not claimed by any payout batch. A school collects first; the money is swept to it
                  by a disbursement run afterwards, and that run is what stamps a batch onto its
                  payments.
                </p>
              )}
            </Card>

            {/* ── Refund ── */}
            <Card>
              <h2 className="mb-2 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                Refundable
              </h2>
              {canRefund ? (
                <>
                  <p className="text-2xl font-extrabold tracking-tight tabular-nums text-ink">
                    {formatCedi(refundable)}
                  </p>
                  <p className="mt-1 text-[12px] font-semibold leading-relaxed text-slate-500">
                    A refund writes a new payment with a negative amount and leaves this one exactly
                    as it is. Money is not transferred back to the parent here — the school does that
                    separately.
                  </p>
                  <button
                    type="button"
                    onClick={() => setRefundOpen(true)}
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-[13px] font-extrabold text-white shadow-lift transition-colors hover:bg-red-700"
                  >
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    Refund this payment
                  </button>
                </>
              ) : (
                <p className="text-[12px] font-semibold leading-relaxed text-slate-500">
                  {isReversal
                    ? 'This row is itself a reversal. Reversing it again would write a second reversal rather than undoing the first — a correction is a positive payment.'
                    : `Nothing to refund: this payment is ${payment?.status || 'not completed'}. Only a completed payment has taken money to give back.`}
                </p>
              )}
            </Card>

            {/* ── Audit ── */}
            <Card>
              <h2 className="mb-2 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                Recorded by
              </h2>
              <dl>
                <Row label="Created by" value={payment?.createdBy?.name || payment?.createdBy} mono />
                <Row label="Updated by" value={payment?.updatedBy?.name || payment?.updatedBy} mono />
                <Row label="Payment id" value={payment?._id} mono />
              </dl>
            </Card>
          </div>
        </div>
      )}

      <AdminRefundPaymentDialog
        open={refundOpen}
        payment={payment}
        refundableAmount={canRefund ? refundable : undefined}
        onClose={() => setRefundOpen(false)}
        onConfirm={confirmRefund}
      />
    </>
  );
};

export { readChargedSplit, readCurrentMarkup };
export default PaymentDetail;