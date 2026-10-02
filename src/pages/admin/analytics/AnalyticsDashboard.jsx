import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  Building2,
  CreditCard,
  RotateCcw,
  ServerCrash,
  TrendingUp,
  Users,
} from 'lucide-react';
import PageHeader from '../../../components/dashboard/PageHeader';
import Card from '../../../components/dashboard/ui/Card';
import Badge from '../../../components/dashboard/ui/Badge';
import EmptyState from '../../../components/dashboard/EmptyState';
import StackedBar from '../../../components/dashboard/charts/StackedBar';
import AnalyticsTabs from './AnalyticsControls';
import AtRiskSchoolsPanel from './AtRiskSchoolsPanel';
import { thisMonthStart } from './analyticsShared';
import {
  getAdminOverview,
  getAtRiskSchools,
  getGatewayMixAnalytics,
  getSchoolsAnalytics,
} from '../../../services/admin';
import { ADMIN_ROUTES } from '../../../utils/constants';
import { formatCedi, formatCediShort, formatCount, formatPercent } from '../../../utils/format';

/**
 * The analytics landing: what the platform is earning, who is joining, who is going
 * quiet, and where every cedi crosses.
 *
 * **Four requests, issued independently.** `GET /admin/overview` for the standing
 * figures, `GET /admin/analytics/schools` for the activation rate, `GET
 * /admin/analytics/at-risk-schools` for the chase list, and `GET
 * /admin/analytics/gateway-mix` for the rails. One `Promise.all` would couple them in
 * exactly the wrong direction — a failing gateway probe would blank the revenue headline
 * — and that coupling is the failure `useAdminDashboard` documents and refuses. Each
 * card carries its own error, so a red panel says *which* call failed rather than
 * replacing the page with a single "could not load".
 *
 * Every panel has exactly three states — in flight, failed, loaded — and a failed panel
 * says so in its own words. This page is the one an operator opens when something has
 * changed, and a screen that renders five zeroes because one request failed is the screen
 * that teaches them not to trust it.
 *
 * **Activation is measured over the current calendar month, deliberately, and labelled.**
 * `getAdminOverview`'s `schools.newThisMonth` is a month-to-date count, so pairing it
 * with an activation rate computed over a different window would put two figures of
 * different populations in one row. `getSchoolsAnalytics` is therefore called with
 * `from` = the first of this month, which makes numerator and denominator the same
 * cohort — and the caveat that this biases the rate *downwards* is stated on the card,
 * because a school created yesterday has had no time to finish onboarding and a young
 * cohort always looks worse than a settled one. The Schools screen is where a longer,
 * fairer window is chosen.
 *
 * ARR is not on this screen. It is a projection (`MRR × 12`) and every SaaS dashboard
 * that shows it without saying so is the one that gets quoted in a board deck. It lives
 * on the Revenue screen's footer, framed.
 */
