import React from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, ChevronRight } from 'lucide-react';
import Card from '../../../components/dashboard/ui/Card';
import Badge from '../../../components/dashboard/ui/Badge';
import { ROUTES } from '../../../utils/constants';
import { formatCediShort, formatCediWhole, formatCount } from '../../../utils/format';

/**
 * The next few days of scheduled collections.
 *
 * A forward-looking card sitting under a backward-looking one. That pairing is
 * deliberate: a bursar reading this column asks two questions in order — what has
 * come in, and what is about to. Putting the second directly under the first
 * answers both without a module change.
 *
 * The horizon is fixed at the design's five days rather than "the rest of the
 * month". A month of tranches is a report, not a glance, and belongs on Reports;
 * five days is the window in which a school can still act on a family who cannot
 * pay.
 */
const UpcomingInstallmentsCard = ({ upcoming, isDemo }) => (
  <Card padding="p-5" className="flex flex-col">
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
          <CalendarClock className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
        <h3 className="text-base font-extrabold leading-tight tracking-tight text-ink">
          Upcoming Installments
        </h3>
      </div>
      <Badge tone="slate">Next {upcoming.horizonDays} Days</Badge>
    </div>

    <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4">
      <div>
        <p className="text-2xl font-extrabold leading-none tracking-tight text-ink">
          {formatCount(upcoming.scheduledTranches)}
        </p>
        <p className="mt-1 text-[11px] font-semibold leading-snug text-slate-500">
          Scheduled Tranches
        </p>
      </div>
      <div className="text-right">
        <p className="text-2xl font-extrabold leading-none tracking-tight text-brand-700">
          {formatCediWhole(upcoming.expectedInflow)}
        </p>
        <p className="mt-1 text-[11px] font-semibold leading-snug text-slate-500">
          Expected Inflow
        </p>
      </div>
    </div>

    <ul className="mt-3 flex flex-col divide-y divide-slate-100">
      {upcoming.days.map((day) => (
        <li key={day.dateLabel} className="flex items-center justify-between gap-3 py-2.5">
          <span className="min-w-0">
            <span className="block truncate text-[12px] font-extrabold text-ink">
              {day.dateLabel}
            </span>
            <span className="block text-[11px] font-semibold text-slate-500">
              {formatCount(day.students)} students
            </span>
          </span>
          <span className="shrink-0 text-[13px] font-extrabold tabular-nums text-ink">
            {formatCediShort(day.amount)}
          </span>
        </li>
      ))}
    </ul>

    <Link
      to={ROUTES.DASHBOARD_PLANS}
      className="mt-3 inline-flex items-center justify-center gap-1 rounded-xl bg-slate-100 px-4 py-2.5 text-[13px] font-extrabold text-slate-700 transition-colors hover:bg-slate-200"
    >
      View Compliance Schedule
      <ChevronRight className="h-4 w-4" aria-hidden="true" />
    </Link>

    {isDemo && (
      <p className="mt-3 text-[11px] font-semibold text-slate-400">
        Demo data. No dated tranches endpoint exists yet — see getUpcomingInstallments.
      </p>
    )}
  </Card>
);

export default UpcomingInstallmentsCard;
