import React, { useCallback, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import PageHeader from '../../components/dashboard/PageHeader';
import EmptyState from '../../components/dashboard/EmptyState';
import KpiRow from './overview/KpiRow';
import RevenueCard from './overview/RevenueCard';
import RecentSchoolsCard from './overview/RecentSchoolsCard';
import { PlatformCompositionCard, SmsBalanceCard } from './overview/PlatformCompositionCard';
import { useAdminDashboard } from '../../hooks/useAdminDashboard';
import { EMPTY_ADMIN_KPIS } from '../../data/adminEmpty';

/**
 * The platform console's Overview.
 *
 * One request for the standing figures (`GET /admin/dashboard`), one for the
 * period totals (`GET /admin/revenue`), one for the trend
 * (`GET /admin/revenue/series`), issued independently by `useAdminDashboard`.
 * None is merged into another, and a failure in any blanks only its own card.
 *
 * That is the whole design difference from the school Overview, and it is a
 * response to a specific failure: `useDashboardOverview` fires six requests in one
 * `Promise.allSettled`, merges them by hand into a synthetic object, and treats a
 * failed request as zero. The result was a live bursar's screen showing a school
 * that did not exist and revenue that had never been collected. An operator's
 * numbers are worse when wrong, not better — a platform admin who reads a wrong
 * figure acts on it for every school at once — so nothing here is ever derived
 * across cards and nothing falls back to a default.
 */
const AdminOverview = () => {
  const { kpis, revenue, series, period, setPeriod } = useAdminDashboard();
  const [reloadKey, setReloadKey] = useState(0);

  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

  const failed = Boolean(kpis.error);

  return (
    <>
      <PageHeader
        eyebrow="Platform console"
        title="Overview"
        description="Every school on SukuuPay, and what the platform is earning. Figures refresh when you reload."
        actions={
          <button
            type="button"
            onClick={refresh}
            disabled={kpis.loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[13px] font-extrabold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
          >
            <RotateCcw
              className={`h-4 w-4 ${kpis.loading ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            Refresh
          </button>
        }
      />

      {/*
        A failed headline call takes over the page rather than sitting as a red line
        above six tiles of zeros. If `GET /admin/dashboard` did not answer, then
        every number below is unknown, and a band of zeros would say "the platform
        has no schools" — the opposite of the truth, and the most dangerous thing
        this page could render.
      */}
      {failed ? (
        <EmptyState
          icon={RotateCcw}
          title="The platform figures could not be loaded"
          description={
            kpis.error?.message ||
            'The request did not complete. Nothing below is shown rather than shown as zero.'
          }
          action={
            <button
              type="button"
              onClick={refresh}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Try again
            </button>
          }
        />
      ) : (
        <>
          {kpis.loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
              {[0, 1, 2, 3, 4, 5].map((tile) => (
                <div key={tile} className="h-[9.5rem] animate-pulse rounded-2xl bg-slate-200/70" />
              ))}
            </div>
          ) : (
            <KpiRow kpis={kpis.data || EMPTY_ADMIN_KPIS} />
          )}

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <RevenueCard
                revenue={revenue.data}
                series={series.data}
                period={period}
                onPeriodChange={setPeriod}
                loading={revenue.loading}
                seriesLoading={series.loading}
                error={revenue.error}
              />
            </div>
            <PlatformCompositionCard kpis={kpis.data || EMPTY_ADMIN_KPIS} />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <RecentSchoolsCard
                schools={kpis.data?.recentSchools}
                loading={kpis.loading}
                error={kpis.error}
              />
            </div>
            <SmsBalanceCard kpis={kpis.data || EMPTY_ADMIN_KPIS} />
          </div>
        </>
      )}
    </>
  );
};

export default AdminOverview;