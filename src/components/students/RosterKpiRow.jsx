import React from 'react';
import { CircleCheck, HandCoins, Receipt, TriangleAlert } from 'lucide-react';
import Tile from '../dashboard/ui/Tile';
import ProgressBar from '../dashboard/charts/ProgressBar';
import { formatCediShort, formatCount, formatPercent } from '../../utils/format';

/**
 * The roster's KPI band.
 *
 * Reuses the Overview's `Tile` rather than declaring its own four cards, so the
 * two screens read as one system: same radius, same label weight, same figure
 * size. Two KPI rows in one app that do not match is the clearest sign of a UI
 * assembled screen by screen.
 *
 * The figures come from `GET /students/stats`, never from summing the visible
 * page. The list is paginated at twenty, so a client-side sum of a 1,000-student
 * school reports the first twenty as the school — and "fully cleared" is a
 * comparison against a computed balance that the client cannot make anyway.
 */
const RosterKpiRow = ({ stats, loading }) => {
  if (loading || !stats) {
    return (
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-200/60" />
        ))}
      </div>
    );
  }

  const collectionRate = stats.totalOwed
    ? (stats.totalPaid / stats.totalOwed) * 100
    : 0;

  return (
    <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Tile
        label="Total Roster"
        icon={Receipt}
        value={formatCount(stats.totalRoster)}
        footer={
          <p className="text-[11px] font-semibold text-slate-500">
            <span className="font-extrabold text-brand-700">
              {formatCount(stats.activePlanStudents)}
            </span>{' '}
            on an installment plan
          </p>
        }
      />

      <Tile
        label="Fully Cleared"
        icon={CircleCheck}
        value={formatCount(stats.fullyCleared)}
        valueTone="text-emerald-600"
        footer={
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-extrabold text-slate-500">Share of roster</span>
              <span className="text-[11px] font-extrabold text-ink">
                {formatPercent(stats.clearedPercent)}
              </span>
            </div>
            <ProgressBar value={stats.clearedPercent} label="Share fully cleared" barClassName="bg-emerald-500" />
          </div>
        }
      />

      <Tile
        label="Installment Pledges"
        icon={HandCoins}
        value={formatCount(stats.activePlans)}
        valueTone="text-amber-600"
        footer={
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-extrabold text-slate-500">Collection rate</span>
              <span className="text-[11px] font-extrabold text-ink">
                {formatPercent(collectionRate)}
              </span>
            </div>
            <ProgressBar value={collectionRate} label="Collection rate" barClassName="bg-amber-500" />
          </div>
        }
      />

      <Tile
        label="Overdue Balances"
        icon={TriangleAlert}
        value={formatCount(stats.overdueStudents)}
        valueTone="text-red-600"
        footer={
          <p className="text-[11px] font-semibold text-slate-500">
            <span className="font-extrabold text-red-600">
              {formatCediShort(stats.overdueAmount)}
            </span>{' '}
            outstanding past deadline
          </p>
        }
      />
    </div>
  );
};

export default RosterKpiRow;
