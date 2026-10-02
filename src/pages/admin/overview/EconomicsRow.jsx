import React from 'react';
import { Info, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import Card from '../../../components/dashboard/ui/Card';
import Badge from '../../../components/dashboard/ui/Badge';
import { CediValue } from '../../../components/dashboard/ui/Tile';
import { formatCount, formatPercent } from '../../../utils/format';

/**
 * The subscription economics, which are a different question from the KPI band above.
 *
 * `KpiRow` is built on payments — what was collected, how many schools, what the
 * platform keeps per transaction. Those are **transaction** figures and they move
 * daily. This strip is the **recurring** side: MRR, ARR, churn and growth, which
 * describe the subscription base and move monthly. Putting them in the same six
 * tiles would read as one set and invite the comparison "did churn go up because
 * collections fell?", which compares a monthly rate against a daily total and
 * answers nothing.
 *
 * **ARR is labelled as a projection, in the tile itself rather than in a comment.**
 * It is `MRR × 12` — an extrapolation of one month's run rate across a year, which
 * assumes nobody churns, nobody upgrades and nobody downgrades. Every SaaS ARR
 * figure is a projection; the ones that do not say so are the ones that mislead,
 * and a platform with eleven schools should not be showing a twelve-figure number
 * without the word.
 *
 * **Growth and churn are shown with direction and colour together, never colour
 * alone.** A red churn number rising is bad; a green one rising is good, and they
 * are the same red. The icon carries the meaning for anyone who cannot see the
 * colour, and the sign carries it for everyone else.
 */
const DirectionBadge = ({ value, invert = false, format = formatPercent }) => {
  const n = Number(value);

  if (!Number.isFinite(n) || n === 0) {
    return (
      <Badge tone="slate" icon={Minus}>
        No change
      </Badge>
    );
  }

  const rising = n > 0;
  // `invert` marks a metric where up is bad (churn), so the same rising number gets
  // the opposite tone. Without it, rising churn and rising growth would render
  // identically, which is the mistake this prop exists to prevent.
  const good = invert ? !rising : rising;
  const Icon = rising ? TrendingUp : TrendingDown;

  return (
    <Badge tone={good ? 'green' : 'red'} icon={Icon}>
      {rising ? '+' : ''}
      {format(n)}
    </Badge>
  );
};

const EconomicsRow = ({ state }) => {
  const data = state?.data || {};

  /*
   * Read through a normaliser, because the flat names this band was first written
   * against — `monthlyRecurringRevenue`, `annualRecurringRevenue`, `churnRate` — do
   * not exist. `GET /admin/overview` nests them: `revenue.mrr`, `revenue.arr`,
   * `churn.churnRatePercent`, `schools.newThisMonth`.
   *
   * That made the whole band render nothing, silently, because the old gate below
   * bailed on a missing `monthlyRecurringRevenue` — the same class of failure as the
   * `.map` in `HealthCard`, and the same reason a green build did not catch either: a
   * component that quietly renders `null` looks exactly like a component that has
   * nothing to show.
   *
   * Both spellings are accepted so the server can flatten the payload later without
   * this band silently disappearing a second time.
   */
  const mrr = Number(data.revenue?.mrr ?? data.monthlyRecurringRevenue) || 0;
  const arr = Number(data.revenue?.arr ?? data.annualRecurringRevenue) || 0;
  const churnRate = Number(data.churn?.churnRatePercent ?? data.churnRate);
  const newSchools = Number(data.schools?.newThisMonth ?? data.newSchools) || 0;
  const growthPercent = Number(data.schools?.growthPercent ?? data.growthPercent);

  if (state?.loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((tile) => (
          <div key={tile} className="h-[8.5rem] animate-pulse rounded-2xl bg-slate-200/70" />
        ))}
      </div>
    );
  }

  /*
   * A failed fetch renders nothing at all rather than four zero tiles.
   *
   * Four zeros here would say "MRR is zero, ARR is zero, churn is zero, growth is
   * zero" — and "churn zero" in particular reads as wonderful rather than as unknown.
   * There is no headline the band should take over for, because the transaction KPIs
   * above it are a different question and remain correct; this is the one place where
   * absence is more honest than zero.
   */
  if (state?.error || !data.revenue) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Card padding="p-5">
        <p className="text-[13px] font-extrabold leading-tight text-slate-600">
          Monthly recurring revenue
        </p>
        <p className="mt-4 flex items-baseline gap-1.5">
          <CediValue pesewas={mrr} />
        </p>
        <p className="mt-4 text-[11px] font-semibold leading-snug text-slate-500">
          Subscription fees from schools on an active paid plan.
        </p>
      </Card>

      <Card padding="p-5">
        <p className="text-[13px] font-extrabold leading-tight text-slate-600">
          Annual run rate
        </p>
        <p className="mt-4 flex items-baseline gap-1.5">
          <CediValue pesewas={arr} tone="text-slate-700" />
          <span className="text-[11px] font-extrabold text-slate-400">projected</span>
        </p>
        <p className="mt-4 flex items-start gap-1.5 text-[11px] font-semibold leading-snug text-slate-500">
          <Info className="mt-0.5 h-3 w-3 shrink-0 text-slate-400" aria-hidden="true" />
          <span>
            This month&apos;s MRR extrapolated twelve times. It assumes no churn, no
            upgrades and no downgrades — it is a projection, not a forecast anyone has
            modelled.
          </span>
        </p>
      </Card>

      <Card padding="p-5">
        <p className="text-[13px] font-extrabold leading-tight text-slate-600">
          Churn this month
        </p>
        <p className="mt-4 flex items-baseline gap-2">
          <span className="text-[28px] font-extrabold leading-none tracking-tight text-ink">
            {formatPercent(churnRate || 0)}
          </span>
          <DirectionBadge value={churnRate} invert />
        </p>
        <p className="mt-4 text-[11px] font-semibold leading-snug text-slate-500">
          Schools that went from active or trial to suspended or cancelled, over the
          schools active at the start of the month.
        </p>
      </Card>

      <Card padding="p-5">
        <p className="text-[13px] font-extrabold leading-tight text-slate-600">
          Growth this month
        </p>
        <p className="mt-4 flex items-baseline gap-2">
          <span className="text-[28px] font-extrabold leading-none tracking-tight text-ink">
            {formatCount(newSchools)}
          </span>
          <DirectionBadge value={growthPercent} />
        </p>
        <p className="mt-4 text-[11px] font-semibold leading-snug text-slate-500">
          New schools signed up this month, against last month.
        </p>
      </Card>
    </div>
  );
};

export default EconomicsRow;