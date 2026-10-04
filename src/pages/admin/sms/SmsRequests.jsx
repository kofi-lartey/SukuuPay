import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowDownToLine,
  CheckCircle2,
  Coins,
  Package,
  TriangleAlert,
  XCircle,
} from 'lucide-react';
import PageHeader from '../../../components/dashboard/PageHeader';
import Card from '../../../components/dashboard/ui/Card';
import Badge from '../../../components/dashboard/ui/Badge';
import EmptyState from '../../../components/dashboard/EmptyState';
import Pagination from '../../../components/students/Pagination';
import Button from '../../../components/common/Button';
import Modal from '../../../components/common/Modal';
import { useToast } from '../../../hooks/useToast';
import {
  getSmsPool,
  recordSmsPoolTopUp,
  listSmsRequests,
  approveSmsRequest,
  rejectSmsRequest,
  markSmsRequestRefunded,
} from '../../../services/smsPool';
import { formatCedis, formatCount } from '../../../utils/format';

/**
 * The console's approval queue for SMS credit.
 *
 * ## What this screen exists to do
 *
 * Two numbers, side by side: **units in the pool** and **units promised to schools**.
 * Every decision on this page is a comparison between them, so they are the first thing
 * rendered rather than a card further down.
 *
 * The pool figure was simply absent before this feature — `admin/sms.service.js`
 * returned `platformPool: null` with a "not configured" note, permanently, on a
 * deployment where the platform had bought Arkesel credit and schools were drawing it
 * down. An operator approving a purchase had no way to know whether the units existed.
 *
 * ## Approval is not idempotent in its effects, so it is not optimistic
 *
 * The server refuses a second approval, which makes the *call* safe to retry. It does
 * not make the UI honest to show a success before the server has moved the money and
 * written two ledger rows. So the button disables and the row waits — the alternative
 * is a queue showing "approved" for a request that silently failed to allocate.
 *
 * ## A rejection is a refundable state, not a dead end
 *
 * By the time a request reaches this queue the school has **already paid**. Declining
 * therefore takes the school's money, which is why every rejection here is followed by
 * a refund action rather than a row that simply disappears.
 */

const AWAITING_APPROVAL = 'awaiting_approval';

const STATUS_TONE = {
  awaiting_payment: 'amber',
  awaiting_approval: 'blue',
  approved: 'green',
  rejected: 'red',
  cancelled: 'slate',
};

