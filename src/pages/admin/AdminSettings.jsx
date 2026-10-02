import React, { useCallback, useEffect, useState } from 'react';
import { Info, Save, ServerCog } from 'lucide-react';
import PageHeader from '../../components/dashboard/PageHeader';
import Card from '../../components/dashboard/ui/Card';
import Badge from '../../components/dashboard/ui/Badge';
import EmptyState from '../../components/dashboard/EmptyState';
import { getDashboardKpis, getPlatformSmsBalance } from '../../services/admin';
import { formatCedi, formatCount } from '../../utils/format';

/**
 * Platform settings — and the honest version of a page that has no write API.
 *
 * **There is no `PUT /admin/settings`.** No platform defaults can be changed,
 * because nothing on the server accepts them: no markup default, no feature
 * flags, no maintenance mode, no SMS provider configuration.
 *
 * So this page does what `dashboard/Settings.jsx` does for a region with no write
 * endpoint: it renders the read-only figures it *can* get, and every control is
 * disabled **with its reason stated**. A disabled control that says why is a
 * promise; an enabled one that 404s on save is a lie, and a settings page that
 * silently discards what you typed is the specific thing this codebase has already
 * been bitten by twice.
 *
 * The contract needed to make this writable is written out below, so whoever
 * builds it does not have to reverse-engineer it from this page.
 *
 * Why not leave Settings empty until it exists: an operator opening the console
 * needs to know the platform's standing state, and the two endpoints that answer
 * that are already here. Shipping them read-only with the gap named is more useful
 * than a placeholder, and it puts the missing contract in front of whoever owns
 * the backend.
 */
const Row = ({ label, value, hint }) => (
  <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-slate-50 py-3 last:border-0">
    <div className="min-w-0">
      <p className="text-[13px] font-extrabold text-ink">{label}</p>
      {hint && <p className="text-[11px] font-semibold text-slate-400">{hint}</p>}
    </div>
    <p className="shrink-0 text-[13px] font-extrabold tabular-nums text-ink">{value}</p>
  </div>
);

const DisabledControl = ({ label, reason }) => (
  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-50 py-3 last:border-0">
    <div className="min-w-0">
      <p className="text-[13px] font-extrabold text-slate-400">{label}</p>
      <p className="text-[11px] font-semibold text-slate-400">{reason}</p>
    </div>
    <Badge tone="slate">Not available yet</Badge>
  </div>
);

const AdminSettings = () => {
  const [state, setState] = useState({ kpis: null, sms: null, loading: true, error: null });

  const load = useCallback(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: null }));
    Promise.all([
      getDashboardKpis().catch(() => null),
      getPlatformSmsBalance().catch(() => null),
    ])
      .then(([kpis, sms]) => {
        if (active) setState({ kpis, sms, loading: false, error: null });
      })
      .catch((error) => {
        if (active) setState({ kpis: null, sms: null, loading: false, error });
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => load(), [load]);

  const schools = state.kpis?.schools || {};
  const payments = state.kpis?.payments || {};
  const sms = state.sms || {};

  return (
    <>
      <PageHeader
        eyebrow="Platform console"
        title="Settings"
        description="The platform's standing state. Nothing here can be changed yet — the endpoints that would accept a change do not exist."
        actions={
          <Badge tone="amber" icon={Info}>
            Read-only
          </Badge>
        }
      />

      {state.error ? (
        <EmptyState
          icon={ServerCog}
          title="Platform settings could not be loaded"
          description={state.error.message}
        />
      ) : state.loading ? (
        <div className="space-y-4">
          {[0, 1].map((card) => (
            <div key={card} className="h-56 animate-pulse rounded-2xl bg-slate-200/70" />
          ))}
        </div>
      ) : (
        <>
          <Card padding="p-5">
            <h2 className="text-[13px] font-extrabold text-ink">Platform standing</h2>
            <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
              Live figures, from the same endpoints the Overview reads.
            </p>

            <div className="mt-3">
              <Row
                label="Schools registered"
                hint="All lifecycle states combined"
                value={formatCount(schools.total)}
              />
              <Row label="Active" value={formatCount(schools.active)} />
              <Row label="On trial" value={formatCount(schools.onTrial)} />
              <Row label="Suspended" value={formatCount(schools.suspended)} />
              <Row label="Archived" value={formatCount(schools.archived)} />
              <Row label="Accounts" hint="Staff and parents" value={formatCount(state.kpis?.users?.total)} />
            </div>
          </Card>

          <Card padding="p-5" className="mt-4">
            <h2 className="text-[13px] font-extrabold text-ink">Money and messaging</h2>
            <div className="mt-3">
              <Row label="Platform markup earned" value={formatCedi(payments.platformMarkup)} />
              <Row label="Pending payouts" value={formatCedi(payments.pendingPayouts)} />
              <Row
                label="SMS credit"
                hint={
                  sms.totalSchools
                    ? `Master balance across ${formatCount(sms.totalSchools)} active schools`
                    : 'Master balance, all schools'
                }
                value={formatCount(sms.totalBalance)}
              />
            </div>
          </Card>

          {/*
            The gap, written as the page's own content rather than as a comment in
            a file nobody opens. Each row names the endpoint that would have to
            exist. This is the honest form of a settings page that has nothing to
            set: it tells the operator what the platform *cannot* do today, which
            is itself a thing an operator needs to know.
          */}
          <Card padding="p-5" className="mt-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[13px] font-extrabold text-ink">Not configurable yet</h2>
                <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
                  Each of these needs a server endpoint that does not exist.
                </p>
              </div>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                <Save className="h-[18px] w-[18px]" aria-hidden="true" />
              </span>
            </div>

            <div className="mt-3">
              <DisabledControl
                label="Default platform markup"
                reason="PUT /admin/settings — no endpoint accepts it"
              />
              <DisabledControl
                label="Feature flags"
                reason="Self-signup, the public ad slider, trial length — all hard-coded server-side"
              />
              <DisabledControl
                label="Maintenance mode"
                reason="No way to put the platform in a read-only state for a migration"
              />
              <DisabledControl
                label="SMS provider and sender ID"
                reason="Configured per school; there is no platform-level default"
              />
              <DisabledControl
                label="Platform revenue trend"
                reason="GET /admin/revenue/series — the analytics routes are school-scoped"
              />
            </div>

            <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2.5 text-[11px] font-semibold leading-relaxed text-slate-500">
              When these are built, each write belongs in the audit log. No administrative action
              on this platform is currently recorded — suspending a school changes every user
              account in it and leaves no trace anyone can read back.
            </p>
          </Card>
        </>
      )}
    </>
  );
};

export default AdminSettings;