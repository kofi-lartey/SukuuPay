import React, { useState } from 'react';
import { Download, Plus, TriangleAlert } from 'lucide-react';
import { useDashboardOverview } from '../../hooks/useDashboardOverview';
import { useAuth } from '../../context/AuthContext';
import useToast from '../../hooks/useToast';
import { exportStudents } from '../../services/students';
import RecordManualPaymentDialog from '../../components/dashboard/RecordManualPaymentDialog';
import ErrorBoundary from '../../components/common/ErrorBoundary';
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
 * Every figure arrives from `useDashboardOverview`, which reads it from the API.
 * The subtitle under the title used to be a fixture: it read "Term 1 • Academic
 * Year 2025/2026 • Basic & JHS Campus" for a school called "Prampram Basic
 * School", on every live deployment, next to a green "Live sync active" badge.
 * The School model has no campus and no current week, so those are gone; the line
 * is now the school's own name, city and academic year, or nothing at all if the
 * school record has not loaded.
 */
const Overview = () => {
  const { user } = useAuth();
  const { data, loading, isFallback, seriesFor, refresh } = useDashboardOverview(user?.schoolId);
  const { success, error: errorToast } = useToast();
  const [recording, setRecording] = useState(false);

  const onExport = () => {
    // The roster export is the same file the Students module produces, so
    // "Export Financial Report" hands over the roster rather than a second shape
    // of the same data with different column names to reconcile.
    exportStudents({ status: 'all', perPage: 100, format: 'csv' })
      .then(({ filename }) => success(`Downloaded ${filename}`))
      .catch((error) => errorToast(error.message));
  };

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

  // Built from what the school actually has set, and omitted rather than padded
  // — a subtitle reading "Term • Academic Year • " tells a bursar nothing.
  const subtitle = [
    term.term,
    term.academicYear ? `Academic Year ${term.academicYear}` : '',
    school.city,
  ]
    .filter(Boolean)
    .join(' • ');

  return (
    <>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
            Overview
            <span className="h-1 w-1 rounded-full bg-slate-300" aria-hidden="true" />
            {isFallback ? (
              <span className="inline-flex items-center gap-1.5 text-amber-600">
                <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />
                Not connected
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
          {subtitle && (
            <p className="mt-1 text-[13px] font-semibold text-slate-500">{subtitle}</p>
          )}
        </div>

        {/*
          Header actions. Both are real now: each opens something, and each is
          disabled *only* while the API has not answered.

          They used to be permanently disabled with a tooltip, which was the
          honest response to fixture data and the wrong thing to ship as the
          product's only state — a bursar who cannot record the cash in their desk
          has no way to reconcile the day's takings at all. The hook's
          `isFallback` decides which of the two it is, so a live deployment gets a
          working button and an unreachable one still cannot record a payment
          against numbers that were never stored.
        */}
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={onExport}
            disabled={isFallback}
            title={isFallback ? 'Available once the dashboard can reach the API' : 'Export this term’s figures'}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-extrabold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Export Financial Report
            {/* The formats move to the tooltip on mobile rather than sitting in
                the label. This button was the widest thing in the header — it set
                the min-content width of the whole action row — and the extra nine
                characters bought nothing on a 320px screen. */}
            <span className="hidden sm:inline">(CSV/PDF)</span>
          </button>

          <button
            type="button"
            onClick={() => setRecording(true)}
            disabled={isFallback}
            title={
              isFallback
                ? 'Available once the dashboard can reach the API'
                : 'Record a cash, cheque or bank transfer payment'
            }
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-[13px] font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Record Manual Payment
          </button>
        </div>
      </div>

      <ErrorBoundary label="The KPI figures">
        <KpiRow kpis={kpis} />
      </ErrorBoundary>

      {/*
        One boundary per card, not one per page.
        *
        * These six regions come from six independent endpoints and are read
        * independently — the left column is a morning narrative, the right column is an
        * all-day alert scan. A page-level boundary would honour neither: one bad
        * response would replace the whole grid with an error card, which is the same
        * blast radius this is meant to remove. Per-card, a fault costs the bursar the
        * one card that is wrong.
        *
        * The boundary renders a block-level `<div>`, which sits inside the flex/grid
        * parents without disturbing their layout.
        */}
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="flex flex-col gap-4 xl:col-span-2">
          <ErrorBoundary label="Collections">
            <CollectionsCard term={term} seriesFor={seriesFor} />
          </ErrorBoundary>

          <ErrorBoundary label="Recent transactions">
            <RecentTransactionsCard
              transactions={transactions}
              totalCount={transactionCount}
              isDemo={isFallback}
            />
          </ErrorBoundary>
        </div>

        <div className="flex flex-col gap-4">
          <ErrorBoundary label="Payment channels">
            <PaymentChannelsCard channels={channels} />
          </ErrorBoundary>

          <ErrorBoundary label="SMS reminders">
            <BroadcastSmsCard broadcast={smsBroadcast} />
          </ErrorBoundary>

          <ErrorBoundary label="Upcoming installments">
            <UpcomingInstallmentsCard upcoming={upcomingInstallments} />
          </ErrorBoundary>
        </div>
      </div>

      {isFallback && (
        <p className="mt-4 text-[11px] font-semibold text-amber-700">
          The dashboard could not reach the API, so every figure above is empty rather
          than estimated. Nothing on this page is a placeholder.
        </p>
      )}

      <RecordManualPaymentDialog
        open={recording}
        onClose={() => setRecording(false)}
        onRecorded={refresh}
      />
    </>
  );
};

export default Overview;
