import React, { useState } from 'react';
import { RefreshCw, ShieldAlert } from 'lucide-react';
import Modal from '../../common/Modal';
import { FormAlert } from '../../common/FormField';
import Badge from '../../dashboard/ui/Badge';
import { SchoolSummary } from './SchoolSelect';
import { DISBURSEMENT_LABEL, periodLabel } from './financeVocabulary';
import { formatCedi, formatCount } from '../../../utils/format';

/**
 * The confirmation in front of retrying a failed payout.
 *
 * ### Why retry is behind a dialog at all
 *
 * Retry looks harmless and is the most dangerous control on the list, precisely
 * because it looks harmless. It is the one button an operator reaches for by
 * reflex, on a batch that failed once, without reading the row. It:
 *
 *   - **re-uses the same row.** `retryDisbursementBatch` does not create a second
 *     batch (`disbursements.service.js:809-881`), which is exactly what makes it a
 *     retry rather than a double payment — but only because of that
 *     implementation detail, which is not visible from the button.
 *   - **increments `attempts`**, and `attempts` is read by the retry endpoint's
 *     own triage and by whoever looks at the queue later.
 *   - **runs the provider call again.** So does anything else that runs money.
 *
 * ### The failure reason is quoted, not paraphrased
 *
 * `failureReason` is stored verbatim — "the provider's words, kept verbatim. A
 * support ticket quotes this" (`DisbursementBatch.js:196`). This dialog shows it
 * exactly as stored, including a blank-line break, because the operator's first
 * question about a failed payout is *why*, and a summarised reason is where the
 * useful part goes. When it is empty the dialog says so rather than showing
 * nothing, since an absent reason on a failed batch means the failure predates the
 * field and a person has to look at the provider's own logs.
 *
 * ### Permanent failures are refused, and the dialog says so before the click
 *
 * `metadata.failureKind === 'permanent'` makes the server refuse the retry with a
 * 409 telling the operator to correct the school's payout details and approve a
 * new batch instead (`disbursements.service.js:843-849`). The button is
 * therefore rendered disabled with that explanation attached when the batch
 * carries the marker, rather than left clickable to return a 409. This is the one
 * place in the section where a *disabled* control is right rather than merely
 * defensible: the action is not merely discouraged, it is impossible, and a
 * button that can only fail teaches operators that the retry control is broken.
 */
const RetryBatchModal = ({ open, batch, onClose, onConfirm }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const failureKind = batch?.metadata?.payoutIntegration?.failureKind || null;
  const permanent = failureKind === 'permanent';
  const attemptBefore = Number(batch?.attempts) || 0;

  const submit = async () => {
    if (busy || permanent) return;

    setBusy(true);
    setError(null);

    // Returns `{ ok, error }`; never throws, so a refused retry leaves the dialog
    // open with the failure reason still on screen rather than closing over the
    // one thing the operator needed to read.
    const result = await onConfirm(batch);

    setBusy(false);

    if (result?.ok) {
      onClose?.();
      return;
    }
    setError(result?.error || 'This payout could not be retried.');
  };

  if (!batch) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Retry ${batch.batchNumber || 'this payout'}?`}
      description={`${batch.schoolName || 'A school'} · ${formatCedi(batch.netAmount)}`}
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
            disabled={busy || permanent}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
          >
            <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} aria-hidden="true" />
            {busy ? 'Retrying…' : 'Retry this payout'}
          </button>
        </>
      }
    >
      <div className="rounded-xl border border-slate-200 px-3.5 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SchoolSummary school={batch} />
          <Badge tone="red">{DISBURSEMENT_LABEL(batch.status)}</Badge>
        </div>
        <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <dt className="text-[11px] font-semibold text-slate-500">School receives</dt>
            <dd className="mt-0.5 text-[18px] font-extrabold leading-none tabular-nums text-ink">
              {formatCedi(batch.netAmount)}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold text-slate-500">Payments in it</dt>
            <dd className="mt-0.5 text-[18px] font-extrabold leading-none tabular-nums text-ink">
              {formatCount(batch.paymentCount)}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold text-slate-500">Attempts so far</dt>
            <dd className="mt-0.5 text-[18px] font-extrabold leading-none tabular-nums text-ink">
              {formatCount(attemptBefore)}
              <span className="text-[13px] font-semibold text-slate-400"> → {formatCount(attemptBefore + 1)}</span>
            </dd>
          </div>
        </dl>
        <p className="mt-2.5 text-[12px] font-semibold text-slate-500">
          {periodLabel(batch.periodStart, batch.periodEnd)}
        </p>
      </div>

      {/*
        The reason, quoted. `whitespace-pre-line` because providers return
        multi-line text and a collapsed newline turns a two-line explanation into
        one unreadable sentence.
      */}
      <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3">
        <p className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-red-700">
          <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
          The provider&rsquo;s words, as recorded
        </p>
        <p className="mt-1.5 whitespace-pre-line text-[12px] font-semibold leading-relaxed text-red-800">
          {batch.failureReason ||
            'No reason was recorded. This batch failed before the reason field existed — the provider’s own logs are the only place the answer will be.'}
        </p>
        {batch.failedAt ? (
          <p className="mt-1.5 text-[11px] font-semibold text-red-700">
            Failed {new Date(batch.failedAt).toLocaleString('en-GB', { timeZone: 'Africa/Accra' })}
          </p>
        ) : null}
      </div>

      {permanent ? (
        <div className="mt-3">
          <FormAlert tone="error">
            This failure was recorded as <strong>permanent</strong>, so the server refuses the
            retry. A 4xx from a payout API means the request itself is wrong — a closed account, a
            name that does not match, a limit — and repeating it verbatim cannot succeed. Correct
            the school&rsquo;s payout details first, then approve a new batch.
          </FormAlert>
        </div>
      ) : (
        <ul className="mt-4 space-y-1.5 text-[12px] font-semibold leading-relaxed text-slate-600">
          <li>
            The <strong>same batch</strong> is retried. No second batch is created for these
            payments, and no new batch number is issued.
          </li>
          <li>
            Attempts goes from {formatCount(attemptBefore)} to {formatCount(attemptBefore + 1)} —
            that is the operator-visible record that this was tried more than once.
          </li>
          <li>
            The payout provider is called again. It is not wired today, so the batch will return to{' '}
            <code className="font-mono">approved</code> with no reference and its ledger will stay
            unsettled. The money stays held.
          </li>
        </ul>
      )}
    </Modal>
  );
};

export default RetryBatchModal;
