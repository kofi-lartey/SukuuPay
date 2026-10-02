import React, { useState } from 'react';
import { AlertTriangle, CheckCheck, Info, ShieldAlert } from 'lucide-react';
import Modal from '../../common/Modal';
import { FormAlert } from '../../common/FormField';
import Badge from '../../dashboard/ui/Badge';
import { SchoolSummary } from './SchoolSelect';
import { DISBURSEMENT_LABEL, periodLabel } from './financeVocabulary';
import { formatCedi, formatCount } from '../../../utils/format';

/**
 * The confirmation in front of money leaving the platform.
 *
 * ### Why a dialog and not a toast
 *
 * `POST /admin/finance/disbursements/:batchId/approve` is described in
 * `services/finance.js:262-269` as "the one call in the console that moves a
 * school's money without asking the school". There is no undo: the batch's
 * payments are marked disbursed and its ledger lines are settled, and the
 * reversal of a payout is a *manual correction*, not a button. A toast is a
 * report of something that already happened; this is the last screen before
 * something irreversible happens, so the words on it are the last chance to say
 * what it is.
 *
 * `window.confirm` is the other thing this replaces and it is worse in three
 * specific ways: it cannot name the school, the batch number or the cedi, it
 * cannot state the blast radius, and it cannot carry the provider status below.
 * "OK?" is not a decision anyone can make; "DISB-2026-000412, Big Step
 * School, GH₵ 41,300.00" is.
 *
 * ### Handles one batch and several, from the same dialog
 *
 * The Overview approves the whole pending queue in one action and the list and
 * detail screens approve one row, and the copy that makes that safe is the same
 * copy in both cases — so there is one dialog with one `submit`, not two dialogs
 * whose blast-radius lists have to be kept in step. `batches.length > 1` switches
 * on the plural forms and the per-batch summary; nothing else differs.
 *
 * ### The part that must not be softened: the money does not move yet
 *
 * **There is no payout provider wired.** `executePayoutProviderCall` throws
 * `PayoutProviderNotWiredError` and the server parks the batch at `approved` with
 * `payoutReference: null`, ledger unsettled
 * (`Backend/src/services/admin/disbursements.service.js:120-161`). So the truth
 * this dialog has to state is that pressing the button **records a decision and
 * settles nothing** — the platform keeps counting the money as held.
 *
 * This is stated above the button, not below it and not only in the comments,
 * because a dialog that lists six consequences of approving and omits the one
 * that matters most is worse than no dialog at all: it reads as a formality
 * before a transfer.
 *
 * The confirmation below is written for the *wired* case and marked as such, so
 * that when the provider lands this dialog's copy is already true rather than
 * needing to be rewritten — and so nobody reads the settled-ledger bullet as a
 * claim about what just happened.
 */
