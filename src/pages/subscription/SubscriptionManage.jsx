import React, { useCallback, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  Clock,
  Copy,
  CreditCard,
  Phone,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import PageHeader from '../../components/dashboard/PageHeader';
import Card from '../../components/dashboard/ui/Card';
import Badge from '../../components/dashboard/ui/Badge';
import { useAuth } from '../../context/AuthContext';
import { useDashboardOverview } from '../../hooks/useDashboardOverview';
import { initiateSubscriptionPayment } from '../../services/school';
import { useToast } from '../../hooks/useToast';
import { PRICING_PLANS, ROUTES } from '../../utils/constants';

const GHS = (amount) => `GH₵ ${amount.toLocaleString('en-GH')}`;

const PLAN_TIER = {
  Free: null,
  Starter: 'starter',
  Growth: 'growth',
};

const DAY_LABELS = {
  active: 'Active subscription',
  grace: 'Grace period',
  locked: 'Subscription locked',
  expired: 'Subscription expired',
  suspended: 'Payment pending approval',
  cancelled: 'Subscription cancelled',
  trial: 'Free trial',
};

/**
 * The subscription management page.
 *
 * A school whose paid subscription has expired is here because the
 * seven-day grace period has lapsed (status `locked`) or is still running
 * (status `grace`). The page offers two paths:
 *
 *   - **Pay for a new subscription** — select a tier and initiate a manual
 *     payment, exactly as on the Upgrade page.
 *   - **Update your existing plan** — change tier and/or billing details,
 *     also via a manual payment that awaits admin approval.
 *
 * Once a payment is initiated, the school is shown the Mobile Money payee
 * number, reference code and amount, and can return to the dashboard after
 * an administrator approves.
 */
const SubscriptionManage = () => {
  const { user } = useAuth();
  const toast = useToast();
  const location = useLocation();
  const schoolId = user?.schoolId;
  const { data } = useDashboardOverview(schoolId);

  const school = data?.school;
  const sub = school?.subscription || {};
  const status = sub.status;
  const graceEndsAt = sub.gracePeriodEnd ? new Date(sub.gracePeriodEnd) : null;

  const [mode, setMode] = useState('pay'); // 'pay' | 'update'
  const [selectedName, setSelectedName] = useState(null);
  const [busy, setBusy] = useState(false);
  const [initiated, setInitiated] = useState(false);
  const [referenceCode, setReferenceCode] = useState('');
  const [expectedAmount, setExpectedAmount] = useState(0);
  const [payeePhone, setPayeePhone] = useState('05576655008');
  const [error, setError] = useState(null);

  const daysLeft = useMemo(() => {
    if (!graceEndsAt) return null;
    const ms = graceEndsAt.getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  }, [graceEndsAt]);

  const isGrace = status === 'grace';
  const isLocked = status === 'locked';

  const returnTo = location.state?.from || ROUTES.DASHBOARD;

  const selectedPlan = PRICING_PLANS.find((plan) => plan.name === selectedName) || null;

  const rawPlan = String(sub.plan || '').toLowerCase();
  const currentPlanLabel = useMemo(() => {
    if (rawPlan === 'starter') return 'Starter';
    if (rawPlan === 'growth') return 'Growth';
    if (rawPlan === 'trial' || rawPlan === 'free') return 'Free Trial';
    return sub.plan ? `${sub.plan.charAt(0).toUpperCase()}${sub.plan.slice(1)}` : 'Not set';
  }, [rawPlan, sub.plan]);

  const initiate = useCallback(async () => {
    if (!selectedPlan) return;
    setBusy(true);
    setError(null);
    try {
      const result = await initiateSubscriptionPayment({
        plan: PLAN_TIER[selectedPlan.name],
        monthlyFee: Math.round(selectedPlan.monthly * 100),
      });
      setInitiated(true);
      setReferenceCode(result.referenceCode || '');
      setExpectedAmount((result.expectedAmount || selectedPlan.monthly * 100) / 100);
      setPayeePhone(result.payeePhone || '05576655008');
      toast.success(
        mode === 'pay'
          ? `New ${selectedPlan.name} subscription initiated.`
          : `${selectedPlan.name} plan update initiated.`
      );
    } catch (err) {
      setError(err.message || 'We could not start your payment. Please try again.');
    } finally {
      setBusy(false);
    }
  }, [selectedPlan, mode, toast]);

  const copyReference = () => {
    navigator.clipboard.writeText(referenceCode);
    toast.info('Reference code copied.');
  };

  const resetFlow = () => {
    setInitiated(false);
    setSelectedName(null);
    setReferenceCode('');
    setError(null);
  };

  return (
    <>
      <PageHeader
        eyebrow="Subscription"
        title={isLocked ? 'Renew your subscription' : 'Manage your subscription'}
        description={
          isLocked
            ? 'Your school subscription has expired and access is locked. Pay to reactivate.'
            : `Your subscription is in its grace period${daysLeft != null ? ` — ${daysLeft} day(s) remaining` : ''}. Full access continues while you renew.`
        }
        meta={
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone={isLocked ? 'red' : isGrace ? 'amber' : 'brand'}>
              {DAY_LABELS[status] || status}
            </Badge>
            {graceEndsAt && isGrace && (
              <span className="text-[12px] font-medium text-slate-500">
                Grace ends {graceEndsAt.toLocaleDateString('en-GB')}
              </span>
            )}
          </div>
        }
      />

      {/* Payment-initiated confirmation. */}
      {initiated && selectedPlan ? (
        <Card className="max-w-2xl">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" aria-hidden="true" />
            <div className="min-w-0">
              <h3 className="text-base font-extrabold text-ink">
                Payment initiated — pending approval
              </h3>
              <p className="mt-1 text-slate-500">
                Your school is{' '}
                <span className="font-medium text-amber-700">pending approval</span>. Access is
                restored once an administrator verifies your payment.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-3">
              <Phone className="h-4 w-4 text-slate-400" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-[12px] font-medium text-slate-500">Payee number</p>
                <p className="font-mono font-bold text-ink">{payeePhone}</p>
              </div>
              <button
                onClick={() => navigator.clipboard.writeText(payeePhone)}
                className="ml-auto p-1 text-slate-400 hover:text-brand-600"
                title="Copy number"
              >
                <Copy className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-3">
              <Copy className="h-4 w-4 text-slate-400" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-[12px] font-medium text-slate-500">Reference code</p>
                <p className="font-mono font-bold text-ink">{referenceCode}</p>
              </div>
              <button
                onClick={copyReference}
                className="ml-auto p-1 text-slate-400 hover:text-brand-600"
                title="Copy code"
              >
                <Copy className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="mt-6 rounded-lg border border-amber-100 bg-amber-50 p-4">
            <p className="text-[13px] text-amber-800">
              <strong>Include the reference code</strong>{' '}
              <span className="font-mono">{referenceCode}</span> as the payment narration when you
              send Mobile Money to <span className="font-mono font-bold">{payeePhone}</span>.
              Amount: <strong>{GHS(expectedAmount)}</strong>.
            </p>
          </div>

          <p className="mt-4 text-[13px] text-slate-500">
            Once paid, an administrator will review and approve. Your subscription reactivates
            automatically after approval — no further action needed.
          </p>

          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={resetFlow}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              Choose a different plan
            </button>
            <Link
              to={returnTo}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-700 px-4 py-2 text-sm font-bold text-white hover:bg-brand-800"
            >
              Back to dashboard
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </Card>
      ) : (
        <>
          {error && (
            <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p className="text-[13px] font-medium">{error}</p>
            </div>
          )}

          {/* Mode selector: pay for new vs update existing. */}
          <div className="mb-8 flex w-full max-w-md rounded-xl border border-slate-200 bg-white">
            <button
              type="button"
              onClick={() => setMode('pay')}
              className={`flex-1 rounded-xl py-3 text-sm font-bold transition-colors ${
                mode === 'pay'
                  ? 'bg-brand-700 text-white shadow-lift'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <CreditCard className="h-4 w-4 mr-2" aria-hidden="true" />
              Pay for new subscription
            </button>
            <button
              type="button"
              onClick={() => setMode('update')}
              className={`flex-1 rounded-xl py-3 text-sm font-bold transition-colors ${
                mode === 'update'
                  ? 'bg-brand-700 text-white shadow-lift'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
              Update existing plan
            </button>
          </div>

          <div className="grid grid-cols-1 items-stretch gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {PRICING_PLANS.map((plan) => {
              const selected = plan.name === selectedName;
              const isCurrent = PLAN_TIER[plan.name] === rawPlan;
              return (
                <div
                  key={plan.name}
                  className={`relative flex flex-col rounded-2xl border bg-white p-6 shadow-soft transition-colors ${
                    selected
                      ? 'border-brand-700 ring-2 ring-brand-700/30'
                      : isCurrent
                        ? 'border-brand-200 bg-brand-50/40'
                        : 'border-slate-100'
                  }`}
                >
                  {isCurrent && (
                    <span className="absolute -top-3 left-1/2 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full bg-blue-100 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-blue-800 shadow-sm">
                      <Clock className="h-3 w-3" aria-hidden="true" />
                      Current plan
                    </span>
                  )}

                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-xl font-extrabold text-ink">{plan.name}</h2>
                    <Badge tone={selected ? 'brand' : 'slate'}>{plan.capacity}</Badge>
                  </div>

                  <p className="mt-2 text-[13px] font-medium text-slate-500">{plan.blurb}</p>

                  <div className="mt-4 border-b border-slate-100 pb-4">
                    <div className="flex items-baseline gap-1">
                      <span className="text-xs font-bold text-slate-500">GHS</span>
                      <span className="text-3xl font-extrabold text-ink">{plan.termly}</span>
                      <span className="text-xs text-slate-500">/ term</span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400">
                      or GHS {plan.monthly}/month
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedName(plan.name)}
                    disabled={busy}
                    className={`mt-6 w-full rounded-xl py-3 text-center text-sm font-bold transition-colors disabled:opacity-50 ${
                      selected
                        ? 'bg-brand-700 text-white shadow-lift hover:bg-brand-800'
                        : 'bg-slate-100 text-ink hover:bg-slate-200'
                    }`}
                  >
                    {selected ? 'Selected' : `Choose ${plan.name}`}
                  </button>
                </div>
              );
            })}
          </div>

          {selectedPlan && (
            <div className="mt-6 flex flex-col items-start justify-between gap-3 rounded-2xl border border-brand-200 bg-brand-50/60 p-5 sm:flex-row sm:items-center">
              <div className="min-w-0">
                <p className="text-[13px] font-extrabold text-ink">
                  {mode === 'pay'
                    ? `New ${selectedPlan.name} subscription — ${GHS(selectedPlan.monthly)}`
                    : `Update to ${selectedPlan.name} — ${GHS(selectedPlan.monthly)}`}
                </p>
                <p className="mt-0.5 text-[12px] font-medium text-slate-600">
                  You will pay via Mobile Money, then an administrator approves.{' '}
                  {isLocked
                    ? 'Access is restored once approved.'
                    : 'Your current features remain available until approval.'}
                </p>
              </div>
              <button
                type="button"
                onClick={initiate}
                disabled={busy}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-bold text-white shadow-lift transition-colors hover:bg-brand-800 disabled:opacity-50"
              >
                {busy ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Initiating…
                  </>
                ) : (
                  <>
                    <Phone className="h-4 w-4" aria-hidden="true" />
                    Continue to payment
                  </>
                )}
              </button>
            </div>
          )}

          <p className="mt-6 text-[12px] font-medium text-slate-400">
            All subscription payments require administrator approval before the plan activates.
            Your school is{' '}
            {isLocked ? 'currently locked out' : 'still in its grace period'} — pay before the grace
            period ends to avoid losing access.
          </p>
        </>
      )}
    </>
  );
};

export default SubscriptionManage;