const TABS = [
  { key: AWAITING_APPROVAL, label: 'Needs approval' },
  { key: 'all', label: 'All' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Declined' },
];

const DIRECTION_TONE = {
  topup: 'green',
  allocation: 'blue',
  reversal: 'amber',
};

const AdminSmsRequests = () => {
  const toast = useToast();

  const [pool, setPool] = useState(null);
  const [poolLoading, setPoolLoading] = useState(true);
  const [poolError, setPoolError] = useState(null);

  const [queue, setQueue] = useState({ rows: [], meta: null, loading: true });
  const [status, setStatus] = useState(AWAITING_APPROVAL);
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

  const [busyId, setBusyId] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState(null);
  const [refunding, setRefunding] = useState(null);
  const [refundReference, setRefundReference] = useState('');

  const [toppingUp, setToppingUp] = useState(false);
  const [topUpUnits, setTopUpUnits] = useState('');
  const [topUpCost, setTopUpCost] = useState('');
  const [topUpReference, setTopUpReference] = useState('');
  const [topUpError, setTopUpError] = useState(null);

  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

  const loadPool = useCallback(() => {
    let active = true;
    setPoolLoading(true);
    getSmsPool()
      .then((result) => {
        if (active) {
          setPool(result);
          setPoolError(null);
        }
      })
      .catch((error) => {
        if (active) setPoolError(error);
      })
      .finally(() => {
        if (active) setPoolLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => loadPool(), [loadPool, reloadKey]);

  useEffect(() => {
    let active = true;
    setQueue((current) => ({ ...current, loading: true }));

    listSmsRequests({ status, page })
      .then((result) => {
        if (active) setQueue({ rows: result.rows, meta: result.meta, loading: false });
      })
      .catch((error) => {
        if (active) {
          setQueue({ rows: [], meta: null, loading: false });
          toast?.error?.(error?.message || 'Requests could not be loaded.');
        }
      });

    return () => {
      active = false;
    };
  }, [status, page, reloadKey, toast]);

  const onApprove = async (row) => {
    setBusyId(row.requestId);
    try {
      const result = await approveSmsRequest(row.requestId);

      toast?.success?.(
        result?.alreadyApproved
          ? 'Already approved — nothing was allocated twice.'
          : `${formatCount(row.units)} SMS released.`
      );
      refresh();
    } catch (error) {
      // Surfaced verbatim, because the interesting failures here are informative: the
      // pool ran out, or another operator approved first. Both say what happened and
      // both are things the operator must know before trying again.
      toast?.error?.(error?.message || 'That request could not be approved.');
    } finally {
      setBusyId(null);
    }
  };

  const onReject = async () => {
    if (reason.trim().length < 3) {
      setReasonError('The school is told this reason, so it cannot be blank.');
      return;
    }

    setBusyId(rejecting?.requestId);
    try {
      await rejectSmsRequest(rejecting.requestId, reason.trim());
      toast?.success?.('Declined. The school has been told why.');
      setRejecting(null);
      setReason('');
      refresh();
    } catch (error) {
      setReasonError(error?.message || 'That request could not be declined.');
    } finally {
      setBusyId(null);
    }
  };

  const onRecordRefund = async () => {
    setBusyId(refunding?.requestId);
    try {
      await markSmsRequestRefunded(refunding.requestId, refundReference.trim());
      toast?.success?.('Refund recorded.');
      setRefunding(null);
      setRefundReference('');
      refresh();
    } catch (error) {
      toast?.error?.(error?.message || 'The refund could not be recorded.');
    } finally {
      setBusyId(null);
    }
  };

  const onTopUp = async () => {
    const units = Number(topUpUnits);

    if (!Number.isFinite(units) || units < 1) {
      setTopUpError('Enter how many units you bought.');
      return;
    }

    setToppingUp(true);
    setTopUpError(null);

    try {
      await recordSmsPoolTopUp({
        units,
        // The platform's *cost*. Null when it is not being tracked, because a zero here
        // would silently imply a free purchase in the ledger.
        amountPes: topUpCost === '' ? null : Number(topUpCost),
        reference: topUpReference.trim() || undefined,
      });
      toast?.success?.(`${formatCount(units)} units added to the pool.`);
      setToppingUp(false);
      setTopUpUnits('');
      setTopUpCost('');
      setTopUpReference('');
      refresh();
    } catch (error) {
      setTopUpError(error?.message || 'That top-up could not be recorded.');
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="SMS"
        title="Credit requests"
        description="Schools buy the messages they send to parents. Payment arriving does not release anything — that is this queue's job."
      />

      {/* ── The two numbers that decide everything below ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card padding="p-4" className={pool?.isLow ? 'border-amber-300 bg-amber-50/50' : ''}>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
            Available in pool
          </p>
          {poolLoading ? (
            <div className="mt-2 h-7 w-24 animate-pulse rounded bg-slate-100" />
          ) : (
            <p className="mt-1.5 text-[26px] font-extrabold tabular-nums tracking-tight text-ink">
              {formatCount(pool?.availableUnits ?? 0)}
            </p>
          )}
          {pool?.isLow ? (
            <p className="mt-1.5 flex items-center gap-1 text-[11px] font-bold text-amber-700">
              <TriangleAlert className="h-3 w-3" aria-hidden="true" />
              At or below the low threshold
            </p>
          ) : (
            <p className="mt-1.5 text-[11px] font-semibold text-slate-400">
              Bought on {pool?.unitPricePes ? formatCedis(pool.unitPricePes) : '—'} each
            </p>
          )}
        </Card>

        <Card padding="p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
            Bought from Arkesel
          </p>
          <p className="mt-1.5 text-[26px] font-extrabold tabular-nums tracking-tight text-ink">
            {formatCount(pool?.totalToppedUp ?? 0)}
          </p>
        </Card>

        <Card padding="p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
            Allocated to schools
          </p>
          <p className="mt-1.5 text-[26px] font-extrabold tabular-nums tracking-tight text-ink">
            {formatCount(pool?.totalAllocated ?? 0)}
          </p>
        </Card>

        <Card padding="p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
            Held by schools
          </p>
          <p className="mt-1.5 text-[26px] font-extrabold tabular-nums tracking-tight text-ink">
            {formatCount(pool?.heldBySchools ?? 0)}
          </p>
          <p className="mt-1.5 text-[11px] font-semibold text-slate-400">
            Unspent, on school balances
          </p>
        </Card>
      </div>

      {poolError ? (
        <div
          role="alert"
          className="mt-4 rounded-xl bg-red-50 p-3 text-[13px] font-semibold text-red-800 ring-1 ring-inset ring-red-200"
        >
          {poolError.message}
        </div>
      ) : null}

      {/* ── Pool ledger ── */}
      <Card padding="p-0" className="mt-4 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-[14px] font-extrabold tracking-tight text-ink">
              Pool ledger
            </h2>
            <p className="mt-0.5 text-[12px] font-semibold text-slate-500">
              Append-only. A correction is a new entry, never an edit.
            </p>
          </div>
          <Button variant="secondary" onClick={() => setToppingUp(true)} icon={ArrowDownToLine}>
            Record a top-up
          </Button>
        </div>

        {pool?.entries?.length ? (
          <ul className="divide-y divide-slate-100">
            {pool.entries.slice(0, 10).map((entry) => (
              <li
                key={entry._id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <Badge tone={DIRECTION_TONE[entry.direction] || 'slate'}>
                    {entry.direction}
                  </Badge>
                  <div className="min-w-0">
                    <p className="text-[13px] font-extrabold text-slate-800">
                      {formatCount(entry.units)} units
                      {entry.schoolId?.name ? ` → ${entry.schoolId.name}` : ''}
                    </p>
                    <p className="truncate font-mono text-[11px] text-slate-400">
                      {entry.entryId}
                      {entry.reference ? ` · ${entry.reference}` : ''}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  {entry.balanceAfter != null ? (
                    <p className="text-[12px] font-extrabold tabular-nums text-slate-600">
                      {formatCount(entry.balanceAfter)} after
                    </p>
                  ) : null}
                  <p className="text-[11px] text-slate-400">
                    {new Date(entry.createdAt).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                    })}
                    {entry.createdBy
                      ? ` · ${entry.createdBy.firstName || ''} ${
                          entry.createdBy.lastName || ''
                        }`.trim()
                      : ' · automatic'}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-8 text-center text-[13px] font-semibold text-slate-500">
            Nothing recorded yet. Add a top-up to start allocating credit to schools.
          </p>
        )}
      </Card>

      {/* ── The queue ── */}
      <div className="mb-3 mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[15px] font-extrabold tracking-tight text-ink">Requests</h2>

        <div
          role="tablist"
          aria-label="Filter requests"
          className="flex flex-wrap items-center gap-1 rounded-xl bg-slate-100 p-1"
        >
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={status === tab.key}
              onClick={() => {
                setStatus(tab.key);
                setPage(1);
              }}
              className={`rounded-lg px-2.5 py-1.5 text-[12px] font-extrabold transition-colors ${
                status === tab.key ? 'bg-white text-ink shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {queue.loading && queue.rows.length === 0 ? (
        <div className="space-y-2">
          {[0, 1].map((key) => (
            <Card key={key} padding="p-4">
              <div className="h-4 w-48 animate-pulse rounded bg-slate-100" />
              <div className="mt-2.5 h-3 w-64 animate-pulse rounded bg-slate-100" />
            </Card>
          ))}
        </div>
      ) : null}

      {!queue.loading && queue.rows.length === 0 ? (
        <EmptyState
          icon={Package}
          title={status === AWAITING_APPROVAL ? 'Nothing waiting' : 'No requests here'}
          description={
            status === AWAITING_APPROVAL
              ? 'No school is waiting for approval right now.'
              : 'Try another tab to see the rest of the history.'
          }
        />
      ) : null}

      <ul className="space-y-2">
        {queue.rows.map((row) => {
          const isWaiting = row.status === AWAITING_APPROVAL;
          const isDeclined = row.status === 'rejected' && !row.refundedAt;
          const busy = busyId === row.requestId;

          return (
            <li key={row._id}>
              <Card padding="p-4" className={isWaiting ? 'border-blue-200' : ''}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={STATUS_TONE[row.status] || 'slate'}>{row.status}</Badge>
                      <span className="font-mono text-[11px] text-slate-400">
                        {row.requestId}
                      </span>
                    </div>

                    <p className="mt-2 text-[14px] font-extrabold text-ink">
                      {/* The school name and its logo — an operator approving money
                          moves is looking at a list, and a list of reference codes is
                          not a list. */}
                      {row.schoolId?.name || 'Unknown school'}
                    </p>

                    <p className="mt-1 text-[13px] font-semibold text-slate-600">
                      {formatCount(row.units)} SMS ·{' '}
                      <span className="tabular-nums font-extrabold text-ink">
                        {formatCedis(row.totalPes)}
                      </span>{' '}
                      · {formatCedis(row.unitPricePes)} each
                    </p>

                    <p className="mt-1 text-[12px] font-semibold text-slate-500">
                      Requested by {row.requestedBy?.firstName || '—'}{' '}
                      {row.requestedBy?.lastName || ''} ·{' '}
                      {new Date(row.createdAt).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </p>

                    {/* Payment evidence. The decision here is "someone paid for this" and
                        the gateway's own transaction id is what makes that checkable
                        rather than assumed. */}
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-500">
                      <Badge tone={row.payment?.status === 'completed' ? 'green' : 'slate'}>
                        {row.payment?.status || 'pending'}
                      </Badge>
                      {row.payment?.phoneNumber ? (
                        <span className="tabular-nums">{row.payment.phoneNumber}</span>
                      ) : null}
                      {row.payment?.financialTransactionId ? (
                        <span className="font-mono">{row.payment.financialTransactionId}</span>
                      ) : null}
                    </div>

                    {row.rejectionReason ? (
                      <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-800">
                        Declined: {row.rejectionReason}
                      </p>
                    ) : null}

                    {row.refundedAt ? (
                      <p className="mt-2 text-[12px] font-bold text-emerald-700">
                        Refunded{row.refundReference ? ` · ${row.refundReference}` : ''}
                      </p>
                    ) : null}

                    {/* Approving more units than the pool holds is refused by the server.
                        Saying so here means the operator finds out before the click
                        rather than from an error toast. */}
                    {isWaiting && pool && row.units > pool.availableUnits ? (
                      <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[12px] font-semibold text-amber-800">
                        Only {formatCount(pool.availableUnits)} units are left in the pool.
                        Top up before approving this.
                      </p>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 flex-col gap-2">
                    {isWaiting ? (
                      <>
                        <Button
                          onClick={() => onApprove(row)}
                          disabled={busy || !pool || row.units > pool.availableUnits}
                          icon={CheckCircle2}
                        >
                          {busy ? 'Working…' : 'Approve'}
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setRejecting(row);
                            setReason('');
                            setReasonError(null);
                          }}
                          disabled={busy}
                          icon={XCircle}
                        >
                          Decline
                        </Button>
                      </>
                    ) : null}

                    {/*
                      A declined request has already taken the school its money, so the
                      row does not disappear — it gains a refund action. Without this the
                      console's "Declined" tab is a list of schools that lost money with
                      no way forward from the screen.
                    */}
                    {isDeclined ? (
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setRefunding(row);
                          setRefundReference('');
                        }}
                        disabled={busy}
                      >
                        Record refund
                      </Button>
                    ) : null}
                  </div>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>

      {queue.meta && queue.meta.totalPages > 1 ? (
        <div className="mt-4">
          <Pagination meta={queue.meta} onPageChange={setPage} />
        </div>
      ) : null}

      {/* ── Decline ──
          The reason is required and floored, because the school is shown it verbatim.
          A decline with an empty reason renders as "declined:" followed by nothing. */}
      <Modal
        open={Boolean(rejecting)}
        onClose={() => setRejecting(null)}
        title={`Decline ${rejecting?.requestId || ''}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={onReject}
              disabled={busyId === rejecting?.requestId}
            >
              Decline request
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="rounded-lg bg-amber-50 px-3 py-2.5 text-[13px] font-semibold leading-relaxed text-amber-800">
            This school has <strong>already paid</strong>. Declining keeps their money,
            and you will be able to record a refund on the next step.
          </p>

          <div>
            <label
              htmlFor="reject-reason"
              className="block text-[13px] font-bold text-slate-700"
            >
              Reason shown to the school
            </label>
            <textarea
              id="reject-reason"
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={300}
              placeholder="e.g. Duplicate of SMS-REQ-20260917-3D8R5X, already approved."
              className={`mt-1.5 w-full rounded-xl border bg-white px-3.5 py-2.5 text-[14px] leading-relaxed text-slate-900 focus:outline-none ${
                reasonError ? 'border-red-300' : 'border-slate-200 focus:border-brand-700'
              }`}
            />
            {reasonError ? (
              <p className="mt-1 text-[12px] font-semibold text-red-600">{reasonError}</p>
            ) : null}
          </div>
        </div>
      </Modal>

      {/* ── Record a refund ──
          Labelled "record", not "refund", and it says so in the body: the money has to
          be returned through MTN by an operator, and a button that looked like it
          performed the refund would be clicked by someone expecting the money to move. */}
      <Modal
        open={Boolean(refunding)}
        onClose={() => setRefunding(null)}
        title="Record a refund"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRefunding(null)}>
              Cancel
            </Button>
            <Button
              onClick={onRecordRefund}
              disabled={busyId === refunding?.requestId}
            >
              Mark as refunded
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-[13px] leading-relaxed text-slate-600">
            This does not move any money. Return {formatCedis(refunding?.totalPes ?? 0)}{' '}
            to the payer through MTN, then record it here so the school and the next
            support conversation both show it as done.
          </p>

          <div>
            <label
              htmlFor="refund-reference"
              className="block text-[13px] font-bold text-slate-700"
            >
              MTN refund reference
            </label>
            <input
              id="refund-reference"
              type="text"
              value={refundReference}
              onChange={(event) => setRefundReference(event.target.value)}
              placeholder="Optional, but it is what proves it went"
              className="mt-1.5 min-h-[48px] w-full rounded-xl border border-slate-200 bg-white px-3.5 font-mono text-[14px] text-slate-900 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
            />
          </div>
        </div>
      </Modal>

      {/* ── Top-up ──
          `amountPes` is the platform's own cost and is explicitly optional. Credit also
          arrives from migrations and goodwill gestures, and forcing a figure for those
          would put a cost on a decision that had none. */}
      <Modal
        open={toppingUp}
        onClose={() => setToppingUp(false)}
        title="Record units bought from Arkesel"
        footer={
          <>
            <Button variant="ghost" onClick={() => setToppingUp(false)}>
              Cancel
            </Button>
            <Button onClick={onTopUp} disabled={toppingUp}>
              {toppingUp ? 'Saving…' : 'Add to pool'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-lg bg-slate-50 px-3 py-2.5 text-[12px] font-semibold leading-relaxed text-slate-600">
            The pool is what schools draw from when you approve a purchase. It is
            recorded here by hand because the Arkesel API in this codebase exposes no
            balance endpoint to read from.
          </div>

          <div>
            <label htmlFor="topup-units" className="block text-[13px] font-bold text-slate-700">
              Units bought
            </label>
            <input
              id="topup-units"
              type="number"
              min="1"
              value={topUpUnits}
              onChange={(event) => setTopUpUnits(event.target.value)}
              placeholder="10000"
              className="mt-1.5 min-h-[48px] w-full rounded-xl border border-slate-200 bg-white px-3.5 text-[16px] font-extrabold tabular-nums text-slate-900 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
            />
          </div>

          <div>
            <label htmlFor="topup-cost" className="block text-[13px] font-bold text-slate-700">
              What you paid (GH₵)
            </label>
            <input
              id="topup-cost"
              type="number"
              min="0"
              step="0.01"
              value={topUpCost}
              onChange={(event) => setTopUpCost(event.target.value)}
              placeholder="Optional"
              className="mt-1.5 min-h-[48px] w-full rounded-xl border border-slate-200 bg-white px-3.5 text-[16px] tabular-nums text-slate-900 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
            />
          </div>

          <div>
            <label htmlFor="topup-reference" className="block text-[13px] font-bold text-slate-700">
              Arkesel receipt
            </label>
            <input
              id="topup-reference"
              type="text"
              value={topUpReference}
              onChange={(event) => setTopUpReference(event.target.value)}
              placeholder="Optional, but it is the audit trail back to Arkesel"
              className="mt-1.5 min-h-[48px] w-full rounded-xl border border-slate-200 bg-white px-3.5 font-mono text-[14px] text-slate-900 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
            />
          </div>

          {topUpError ? (
            <p role="alert" className="text-[12px] font-semibold text-red-600">
              {topUpError}
            </p>
          ) : null}
        </div>
      </Modal>
    </div>
  );
};

export default AdminSmsRequests;