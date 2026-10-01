import React from 'react';
import { ArrowDownRight, ArrowUpRight, Building2, Clock, Smartphone } from 'lucide-react';
import Tile, { CediValue } from '../dashboard/ui/Tile';
import Badge from '../dashboard/ui/Badge';
import { formatCedi, formatCediShort, formatCount, formatPercent } from '../../utils/format';

/**
 * The module's KPI band.
 *
 * Every figure here comes from `GET /payments/summary` — never from summing the
 * rows in the table below it. The table is capped at 100 rows per page, so a
 * client-side total would report page one of a school with 3,000 transactions
 * as the term's inflow, and it would look entirely plausible.
 *
 * **There is no "pending sweep" tile, and its absence is deliberate.** The design
 * this was built from shows a fourth tile for money awaiting a bank settlement,
 * with an "escrow cleared" badge and a next-sweep time. Nothing in this backend
 * records when collected money reached a bank: `Payment.settlement.appliedAt`
 * marks the moment a student's *balance* was credited, which is a different
 * event, and there is no settlement-batch collection or sweep job. A tile like
 * that could only have been filled with a placeholder — and a plausible-looking
 * cedi figure on a payments screen is the single most dangerous thing this module
 * could render, because a bursar reconciles against it.
 *
 * The fourth slot therefore shows the one genuinely outstanding state that *is*
 * measured: payments sitting in `pending` or `processing`, waiting on a gateway
 * callback that has not arrived yet. Those are real rows in the table underneath,
 * and the tile's count is a link to exactly them.
 */

const TrendBadge = ({ percent }) => {
  // `null` means the comparison period had no completed payments. That is not a
  // 0% trend — there is no prior figure to have grown from — so nothing is shown
  // rather than a confident "+0.0%".
  if (percent === null || percent === undefined) return null;

  const up = percent >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;

  return (
    <Badge tone={up ? 'green' : 'red'} icon={Icon}>
      {`${up ? '+' : ''}${formatPercent(percent)}`}
    </Badge>
  );
};

const UnavailableTile = ({ label, icon: Icon }) => (
  <Tile
    label={label}
    icon={Icon}
    value={<span className="text-slate-300">—</span>}
    footer={
      <p className="text-[11px] font-semibold text-slate-400">
        Not available — the summary could not be loaded.
      </p>
    }
  />
);

const PaymentKpiRow = ({ summary, loading, error }) => {
  if (error || (!loading && !summary)) {
    return (
      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <UnavailableTile label="Total inflow" icon={Building2} />
        <UnavailableTile label="Mobile money volume" icon={Smartphone} />
        <UnavailableTile label="Other networks" icon={Smartphone} />
        <UnavailableTile label="Awaiting confirmation" icon={Clock} />
      </div>
    );
  }

  const networks = summary?.networks || [];
  const totalInflow = summary?.totalInflow || 0;

  // The band splits Mobile Money by network, and the largest network gets its own
  // tile because a single dominant network is the figure a bursar checks against
  // a provider statement. The rest are summed — "the other networks" is the
  // useful complement, and a tile per remaining network would be four tiles of
  // noise on a school with one active network.
  const [leading, ...rest] = [...networks].sort((a, b) => b.amount - a.amount);
  const othersAmount = rest.reduce((sum, n) => sum + (n.amount || 0), 0);
  const othersCount = rest.reduce((sum, n) => sum + (n.count || 0), 0);
  const othersWallets = rest.reduce((sum, n) => sum + (n.wallets || 0), 0);
  const othersLabel = rest.length ? rest.map((n) => n.label.replace(' Money', '')).join(' & ') : 'Other networks';

  const awaiting = summary?.awaitingConfirmation || { amount: 0, count: 0 };

  const skeleton = (label, icon) => (
    <Tile
      label={label}
      icon={icon}
      value={<span className="inline-block h-7 w-28 animate-pulse rounded bg-slate-100" />}
      footer={<div className="h-3 w-32 animate-pulse rounded bg-slate-100" />}
    />
  );

  return (
    <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {loading || !summary ? (
        <>
          {skeleton('Total inflow', Building2)}
          {skeleton('Mobile money volume', Smartphone)}
          {skeleton('Other networks', Smartphone)}
          {skeleton('Awaiting confirmation', Clock)}
        </>
      ) : (
        <>
          <Tile
            label="Total inflow"
            icon={Building2}
            badge={<TrendBadge percent={summary.trendPercent} />}
            value={<CediValue pesewas={totalInflow} />}
            accent
            footer={
              <div>
                <p className="text-[11px] font-semibold text-slate-500">
                  {formatCount(summary.totalTransactions)} successful transaction
                  {summary.totalTransactions === 1 ? '' : 's'} collected
                </p>
                {summary.previousTotalInflow > 0 && (
                  <p className="mt-0.5 text-[11px] font-semibold text-slate-400">
                    Previous period {formatCedi(summary.previousTotalInflow)}
                  </p>
                )}
              </div>
            }
          />

          <Tile
            label={leading?.label ? `${leading.label} volume` : 'Mobile money volume'}
            icon={Smartphone}
            badge={
              leading ? (
                <Badge tone="amber" dot="mtn">
                  {`${formatPercent(leading.sharePercent)} share`}
                </Badge>
              ) : null
            }
            value={<CediValue pesewas={leading?.amount || 0} />}
            footer={
              <p className="text-[11px] font-semibold text-slate-500">
                {formatCount(leading?.wallets || 0)} distinct mobile wallet
                {(leading?.wallets || 0) === 1 ? '' : 's'}
              </p>
            }
          />

          <Tile
            label={othersLabel}
            icon={Smartphone}
            badge={
              <Badge tone="slate">{`${formatPercent(
                totalInflow ? (othersAmount / totalInflow) * 100 : 0
              )} share`}</Badge>
            }
            value={<CediValue pesewas={othersAmount} />}
            footer={
              <p className="text-[11px] font-semibold text-slate-500">
                {formatCount(othersCount)} collection{othersCount === 1 ? '' : 's'} across{' '}
                {formatCount(othersWallets)} wallet{othersWallets === 1 ? '' : 's'}
              </p>
            }
          />

          <Tile
            label="Awaiting confirmation"
            icon={Clock}
            badge={
              <Badge tone={awaiting.count ? 'amber' : 'green'}>
                {awaiting.count ? 'In progress' : 'All settled'}
              </Badge>
            }
            value={
              <span className={awaiting.count ? 'text-amber-600' : 'text-emerald-600'}>
                {formatCediShort(awaiting.amount)}
              </span>
            }
            footer={
              <p className="text-[11px] font-semibold text-slate-500">
                {awaiting.count
                  ? `${formatCount(awaiting.count)} transaction${awaiting.count === 1 ? '' : 's'} waiting on a provider callback`
                  : 'No payments are waiting on a provider callback'}
              </p>
            }
          />
        </>
      )}
    </div>
  );
};

export default PaymentKpiRow;