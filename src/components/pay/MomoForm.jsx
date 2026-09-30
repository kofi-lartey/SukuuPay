import React, { useState } from 'react';
import { MessageSquare, Smartphone } from 'lucide-react';
import Card from '../dashboard/ui/Card';
import Button from '../common/Button';
import { FormAlert, SelectField } from '../common/FormField';
import MoneyInput from '../common/MoneyInput';
import PhoneInput, { isValidGhanaPhone } from '../common/PhoneInput';
import { formatCedi } from '../../utils/format';

const NETWORKS = [
  { value: 'MTN', label: 'MTN MoMo' },
  { value: 'VODAFONE', label: 'Vodafone Cash' },
  { value: 'AIRTELTELIGO', label: 'AirtelTigo Money' },
];

/**
 * The Mobile Money payment form.
 *
 * **Network and phone are the parent's, not the school's.** The prompt arrives
 * on the SIM in front of them, so a wrong network means the prompt does not
 * arrive at all, and the phone number must be the one that will receive it. The
 * parent's own number is routinely different from the number on the school
 * record — the father pays, the mother is the contact.
 *
 * **The amount defaults to the full balance**, which is what a parent paying a
 * bill wants nine times out of ten, and can be lowered for a part payment. The
 * button is disabled above the balance, because a Mobile Money prompt for more
 * than is owed would collect money the school cannot account for.
 */
const MomoForm = ({ student, onSubmit, submitting, error }) => {
  const balance = student.balance || 0;
  const [amount, setAmount] = useState(balance > 0 ? balance : null);
  const [network, setNetwork] = useState('MTN');
  const [phone, setPhone] = useState('');
  const [touched, setTouched] = useState(false);

  const phoneValid = isValidGhanaPhone(phone);
  const tooMuch = amount !== null && amount > balance;
  const canSubmit = !submitting && amount !== null && amount > 0 && phoneValid && !tooMuch;

  const error_ =
    error ||
    (touched && phone && !phoneValid
      ? 'Enter a valid Ghana number, e.g. 0241234567'
      : null);

  return (
    <Card padding="p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
          <MessageSquare className="h-4 w-4" aria-hidden="true" />
        </span>
        <h3 className="text-base font-extrabold text-ink">Pay with Mobile Money</h3>
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

        <SelectField label="Your network" value={network} onChange={(e) => setNetwork(e.target.value)}>
          {NETWORKS.map((n) => (
            <option key={n.value} value={n.value}>
              {n.label}
            </option>
          ))}
        </SelectField>

        <PhoneInput
          label="Mobile Money number"
          hint="the number that will receive the prompt"
          required
          value={phone}
          error={touched && phone && !phoneValid ? 'Enter a valid Ghana number' : undefined}
          onChange={setPhone}
        />

        <Button
          type="button"
          variant="primary"
          className="w-full"
          disabled={!canSubmit}
          onClick={() => {
            setTouched(true);
            if (!canSubmit) return;
            onSubmit({ amount, momoNetwork: network, phoneNumber: phone });
          }}
        >
          <Smartphone className="mr-2 h-4 w-4" aria-hidden="true" />
          {submitting
            ? 'Waiting for your network…'
            : `Pay ${amount !== null ? formatCedi(amount) : ''}`.trim()}
        </Button>

        <p className="text-center text-[11px] font-semibold leading-relaxed text-slate-400">
          You will get a prompt on your phone. Approve it to complete the payment — this
          page will tell you when the money arrives.
        </p>
      </div>
    </Card>
  );
};

export default MomoForm;
