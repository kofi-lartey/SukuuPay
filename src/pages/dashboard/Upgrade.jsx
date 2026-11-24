import React, { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle,
  Copy,
  Crown,
  LoaderCircle,
  Phone,
  Sparkles,
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

/**
 * Map a `PRICING_PLANS` entry to its marketing tier key (starter/growth/campus).
 * Free/trial has no paid tier.
 */
const PLAN_TIER = {
  Free: null,
  Starter: 'starter',
  Growth: 'growth',
  Campus: 'campus',
};

const TIER_RANK = ['starter', 'growth', 'campus'];

/**
 * The Upgrade page.
 *
 * A school administrator compares the published plans and initiates an upgrade
 * to a higher tier. The page deliberately hides the current plan and every plan
 * at or below the school's tier — an upgrade can only move up, and showing a
 * "Free" or same-tier card would be a button that does nothing.
 *
 * Selecting a plan and confirming follows the existing subscription-payment
 * workflow: `initiateSubscriptionPayment` creates a pending `ManualPayment`,
 * suspends the school until a super admin approves, and the new tier only
 * activates on approval — at which point the entitlement resolver applies every
 * feature the new plan unlocks.
 */
const Upgrade = () => {
  const { user } = useAuth();
  const toast = useToast();
  const schoolId = user?.schoolId;
  const { data } = useDashboardOverview(schoolId);

  const school = data?.school;
  const currentPlan = school?.subscription?.plan;

  const [selectedName, setSelectedName] = useState(null);
  const [busy, setBusy] = useState(false);
  const [initiated, setInitiated] = useState(false);
  const [referenceCode, setReferenceCode] = useState('');
  const [expectedAmount, setExpectedAmount] = useState(0);
  const [payeePhone, setPayeePhone] = useState('05576655008');
  const [error, setError] = useState(null);

  /*
   * Resolve the school's current position from the raw `subscription.plan`
   * value, not from the entitlement resolver.
   *
   * `subscription.plan` holds either a legacy server alias (`basic`,
   * `standard`, `premium`, `enterprise`) or the marketing name the
   * manual-payment flow stores (`starter`/`growth`/`campus`) — and a school that
   * has never paid is `trial`/`free`. The entitlement resolver folds trial into
   * the starter tier (so a trial school gets starter features), but for the
   * upgrade decision a trial school must still be offered the paid Starter plan.
   * So the mapping lives here, and a trial/free school ranks below Starter.
   */
  const view = useMemo(() => {
    const raw = String(currentPlan || '').toLowerCase();
    const status = school?.subscription?.status;
    const isTrial = !raw || raw === 'trial' || raw === 'free' || status === 'trial';

    const tierForPlan = {
      starter: 'starter',
      basic: 'starter',
      growth: 'growth',
      standard: 'growth',
      premium: 'growth',
      campus: 'campus',
      enterprise: 'campus',
    };

    const tierKey = isTrial ? null : tierForPlan[raw] || null;
    const currentRank = tierKey ? TIER_RANK.indexOf(tierKey) : -1;

    const upgradePlans = PRICING_PLANS.filter((plan) => {
      const tier = PLAN_TIER[plan.name];
      if (!tier) return false;
      return TIER_RANK.indexOf(tier) > currentRank;
    });

    const currentPlanLabel = isTrial
      ? 'Free Trial'
      : PRICING_PLANS.find((plan) => PLAN_TIER[plan.name] === tierKey)?.name ||
        (currentPlan ? currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1) : 'Current');

    return {
      upgradePlans,
      currentPlanLabel,
      isTopTier: tierKey === 'campus' && upgradePlans.length === 0,
    };
  }, [currentPlan, school?.subscription?.status]);

  const { upgradePlans, currentPlanLabel, isTopTier } = view;

  const selectedPlan = upgradePlans.find((plan) => plan.name === selectedName) || null;

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
      toast.success(`Upgrade to ${selectedPlan.name} initiated.`);
    } catch (err) {
      setError(err.message || 'We could not start your upgrade. Please try again.');
    } finally {
      setBusy(false);
    }
  }, [selectedPlan, toast]);

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
        eyebrow="Administration"
        title="Upgrade your plan"
        description="Move to a higher tier to unlock more features. Your upgrade takes effect once an administrator approves your payment."
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] font-semibold text-slate-500">Current plan:</span>
            <Badge tone="brand">{currentPlanLabel}</Badge>
            {isTopTier && <Badge tone="green">Highest tier</Badge>}
          </div>
        }
      />

      {/* Payment-initiated confirmation — replaces the plan grid once the
          school has started an upgrade and is awaiting approval. */}
      {initiated && selectedPlan ? (
        <Card className="max-w-2xl">
          <div className="flex items-start gap-3">
            <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" aria-hidden="true" />
            <div className="min-w-0">
              <h3 className="text-base font-extrabold text-ink">
                Upgrade to {selectedPlan.name} initiated
              </h3>
              <p className="mt-1 text-slate-500">
                Your school is now{' '}
                <span className="font-medium text-amber-700">pending approval</span>. Features
                unlock once an administrator verifies your payment.
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
            Once paid, an administrator will review and approve your upgrade. The new tier and its
            features activate automatically after approval — no further action needed.
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
              to={ROUTES.DASHBOARD}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-700 px-4 py-2 text-sm font-bold text-white hover:bg-brand-800"
            >
              Back to dashboard
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </Card>
      ) : isTopTier ? (
        <Card className="max-w-2xl">
          <div className="flex flex-col items-center text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              <Crown className="h-7 w-7" aria-hidden="true" />
            </span>
            <h3 className="mt-4 text-base font-extrabold text-ink">
              You are on the highest plan
            </h3>
            <p className="mt-2 text-slate-500">
              Your school is already on the Campus tier, which includes every feature SukuuPay
              offers. Contact support if you need help getting the most out of it.
            </p>
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

          <div className="grid grid-cols-1 items-stretch gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {upgradePlans.map((plan) => {
              const selected = plan.name === selectedName;
              return (
                <div
                  key={plan.name}
                  className={`relative flex flex-col rounded-2xl border bg-white p-6 shadow-soft transition-colors ${
                    selected
                      ? 'border-brand-700 ring-2 ring-brand-700/30'
                      : plan.highlight
                        ? 'border-brand-200'
                        : 'border-slate-100'
                  }`}
                >
                  {plan.highlight && (
                    <span className="absolute -top-3 left-1/2 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full bg-amber-400 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-ink shadow-sm">
                      <Sparkles className="h-3 w-3" aria-hidden="true" />
                      Most Popular
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
                      or GHS {plan.monthly}/month · {plan.termNote}
                    </p>
                  </div>

                  <p className="mt-4 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                    {plan.name === 'Starter'
                      ? 'Everything included:'
                      : `Everything in ${PRICING_PLANS[PRICING_PLANS.findIndex((p) => p.name === plan.name) - 1]?.name || 'Starter'}, plus:`}
                  </p>

                  <ul className="mt-3 flex-1 space-y-2.5">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-[13px] font-medium text-slate-700">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

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
                  Upgrade to {selectedPlan.name} — {GHS(selectedPlan.monthly)}
                </p>
                <p className="mt-0.5 text-[12px] font-medium text-slate-600">
                  You will pay via Mobile Money, then an administrator approves. Features activate on
                  approval.
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
                    <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
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
            All upgrades require administrator approval before the new tier activates. Your current
            features remain available until then.
          </p>
        </>
      )}
    </>
  );
};

export default Upgrade;