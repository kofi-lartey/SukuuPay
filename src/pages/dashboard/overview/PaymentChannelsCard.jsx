import React from 'react';
import Card from '../../../components/dashboard/ui/Card';
import Badge from '../../../components/dashboard/ui/Badge';
import StackedBar from '../../../components/dashboard/charts/StackedBar';
import { formatCediShort, formatCount, formatPercent } from '../../../utils/format';

const SEGMENT_CLASS = {
  momo: 'bg-momo-mtn',
  card: 'bg-momo-telecel',
  bank_transfer: 'bg-momo-at',
  manual: 'bg-slate-300',
};

/**
 * Where the money came from, by payment method.
 *
 * A stacked bar plus a per-method list rather than a pie. Three slices with a
 * stated share each: the bar answers "roughly how is it split" in one glance and
 * the list gives the exact figures, and neither has to be read against radial
 * angles.
 *
 * **This reads `GET /reports/payment-methods/:schoolId`, which groups by payment
 * method.** The card previously claimed a per-network split — MTN 68% with a
 * 99.4% authorisation rate, Telecel 22%, AT 10% — plus a count of "accounts"
 * that added to exactly the 1,000-student fixture headline. None of that
 * endpoint exists: there is no group-by-network aggregation, no authorisation-rate
 * metric and no account count. The figures came from `data/dashboardDemo.js` and
 * were internally consistent only with each other.
 *
 * So the card was rebuilt on what the server actually returns —
 * `{ label, amount, count, percentage }` — and the two numbers with no source are
 * gone rather than relabelled. "count" is a count of *transactions*, not
 * accounts, and saying so is the difference between a real figure and a plausible
 * one. The authorisation rate was the number that justified the card's place on
 * the Overview; there is no honest substitute for it yet, so the card reports the
 * split and stops there.
 */
const PaymentChannelsCard = ({ channels = [] }) => {
  if (!channels.length) {
    return (
      <Card padding="p-5" className="flex flex-col">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-base font-extrabold tracking-tight text-ink">
            Payment Channels
          </h3>
          <Badge tone="brand">Automated</Badge>
        </div>
        <p className="text-[12px] font-medium leading-relaxed text-slate-500">
          No completed payments in this period yet. The split by MoMo, card, bank
          transfer and manual appears here as soon as there are some.
        </p>
      </Card>
    );
  }

  return (
    <Card padding="p-5" className="flex flex-col">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-base font-extrabold tracking-tight text-ink">
          Payment Channels
        </h3>
        <Badge tone="brand">Automated</Badge>
      </div>

      <StackedBar
        segments={channels.map((c) => ({
          key: c.key,
          label: c.label,
          value: c.amount,
          className: SEGMENT_CLASS[c.key] || 'bg-slate-300',
        }))}
        className="mb-5"
      />

      <ul className="flex flex-col gap-3">
        {channels.map((channel) => (
          <li key={channel.key}>
            <div className="rounded-xl bg-slate-50 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2.5">
                  <span
                    className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                      SEGMENT_CLASS[channel.key] || 'bg-slate-300'
                    }`}
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-extrabold capitalize text-ink">
                      {channel.key?.replace(/_/g, ' ')}
                    </p>
                    <p className="text-[11px] font-semibold text-slate-500">
                      {formatPercent(channel.sharePercent)} Share •{' '}
                      {formatCount(channel.transactionCount)} Payments
                    </p>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-[13px] font-extrabold text-brand-700">
                    {formatCediShort(channel.amount)}
                  </p>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
};

export default PaymentChannelsCard;
