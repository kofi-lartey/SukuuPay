import React from 'react';
import { CircleAlert, CircleCheck, Hourglass, Receipt } from 'lucide-react';
import Card from '../dashboard/ui/Card';
import Button from '../common/Button';
import { formatCedi } from '../../utils/format';

/**
 * What the page shows while a payment is in flight, and after it lands.
 *
 * The four states are distinct because a parent cannot tell them apart otherwise,
 * and each needs a different action:
 *
 * - `pending`  — the prompt is out. Wait, and do not pay twice.
 * - `completed` — money received. Offer the receipt, which is what a parent
 *   actually wants at this moment: something to show an employer or a sibling.
 * - `failed`   — the gateway declined it. Say what to do next.
 * - `cancelled` — pulled back before a prompt was sent.
 *
 * "Do not pay twice" is stated on the pending state on purpose. A parent who has
 * approved a prompt and then sees a generic failure will very often approve
 * again, and the school receives the money twice.
 */
const PaymentResult = ({ status, payment, error, onRetry }) => {
  if (status === 'pending') {
    return (
      <Card padding="p-6" className="border-amber-200 bg-amber-50/60 text-center">
        <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
          <Hourglass className="h-6 w-6" aria-hidden="true" />
        </span>
        <h3 className="text-base font-extrabold text-ink">Check your phone</h3>
        <p className="mx-auto mt-1.5 max-w-sm text-[13px] font-semibold leading-relaxed text-slate-600">
          We have sent a prompt to your number. Approve it and this page will update on its
          own.
        </p>
        <p className="mt-4 rounded-lg bg-white/70 px-3 py-2 text-[12px] font-bold text-amber-800">
          Please do not approve a second prompt — one payment is already in progress.
        </p>
      </Card>
    );
  }

  if (status === 'completed') {
    return (
      <Card padding="p-6" className="border-emerald-200 bg-emerald-50/60 text-center">
        <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
          <CircleCheck className="h-6 w-6" aria-hidden="true" />
        </span>
        <h3 className="text-base font-extrabold text-ink">Payment received</h3>
        <p className="mt-1.5 text-[13px] font-semibold text-slate-600">
          {formatCedi(payment?.amount || 0)} has been received. Thank you.
        </p>
        {payment?.paymentId && (
          <p className="mt-2 font-mono text-[11px] font-bold text-slate-500">
            {payment.paymentId}
          </p>
        )}
        {onRetry && (
          <Button variant="secondary" className="mt-4" onClick={onRetry}>
            <Receipt className="mr-2 h-4 w-4" aria-hidden="true" />
            Download receipt
          </Button>
        )}
      </Card>
    );
  }

  return (
    <Card padding="p-6" className="border-red-200 bg-red-50/60 text-center">
      <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-red-100 text-red-600">
        <CircleAlert className="h-6 w-6" aria-hidden="true" />
      </span>
      <h3 className="text-base font-extrabold text-ink">The payment did not go through</h3>
      <p className="mx-auto mt-1.5 max-w-sm text-[13px] font-semibold leading-relaxed text-slate-600">
        {error ||
          'Your network declined the payment, or the request could not reach it. No money has left your account.'}
      </p>
      {onRetry && (
        <Button variant="primary" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </Card>
  );
};

export default PaymentResult;
