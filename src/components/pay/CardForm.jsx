import React, { useState } from 'react';
import { CreditCard } from 'lucide-react';
import Card from '../dashboard/ui/Card';
import Button from '../common/Button';
import { FormAlert } from '../common/FormField';
import MoneyInput from '../common/MoneyInput';
import { formatCedi } from '../../utils/format';

/**
 * The Card payment form for Moolre's hosted checkout.
 *
 * No phone number or network selector is needed — the checkout page lets the
 * parent pick card, bank transfer, or mobile money from its own UI. The backend
 * opens the session with a `redirect` that returns the parent to this page, and
 * Moolre's callback settles the final status.
 */
const CardForm = ({ student, onSubmit, submitting, error }) => {
  const balance = student.balance || 0;
  const [amount, setAmount] = useState(balance > 0 ? balance : null);
  const [touched, setTouched] = useState(false);

  const tooMuch = amount !== null && amount > balance;
  const canSubmit = !submitting && amount !== null && amount > 0 && !tooMuch;

  const error_ =
    error ||
    (touched && amount !== null && amount <= 0
      ? 'Enter an amount above 0'
      : null);

  return (
    <Card padding="p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
          <CreditCard className="h-4 w-4" aria-hidden="true" />
        </span>
        <h3 className="text-base font-extrabold text-ink">Pay with Card or Bank</h3>
      </div>

      {error_ && <FormAlert>{error_}</FormAlert>}

      <div className="space-y-4">
        <MoneyInput
          label="Amount to pay"
          hint={`cedis · ${formatCedi(balance)} outstanding`}
          required
          value={amount}
          error={tooMuch ? 'That is more than the balance due' : undefined}
          onChange={setAmount}
        />

        <Button
          type="button"
          variant="primary"
          className="w-full"
          disabled={!canSubmit}
          onClick={() => {
            setTouched(true);
            if (!canSubmit) return;
            onSubmit({ amount, paymentMethod: 'card' });
          }}
        >
          <CreditCard className="mr-2 h-4 w-4" aria-hidden="true" />
          {submitting
            ? 'Opening secure checkout…'
            : `Pay ${amount !== null ? formatCedi(amount) : ''}`.trim()}
        </Button>

        <p className="text-center text-[11px] font-semibold leading-relaxed text-slate-400">
          You will be taken to a secure checkout page to complete the payment.
          Card, bank transfer and mobile money are all available there.
        </p>
      </div>
    </Card>
  );
};

export default CardForm;
