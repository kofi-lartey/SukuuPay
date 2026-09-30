import React from 'react';
import {
  CircleCheck,
  Clock,
  GraduationCap,
  TrendingUp,
  TriangleAlert,
  Users,
} from 'lucide-react';
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
 */
const KpiRow = ({ kpis }) => (
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
    <Tile
      label="Total Students"
      icon={Users}
      value={formatCount(kpis.totalStudents.value)}
      footer={
        <p className="flex items-start gap-2 text-[11px] font-semibold leading-snug text-slate-500">
          <CircleCheck className="mt-px h-3.5 w-3.5 shrink-0 text-brand-600" aria-hidden="true" />
          <span>
            <span className="font-extrabold text-brand-700">
              {formatPercent(kpis.totalStudents.enrollmentPercent)}
            </span>{' '}
            {kpis.totalStudents.enrollmentNote}
          </span>
        </p>
      }
    />

    <Tile
      label="Total Expected Owed"
      icon={GraduationCap}
      value={<CediValue pesewas={kpis.expectedOwed.amount} />}
      footer={
        <p className="flex items-start gap-2 text-[11px] font-semibold leading-snug text-slate-500">
          <GraduationCap className="mt-px h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
          {kpis.expectedOwed.scopeNote}
        </p>
      }
    />

    <Tile
      label="Total Collected"
      icon={TrendingUp}
      accent
      valueTone="text-brand-700"
      badge={
        <Badge tone="green" icon={TrendingUp}>
          {kpis.collected.deltaPercent > 0 ? '+' : ''}
          {kpis.collected.deltaPercent}% {kpis.collected.deltaLabel}
        </Badge>
      }
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
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-start gap-2 text-[11px] font-semibold leading-snug text-slate-500">
            <Clock className="mt-px h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
            <span>
              <span className="font-extrabold text-ink">{kpis.overdue.onGrace}</span>{' '}
              {kpis.overdue.graceNote}
            </span>
          </p>
          <p className="shrink-0 text-[11px] font-extrabold text-red-600">
            {formatCediShort(kpis.overdue.amount)}
          </p>
        </div>
      }
    />
  </div>
);

export default KpiRow;
