import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCheck,
  Receipt,
  RotateCcw,
  ScrollText,
  ShieldAlert,
} from 'lucide-react';
import PageHeader from '../../../components/dashboard/PageHeader';
import EmptyState from '../../../components/dashboard/EmptyState';
import Card from '../../../components/dashboard/ui/Card';
import Badge from '../../../components/dashboard/ui/Badge';
import ApproveBatchModal from '../../../components/admin/finance/ApproveBatchModal';
import RetryBatchModal from '../../../components/admin/finance/RetryBatchModal';
import {
  DISBURSEMENT_LABEL,
  DISBURSEMENT_TONE,
  LEDGER_LABEL,
  LEDGER_TONE,
  canApprove,
  canRetry,
  periodLabel,
} from '../../../components/admin/finance/financeVocabulary';
import { useToast } from '../../../hooks/useToast';
import {
  approveDisbursement,
  getDisbursement,
  retryDisbursement,
} from '../../../services/finance';
import { ADMIN_ROUTES } from '../../../utils/constants';
import { formatCedi, formatCount, formatPercent } from '../../../utils/format';
import { formatDateTime } from '../../../utils/dates';

/**
 * `/admin/finance/disbursements/:batchId` — one payout, in full.
 *
 * ### The breakdown is stored, not recomputed, and that is the point of the screen
 *
 * `grossAmount`, `platformAmount`, `netAmount` and the `breakdown` block are frozen
 * at build time alongside the exact `paymentIds` that produced them
 * (`DisbursementBatch.js:16-24`). This screen renders the stored values and the
 * **rates that applied at approval** rather than re-deriving anything from the
 * payments.
 *
 * The reason is stated in the model and it is worth repeating here, because this
 * screen is the one place a future reader will be tempted to "fix" it:
 *
 *   - **Re-deriving is wrong the moment a payment is refunded.** The payout did not
 *     change; the ledger was corrected. A recomputed figure would move when a
 *     refund happened months later, and the batch would stop describing the
 *     transfer that actually happened.
 *   - **The rate is the only explanation of the figure.** If a school's markup
 *     changes from 5% to 8% next month, re-deriving this March's batch would
 *     produce a *different* platform amount for the same March payments. The stored
 *     rate is the only thing that makes GH₵ 1,204 of markup on GH₵ 24,080 of gross
 *     intelligible.
 *
 * So the rates are shown beside the money as first-class fields, not as a footnote.
 * A school disputing the platform's cut is answered with the rate that was applied
 * to *its* payments, and this is the screen that has it.
 *
 * ### One gap on this screen, stated rather than papered over
 *
 * `getDisbursementBatch` returns `{ ...batch, breakdown }` — the composed
 * `breakdown` **shadows** the stored one, and the composed object carries the two
 * *rates* but not `platformFeeAmount`. So the platform fee's *amount* is not
 * reachable through this endpoint. It is always `0` today anyway — `buildDisbursementBatch`
 * writes it as a literal zero because the fee is never deducted from a per-payment
 * batch (`disbursements.service.js:575-580`) — so no figure is lost today. The card
 * below therefore states the rate and what the charge is, rather than rendering a
 * number the response does not contain.
 *
 * ### `ledgerSettled` is the check this screen exists to make possible
 *
 * A batch whose `netAmount` disagrees with the sum of its own payments, or whose
 * ledger lines are still unsettled while the batch says `paid`, is a real and
 * recoverable defect. All four figures are returned in one payload
 * deliberately — "the four questions are asked together, and answering them from
 * three round trips lets the three answers drift"
 * (`disbursements.service.js:918-926`) — so they can be compared on one screen.
 *
 * ### Approve and Retry here too, under the same rules as the list
 *
 * `canApprove` / `canRetry`, the same helpers, the same dialogs. A detail screen
 * with its own looser rules is how a `paid` batch acquires a Retry button.
 */
