import React, { useCallback, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  BarChart3,
  Clock,
  FileSpreadsheet,
  Info,
  Loader2,
  Receipt,
  Search,
  ShieldCheck,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import PageHeader from '../../components/dashboard/PageHeader';
import Card from '../../components/dashboard/ui/Card';
import Badge from '../../components/dashboard/ui/Badge';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../hooks/useToast';
import {
  REPORTS,
  REPORT_CATEGORIES,
  runReport,
  downloadReport,
} from '../../services/reports';
import {
  formatCedi,
  formatCediWhole,
  formatCedis,
  formatCount,
  formatPercent,
} from '../../utils/format';
import { ROUTES } from '../../utils/constants';

/**
 * A percentage, or an em dash when its denominator is zero.
 *
 * Every rate on the reports service is `rate(collected, expected)`, which returns
 * a plain `0` when the denominator is falsy. So `collectionRate: 0` means one of
 * two things — nothing billed at all, or nothing collected out of nothing billed —
 * and those are very different facts. The companion `expected` field is what
 * disambiguates them, so the guard is on the denominator and never on the rate
 * itself.
 */
const Rate = ({ value, expected, className = '' }) => {
  if (!expected) {
    return (
      <span className={`text-slate-400 ${className}`} title="Nothing was billed, so there is no rate to calculate">
        —
      </span>
    );
  }
  return <span className={className}>{formatPercent(value)}</span>;
};

const formatDate = (value) => {
  if (!value) return '—';
  const when = new Date(value);
  if (Number.isNaN(when.getTime())) return '—';
  return when.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const SECTIONS = {
  daily: 'Daily collections',
  term: 'Term summary',
  outstanding: 'Outstanding balances',
  overdue: 'Overdue installments',
  'payment-methods': 'Payment methods',
  'class-collections': 'Class collections',
  compliance: 'Installment compliance',
  'headmaster-monthly': 'Headteacher summary',
  'parent-contacts': 'Parent contacts',
};

/**
 * One report's rendering, keyed by `report` — the discriminator every response
 * carries.
 *
 * Split per report rather than one generic table over `rows`, because the nine
 * result sets share no columns. `parent-contacts` has no money in its summary,
 * `compliance` has none anywhere, and `headmaster-monthly`'s rows are
 * metric/value pairs where `value` is money for some rows, a count for others
 * and a percentage for one. A generic renderer would have to guess, and a guess
 * here is a bursar reading "GHS 12" for a headcount.
 */
const ReportBody = ({ report, data }) => {
  const s = data.summary || {};

  if (report === 'headmaster-monthly') {
    // `value` is deliberately not read for display: `display` is already
    // formatted server-side and is correct for all three types.
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Collected this month', value: s.collectedDisplay },
            { label: 'Collected last month', value: formatCedi(s.previousCollected) },
            {
              label: 'Change',
              value: formatCedi(s.monthOnMonthChange),
              tone: s.monthOnMonthChange < 0 ? 'text-red-600' : 'text-emerald-700',
            },
            { label: 'Outstanding', value: s.totalOutstandingDisplay },
          ].map((tile) => (
            <div key={tile.label} className="rounded-xl bg-slate-50 p-3">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                {tile.label}
              </p>
              <p className={`mt-1 text-[15px] font-extrabold ${tile.tone || 'text-ink'}`}>{tile.value ?? '—'}</p>
            </div>
          ))}
        </div>

        <dl className="divide-y divide-slate-100">
          {data.rows.map((row) => (
            <div key={row.metric} className="flex items-center justify-between gap-4 py-2">
              <dt className="text-[13px] font-semibold text-slate-600">{row.metric}</dt>
              <dd className="text-[13px] font-extrabold text-ink">{row.display}</dd>
            </div>
          ))}
        </dl>

        {/*
          The one figure on this page that is not the same measure as the ones
          above it. `collected` is a single month; `totalExpected` and
          `totalCollectedToDate` are lifetime sums over every non-deleted
          student, ignoring year and term. Putting them in one bucket is how a
          month reads as 80% collected when the school is at 40%.
        */}
        <p className="flex items-start gap-2 text-[11px]/[16px] font-medium text-slate-500">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            “Collected this month” is one calendar month. “Total expected” and “Total collected to
            date” are lifetime figures across every enrolled student, so the collection rate below
            is a lifetime rate — not this month’s.
          </span>
        </p>
      </div>
    );
  }

  if (report === 'payment-methods') {
    const max = Math.max(...(data.rows || []).map((r) => r.amount), 0);
    return (
      <div>
        <p className="mb-3 text-[12px] font-semibold text-slate-500">
          {`${formatCount(s.transactionCount)} completed payments · ${formatCedi(s.totalCollected)}`}
        </p>
        <div className="space-y-2.5">
          {(data.rows || []).map((row) => (
            <div key={row.label}>
              <div className="flex items-baseline justify-between gap-3 text-[12px]">
                <span className="font-bold text-ink">{row.label}</span>
                <span className="font-extrabold text-slate-600">{formatCedis(row.amount)}</span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-brand-700"
                    style={{ width: `${max ? (row.amount / max) * 100 : 0}%` }}
                  />
                </div>
                <span className="w-11 shrink-0 text-right text-[11px] font-bold text-slate-500">
                  {formatPercent(row.percentage)}
                </span>
              </div>
            </div>
          ))}
        </div>
        {data.period?.groupBy === 'term' && (
          <p className="mt-3 text-[11px] font-medium text-slate-500">
            Grouped by calendar quarter, which is not the school’s academic term. Use the Term
            Collection report for terms.
          </p>
        )}
      </div>
    );
  }

  if (report === 'class-collections' || report === 'term') {
    const rows = data.rows || [];
    const windowed = report === 'class-collections' && Boolean(data.period?.startDate || data.period?.endDate);
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: report === 'term' ? 'Students' : 'Classes', value: formatCount(report === 'term' ? s.studentCount : s.classCount) },
            { label: 'Expected', value: report === 'term' ? s.expectedDisplay : s.totalExpectedDisplay },
            { label: 'Collected', value: report === 'term' ? s.collectedToDateDisplay : s.totalCollectedDisplay },
            { label: 'Outstanding', value: report === 'term' ? s.outstandingDisplay : s.totalBalanceDisplay },
          ].map((tile) => (
            <div key={tile.label} className="rounded-xl bg-slate-50 p-3">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                {tile.label}
              </p>
              <p className="mt-1 text-[15px] font-extrabold text-ink">{tile.value ?? '—'}</p>
            </div>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-500">
                <th className="py-2 font-extrabold">Class</th>
                <th className="py-2 text-right font-extrabold">Students</th>
                <th className="py-2 text-right font-extrabold">Expected</th>
                {/* The header changes because the measure changes. With no date
                    window `collected` is lifetime billed-to-date; with one it is
                    payments inside the window. Same field, two different things. */}
                <th className="py-2 text-right font-extrabold">
                  {windowed ? 'Collected in window' : 'Collected'}
                </th>
                <th className="py-2 text-right font-extrabold">Balance</th>
                <th className="py-2 text-right font-extrabold">Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.className}>
                  <td className="py-2 font-bold text-ink">{row.className}</td>
                  <td className="py-2 text-right font-semibold text-slate-600">{formatCount(row.studentCount)}</td>
                  <td className="py-2 text-right font-semibold text-slate-600">{formatCediWhole(row.expected)}</td>
                  <td className="py-2 text-right font-semibold text-slate-600">{formatCediWhole(row.collected)}</td>
                  <td className="py-2 text-right font-bold text-ink">{formatCediWhole(row.balance)}</td>
                  <td className="py-2 text-right">
                    <Rate value={row.collectionRate} expected={row.expected} className="font-bold text-slate-600" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {windowed && (
          <p className="flex items-start gap-2 text-[11px]/[16px] font-medium text-amber-700">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>
              A date window is applied, so “collected in window” counts payments inside those dates
              while “expected” is still the lifetime total. The rate is therefore a window rate
              against a lifetime denominator and is not a true collection rate.
            </span>
          </p>
        )}
      </div>
    );
  }

  if (report === 'outstanding') {
    const rows = data.rows || [];
    const aged = rows.some((row) => row.oldestDueDate);
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Debtors', value: formatCount(s.studentCount) },
            { label: 'Total outstanding', value: s.totalOutstandingDisplay },
            { label: 'Nothing paid', value: formatCount(s.fullyUnpaidCount) },
            { label: 'Part paid', value: formatCount(s.partiallyPaidCount) },
          ].map((tile) => (
            <div key={tile.label} className="rounded-xl bg-slate-50 p-3">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                {tile.label}
              </p>
              <p className="mt-1 text-[15px] font-extrabold text-ink">{tile.value ?? '—'}</p>
            </div>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-500">
                <th className="py-2 font-extrabold">Student</th>
                <th className="py-2 font-extrabold">Class</th>
                <th className="py-2 text-right font-extrabold">Billed</th>
                <th className="py-2 text-right font-extrabold">Paid</th>
                <th className="py-2 text-right font-extrabold">Balance</th>
                {aged && <th className="py-2 text-right font-extrabold">Oldest due</th>}
                <th className="py-2 font-extrabold">Guardian</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row._id}>
                  <td className="py-2 font-bold text-ink">{row.studentName}</td>
                  <td className="py-2 font-semibold text-slate-500">{row.studentClass || '—'}</td>
                  <td className="py-2 text-right font-semibold text-slate-600">{formatCediWhole(row.totalOwed)}</td>
                  <td className="py-2 text-right font-semibold text-slate-600">{formatCediWhole(row.totalPaid)}</td>
                  <td className="py-2 text-right font-extrabold text-ink">{formatCediWhole(row.balance)}</td>
                  {aged && (
                    <td className="py-2 text-right font-bold text-slate-600">
                      {row.oldestDueDate ? formatDate(row.oldestDueDate) : '—'}
                      {row.daysOutstanding != null && (
                        <span className="ml-1 text-[10px] text-slate-400">{row.daysOutstanding}d</span>
                      )}
                    </td>
                  )}
                  <td className="py-2 font-semibold text-slate-500">
                    {row.primaryParentName || '—'}
                    {/* The API masks this and there is no endpoint that unmasks
                        it, so no "call parent" action is offered here. */}
                    {row.primaryParentPhone && (
                      <span className="ml-1 font-mono text-[10px] text-slate-400">{row.primaryParentPhone}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (report === 'overdue') {
    const rows = data.rows || [];
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Students overdue', value: formatCount(s.totalOverdue), tone: 'text-ink' },
            { label: 'Amount overdue', value: s.totalOverdueAmountDisplay, tone: 'text-ink' },
            { label: 'Critical (14d+)', value: formatCount(s.criticalCount), tone: 'text-red-600' },
            { label: 'Average days', value: s.avgDaysOverdue, tone: 'text-amber-600' },
          ].map((tile) => (
            <div key={tile.label} className="rounded-xl bg-slate-50 p-3">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                {tile.label}
              </p>
              <p className={`mt-1 text-[15px] font-extrabold ${tile.tone}`}>{tile.value ?? '—'}</p>
            </div>
          ))}
        </div>

        <ul className="divide-y divide-slate-100">
          {rows.map((row) => (
            <li key={`${row.studentId}-${row.planId ?? row.planName}`} className="py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-[13px] font-extrabold text-ink">
                  {row.studentName}
                  <span className="ml-1.5 text-[11px] font-semibold text-slate-400">
                    {row.studentClass || 'Unassigned'}
                  </span>
                </p>
                <div className="flex items-center gap-2">
                  <Badge tone={row.severity === 'critical' ? 'red' : 'amber'}>
                    {formatCount(row.daysOverdue)} days overdue
                  </Badge>
                  <span className="text-[13px] font-extrabold text-ink">
                    {formatCedi(row.totalOverdueAmount)}
                  </span>
                </div>
              </div>

              {row.installments?.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {row.installments.map((inst) => (
                    <li
                      key={inst.installmentNumber}
                      className="flex flex-wrap items-center gap-x-3 text-[11px] font-medium text-slate-500"
                    >
                      <span className="font-bold text-slate-600">
                        {`Tranche ${inst.installmentNumber}`}
                      </span>
                      <span>due {formatDate(inst.dueDate)}</span>
                      <span>{formatCedi(inst.outstanding)} outstanding</span>
                      {inst.amountPaid > 0 && (
                        <span className="text-emerald-700">{formatCedi(inst.amountPaid)} paid</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (report === 'compliance') {
    const buckets = [
      { key: 'completed', label: 'Completed', tone: 'green' },
      { key: 'onTrack', label: 'On track', tone: 'green' },
      { key: 'approachingDue', label: 'Approaching due', tone: 'amber' },
      { key: 'overdue', label: 'Overdue', tone: 'red' },
      { key: 'defaulted', label: 'Defaulted', tone: 'rose' },
      { key: 'pendingAcceptance', label: 'Pending acceptance', tone: 'slate' },
    ];
    const total = s.totalPlans || 0;
    return (
      <div className="space-y-4">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
            On-time tranche execution
          </p>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-ink">
              <Rate value={s.overallComplianceRate} expected={s.totalInstallments} />
            </span>
            <span className="text-[12px] font-semibold text-slate-500">
              {`${formatCount(s.paidOnTime)} of ${formatCount(s.totalInstallments)} tranches`}
            </span>
          </div>
        </div>

        {/* A stacked bar of the six buckets. The counts sum to totalPlans, so
            the segments are a real partition rather than six independent
            percentages that need not add up. */}
        {total > 0 && (
          <div>
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
              {buckets.map(({ key, tone }) => {
                const value = s[key] || 0;
                if (!value) return null;
                const colour = {
                  green: 'bg-emerald-500',
                  amber: 'bg-amber-500',
                  red: 'bg-red-500',
                  rose: 'bg-rose-500',
                  slate: 'bg-slate-400',
                }[tone];
                return (
                  <div
                    key={key}
                    className={colour}
                    style={{ width: `${(value / total) * 100}%` }}
                    title={`${key}: ${value}`}
                  />
                );
              })}
            </div>
            <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
              {buckets.map(({ key, label, tone }) => (
                <span key={key} className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      { green: 'bg-emerald-500', amber: 'bg-amber-500', red: 'bg-red-500', rose: 'bg-rose-500', slate: 'bg-slate-400' }[tone]
                    }`}
                  />
                  {label}
                  <span className="text-slate-400">{formatCount(s[key] || 0)}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-500">
                <th className="py-2 font-extrabold">Plan</th>
                <th className="py-2 font-extrabold">Student</th>
                <th className="py-2 text-right font-extrabold">Tranches</th>
                <th className="py-2 text-right font-extrabold">On time</th>
                <th className="py-2 text-right font-extrabold">Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(data.rows || []).map((row) => (
                <tr key={row.planId}>
                  <td className="py-2 font-bold text-ink">{row.planName}</td>
                  <td className="py-2 font-semibold text-slate-500">
                    {row.studentName}
                    {row.studentClass ? ` · ${row.studentClass}` : ''}
                  </td>
                  <td className="py-2 text-right font-semibold text-slate-600">
                    {formatCount(row.totalInstallments)}
                  </td>
                  <td className="py-2 text-right font-semibold text-slate-600">
                    {formatCount(row.installmentsPaidOnTime)}
                  </td>
                  <td className="py-2 text-right">
                    <Rate value={row.complianceRate} expected={row.totalInstallments} className="font-bold text-slate-600" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-[11px]/[16px] font-medium text-slate-500">
          A plan is bucketed as overdue if any tranche is overdue, and as approaching due if its
          next pending tranche falls within three days. The bucket therefore changes between fetches
          without anything being edited.
        </p>
      </div>
    );
  }

  if (report === 'parent-contacts') {
    const rows = data.rows || [];
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Students', value: formatCount(s.studentCount) },
            { label: 'Contacts', value: formatCount(s.contactCount) },
            { label: 'Unique numbers', value: formatCount(s.uniquePhoneCount) },
            { label: 'Students owing', value: formatCount(s.studentsOwing) },
          ].map((tile) => (
            <div key={tile.label} className="rounded-xl bg-slate-50 p-3">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                {tile.label}
              </p>
              <p className="mt-1 text-[15px] font-extrabold text-ink">{tile.value ?? '—'}</p>
            </div>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-500">
                <th className="py-2 font-extrabold">Student</th>
                <th className="py-2 font-extrabold">Guardian</th>
                <th className="py-2 font-extrabold">Phone</th>
                <th className="py-2 text-right font-extrabold">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, index) => (
                <tr key={`${row.studentRef}-${row.parentName}-${index}`}>
                  <td className="py-2 font-bold text-ink">
                    {row.studentName}
                    <span className="ml-1.5 text-[11px] font-semibold text-slate-400">
                      {row.studentClass || 'Unassigned'}
                    </span>
                  </td>
                  <td className="py-2 font-semibold text-slate-600">
                    {row.parentName}
                    <span className="ml-1.5 text-[11px] font-normal capitalize text-slate-400">
                      {row.relationship}
                    </span>
                    {row.isPrimary && (
                      <Badge tone="blue" className="ml-1.5">
                        Primary
                      </Badge>
                    )}
                  </td>
                  <td className="py-2 font-mono text-[11px] text-slate-500">{row.phone}</td>
                  <td className="py-2 text-right font-extrabold text-ink">{formatCediWhole(row.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="flex items-start gap-2 text-[11px]/[16px] font-medium text-slate-500">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            Numbers are masked by the server and there is no endpoint that returns them unmasked, so
            this directory cannot be used to contact a guardian from here. Export it and use your own
            channel of record.
          </span>
        </p>
      </div>
    );
  }

  // daily
  const rows = data.rows || [];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
            Collected
          </p>
          <p className="mt-1 text-[15px] font-extrabold text-ink">{s.totalCollectedDisplay}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
            Transactions on this page
          </p>
          <p className="mt-1 text-[15px] font-extrabold text-ink">{formatCount(s.transactionCount)}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
            Average payment
          </p>
          <p className="mt-1 text-[15px] font-extrabold text-ink">{formatCedi(s.averagePayment)}</p>
        </div>
      </div>

      {/*
        The one number on this card that is the whole day rather than the page.
        The summary above is computed from `rows`, i.e. the current page — so it
        is labelled "on this page" and this is labelled "matched". Labelling the
        page figure "transactions" is how a day with 500 payments reads as 50.
      */}
      <p className="text-[12px] font-semibold text-slate-500">
        {`${formatCount(data.meta?.total ?? rows.length)} transactions matched this day`}
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-[12px]">
          <thead>
            <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-500">
              <th className="py-2 font-extrabold">Receipt</th>
              <th className="py-2 font-extrabold">Student</th>
              <th className="py-2 font-extrabold">Method</th>
              <th className="py-2 text-right font-extrabold">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row._id}>
                <td className="py-2 font-mono text-[11px] text-slate-500">{row.receiptNumber || '—'}</td>
                <td className="py-2 font-bold text-ink">
                  {row.studentName}
                  {row.studentClass ? (
                    <span className="ml-1.5 text-[11px] font-semibold text-slate-400">{row.studentClass}</span>
                  ) : null}
                </td>
                <td className="py-2 font-semibold capitalize text-slate-500">
                  {row.paymentMethod?.replace('_', ' ')}
                </td>
                <td className="py-2 text-right font-extrabold text-ink">{formatCedi(row.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.byMethod?.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {data.byMethod.map((m) => (
            <Badge key={m.paymentMethod} tone="slate">
              {`${m.paymentMethod} · ${m.count} · ${formatCedis(m.amount)}`}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * The Reports module.
 *
 * A catalogue of nine reports, each generated on demand against real
 * aggregations. The design also showed a repository count, a template search, a
 * custom query builder and a scheduled-delivery table; none of those have an
 * endpoint, and this module does not draw them — a "Scheduled Automated Delivery"
 * table with three rows that no backend job ever reads would be a bursar trusting
 * a pipeline that does not exist.
 *
 * The one thing that *is* built from the design here is the per-report CSV/XLSX
 * export, because `sendReportFile` supports both. PDF does not: the endpoint
 * answers 501 by design, so no card offers it.
 */
const Reports = () => {
  const { user } = useAuth();
  const toast = useToast();
  const schoolId = user?.schoolId;

  const [searchParams, setSearchParams] = useSearchParams();
  const category = searchParams.get('category') || 'all';
  const query = searchParams.get('q') || '';

  const [results, setResults] = useState({});
  const [busy, setBusy] = useState(null);
  const [downloading, setDownloading] = useState(null);
  const [openReport, setOpenReport] = useState(null);

  const setCategory = (key) => {
    const next = new URLSearchParams(searchParams);
    if (key === 'all') next.delete('category');
    else next.set('category', key);
    setSearchParams(next, { replace: true });
  };

  const setQuery = (value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set('q', value);
    else next.delete('q');
    setSearchParams(next, { replace: true });
  };

  /**
   * Builds the query for a report from the catalogue's `supports` list.
   *
   * `silentParams` is deliberately excluded. Four of these endpoints accept
   * `academicYear` and/or `term`, echo them into `period`, and filter nothing by
   * them — so sending them would put a filter on screen that the report silently
   * ignored, which is worse than not sending it: the figure would change
   * appearance to be about a term it has nothing to do with.
   */
  const buildParams = useCallback(
    (report) => {
      const params = {};
      const silent = new Set(report.silentParams || []);

      if (report.supports.includes('date')) {
        params.date = new Date().toISOString().slice(0, 10);
      }
      if (report.supports.includes('academicYear') && !silent.has('academicYear')) {
        params.academicYear = user?.school?.academic?.currentYear || '';
      }
      if (report.supports.includes('term') && !silent.has('term')) {
        params.term = user?.school?.academic?.currentTerm || '';
      }
      // `outstanding` only computes `oldestDueDate` and `daysOutstanding` when
      // this is truthy — and `0` is falsy in JS, so it has to be at least 1.
      if (report.ageingNeedsMinAgeDays) {
        params.minAgeDays = 1;
      }
      Object.keys(params).forEach((key) => {
        if (!params[key]) delete params[key];
      });
      return params;
    },
    [user]
  );

  const generate = useCallback(
    async (report) => {
      if (!schoolId || busy) return;
      setBusy(report.key);
      setOpenReport(report.key);
      try {
        const data = await runReport({
          schoolId,
          endpoint: report.endpoint,
          params: buildParams(report),
        });
        setResults((current) => ({ ...current, [report.key]: data }));
        if (openReport !== report.key) setOpenReport(report.key);
      } catch (error) {
        toast.error(error.message);
        setResults((current) => ({ ...current, [report.key]: { error: error.message } }));
      } finally {
        setBusy(null);
      }
    },
    [schoolId, busy, buildParams, openReport, toast]
  );

  const download = useCallback(
    async (report, format) => {
      setDownloading(`${report.key}:${format}`);
      try {
        const result = await downloadReport({
          schoolId,
          endpoint: report.endpoint,
          format,
          params: buildParams(report),
        });
        toast.success(`Downloaded ${result.filename}`);
      } catch (error) {
        toast.error(error.message);
      } finally {
        setDownloading(null);
      }
    },
    [schoolId, buildParams, toast]
  );

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return REPORTS.filter((report) => {
      if (category !== 'all' && report.category !== category) return false;
      if (!term) return true;
      return [report.name, report.blurb, report.cadence]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(term));
    });
  }, [category, query]);

  const counts = useMemo(() => {
    const byCategory = { collections: 0, arrears: 0, institutional: 0 };
    REPORTS.forEach((report) => {
      byCategory[report.category] += 1;
    });
    return { total: REPORTS.length, byCategory };
  }, []);

  const activeResult = openReport ? results[openReport] : null;

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Reports & Financial Auditing"
        description="Generate, schedule and export accredited school fee collections, reconciliation and audit reports."
        actions={
          <span className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-600">
            <ShieldCheck className="h-4 w-4 text-brand-700" aria-hidden="true" />
            {counts.total} reports available
          </span>
        }
      />

      {/* Category tabs. On the query string, for the usual reason. */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Report categories">
          {REPORT_CATEGORIES.map((item) => {
            const isActive = item.key === category;
            const count = item.key === 'all' ? counts.total : counts.byCategory[item.key];
            return (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setCategory(item.key)}
                className={`rounded-xl px-3.5 py-2 text-[13px] font-bold transition-colors ${
                  isActive ? 'bg-brand-700 text-white shadow-lift' : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {item.label}
                <span className={isActive ? 'ml-1.5 text-white/70' : 'ml-1.5 text-slate-400'}>{count}</span>
              </button>
            );
          })}
        </div>

        <div className="relative ml-auto min-w-[200px] max-w-xs flex-1">
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <Search className="h-4 w-4" aria-hidden="true" />
          </span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search reports…"
            aria-label="Search reports"
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-[13px]/[18px] font-medium text-ink placeholder:font-normal placeholder:text-slate-500 focus:border-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/30"
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
          <p className="text-base font-extrabold text-ink">No reports match “{query}”</p>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Try a different term, or clear the category filter.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((report) => {
            const result = results[report.key];
            const isOpen = openReport === report.key;
            const isBusy = busy === report.key;

            return (
              <Card key={report.key} padding="p-0" className="flex flex-col">
                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                      {report.category === 'arrears' ? (
                        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                      ) : report.category === 'collections' ? (
                        <TrendingUp className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Users className="h-4 w-4" aria-hidden="true" />
                      )}
                    </span>
                    <Badge tone={isOpen ? 'brand' : 'slate'}>{report.cadence}</Badge>
                  </div>

                  <h3 className="mt-3.5 text-[15px] font-extrabold leading-snug text-ink">{report.name}</h3>
                  <p className="mt-1.5 flex-1 text-[12px]/[18px] font-medium text-slate-500">{report.blurb}</p>

                  {result && !result.error && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {result.meta?.generatedAt && (
                        <Badge tone="slate" icon={Clock}>
                          {new Date(result.meta.generatedAt).toLocaleTimeString('en-GB', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Badge>
                      )}
                      {result.summary?.totalCollectedDisplay && (
                        <Badge tone="green">{result.summary.totalCollectedDisplay}</Badge>
                      )}
                      {result.summary?.totalOutstandingDisplay && (
                        <Badge tone="amber">{result.summary.totalOutstandingDisplay}</Badge>
                      )}
                    </div>
                  )}

                  {result?.error && (
                    <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-700">
                      {result.error}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 border-t border-slate-100 p-4">
                  <button
                    type="button"
                    onClick={() => generate(report)}
                    disabled={isBusy || !schoolId}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-700 px-3 py-2 text-[12px] font-extrabold text-white transition-colors hover:bg-brand-800 disabled:opacity-50"
                  >
                    {isBusy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    {isBusy ? 'Generating…' : 'Generate now'}
                  </button>

                  {/* CSV and XLSX only. `?format=pdf` is a deliberate 501 on the
                      server, so a PDF button here would have one outcome. */}
                  <button
                    type="button"
                    onClick={() => download(report, 'csv')}
                    disabled={downloading?.startsWith(report.key) || !schoolId}
                    aria-label={`Download ${report.name} as CSV`}
                    title="Download CSV"
                    className="rounded-xl border border-slate-200 px-2.5 py-2 text-slate-500 transition-colors hover:bg-slate-50 hover:text-ink disabled:opacity-50"
                  >
                    <Receipt className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => download(report, 'excel')}
                    disabled={downloading?.startsWith(report.key) || !schoolId}
                    aria-label={`Download ${report.name} as Excel`}
                    title="Download Excel"
                    className="rounded-xl border border-slate-200 px-2.5 py-2 text-slate-500 transition-colors hover:bg-slate-50 hover:text-ink disabled:opacity-50"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* The generated report, inline under the grid. */}
      {openReport && activeResult && !activeResult.error && (
        <Card className="mt-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-extrabold text-ink">
                {REPORTS.find((r) => r.key === openReport)?.name}
              </h2>
              <p className="mt-0.5 text-[12px]/[18px] font-medium text-slate-500">
                {activeResult.school?.name}
                {activeResult.period?.month ? ` · ${activeResult.period.month}` : ''}
                {activeResult.period?.academicYear ? ` · ${activeResult.period.academicYear}` : ''}
                {activeResult.period?.class ? ` · ${activeResult.period.class}` : ''}
                {` · ${SECTIONS[activeResult.report] || ''}`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpenReport(null)}
              aria-label="Close report"
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-ink"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="mt-5">
            <ReportBody report={activeResult.report} data={activeResult} />
          </div>
        </Card>
      )}

      <p className="mt-5 flex items-start gap-2 text-[11px]/[16px] font-medium text-slate-500">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>
          Reports are generated from live school data on demand — nothing is pre-computed and
          nothing is scheduled. PDF export is not available yet; CSV and Excel are. Figures are
          whole pesewas on the wire and are formatted to cedis here, so GH₵ 425,000 is 42,500,000
          pesewas. Every figure is traceable in the{' '}
          <Link to={ROUTES.DASHBOARD_ACTIVITY} className="font-bold text-brand-700 hover:underline">
            audit trail
          </Link>
          .
        </span>
      </p>
    </>
  );
};

export default Reports;
