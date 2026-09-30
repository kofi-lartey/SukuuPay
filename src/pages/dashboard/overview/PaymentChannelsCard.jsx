import React from 'react';
import Card from '../../../components/dashboard/ui/Card';
import Badge from '../../../components/dashboard/ui/Badge';
import StackedBar from '../../../components/dashboard/charts/StackedBar';
import { formatCediShort, formatCount, formatPercent } from '../../../utils/format';

const SEGMENT_CLASS = {
  mtn: 'bg-momo-mtn',
  telecel: 'bg-momo-telecel',
  at: 'bg-momo-at',
};

/**
 * Where the money came from, by network.
 *
 * A stacked bar plus a per-network list rather than a pie. Three slices with a
 * stated share each: the bar answers "roughly how is it split" in one glance and
 * the list gives the exact figures, and neither has to be read against radial
 * angles. A pie would also put MTN's 68% and AT's 10% at arc lengths that are
 * hard to compare, when the comparison is the entire point.
 *
 * The authorisation rate is the number that earns this card its place on the
 * Overview: it is per network, and a school whose AT Money authorisations are
 * failing needs to know before parents start reporting that they were charged.
 */
const PaymentChannelsCard = ({ channels, isDemo }) => (
  <Card padding="p-5" className="flex flex-col">
    <div className="mb-4 flex items-center justify-between gap-3">
      <h3 className="text-base font-extrabold tracking-tight text-ink">Payment Channels</h3>
      <Badge tone="brand">Automated</Badge>
    </div>

    <StackedBar
      segments={channels.map((c) => ({
        key: c.key,
        label: c.network,
        value: c.amount,
        className: SEGMENT_CLASS[c.key],
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
                  className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${SEGMENT_CLASS[channel.key]}`}
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-extrabold text-ink">{channel.network}</p>
                  <p className="text-[11px] font-semibold text-slate-500">
                    {formatPercent(channel.sharePercent)} Share •{' '}
                    {formatCount(channel.accounts)} Accounts
                  </p>
                </div>
              </div>

              <div className="shrink-0 text-right">
                <p className="text-[13px] font-extrabold text-brand-700">
                  {formatCediShort(channel.amount)}
                </p>
                <p className="text-[11px] font-semibold text-slate-500">
                  {formatPercent(channel.authRatePercent)} Auth rate
                </p>
              </div>
            </div>
          </div>
        </li>
      ))}
    </ul>

    {isDemo && (
      <p className="mt-4 text-[11px] font-semibold text-slate-400">
        Demo data. Backed by GET /reports/payment-methods/:schoolId once wired.
      </p>
    )}
  </Card>
);

export default PaymentChannelsCard;
