import React, { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import MoneyInput from '../common/MoneyInput';
import { Field, FormAlert } from '../common/FormField';
import { refundPayment } from '../../services/payments';
import { formatCedi } from '../../utils/format';
import { formatDateTime, paymentTimestamp } from '../../utils/dates';

/**
 * The student's name for the dialog's subtitle.
 *
 * `parentName` is deliberately not shown here. A refund notice names the payer in
 * the confirmation they may receive later, and a bursar scanning several refunds
 * needs the child the money is being credited back to.
 */
const studentName = (payment) => {
  const student = payment.studentId || {};
  return student.studentName ? `${student.studentName}'s balance` : 'the student';
};

/**
 * Reverse a payment.
 *
 * **The amount defaults to the full payment, and that is the dangerous default,
 * so it is stated rather than assumed.** Omitting `amount` on the server refunds
 * everything, which is the right behaviour for a mis-keyed row and catastrophic
 * for a part-payment a bursar meant to cancel. The field is therefore pre-filled
 * with the full amount *and* the confirm button spells out what will happen.
 *
 * A partial refund leaves the original payment `completed` and writes its own
 * negative row; a full one marks the original `refunded`. Either way the ledger
 * stays additive, so this dialog cannot erase the evidence of what was taken.
 */
const RefundPaymentDialog = ({ open, payment, onClose, onRefunded }) => {
  const [amount, setAmount] = useState(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Re-seeded from the payment rather than kept across opens, so refunding one
  // row then another does not silently carry the previous amount and reason
  // across.
  useEffect(() => {
    if (!open || !payment) return;
    setAmount(payment.amount ?? null);
    setReason('');
    setError(null);
    setSubmitting(false);
  }, [open, payment]);

  if (!open || !payment) return null;

  const overRefunding = amount !== null && amount > payment.amount;
  const invalid = !reason.trim() || !amount || amount < 1 || overRefunding;
  const isFull = amount === payment.amount;

  const submit = async (event) => {
    event.preventDefault();
    if (invalid || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      await refundPayment(payment.paymentId, { amount, reason: reason.trim() });
      onRefunded?.(payment);
    } catch (apiError) {
      setError(apiError);
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Refund this payment"
      description={`${payment.paymentId} · ${studentName(payment)} · taken ${formatDateTime(
        paymentTimestamp(payment)
      )}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="danger" onClick={submit} disabled={invalid || submitting}>
            {submitting
              ? 'Refunding…'
              : isFull
                ? `Refund the full ${formatCedi(payment.amount)}`
                : `Refund ${amount ? formatCedi(amount) : '—'}`}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <FormAlert tone="warning">
          <span className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              Refunding returns the money to the student's balance and writes a
              reversing entry against this payment. It does not move money back to the
              parent — that is a separate transfer the bursar makes.
            </span>
          </span>
        </FormAlert>

        <MoneyInput
          label="Amount to refund"
          hint={`of ${formatCedi(payment.amount)} taken`}
          value={amount}
          onChange={setAmount}
          disabled={submitting}
          required
          error={
            overRefunding
              ? 'A refund cannot be larger than the payment it reverses.'
              : !amount
                ? 'Enter the amount to refund.'
                : undefined
          }
        />

        <Field
          label="Reason"
          hint="Recorded in the activity log"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          disabled={submitting}
          required
          error={!reason.trim() && reason.length > 0 ? 'A reason is required.' : undefined}
          placeholder="Cheque bounced, duplicate payment, wrong student…"
        />

        <FormAlert tone="error">{error?.message}</FormAlert>
      </form>
    </Modal>
  );
};

export default RefundPaymentDialog;