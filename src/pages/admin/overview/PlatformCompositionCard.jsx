import React from 'react';
import { Building2, MessageSquare, UserCog, Users } from 'lucide-react';
import Card from '../../../components/dashboard/ui/Card';
import StackedBar from '../../../components/dashboard/charts/StackedBar';
import ProgressBar from '../../../components/dashboard/charts/ProgressBar';
import { formatCount, formatPercent } from '../../../utils/format';

/**
 * Platform composition — schools by lifecycle state, and the user base.
 *
 * Two panels in one card because they answer one question between them: *what is
 * the platform made of*. A separate card each would be two cards of two numbers
 * with a heading between them.
 *
 * The school bar is a status split, so the segments carry status colours rather
 * than a categorical palette — green is doing something, red is something someone
 * has to act on, slate is finished. The colours are the same semantic ones the
 * schools table's status badges use, which is what lets an operator read a bar and
 * a list as one system.
 *
 * `StackedBar` returns null for an all-zero set rather than an empty grey pill,
 * which is why the "no schools yet" copy below is doing real work: a platform on
 * day one has a legitimate zero here, and an empty bar alone would read as a chart
 * that failed.
 */
const PlatformCompositionCard = ({ kpis }) => {
  const schools = kpis?.schools || {};
  const users = kpis?.users || {};

  const totalSchools = Number(schools.total) || 0;
  const totalUsers = Number(users.total) || 0;

  const segments = [
    { key: 'active', label: 'Active', value: schools.active, className: 'bg-brand-600' },
    { key: 'onTrial', label: 'On trial', value: schools.onTrial, className: 'bg-amber-400' },
    { key: 'suspended', label: 'Suspended', value: schools.suspended, className: 'bg-red-500' },
    { key: 'archived', label: 'Archived', value: schools.archived, className: 'bg-slate-300' },
  ];

  const staffShare = totalUsers ? ((Number(users.staff) || 0) / totalUsers) * 100 : 0;

  return (
    <Card padding="p-5" className="flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[13px] font-extrabold leading-tight text-ink">What the platform is made of</h2>
          <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
            {formatCount(totalSchools)} schools · {formatCount(totalUsers)} accounts
          </p>
        </div>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
          <Building2 className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
      </div>

      {totalSchools === 0 ? (
        <p className="mt-6 text-[13px] font-semibold text-slate-500">
          No schools have registered yet. The first one to finish provisioning appears here.
        </p>
      ) : (
        <>
          <div className="mt-5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] font-extrabold text-slate-500">Schools by status</span>
              <span className="text-[11px] font-extrabold text-ink">{formatCount(totalSchools)}</span>
            </div>
            <StackedBar segments={segments} className="mt-2" />
          </div>

          {/*
            A legend rather than tooltips alone. The bar's own `title` attributes
            carry the share, which is fine for a mouse and useless on a phone and
            for a screen reader — so the numbers are also written out, and this is
            the row a bar segment's percentage is reconciled against.
          */}
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2">
            {segments.map((segment) => (
              <div key={segment.key} className="flex items-center justify-between gap-2">
                <dt className="flex min-w-0 items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                  <span
                    aria-hidden="true"
                    className={`h-2 w-2 shrink-0 rounded-full ${segment.className}`}
                  />
                  <span className="truncate">{segment.label}</span>
                </dt>
                <dd className="shrink-0 text-[11px] font-extrabold text-ink">
                  {formatCount(segment.value)}
                  {totalSchools > 0 && (
                    <span className="ml-1 font-semibold text-slate-400">
                      {formatPercent(((Number(segment.value) || 0) / totalSchools) * 100)}
                    </span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </>
      )}

      <div className="mt-auto border-t border-slate-100 pt-4">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-[11px] font-extrabold text-slate-500">
            <Users className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
            Staff of all accounts
          </span>
          <span className="text-[11px] font-extrabold text-ink">
            {formatCount(users.staff)}
            <span className="ml-1 font-semibold text-slate-400">
              {totalUsers ? formatPercent(staffShare) : ''}
            </span>
          </span>
        </div>
        <ProgressBar value={staffShare} label="Staff as a share of all platform accounts" className="mt-2" />
        <p className="mt-2 text-[11px] font-semibold text-slate-400">
          {formatCount(users.students)} parents hold the remaining accounts.
        </p>
      </div>
    </Card>
  );
};

/**
 * The platform SMS balance, alone on its own card.
 *
 * It is the platform's **master** credit aggregated across every school
 * (`GET /admin/sms-balance`), not any school's own balance — which is exactly why
 * it lives here and never in a school header. `DashboardLayout` documented the
 * reasoning when it refused to show this figure in the school shell, and that
 * decision is only half of it: a platform-wide number is meaningless to a bursar
 * and actionable to an operator, and the two shells are where those two people
 * are.
 *
 * When it runs out, every school's reminders stop — which is why this is the only
 * figure on the Overview that is allowed to be alarming on its own.
 */
const SmsBalanceCard = ({ kpis }) => {
  const balance = kpis?.sms?.totalBalance;

  return (
    <Card padding="p-5" className="flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[13px] font-extrabold leading-tight text-ink">SMS credit</h2>
          <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
            Master balance, all schools combined
          </p>
        </div>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
          <MessageSquare className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
      </div>

      <p className="mt-5 text-[28px] font-extrabold leading-none tracking-tight text-ink">
        {formatCount(balance)}
      </p>
      <p className="mt-1 text-[11px] font-semibold text-slate-500">messages remaining platform-wide</p>

      <p className="mt-auto pt-4 text-[11px] font-semibold leading-relaxed text-slate-400">
        <UserCog className="mr-1 inline h-3.5 w-3.5 align-text-bottom" aria-hidden="true" />
        When this reaches zero, every school&rsquo;s reminders stop at once.
      </p>
    </Card>
  );
};

export { PlatformCompositionCard, SmsBalanceCard };
export default PlatformCompositionCard;