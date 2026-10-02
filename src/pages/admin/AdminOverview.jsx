import React, { useCallback, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import PageHeader from '../../components/dashboard/PageHeader';
import EmptyState from '../../components/dashboard/EmptyState';
import KpiRow from './overview/KpiRow';
import RevenueCard from './overview/RevenueCard';
import RecentSchoolsCard from './overview/RecentSchoolsCard';
import EconomicsRow from './overview/EconomicsRow';
import AtRiskCard from './overview/AtRiskCard';
import HealthCard from './overview/HealthCard';
import DisbursementQueueCard, {
  TopSchoolsCard,
} from './overview/DisbursementQueueCard';
import { PlatformCompositionCard, SmsBalanceCard } from './overview/PlatformCompositionCard';
import { useAdminDashboard } from '../../hooks/useAdminDashboard';
import { usePlatformOverview } from '../../hooks/usePlatformOverview';
import { EMPTY_ADMIN_KPIS } from '../../data/adminEmpty';

/**
 * The platform console's Overview.
 *
 * Two data layers, eight requests, and **not one of them is merged into another**.
 *
 * `useAdminDashboard` owns the three it always had — standing KPIs, period totals,
 * the revenue series. `usePlatformOverview` owns the five that arrived with the
 * platform-owner work: subscription economics, at-risk schools, top schools, the
 * payout queue, the recent-payment feed, and the health summary.
 *
 * They are separate hooks for the reason the original three are separate requests:
 * a failure in one blanks only its own card. The six transaction KPIs come from
 * `GET /admin/dashboard`; MRR, ARR, churn and growth come from `GET /admin/overview`.
 * A database hiccup can fail the health probe while the payment totals still answer,
 * and an operator needs the second more than the first. Merged into one
 * `Promise.all`, a failing health probe would take every number on this page with
 * it — which is precisely the failure `useDashboardOverview` had on the school
 * Overview, where a dropped request rendered as zero and a bursar read it as truth.
 *
 * So: nothing here falls back to a default, nothing is derived across cards, and
 * the one genuinely headline request (`GET /admin/dashboard`) is the only one whose
 * failure takes over the page.
 */
const AdminOverview = () => {
  const { kpis, revenue, series, period, setPeriod } = useAdminDashboard();
  const platform = usePlatformOverview();
  const [reloadKey, setReloadKey] = useState(0);

  /*
   * One refresh for both layers.
   *
   * Bumping `reloadKey` only re-runs `useAdminDashboard` (it takes the key as a
   * dependency), so `platform.refresh()` is what re-runs the second hook's tick.
   * Both are counters rather than a shared value because they are independent fetch
   * groups — the point of the split above — and a refresh that had to coordinate
   * them would be a step towards merging them again.
   */
  const refresh = useCallback(() => {
    setReloadKey((key) => key + 1);
    platform.refresh();
  }, [platform.refresh]);

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

          {/*
            Subscription economics, below the payment KPIs and above everything
            else. The band above is transaction-shaped and moves daily; this one is
            the recurring base and moves monthly, and mixing them into one row of
            six would invite comparing a churn *rate* against a collections
            *total*. See `EconomicsRow` for why ARR is labelled a projection in the
            tile rather than in a comment.
          */}
          <div className="mt-4">
            <EconomicsRow state={platform.overview} />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <RecentSchoolsCard
                schools={kpis.data?.recentSchools}
                loading={kpis.loading}
                error={kpis.error}
              />
            </div>
            <AtRiskCard state={platform.atRisk} />
          </div>

          {/*
            Four panels of equal weight, two-by-two at `lg` and four-across at `xl`.
            `xl:grid-cols-4` rather than three because the SMS balance is a standing
            figure that belonged in this row before any of these panels existed —
            dropping it to make room for the new ones would have removed a number an
            operator uses every day. The payout queue sits beside the health summary
            deliberately: the queue is the one card on this page that can move money,
            and the health summary is the one that explains why a payout might be
            failing. An operator triaging a stuck batch should have both in one
            glance, not one screen apart.
          */}
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
            <TopSchoolsCard state={platform.topSchools} />
            <DisbursementQueueCard state={platform.pendingApprovals} />
            <HealthCard state={platform.health} />
            <SmsBalanceCard kpis={kpis.data || EMPTY_ADMIN_KPIS} />
          </div>
        </>
      )}
    </>
  );
};

export default AdminOverview;