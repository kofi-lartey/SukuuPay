import React from 'react';
import { Download, Plus, TriangleAlert } from 'lucide-react';
import { useDashboardOverview } from '../../hooks/useDashboardOverview';
import { formatCount } from '../../utils/format';
import KpiRow from './overview/KpiRow';
import CollectionsCard from './overview/CollectionsCard';
import PaymentChannelsCard from './overview/PaymentChannelsCard';
import RecentTransactionsCard from './overview/RecentTransactionsCard';
import BroadcastSmsCard from './overview/BroadcastSmsCard';
import UpcomingInstallmentsCard from './overview/UpcomingInstallmentsCard';

/**
 * Dashboard Overview — the landing surface of the management system.
 *
 * The layout is a KPI band over a 2/3 + 1/3 split, and the split is the design's
 * main structural claim: the wide left column is a vertical narrative (what came
 * in this term, then the transactions behind that number) and the narrow right
 * column is a set of independent alerts (channels, reminders, what is due). A
 * bursar reads down the left once in the morning and scans the right all day, so
 * the two must not interleave — a full-width alert between two charts would read
 * as part of the narrative and get skipped.
 *
 * Every figure arrives from `useDashboardOverview`, and its `isDemo` flag drives
 * the indicator under the title. The design's "LIVE SYNC ACTIVE" marker is
 * rendered *only* when that flag is false: a bursar reconciling a real figure
 * against a bank statement must never be told a screen is live when it is
 * serving fixtures.
 */
const Overview = () => {
  const { data, loading, isDemo, seriesFor } = useDashboardOverview();

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64 animate-pulse rounded-lg bg-slate-200" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl bg-slate-200/70" />
          ))}
        </div>
      </div>
    );
  }

  const { school, term, kpis, channels, transactions, transactionCount, upcomingInstallments, smsBroadcast } =
    data;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
            Overview
            <span className="h-1 w-1 rounded-full bg-slate-300" aria-hidden="true" />
            {isDemo ? (
              <span className="inline-flex items-center gap-1.5 text-amber-600">
                <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />
                Demo data
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-brand-700">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-500" aria-hidden="true" />
                Live sync active
              </span>
            )}
          </p>

          <h1 className="mt-1.5 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
            Dashboard Overview
          </h1>
          <p className="mt-1 text-[13px] font-semibold text-slate-500">
            {term.term} • Academic Year {term.academicYear} • {school.campus}
          </p>
        </div>

        {/*
          Header actions. Both are real links into modules that exist as routes,
          so neither is a dead control — but they are disabled while the Overview
          is on demo data, because "Export Financial Report" on figures the
          service did not produce would hand a bursar a file of fiction.
        */}
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={isDemo}
            title={isDemo ? 'Available once reports are wired' : 'Export this term’s figures'}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-extrabold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Export Financial Report (CSV/PDF)
          </button>

          <button
            type="button"
            disabled={isDemo}
            title={isDemo ? 'Available once payments are wired' : 'Record a cash or cheque payment'}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-[13px] font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Record Manual Payment
          </button>
        </div>
      </div>

      <KpiRow kpis={kpis} />

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="flex flex-col gap-4 xl:col-span-2">
          <CollectionsCard term={term} seriesFor={seriesFor} isDemo={isDemo} />
          <RecentTransactionsCard
            transactions={transactions}
            totalCount={transactionCount}
            isDemo={isDemo}
          />
        </div>

        <div className="flex flex-col gap-4">
          <PaymentChannelsCard channels={channels} isDemo={isDemo} />
          <BroadcastSmsCard broadcast={smsBroadcast} isDemo={isDemo} />
          <UpcomingInstallmentsCard upcoming={upcomingInstallments} isDemo={isDemo} />
        </div>
      </div>

      {isDemo && (
        <p className="mt-4 text-[11px] font-semibold text-slate-400">
          Every figure on this page is a fixture from src/data/dashboardDemo.js, not a
          school’s real position. {formatCount(kpis.totalStudents.value)} students is
          the demo roster, not a count of anyone.
        </p>
      )}
    </>
  );
};

export default Overview;