const ApproveBatchModal = ({ open, batches = [], onClose, onConfirm }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [failures, setFailures] = useState([]);

  const list = (Array.isArray(batches) ? batches : [batches]).filter(Boolean);
  const isBulk = list.length > 1;

  /**
   * The exact figure being committed, summed over the group.
   *
   * Integer pesewas throughout: `netAmount` is what the school receives, and the
   * dialog quotes that and not `grossAmount`, because "you are releasing
   * GH₵ 41,300" and "you are keeping GH₵ 5,200 of it" are two halves of one
   * decision and an operator approving the first must see the second. The sum is
   * a plain reduce over integers — no division, no rounding, nothing `format.js`
   * is asked to do beyond the display.
   */
  const netTotal = list.reduce((sum, batch) => sum + (Number(batch?.netAmount) || 0), 0);
  const platformTotal = list.reduce(
    (sum, batch) => sum + (Number(batch?.platformAmount) || 0),
    0
  );
  const paymentTotal = list.reduce((sum, batch) => sum + (Number(batch?.paymentCount) || 0), 0);

  const submit = async () => {
    if (busy || list.length === 0) return;

    setBusy(true);
    setError(null);
    setFailures([]);

    // Never throws: the caller branches on `{ ok, error }` (SUKUU_ADMIN_FRONTEND_CONVENTIONS
    // §4), so a failed approval leaves this dialog open with everything the
    // operator read still on screen instead of closing over the decision.
    const result = await onConfirm(list);

    setBusy(false);

    if (result?.ok) {
      onClose?.();
      return;
    }

    /*
     * A bulk run is not all-or-nothing — there is no server-side bulk endpoint,
     * so the caller issues one `POST` per batch and some can succeed while others
     * are refused (a 409 because somebody approved the same batch first, a 403
     * because the request is impersonated). The dialog therefore reports *which*
     * ones failed rather than collapsing the whole run into one error string:
     * "it did not work" for a run where 11 of 12 payouts were recorded is the
     * kind of message that gets the queue re-run by hand and pays a school twice.
     */
    const reported = Array.isArray(result?.failures) ? result.failures : [];
    setFailures(reported);
    setError(
      result?.error ||
        (isBulk
          ? 'Some of these batches could not be approved. Nothing was rolled back — check each one.'
          : 'This batch could not be approved.')
    );
  };

  if (list.length === 0) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        isBulk
          ? `Approve ${formatCount(list.length)} payouts?`
          : `Approve ${list[0].batchNumber || 'this batch'}?`
      }
      description={
        isBulk
          ? `${formatCedi(netTotal)} will be released to ${formatCount(new Set(list.map((b) => b.schoolId?._id || b.schoolId)).size)} schools.`
          : `${list[0].schoolName || 'A school'} receives ${formatCedi(netTotal)}.`
      }
      size="lg"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            // The first line of defence against a double-approval, and the honest
            // one. The server refuses a second approval with a 409
            // (`disbursements.service.js:753-765`) so a double-click cannot pay
            // twice — but the refusal arrives after the operator has already been
            // told something went wrong, which is a worse experience than a
            // button that was never clickable.
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
          >
            <CheckCheck className="h-4 w-4" aria-hidden="true" />
            {busy
              ? isBulk
                ? 'Approving…'
                : 'Approving…'
              : isBulk
                ? `Approve ${formatCount(list.length)} batches`
                : 'Approve this payout'}
          </button>
        </>
      }
    >
      {/*
        What is about to happen, stated before the button and in the order an
        operator needs it: what the school gets, what the platform keeps, and
        only then the bookkeeping. Money first, mechanism second — the reverse
        order is how an operator ends up approving a transfer they did not
        realise they had read.
      */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3.5">
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <dt className="text-[11px] font-semibold text-slate-500">
              {isBulk ? 'Released in total' : 'School receives'}
            </dt>
            <dd className="mt-0.5 text-[22px] font-extrabold leading-none tracking-tight text-ink tabular-nums">
              {formatCedi(netTotal)}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold text-slate-500">Platform keeps</dt>
            <dd className="mt-0.5 text-[22px] font-extrabold leading-none tracking-tight text-brand-700 tabular-nums">
              {formatCedi(platformTotal)}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold text-slate-500">Parent payments</dt>
            <dd className="mt-0.5 text-[22px] font-extrabold leading-none tracking-tight text-ink tabular-nums">
              {formatCount(paymentTotal)}
            </dd>
          </div>
        </dl>
      </div>

      {/* ── The batch(es), named ── */}
      <ul className="mt-4 space-y-2.5">
        {list.map((batch) => (
          <li key={batch._id} className="rounded-xl border border-slate-200 px-3.5 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <SchoolSummary school={batch} />
              <span className="font-mono text-[12px] font-extrabold text-ink">
                {batch.batchNumber || '—'}
              </span>
            </div>
            <p className="mt-1.5 text-[12px] font-semibold text-slate-500">
              {periodLabel(batch.periodStart, batch.periodEnd)} ·{' '}
              {formatCount(batch.paymentCount)} payment{batch.paymentCount === 1 ? '' : 's'} ·{' '}
              {formatCedi(batch.netAmount)} to the school, {formatCedi(batch.platformAmount)}{' '}
              markup kept
            </p>
            <p className="mt-1 text-[11px] font-semibold text-slate-400">
              Status now: <Badge tone="amber">{DISBURSEMENT_LABEL(batch.status)}</Badge>
            </p>
          </li>
        ))}
      </ul>

      {/*
        The honest headline, above everything else that is true.

        Deliberately amber and not red: nothing is broken, no approval has been
        refused and no error is on screen. What this says is that the system is
        not yet capable of the thing the screen is named after, which is a
        different kind of statement and should not look like a fault the operator
        caused or can fix here.
      */}
      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3">
        <p className="flex items-start gap-2 text-[13px] font-extrabold text-amber-900">
          <AlertTriangle className="mt-px h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Approving records the decision. No payout provider is wired, so no money moves.</span>
        </p>
        <p className="mt-1 pl-6 text-[12px] font-semibold leading-relaxed text-amber-800">
          The server stamps the batch <code className="font-mono">approved</code> with no payout
          reference and leaves its ledger unsettled, and keeps counting the money as held. It will
          never report a batch as <code className="font-mono">paid</code> without a provider
          reference, because that reference is the only proof the transfer happened.
        </p>
      </div>

      {/* ── The full blast radius, for when the provider is wired ── */}
      <div className="mt-4">
        <h3 className="flex items-center gap-1.5 text-[12px] font-extrabold uppercase tracking-wider text-slate-500">
          <Info className="h-3.5 w-3.5" aria-hidden="true" />
          When a provider is wired, approving also does all of this
        </h3>
        <ul className="mt-2 space-y-1.5 text-[12px] font-semibold leading-relaxed text-slate-600">
          <li>
            <code className="font-mono">approvedBy</code> is set to you, and{' '}
            <code className="font-mono">approvedAt</code> to now — the batch's approval trail stops
            being inferable from its status alone.
          </li>
          <li>
            <code className="font-mono">processedAt</code> is stamped, and the school&rsquo;s{' '}
            {formatCount(paymentTotal)} payment
            {paymentTotal === 1 ? '' : 's'} are marked as disbursed so they are not collected in the
            next batch.
          </li>
          <li>
            The batch&rsquo;s <code className="font-mono">PlatformLedger</code> entries flip to{' '}
            <code className="font-mono">settled</code>. Until they do, that revenue is accrued —
            taken from parents, counted as earned, and not yet in an account — and leaving it
            accruing after the money has gone would count it as both held and paid.
          </li>
        </ul>
      </div>

      {/*
        The idempotency statement, in the dialog rather than only in
        `services/finance.js`. It is the answer to the question an operator asks
        after a double-click or a retried request, and "the server refused it" is
        a much better thing to have read before pressing the button than after.
      */}
      <p className="mt-4 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[11px] font-semibold leading-relaxed text-slate-500">
        Approving the same batch twice is refused by the server with a 409 naming the status it
        found — so a double-click cannot pay a school twice. That refusal is a backstop, not the
        mechanism: this button is disabled the moment the request is in flight.
      </p>

      {error && (
        <div className="mt-3">
          <FormAlert tone={isBulk && failures.length > 0 ? 'warning' : 'error'}>{error}</FormAlert>
        </div>
      )}

      {/*
        The per-batch failures, listed. Names, not counts: a queue with 12 entries
        where 2 were refused needs to know *which* two, because the operator's next
        action is per-batch — refresh, look, approve the one that was still
        pending — and a count does not tell them where to look.
      */}
      {failures.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {failures.map((failure) => (
            <li
              key={failure.id || failure.batchNumber}
              className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-800"
            >
              <ShieldAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>
                <span className="font-mono font-extrabold">{failure.batchNumber || failure.id}</span>{' '}
                — {failure.error}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
};

export default ApproveBatchModal;
