import React, { useEffect, useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import Modal from '../common/Modal';
import MoneyInput from '../common/MoneyInput';
import { Field, FormAlert } from '../common/FormField';
import { formatCedi } from '../../utils/format';
import { formatDateTime, paymentTimestamp } from '../../utils/dates';

/** The server's own floor. `refundPaymentSchema` rejects anything shorter. */
const MIN_REASON = 10;

/**
 * Reverse a payment, from the platform console.
 *
 * **This is an adaptation of `components/payments/RefundPaymentDialog.jsx`, not a
 * second refund dialog.** Copying that file wholesale would have been wrong in two
 * specific ways, and both are about who is asking:
 *
 *   1. **It calls `refundPayment` from `services/payments` internally.** That is
 *      the school-scoped endpoint. The platform console must call
 *      `services/admin.js`, which posts to `/admin/payments/:id/refund`. Two
 *      service modules, two base paths, one action — a file that called the wrong
 *      one would fail loudly, at least, but it would fail on the one screen where
 *      the operator is holding somebody's money.
 *   2. **It owns its mutation and closes itself on success.** The convention here
 *      is the opposite: the page owns the call and it returns `{ ok, error }`
 *      (`AdminSchools.jsx`, `hooks/useUsers.js`) so the caller branches and the
 *      dialog stays open on failure. Injecting `onConfirm` rather than importing
 *      the service is what makes that possible, and it is also what lets the list
 *      and the detail screen share one dialog.
 *
 * The two keep identical form semantics on purpose — same defaults, same client
 * validation, same wording about what a refund does — because a bursar and a
 * platform owner reading two different descriptions of the same irreversible act
 * is the failure this duplication would eventually produce.
 *
 * **The amount defaults to the full payment, and that is the dangerous default,
 * so it is stated rather than assumed.** The server refunds everything when
 * `amount` is omitted, which is right for a mis-keyed row and catastrophic for a
 * part-payment somebody meant to cancel. The field is pre-filled with the full
 * amount *and* the confirm button names the figure.
 *
 * **`onConfirm({ amount, reason })` takes pesewas and returns `{ ok, error }`.**
 * `MoneyInput` is the only place the client crosses the cedi/pesewa line; this
 * component does no arithmetic of its own beyond a comparison against the
 * refundable balance.
 */
const AdminRefundPaymentDialog = ({ open, payment, onClose, onConfirm, refundableAmount }) => {
  const [amount, setAmount] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState(null);

  // Re-seeded from the payment rather than kept across opens, so refunding one row
  // then another does not silently carry the previous amount and reason across —
  // which on a screen where the rows are other schools' money would be a genuinely
  // dangerous kind of stale state.
  useEffect(() => {
    if (!open || !payment) return;
    setAmount(payment.amount ?? null);
    setReason('');
    setFormError(null);
    setBusy(false);
  }, [open, payment]);

  if (!open || !payment) return null;

  /**
   * What is actually still refundable.
   *
   * A full refund marks the original `refunded`; a partial one leaves it
   * `completed` and writes its own negative row. So "the amount of this payment"
   * is only the refundable amount on a payment nobody has partially refunded, and
   * preferring a server-provided `refundableAmount` is what lets the field be right
   * on the second attempt without the client tracking refunds itself. When the
   * server does not supply one, the original amount is the fallback and the
   * difference is stated below rather than assumed away.
   */
  const ceiling =
    refundableAmount !== undefined && refundableAmount !== null
      ? Number(refundableAmount)
      : Number(payment.amount);

  const overRefunding = amount !== null && amount > ceiling;
  const isFull = amount === ceiling;
  const reasonTooShort = reason.trim().length > 0 && reason.trim().length < MIN_REASON;
  const invalid = !reason.trim() || !amount || amount < 1 || overRefunding || reasonTooShort;

  const submit = async (event) => {
    event?.preventDefault?.();
    if (invalid || busy) return;
    setBusy(true);
    setFormError(null);
    try {
      const result = await onConfirm({ amount, reason: reason.trim() });
      if (result?.ok) onClose?.();
      else setFormError(result?.error || 'That payment could not be refunded.');
    } catch (error) {
      // `onConfirm` is contractually non-throwing; this is here so a violation
      // degrades to a message in the dialog rather than to a blank screen.
      setFormError(error?.message || 'That payment could not be refunded.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Refund this payment"
      description={`${payment.paymentId || payment._id} · ${formatCedi(payment.amount)} · taken ${formatDateTime(
        paymentTimestamp(payment)
      )}`}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={invalid || busy}
            className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-red-700 disabled:opacity-60"
          >
            {busy
              ? 'Refunding…'
              : isFull
                ? `Refund the full ${formatCedi(ceiling)}`
                : `Refund ${amount ? formatCedi(amount) : '—'}`}
          </button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {formError && <FormAlert tone="error">{formError}</FormAlert>}

        {/*
          The confirmation wording, and the reason it is this long.

          A refund here is **not** an edit and **not** a deletion: it writes a new
          `Payment` row with a negative amount, leaving the original exactly as it
          was. That is deliberate — the ledger stays additive, so the money taken and
          the money returned are both still on the record, and a school's collected
          total is the sum of both. An operator who believes the dialog is about to
          modify the original will look for the original afterwards, not find it
          changed, and conclude the refund failed. So the two sentences below state
          what will appear in the list and what will not change.
        */}
        <FormAlert tone="warning">
          <span className="flex items-start gap-2">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              This writes a <strong>new negative payment</strong> against this one. The original
              payment is not altered and keeps its own status — a full refund marks it
              &ldquo;refunded&rdquo;, a partial one leaves it &ldquo;completed&rdquo;. Money is not moved
              back to the parent here; the student&rsquo;s balance is reversed and the transfer is a
              separate step the school makes.
            </span>
          </span>
        </FormAlert>

        <MoneyInput
          label="Amount to refund"
          hint={`of ${formatCedi(ceiling)} refundable`}
          value={amount}
          onChange={setAmount}
          disabled={busy}
          required
          error={
            overRefunding
              ? 'A refund cannot be larger than what is still refundable on this payment.'
              : !amount
                ? 'Enter the amount to refund.'
                : undefined
          }
        />

        <Field
          label="Reason"
          hint={`At least ${MIN_REASON} characters`}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          disabled={busy}
          required
          error={
            reasonTooShort
              ? `A reason of at least ${MIN_REASON} characters is required — it is what the parent is told and what support quotes.`
              : !reason.trim() && reason.length > 0
                ? 'A reason is required.'
                : undefined
          }
          placeholder="Duplicate collection, wrong student, cheque bounced…"
        />

        {/*
          The already-refunded case, said rather than disabled. A payment that has
          been partly refunded has a refundable balance smaller than its amount, and
          an operator looking at a dialog that merely refuses their number learns
          nothing. This tells them the number they should be using.
        */}
        {ceiling !== Number(payment.amount) && (
          <p className="text-[11px] font-semibold leading-relaxed text-slate-500">
            {formatCedi(Number(payment.amount) - ceiling)} of this payment has already been refunded.
            Only the remaining {formatCedi(ceiling)} can be returned.
          </p>
        )}

        <p className="text-[11px] font-semibold leading-relaxed text-slate-400">
          Recorded in the activity log against this payment, with your account as the actor.
        </p>
      </form>
    </Modal>
  );
};

export { MIN_REASON };
export default AdminRefundPaymentDialog;