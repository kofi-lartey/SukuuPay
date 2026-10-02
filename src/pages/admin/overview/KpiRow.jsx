import React from 'react';
import {
  Banknote,
  Building2,
  HandCoins,
  MessageSquare,
  PiggyBank,
  TrendingUp,
} from 'lucide-react';
import Tile, { CediValue } from '../../../components/dashboard/ui/Tile';
import ProgressBar from '../../../components/dashboard/charts/ProgressBar';
import { formatCediShort, formatCount, formatPercent } from '../../../utils/format';

/**
 * The platform console's KPI band.
 *
 * Ordered by what a platform operator actually decides on, which is not the same
 * order a school dashboard uses. A bursar opens their day with "who owes me"; an
 * operator opens theirs with "how many schools do I have, how many are paying, and
 * what did I earn" — so the band is: reach → conversion → this month → all time →
 * what the platform earns → what it owes.
 *
 * **Every figure is read straight from `GET /admin/dashboard`.** None of them is
 * derived from another card, and none is a local calculation over a partial set.
 * That constraint is the reason this band can be trusted: there is no arithmetic
 * here that could disagree with the API, and no field that is decoration read as
 * measurement — which is how the school Overview ended up with a 98% "MoMo direct
 * billing" rate that no endpoint ever returned.
 *
 * One derived figure survives, because it is derived from two fields of the same
 * response and labelled as a rate: the trial→paid conversion under the schools
 * tile. It is the number that says whether the sales motion is working.
 *
 * All money is pesewas on the wire; `CediValue` takes pesewas and splits the
 * symbol from the digits the way the design sets them.
 */
const KpiRow = ({ kpis }) => {
  const schools = kpis?.schools || {};
  const payments = kpis?.payments || {};

  const total = Number(schools.total) || 0;
  // `paid` is a count of schools on a paid plan; `onTrial` is a count of schools
  // on trial. Their sum is not necessarily `total` — a school can be neither, and
  // the endpoint does not guarantee a fourth bucket. So the conversion rate is
  // taken over `paid + onTrial`, the two states the endpoint *does* report, and
  // its label says so rather than implying it covers every school.
  const conversionBase = (Number(schools.paid) || 0) + (Number(schools.onTrial) || 0);
  const conversionPercent = conversionBase ? ((Number(schools.paid) || 0) / conversionBase) * 100 : 0;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      <Tile
        label="Schools on platform"
        icon={Building2}
        value={formatCount(total)}
        footer={
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] font-semibold text-slate-500">Trial converted to paid</span>
              <span className="text-[11px] font-extrabold text-ink">
                {conversionBase ? formatPercent(conversionPercent) : '—'}
              </span>
            </div>
            <ProgressBar value={conversionPercent} label="Trial schools converted to a paid plan" />
          </div>
        }
      />

      <Tile
        label="Active schools"
        icon={TrendingUp}
        value={formatCount(schools.active)}
        footer={
          <p className="text-[11px] font-semibold text-slate-500">
            <span className="font-extrabold text-ink">{formatCount(schools.onTrial)}</span> on trial
            {Number(schools.suspended) ? ` · ${formatCount(schools.suspended)} suspended` : ''}
          </p>
        }
      />

      <Tile
        label="Revenue this month"
        icon={Banknote}
        accent
        valueTone="text-brand-700"
        value={<CediValue pesewas={payments.mtdRevenue} tone="text-brand-700" />}
        footer={
          <p className="text-[11px] font-semibold text-slate-500">
            <span className="font-extrabold text-ink">{formatCount(payments.mtdCount)}</span> payments this month
          </p>
        }
      />

      <Tile
        label="Revenue year to date"
        icon={TrendingUp}
        value={<CediValue pesewas={payments.ytdRevenue} />}
        footer={
          <p className="text-[11px] font-semibold text-slate-500">
            <span className="font-extrabold text-ink">{formatCount(payments.ytdCount)}</span> payments
          </p>
        }
      />

      <Tile
        label="Platform markup"
        icon={PiggyBank}
        value={<CediValue pesewas={payments.platformMarkup} />}
        footer={
          <p className="text-[11px] font-semibold text-slate-500">
            Earned on {formatCount(payments.totalCompleted)} completed payments
          </p>
        }
      />

      <Tile
        label="Pending payouts"
        icon={HandCoins}
        valueTone={Number(payments.pendingPayouts) ? 'text-amber-600' : 'text-ink'}
        value={<CediValue pesewas={payments.pendingPayouts} tone={Number(payments.pendingPayouts) ? 'text-amber-600' : 'text-ink'} />}
        footer={
          <p className="text-[11px] font-semibold text-slate-500">
            All time <span className="font-extrabold text-ink">{formatCediShort(payments.totalRevenue)}</span>
          </p>
        }
      />
    </div>
  );
};

export default KpiRow;