const AnalyticsDashboard = () => {
  /*
    One counter invalidates all four calls.
    *
    * `reloadKey` rather than four booleans, and not a shared `Promise.all`: the four
    * requests are independent reads, and a single counter keeps "refresh" meaning one
    * thing rather than four that can drift apart mid-incident.
    */
  const [reloadKey, setReloadKey] = useState(0);

  const [overview, setOverview] = useState({ data: null, loading: true, error: null });
  const [schools, setSchools] = useState({ data: null, loading: true, error: null });
  const [atRisk, setAtRisk] = useState({ data: null, loading: true, error: null });
  const [gateway, setGateway] = useState({ data: null, loading: true, error: null });

  // `thisMonthStart()` is evaluated once per mount rather than per render so the effects
  // below cannot be handed two different windows by a midnight rollover between them — a
  // one-request-wide disagreement is invisible in the output and annoying in the audit log.
  const [monthStart] = useState(thisMonthStart);

  const loadOverview = useCallback(() => {
    let active = true;
    setOverview((current) => ({ ...current, loading: true, error: null }));
    getAdminOverview()
      .then((data) => active && setOverview({ data, loading: false, error: null }))
      .catch((error) => active && setOverview({ data: null, loading: false, error }));
    return () => {
      active = false;
    };
  }, []);

  const loadSchools = useCallback(() => {
    let active = true;
    setSchools((current) => ({ ...current, loading: true, error: null }));
    getSchoolsAnalytics({ from: monthStart })
      .then((data) => active && setSchools({ data, loading: false, error: null }))
      .catch((error) => active && setSchools({ data: null, loading: false, error }));
    return () => {
      active = false;
    };
  }, [monthStart]);

  const loadAtRisk = useCallback(() => {
    let active = true;
    setAtRisk((current) => ({ ...current, loading: true, error: null }));
    getAtRiskSchools()
      .then((data) => active && setAtRisk({ data, loading: false, error: null }))
      .catch((error) => active && setAtRisk({ data: null, loading: false, error }));
    return () => {
      active = false;
    };
  }, []);

  const loadGateway = useCallback(() => {
    let active = true;
    setGateway((current) => ({ ...current, loading: true, error: null }));
    getGatewayMixAnalytics()
      .then((data) => active && setGateway({ data, loading: false, error: null }))
      .catch((error) => active && setGateway({ data: null, loading: false, error }));
    return () => {
      active = false;
    };
  }, []);

  // Four effects rather than one that fans out, because each loader closes over its own
  // `active` flag. That flag is what makes a response that lands after unmount — or after
  // a refresh superseded it — a no-op instead of a `setState` on a dead or stale tree,
  // and it cannot be shared between four concurrent requests without being wrong.
  useEffect(() => loadOverview(), [loadOverview, reloadKey]);
  useEffect(() => loadSchools(), [loadSchools, reloadKey]);
  useEffect(() => loadAtRisk(), [loadAtRisk, reloadKey]);
  useEffect(() => loadGateway(), [loadGateway, reloadKey]);

  const kpis = overview.data || {};
  const revenue = kpis.revenue || {};
  const schoolStats = kpis.schools || {};
  const activation = schools.data?.signups?.activationRatePercent;

  const rails = gateway.data?.rails || {};
  const railSegments = useMemo(
    () => [
      {
        key: 'sukuupay',
        label: 'Through SukuuPay',
        value: Number(rails.sukuupay?.volume) || 0,
        className: 'bg-brand-700',
      },
      {
        key: 'school_own',
        label: "The school's own rail",
        value: Number(rails.school_own?.volume) || 0,
        className: 'bg-brand-400',
      },
      {
        key: 'unset',
        label: 'No rail set',
        value: Number(rails.unset?.volume) || 0,
        className: 'bg-slate-400',
      },
    ],
    [rails]
  );

  const railVolume = railSegments.reduce((sum, segment) => sum + segment.value, 0);

  const headline = [
    {
      key: 'revenue',
      label: 'Revenue this month',
      icon: CreditCard,
      value: overview.loading ? '—' : formatCediShort(revenue.thisMonth),
      detail: overview.loading
        ? 'Loading'
        : `${formatCount(revenue.thisMonthEntries)} ledger entries`,
      state: overview,
    },
    {
      key: 'schools',
      label: 'Schools added this month',
      icon: Building2,
      value: schools.loading ? '—' : formatCount(schoolStats.newThisMonth ?? schools.data?.signups?.newSchools),
      detail: schools.loading ? 'Loading' : 'Signed up since the 1st',
      state: schools,
      to: ADMIN_ROUTES.SCHOOLS_ANALYTICS,
    },
    {
      key: 'activation',
      label: 'Activation rate',
      icon: TrendingUp,
      // `percent()` returns `null` for an empty denominator rather than `0`, so this is
      // a real distinction: no schools signed up this month means "no rate", not "nobody
      // onboarded". Rendering `0%` there is how a young platform reports a churn-free,
      // onboarding-free month as though both were measured.
      value: schools.loading
        ? '—'
        : activation === null || activation === undefined
          ? '—'
          : formatPercent(activation),
      detail: schools.loading
        ? 'Loading'
        : `${formatCount(schools.data?.signups?.activatedSchools)} of ${formatCount(
            schools.data?.signups?.newSchools
          )} schools created this month finished onboarding`,
      state: schools,
      to: ADMIN_ROUTES.SCHOOLS_ANALYTICS,
    },
    {
      key: 'atrisk',
      label: 'At-risk schools',
      icon: Users,
      value: atRisk.loading ? '—' : formatCount(atRisk.data?.summary?.atRiskSchools),
      detail: atRisk.loading ? 'Loading' : 'Quiet, lapsed or unrostered',
      state: atRisk,
      tone: (atRisk.data?.summary?.atRiskSchools || 0) > 5 ? 'text-red-600' : 'text-ink',
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Platform console"
        title="Analytics"
        description="What the platform earns, which schools are joining and which are going quiet, and where the money crosses."
        actions={
          <button
            type="button"
            onClick={() => setReloadKey((token) => token + 1)}
            disabled={overview.loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[13px] font-extrabold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
          >
            <RotateCcw
              className={`h-4 w-4 ${overview.loading ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            Refresh
          </button>
        }
      />

      <AnalyticsTabs />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {headline.map((tile) => {
          const body = (
            <>
              <div className="flex items-start justify-between gap-2">
                <p className="truncate text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  {tile.label}
                </p>
                <tile.icon className="h-4 w-4 shrink-0 text-slate-300" aria-hidden="true" />
              </div>
              <p className={`mt-2 text-2xl font-extrabold tracking-tight ${tile.tone || 'text-ink'}`}>
                {tile.value}
              </p>
              <p className="mt-1 text-[10px]/[15px] font-semibold text-slate-400">{tile.detail}</p>
              {tile.state.error && (
                <p className="mt-1 text-[10px]/[15px] font-extrabold text-red-600">
                  {tile.state.error.message || 'Could not load'}
                </p>
              )}
            </>
          );

          return tile.to ? (
            <Link
              key={tile.key}
              to={tile.to}
              className="rounded-2xl border border-slate-100 bg-white p-5 shadow-soft transition-colors hover:border-brand-200 hover:bg-brand-50/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
            >
              {body}
            </Link>
          ) : (
            <Card key={tile.key} padding="p-5">
              {body}
            </Card>
          );
        })}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <AtRiskSchoolsPanel
            state={{ ...atRisk, onRetry: () => setReloadKey((token) => token + 1) }}
          />
        </div>

        <div className="space-y-4">
          <Card padding="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-[15px] font-extrabold tracking-tight text-ink">
                  Gateway mix
                </h2>
                <p className="mt-1 text-[12px]/[18px] font-medium text-slate-500">
                  Share of collected volume, over the endpoint&rsquo;s default 12-month window.
                </p>
              </div>
              {gateway.data && (
                <Badge tone="slate">{formatCediShort(rails.sukuupay?.volumePercent ?? 0)}</Badge>
              )}
            </div>

            {gateway.loading ? (
              <div className="mt-4 space-y-2">
                <div className="h-10 animate-pulse rounded-xl bg-slate-100" />
                <div className="h-3 w-2/3 animate-pulse rounded bg-slate-100" />
              </div>
            ) : gateway.error ? (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5">
                <p className="text-[12px] font-extrabold leading-snug text-red-700">
                  Gateway mix could not be loaded.
                </p>
                <p className="mt-1 text-[12px]/[17px] font-semibold text-red-700/90">
                  {gateway.error.message || 'The request did not complete.'}
                </p>
              </div>
            ) : (
              <>
                {railVolume === 0 ? (
                  <p className="mt-4 rounded-xl bg-slate-50 px-3 py-2.5 text-[12px] font-semibold text-slate-500">
                    No completed payments in this window. Nothing to split — this is a real
                    zero, not a missing reading.
                  </p>
                ) : (
                  <>
                    <p className="mt-4 text-[24px] font-extrabold leading-none tracking-tight text-ink">
                      {formatCedi(railVolume)}
                    </p>
                    <div className="mt-3">
                      {/*
                        `StackedBar` is the right component here and is reused rather than
                        redrawn: this is exactly what it was built for — one bar of three
                        numbers — and it already gives a 0.0% share a hairline so "no volume
                        on this rail" cannot be mistaken for "this rail was filtered out".
                      */}
                      <StackedBar segments={railSegments} />
                    </div>
                    <dl className="mt-3 space-y-1.5">
                      {railSegments.map((segment) => (
                        <div key={segment.key} className="flex items-baseline justify-between gap-3">
                          <dt className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
                            <span
                              className={`h-2 w-2 shrink-0 rounded-full ${segment.className}`}
                              aria-hidden="true"
                            />
                            {segment.label}
                          </dt>
                          <dd className="text-[11px] font-extrabold tabular-nums text-ink">
                            {formatPercent(
                              railVolume ? (segment.value / railVolume) * 100 : null
                            )}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </>
                )}

                {gateway.data?.caveat && (
                  <p className="mt-3 text-[11px]/[16px] font-medium leading-relaxed text-slate-500">
                    {gateway.data.caveat}
                  </p>
                )}
              </>
            )}
          </Card>

          <Card padding="p-5">
            <h2 className="text-[15px] font-extrabold tracking-tight text-ink">Go deeper</h2>
            <p className="mt-1 text-[12px]/[18px] font-medium text-slate-500">
              Each screen has its own window, its own definitions and its own caveats.
            </p>
            <ul className="mt-3 space-y-2">
              {[
                { to: ADMIN_ROUTES.REVENUE_ANALYTICS, label: 'Revenue by source', hint: 'Markup, platform fee, subscription and SMS, stacked over time.' },
                { to: ADMIN_ROUTES.SCHOOLS_ANALYTICS, label: 'Signups and activation', hint: 'Churn, activation rate and time to first payment.' },
                { to: ADMIN_ROUTES.COLLECTION_RATE_ANALYTICS, label: 'Collection rate', hint: 'Owed against collected, by term, with its denominator rule stated.' },
              ].map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 px-3.5 py-3 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
                  >
                    <span className="min-w-0">
                      <span className="block text-[13px] font-extrabold text-ink">{link.label}</span>
                      <span className="mt-0.5 block text-[11px]/[16px] font-medium text-slate-500">
                        {link.hint}
                      </span>
                    </span>
                    <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      {/*
        The Overview is four separate calls and all four failed. That is not a page with
        no data; it is a page whose API is unreachable, and rendering the shell with empty
        panels would read as "the platform is quiet" — so it takes over the screen.
      */}
      {overview.error && schools.error && atRisk.error && gateway.error && (
        <div className="mt-4">
          <EmptyState
            icon={ServerCrash}
            title="None of the analytics endpoints answered"
            description="Every call on this page failed. That is different from a platform with no data, and it is shown as a failure rather than as a page of zeroes."
            action={
              <button
                type="button"
                onClick={() => setReloadKey((token) => token + 1)}
                className="rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
              >
                Try again
              </button>
            }
          />
        </div>
      )}
    </>
  );
};

export default AnalyticsDashboard;
