import React from 'react';
import { AlertCircle, CheckCircle2, FileText, TrendingUp } from 'lucide-react';
import Tile from '../dashboard/ui/Tile';
import { formatCediShort, formatCount, formatPercent } from '../../utils/format';

/**
 * The four headline tiles.
 *
 * Every figure here comes from `summary` — the server's aggregate over the whole
 * school — rather than from the visible page. The distinction is not academic:
 * the endpoint returns twenty plans per page, so a client that totalled the rows
 * it happened to be looking at would report a school of 4,000 as owing whatever
 * twenty families happen to owe. `summary` exists so that mistake cannot be made
 * quietly.
 *
 * **Counts lead, money follows.** "11 students" and "GHC 3,450" answer different
 * questions — how much work is there, and how much money is at stake — and a
 * bursar triaging a morning needs the first before the second. Leading with the
 * cedi figure also reads as a bigger number, which is the wrong impression for a
 * school that is mostly on track.
 *
 * The count-only tile also states its denominator, because "142" means nothing
 * without knowing it is 142 of 176.
 */
const ComplianceKpiRow = ({ summary, loading }) => {
  const onTrack = summary?.onTrack ?? 0;
  const approaching = summary?.approachingDue ?? 0;
  const overdue = summary?.overdue ?? 0;
  const active = summary?.activePlans ?? 0;

  // The rate is the server's, and `null` when there is nothing in flight. Shown
  // as a dash rather than 0% or 100%: a school with no active plans has no
  // compliance rate at all, and rendering "0%" would read as total failure.
  const rate = summary?.complianceRate;
  const hasRate = rate !== null && rate !== undefined;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Tile
        label="On Track"
        icon={CheckCircle2}
        accent="green"
        value={loading ? '—' : formatCount(onTrack)}
        valueTone="text-ink"
        badge={
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="h-[18px] w-[18px]" aria-hidden="true" />
          </span>
        }
        footer={
          <p className="text-[11px] font-semibold text-slate-500">
            {hasRate ? `${formatPercent(rate)} of active plans` : 'No active plans yet'} &middot;
            zero overdue tranches
          </p>
        }
      />

      <Tile
        label="Approaching Due (Next 5 Days)"
        icon={TrendingUp}
        accent="amber"
        value={loading ? '—' : formatCount(approaching)}
        valueTone="text-ink"
        suffix="students"
        badge={
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
            <TrendingUp className="h-[18px] w-[18px]" aria-hidden="true" />
          </span>
        }
        footer={
          <p className="text-[11px] font-semibold text-slate-500">
            {formatCediShort(summary?.approachingInflow ?? 0)} expected inflow
          </p>
        }
      />

      <Tile
        label="Overdue Installments"
        icon={AlertCircle}
        accent="red"
        value={loading ? '—' : formatCount(overdue)}
        valueTone="text-red-600"
        suffix="students"
        badge={
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600">
            <AlertCircle className="h-[18px] w-[18px]" aria-hidden="true" />
          </span>
        }
        footer={
          <p className="text-[11px] font-semibold text-red-600">
            {formatCediShort(summary?.overdueArrears ?? 0)} arrears &middot; immediate action
          </p>
        }
      />

      <Tile
        label="Total Active Plans"
        icon={FileText}
        accent="green"
        value={loading ? '—' : formatCount(active)}
        valueTone="text-emerald-600"
        suffix="active plans"
        badge={
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
            <FileText className="h-[18px] w-[18px]" aria-hidden="true" />
          </span>
        }
        footer={
          <p className="text-[11px] font-semibold text-slate-500">
            Covering {formatCediShort(summary?.committedAmount ?? 0)} committed
          </p>
        }
      />
    </div>
  );
};

export default ComplianceKpiRow;
