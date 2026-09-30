import React from 'react';
import { GraduationCap, TrendingUp, TriangleAlert, Users } from 'lucide-react';
import Tile, { CediValue } from '../../../components/dashboard/ui/Tile';
import Badge from '../../../components/dashboard/ui/Badge';
import ProgressBar from '../../../components/dashboard/charts/ProgressBar';
import { formatCediShort, formatCount, formatPercent } from '../../../utils/format';

/**
 * The overview module's KPI band.
 *
 * The four tiles answer, in order, the questions a bursar opens the day with:
 * how many students, how much is owed, how much has come in, who is late. Only
 * the collected figure is green — it is the only one that is an achievement —
 * and only the overdue tile is red, carrying the only urgent badge.
 *
 * **Every figure here is read straight from `GET /students/stats`.** The band
 * used to carry four more numbers from `data/dashboardDemo.js` — a 98%
 * "enrolled in MoMo direct billing" rate, a "vs L/T +12%" delta, a "11 on
 * Installment grace" count, and a "across all classes (P1 to JHS 3)" scope note.
 * None of them has a source: the stats endpoint returns no enrollment rate, no
 * prior-term comparison and no grace cohort, so they were decoration that read
 * as measurement. The notes are gone rather than reworded, because a bursar
 * reconciling these tiles against a bank statement is owed only the number that
 * came from the server.
 *
 * The two that survive are derived, not stored: the collection rate is
 * `collected / expectedOwed`, and the overdue amount is the server's own sum.
 */
const KpiRow = ({ kpis }) => (
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
    <Tile
      label="Total Students"
      icon={Users}
      value={formatCount(kpis.totalStudents.value)}
    />

    <Tile
      label="Total Expected Owed"
      icon={GraduationCap}
      value={<CediValue pesewas={kpis.expectedOwed.amount} />}
    />

    <Tile
      label="Total Collected"
      icon={TrendingUp}
      accent
      valueTone="text-brand-700"
      value={<CediValue pesewas={kpis.collected.amount} tone="text-brand-700" />}
      footer={
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] font-extrabold text-slate-500">
              {kpis.collected.rateLabel}
            </span>
            <span className="text-[11px] font-extrabold text-ink">
              {formatPercent(kpis.collected.ratePercent)}
            </span>
          </div>
          <ProgressBar
            value={kpis.collected.ratePercent}
            label={kpis.collected.rateLabel}
            className="w-full"
          />
        </div>
      }
    />

    <Tile
      label="Overdue Students"
      icon={TriangleAlert}
      valueTone="text-red-600"
      suffix="learners"
      badge={
        <Badge tone="red" dot>
          Immediate Attention
        </Badge>
      }
      value={formatCount(kpis.overdue.students)}
      footer={
        <p className="flex items-center justify-between gap-3 text-[11px] font-extrabold text-red-600">
          <span className="font-semibold text-slate-500">Outstanding overdue</span>
          {formatCediShort(kpis.overdue.amount)}
        </p>
      }
    />
  </div>
);

export default KpiRow;