const DisbursementDetail = () => {
  const { batchId } = useParams();
  const toast = useToast();
  const [reloadKey, setReloadKey] = useState(0);
  const [approveOpen, setApproveOpen] = useState(false);
  const [retryOpen, setRetryOpen] = useState(false);
  const [state, setState] = useState({ data: null, loading: true, error: null });

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: null }));

    getDisbursement(batchId)
      .then((data) => active && setState({ data, loading: false, error: null }))
      .catch((error) => active && setState({ data: null, loading: false, error }));

    return () => {
      active = false;
    };
  }, [batchId, reloadKey]);

  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

  /**
   * `{ ok, error }`, never a throw.
   *
   * The movement wording comes from the returned `payoutReference`. `services/finance.js`
   * returns `data.data`, which drops the response's `meta.payoutProviderWired` — the
   * field that says whether a transfer was attempted is not on the client. The
   * reference is the better signal regardless: the server writes it only from a
   * provider's own transfer id, so its absence is positive evidence that nothing
   * moved, and it is the same field the detail screen renders below.
   */
  const confirmApprove = useCallback(
    async (batches) => {
      const batch = batches[0];
      try {
        const updated = await approveDisbursement(batch._id);
        toast[updated?.payoutReference ? 'success' : 'warning'](
          updated?.payoutReference
            ? `${batch.batchNumber} paid out (${updated.payoutReference}).`
            : `${batch.batchNumber} approved — no payout provider is wired, so the money has not moved. It stays held until one is.`
        );
        refresh();
        return { ok: true };
      } catch (error) {
        return { ok: false, error: error.message || 'This batch could not be approved.' };
      }
    },
    [refresh, toast]
  );

  const confirmRetry = useCallback(
    async (batch) => {
      try {
        const updated = await retryDisbursement(batch._id);
        toast[updated?.payoutReference ? 'success' : 'warning'](
          updated?.payoutReference
            ? `${batch.batchNumber} paid out on retry (${updated.payoutReference}).`
            : `${batch.batchNumber} retried, but no payout provider is wired — the money has not moved.`
        );
        refresh();
        return { ok: true };
      } catch (error) {
        return { ok: false, error: error.message || 'This payout could not be retried.' };
      }
    },
    [refresh, toast]
  );

  const batch = state.data;
  // The composed `breakdown` the detail endpoint returns. It carries the gross /
  // platform / net trio, **both rates**, the payment count, the ledger-entry count
  // and `ledgerSettled` — which is everything this screen needs to explain the
  // figure.
  const breakdown = batch?.breakdown || {};
  const payments = Array.isArray(batch?.payments) ? batch.payments : [];
  const ledgerEntries = Array.isArray(batch?.ledgerEntries) ? batch.ledgerEntries : [];

  /*
   * The payments' own sum, next to the batch's stored net.
   *
   * Deliberately computed here and shown as a comparison rather than as the figure
   * — the stored value is authoritative (see the header), and the point of the
   * comparison is that a disagreement is *visible*. A refund taken after the batch
   * was built will make the two differ legitimately, which is why the line under it
   * says that rather than leaving the operator to decide which one is wrong.
   */
  const paymentsTotal = payments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);

  return (
    <>
      <Link
        to={ADMIN_ROUTES.DISBURSEMENTS}
        className="mb-4 inline-flex items-center gap-1.5 rounded-lg px-1 py-1 text-[12px] font-extrabold text-slate-600 transition-colors hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        All disbursements
      </Link>

      <PageHeader
        eyebrow="Platform console"
        title={batch?.batchNumber || 'Disbursement'}
        description={
          batch
            ? `${batch.schoolName || 'Unknown school'} · ${periodLabel(
                batch.periodStart,
                batch.periodEnd
              )}`
            : 'One payout batch, its payments, and the ledger entries it produced.'
        }
        actions={
          <>
            {batch && canApprove(batch.status) && (
              <button
                type="button"
                onClick={() => setApproveOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-3.5 py-2 text-[13px] font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
              >
                <CheckCheck className="h-4 w-4" aria-hidden="true" />
                Approve
              </button>
            )}
            {batch && canRetry(batch.status) && (
              <button
                type="button"
                onClick={() => setRetryOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[13px] font-extrabold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Retry payout
              </button>
            )}
            <button
              type="button"
              onClick={refresh}
              disabled={state.loading}
              aria-label="Refresh this batch"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[13px] font-extrabold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
            >
              <RotateCcw
                className={`h-4 w-4 ${state.loading ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              Refresh
            </button>
          </>
        }
      />

      {state.error ? (
        <EmptyState
          icon={RotateCcw}
          title="This batch could not be loaded"
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
      ) : state.loading && !batch ? (
        <div className="space-y-3">
          <div className="h-32 animate-pulse rounded-2xl bg-slate-200/70" />
          <div className="h-48 animate-pulse rounded-2xl bg-slate-200/70" />
        </div>
      ) : batch ? (
        <>
          {/* ── Status and outcome ── */}
          <Card padding="p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                  Status
                </p>
                <p className="mt-1.5">
                  <Badge tone={DISBURSEMENT_TONE(batch.status)} dot>
                    {DISBURSEMENT_LABEL(batch.status)}
                  </Badge>
                </p>
              </div>
              <dl className="grid flex-1 grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
                <div>
                  <dt className="text-[11px] font-semibold text-slate-500">Approved</dt>
                  <dd className="text-[12px] font-bold text-ink">
                    {batch.approvedAt ? formatDateTime(batch.approvedAt) : 'Not yet'}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold text-slate-500">Approved by</dt>
                  <dd className="text-[12px] font-bold text-ink">
                    {batch.approvedByName ||
                      (batch.status === 'pending_approval'
                        ? '—'
                        : 'Auto-approve setting')}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold text-slate-500">Processed</dt>
                  <dd className="text-[12px] font-bold text-ink">
                    {batch.processedAt ? formatDateTime(batch.processedAt) : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold text-slate-500">Attempts</dt>
                  <dd className="text-[12px] font-bold text-ink" title="Attempts, not transfers sent.">
                    {formatCount(batch.attempts)}
                  </dd>
                </div>
              </dl>
            </div>

            {/*
              The payout reference, and its absence.

              A `payoutReference` is the provider's own transfer id — the only proof
              the money went where it was supposed to, and the reason the server
              never fabricates a `paid`. So it is the most important field on the
              screen when present, and its **absence on a settled batch is a defect
              worth acting on**, not a formatting gap. So the empty branch says that
              rather than showing a dash.
            */}
            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                Payout reference
              </p>
              {batch.payoutReference ? (
                <p className="mt-1 font-mono text-[14px] font-extrabold text-ink">
                  {batch.payoutReference}
                </p>
              ) : (
                <p className="mt-1 text-[12px] font-semibold leading-relaxed text-amber-800">
                  No payout reference. Nothing has been sent to the provider — either no provider is
                  wired (the current state of this platform) or the transfer has not been attempted.
                  The money is still counted as held.
                </p>
              )}
            </div>

            {batch.failureReason && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3">
                <p className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-red-700">
                  <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                  Failure reason, verbatim
                </p>
                <p className="mt-1.5 whitespace-pre-line text-[12px] font-semibold leading-relaxed text-red-800">
                  {batch.failureReason}
                </p>
                {batch.failedAt ? (
                  <p className="mt-1.5 text-[11px] font-semibold text-red-700">
                    Failed {formatDateTime(batch.failedAt)}
                  </p>
                ) : null}
              </div>
            )}
          </Card>

          {/* ── The stored split, and the rates that explain it ── */}
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card padding="p-5" className="lg:col-span-2">
              <h2 className="text-[13px] font-extrabold leading-tight text-ink">
                The split, as stored at approval
              </h2>
              <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
                Frozen when the batch was built. Not re-derived from the payments — see the note
                below the figures.
              </p>

              <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-xl bg-slate-50 px-3.5 py-3">
                  <dt className="text-[11px] font-semibold text-slate-500">Gross collected</dt>
                  <dd className="mt-1 text-[20px] font-extrabold leading-none tracking-tight tabular-nums text-ink">
                    {formatCedi(breakdown.grossAmount)}
                  </dd>
                </div>
                <div className="rounded-xl bg-brand-50 px-3.5 py-3">
                  <dt className="text-[11px] font-semibold text-brand-800">
                    Platform keeps ({formatPercent(Number(breakdown.markupPercent) || 0)} markup)
                  </dt>
                  <dd className="mt-1 text-[20px] font-extrabold leading-none tracking-tight tabular-nums text-brand-700">
                    {formatCedi(breakdown.platformAmount)}
                  </dd>
                </div>
                <div className="rounded-xl bg-slate-50 px-3.5 py-3">
                  <dt className="text-[11px] font-semibold text-slate-500">School receives</dt>
                  <dd className="mt-1 text-[20px] font-extrabold leading-none tracking-tight tabular-nums text-ink">
                    {formatCedi(breakdown.netAmount)}
                  </dd>
                </div>
              </dl>

              {/*
                The rates, as fields rather than as a footnote.

                `markupPercent` is the per-payment skim and it is the one that
                produced the platform figure above. `platformFeePercent` is Mode B's
                monthly subscription rate: **recorded on the batch and deliberately
                not deducted from it**, because it is a separate monthly charge and
                deducting it here would make one school's gateway choice change its
                per-payment rate — the exact conflation the two fields exist to
                prevent.
              */}
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 px-3.5 py-3">
                  <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                    Markup rate applied
                  </p>
                  <p className="mt-1 text-[18px] font-extrabold tabular-nums text-ink">
                    {formatPercent(Number(breakdown.markupPercent) || 0)}
                  </p>
                  <p className="mt-1 text-[11px] font-semibold leading-relaxed text-slate-500">
                    {formatCedi(breakdown.platformAmount)} taken across{' '}
                    {formatCount(breakdown.paymentCount)} payment
                    {Number(breakdown.paymentCount) === 1 ? '' : 's'}. Rounded per payment and
                    summed, so the batch total equals the sum of its own ledger lines rather than a
                    figure the ledger cannot produce.
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 px-3.5 py-3">
                  <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                    Platform fee rate (Mode B)
                  </p>
                  <p className="mt-1 text-[18px] font-extrabold tabular-nums text-ink">
                    {formatPercent(Number(breakdown.platformFeePercent) || 0)}
                  </p>
                  <p className="mt-1 text-[11px] font-semibold leading-relaxed text-slate-500">
                    Recorded on the batch and <strong>not deducted from it</strong> — nothing was
                    taken here at this rate. It is a monthly subscription charge, taken as its own{' '}
                    <code className="font-mono">platform_fee</code> ledger entry by billing rather
                    than as a per-payment skim. This response carries the rate but not the stored
                    fee amount, so none is shown.
                  </p>
                </div>
              </div>

              <p className="mt-4 text-[11px] font-semibold leading-relaxed text-slate-400">
                These figures are stored rather than recalculated, because recalculating them would
                be wrong twice over: a payment refunded after the batch was built would move the
                number even though the payout did not change, and a markup rate that has since been
                changed would produce a different platform amount for the same March payments. The
                rate above is the only thing that explains the figure.
              </p>
            </Card>

            {/*
              The settlement check.

              `ledgerSettled` is the composed field that answers "did the money
              actually leave, or does the ledger still think it is accruing?" — and
              the combination that matters is `paid` with unsettled ledger lines, which
              is a real defect rather than a display problem. Called out explicitly
              because the alternative — leaving it to a reader comparing two columns
              — is how it stays unnoticed.
            */}
            <Card padding="p-5">
              <h2 className="text-[13px] font-extrabold leading-tight text-ink">
                Ledger settlement
              </h2>
              <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
                Whether the revenue this batch took has been swept out of the float
              </p>

              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[12px] font-semibold text-slate-600">Ledger entries</span>
                  <span className="text-[13px] font-extrabold tabular-nums text-ink">
                    {formatCount(breakdown.ledgerEntries)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[12px] font-semibold text-slate-600">
                    All marked settled
                  </span>
                  <span>
                    {breakdown.ledgerSettled ? (
                      <Badge tone="green">Yes</Badge>
                    ) : (
                      <Badge tone="amber">No</Badge>
                    )}
                  </span>
                </div>
              </div>

              {batch.status === 'paid' && breakdown.ledgerSettled === false ? (
                <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[11px] font-semibold leading-relaxed text-red-800">
                  This batch is marked <strong>paid</strong> but its ledger entries are not
                  settled. That combination means the revenue is being counted as both held and
                  paid. It needs a person to look at it.
                </p>
              ) : (
                <p className="mt-4 text-[11px] font-semibold leading-relaxed text-slate-400">
                  Until these entries are settled, this revenue is <strong>accrued</strong> — taken
                  from parents and counted as earned, but not yet in an account.
                </p>
              )}
            </Card>
          </div>

          {/* ── The payments ── */}
          <div className="mt-4">
            <Card padding="p-0" className="overflow-hidden">
              <div className="px-5 py-4">
                <h2 className="text-[13px] font-extrabold leading-tight text-ink">
                  Parent payments in this batch
                </h2>
                <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
                  {formatCount(payments.length)} resolved · frozen into the batch at build time.
                </p>
              </div>

              {payments.length === 0 ? (
                <div className="px-5 pb-5">
                  <EmptyState
                    icon={Receipt}
                    title="No payments resolved"
                    description="The batch lists payment ids, but none of them resolved to a payment document. That is a defect worth reporting — it means the batch references records that no longer exist."
                  />
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[46rem] border-collapse text-left">
                      <caption className="sr-only">Payments included in this batch</caption>
                      <thead>
                        <tr className="border-y border-slate-100 bg-slate-50/60">
                          <th scope="col" className="px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                            Receipt
                          </th>
                          <th scope="col" className="px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                            Student
                          </th>
                          <th scope="col" className="px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                            Rail
                          </th>
                          <th scope="col" className="px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                            Taken
                          </th>
                          <th scope="col" className="px-5 py-3 text-right text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                            Amount
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {payments.map((payment) => (
                          <tr key={payment.id} className="border-b border-slate-50 last:border-0">
                            <td className="px-5 py-3 font-mono text-[11px] font-bold text-slate-600">
                              {payment.receiptNumber || String(payment.id).slice(-8)}
                            </td>
                            <td className="px-5 py-3 text-[13px] font-semibold text-ink">
                              {payment.student?.studentName || '—'}
                              {payment.student?.studentClass ? (
                                <span className="block text-[11px] font-semibold text-slate-400">
                                  {payment.student.studentClass}
                                </span>
                              ) : null}
                            </td>
                            <td className="px-5 py-3 text-[12px] font-semibold text-slate-600">
                              {payment.provider || '—'}
                            </td>
                            <td className="whitespace-nowrap px-5 py-3 text-[12px] font-semibold text-slate-600">
                              {formatDateTime(payment.createdAt)}
                            </td>
                            <td className="whitespace-nowrap px-5 py-3 text-right text-[13px] font-bold tabular-nums text-ink">
                              {formatCedi(payment.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <p className="border-t border-slate-100 px-5 py-3 text-[11px] font-semibold leading-relaxed text-slate-400">
                    These {formatCount(payments.length)} payments sum to{' '}
                    <span className="font-extrabold text-ink">{formatCedi(paymentsTotal)}</span>. The
                    batch&rsquo;s stored gross is{' '}
                    <span className="font-extrabold text-ink">
                      {formatCedi(breakdown.grossAmount)}
                    </span>
                    . A difference is not automatically a bug — a refund taken after the batch was
                    built will move the payments&rsquo; total without the payout having changed, which
                    is exactly why the batch stores its figures instead of recomputing them.
                  </p>
                </>
              )}
            </Card>
          </div>

          {/* ── The ledger entries ── */}
          <div className="mt-4">
            <Card padding="p-0" className="overflow-hidden">
              <div className="px-5 py-4">
                <h2 className="text-[13px] font-extrabold leading-tight text-ink">
                  Platform ledger entries
                </h2>
                <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
                  One markup line per payment — the record the platform&rsquo;s revenue is rebuilt
                  from, and what settles when this batch is paid.
                </p>
              </div>

              {ledgerEntries.length === 0 ? (
                <div className="px-5 pb-5">
                  <EmptyState
                    icon={ScrollText}
                    title="This batch wrote no ledger entries"
                    description="Expected for a school on a 0% markup: PlatformLedger rejects a zero amount, so there is no revenue line to write. The batch is real and the payout is real; the platform simply took nothing from it."
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[46rem] border-collapse text-left">
                    <caption className="sr-only">
                      Ledger entries this batch produced, one per parent payment
                    </caption>
                    <thead>
                      <tr className="border-y border-slate-100 bg-slate-50/60">
                        <th scope="col" className="px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                          Written
                        </th>
                        <th scope="col" className="px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                          Type
                        </th>
                        <th scope="col" className="px-5 py-3 text-right text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                          Amount
                        </th>
                        <th scope="col" className="px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                          Settled
                        </th>
                        <th scope="col" className="px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                          Reference
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {ledgerEntries.map((entry) => (
                        <tr
                          key={entry._id}
                          className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60"
                        >
                          <td className="whitespace-nowrap px-5 py-3 text-[12px] font-semibold text-slate-600">
                            {formatDateTime(entry.createdAt)}
                          </td>
                          <td className="px-5 py-3">
                            <Badge tone={LEDGER_TONE(entry.type)}>{LEDGER_LABEL(entry.type)}</Badge>
                          </td>
                          <td className="whitespace-nowrap px-5 py-3 text-right text-[13px] font-extrabold tabular-nums text-brand-700">
                            {formatCedi(entry.amount)}
                          </td>
                          <td className="px-5 py-3">
                            <Badge tone={entry.settled ? 'green' : 'amber'}>
                              {entry.settled ? 'Settled' : 'Unsettled'}
                            </Badge>
                          </td>
                          <td className="px-5 py-3 font-mono text-[11px] font-bold text-slate-500">
                            {entry.reference || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>

          <p className="mt-4 text-[11px] font-semibold text-slate-400">
            Every figure on this page is in the batch itself — the whole platform ledger for it is{' '}
            <Link
              to={`${ADMIN_ROUTES.LEDGER}?schoolId=${batch.schoolId?._id || batch.schoolId}`}
              className="font-extrabold text-brand-700 underline-offset-2 hover:underline"
            >
              one click away
            </Link>
            .
          </p>
        </>
      ) : null}

      <ApproveBatchModal
        open={approveOpen}
        batches={batch ? [batch] : []}
        onClose={() => setApproveOpen(false)}
        onConfirm={confirmApprove}
      />

      <RetryBatchModal
        open={retryOpen}
        batch={batch}
        onClose={() => setRetryOpen(false)}
        onConfirm={confirmRetry}
      />
    </>
  );
};

export default DisbursementDetail;
