import React from 'react';
import { Banknote, CreditCard, Landmark, Smartphone } from 'lucide-react';
import Badge, { NETWORK_DOTS } from '../dashboard/ui/Badge';

/**
 * Status and channel vocabulary for the Payments module.
 *
 * Centralised rather than inlined per cell because the *same* status is rendered
 * in four places — the table, the detail drawer, the refund dialog's guard and
 * the KPI band's "awaiting confirmation" tile. A fourth copy of a status colour
 * map is how "Pending" ends up amber in one table and slate in another, and a
 * bursar scanning for unconfirmed payments cannot scan two colours for one
 * state.
 *
 * **The channel labels come from `MOMO_NETWORK_ENUM` in
 * `Backend/src/validations/payment.validation.js`, not from the wire.**
 * `VODAFONE` is what the model actually stores; a design that calls this
 * "Telecel Cash" is describing a network the schema does not have. Renaming it
 * here would make the pill lie about the value in the database, so the enum wins
 * and the label follows it.
 */

export const PAYMENT_STATUS_TONES = {
  completed: 'green',
  processing: 'blue',
  pending: 'amber',
  failed: 'red',
  cancelled: 'slate',
  refunded: 'rose',
};

/**
 * A blank status is not a blank value.
 *
 * The design this module replaced left the status cell empty when a payment had
 * none, which read as a rendering bug. The scaffold that replaced it called this
 * out explicitly: a row can sit unconfirmed for a moment after the parent paid,
 * and that state needs its own visible badge.
 */
export const PAYMENT_STATUS_LABELS = {
  completed: 'Completed',
  processing: 'Processing',
  pending: 'Pending',
  failed: 'Failed',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

export const PaymentStatusBadge = ({ status }) => {
  const key = String(status || '').toLowerCase();
  return (
    <Badge tone={PAYMENT_STATUS_TONES[key] || 'slate'}>
      {PAYMENT_STATUS_LABELS[key] || 'Unknown'}
    </Badge>
  );
};

/** The MoMo network behind a payment, mapped onto the shared `momo` palette. */
export const NETWORK_TONES = {
  MTN: 'mtn',
  VODAFONE: 'telecel',
  AIRTELTELIGO: 'at',
  UNKNOWN: 'slate',
};

export const NETWORK_LABELS = {
  MTN: 'MTN MoMo',
  VODAFONE: 'Vodafone Cash',
  AIRTELTELIGO: 'AT Money',
  UNKNOWN: 'Unidentified',
};

/** A network the gateway did not name, or a hand-recorded payment. */
const NON_MOMO_LABELS = {
  cash: 'Cash',
  card: 'Card',
  bank_transfer: 'Bank Transfer',
  manual: 'Manual',
};

const METHOD_ICONS = {
  momo: Smartphone,
  cash: Banknote,
  card: CreditCard,
  bank_transfer: Landmark,
};

/**
 * The channel pill.
 *
 * **A non-Mobile-Money payment shows its method, not a network.** Cash at the
 * desk has no `momoNetwork`, and rendering "Unidentified" on a GH₵ 850 cash
 * receipt reads as a data problem when there simply was no network involved.
 */
export const PaymentChannelBadge = ({ network, paymentMethod }) => {
  const isMomo = paymentMethod === 'momo' || Boolean(network);
  const key = String(network || '').toUpperCase();

  if (isMomo && key && key !== 'UNKNOWN') {
    return (
      <Badge tone={NETWORK_TONES[key] || 'slate'} dot={NETWORK_DOTS[key] ? key.toLowerCase() : undefined}>
        {NETWORK_LABELS[key] || key}
      </Badge>
    );
  }

  const label = NON_MOMO_LABELS[paymentMethod] || 'Cash Counter';
  const Icon = METHOD_ICONS[paymentMethod] || Banknote;

  return (
    <Badge tone="slate" icon={Icon}>
      {label}
    </Badge>
  );
};

export default PaymentStatusBadge;
