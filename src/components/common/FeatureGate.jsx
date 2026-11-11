import React from 'react';
import { Lock, ArrowUpRight, ExternalLink } from 'lucide-react';

/**
 * A feature gate: renders children when enabled, otherwise an upgrade prompt.
 *
 * Usage:
 *   <FeatureGate feature="installments">
 *     <InstallmentPlansModule />
 *   </FeatureGate>
 *
 * If `enabled` is provided, uses that; otherwise calls `useEntitlements` internally.
 */
export const FeatureGate = ({
  feature,
  children,
  fallback,
  enabled,
  upgradeTarget,
  onUpgradeClick,
}) => {
  const canAccess = enabled?.has(feature);

  if (canAccess) return <>{children}</>;

  // Use provided fallback or render default upgrade prompt
  if (fallback) {
    return typeof fallback === 'function' ? fallback({ feature, upgradeTarget }) : fallback;
  }

  return (
    <UpgradePrompt
      feature={feature}
      upgradeTarget={upgradeTarget}
      onClick={onUpgradeClick}
    />
  );
};

/**
 * Upgrade prompt shown when a feature is locked.
 *
 * Props:
 * - feature: feature ID
 * - upgradeTarget: { tier, marketingName, features[] } from useEntitlements
 * - onClick: optional handler (e.g., navigate to billing page)
 */
export const UpgradePrompt = ({
  feature,
  upgradeTarget,
  onClick,
  className = '',
}) => {
  const FEATURE_LABELS = {
    installments: 'Installment Plans',
    lmsQuizzes: 'Quizzes & Grading',
    lmsAnalytics: 'LMS Analytics',
    multiCampusControls: 'Multi-Campus Controls',
    customAuditReports: 'Custom Audit Reports',
    successAccountManager: 'Dedicated Account Manager',
    customSenderId: 'Custom Sender ID',
    lmsAdvanced: 'Advanced LMS',
    arrearsDashboard: 'Arrears Dashboard',
    cashFlowAnalytics: 'Cash Flow Analytics',
  };

  const featureName = FEATURE_LABELS[feature] || feature;
  const tierName = upgradeTarget?.marketingName || 'a higher tier';

  const handleClick = onClick || (() => {
    // Default: navigate to billing settings page where admin can request upgrade
    window.location.href = '/dashboard/settings?tab=billing';
  });

  return (
    <div
      className={`rounded-2xl border-2 border-dashed border-brand-200 bg-brand-50/60 p-8 text-center ${className}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100">
          <Lock className="h-7 w-7 text-brand-700" aria-hidden="true" />
        </div>

        <div>
          <h3 className="text-lg font-extrabold text-ink">
            {featureName} is locked
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            This feature is available on the <strong>{tierName}</strong> plan.
          </p>

          {upgradeTarget?.features?.length && (
            <p className="mt-2 text-sm text-slate-500">
              {tierName} also unlocks:
            </p>
          )}

          {upgradeTarget?.features?.length && (
            <ul className="mt-2 space-y-1 text-sm text-slate-600">
              {upgradeTarget.features.slice(0, 3).map(({ feature: f }) => (
                <li key={f.featureId} className="flex items-center justify-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-brand-500" aria-hidden="true" />
                  {FEATURE_LABELS[f.featureId] || f.featureId}
                </li>
              ))}
              {upgradeTarget.features.length > 3 && (
                <li className="flex items-center justify-center gap-1.5 text-slate-500">
                  +{upgradeTarget.features.length - 3} more features
                </li>
              )}
            </ul>
          )}
        </div>

        <button
          type="button"
          onClick={handleClick}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
        >
          Upgrade to {tierName}
          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </button>

        <p className="text-[11px] text-slate-500">
          Contact your account manager or visit{' '}
          <a
            href="https://sukuupay.com/pricing"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-brand-700 hover:underline"
          >
            the pricing page
          </a>{' '}
          for details.
        </p>
      </div>
    </div>
  );
};

/**
 * Inline upgrade badge for nav items or module headers.
 */
export const UpgradeBadge = ({ tierName = 'Growth', className = '' }) => (
  <span
    className={`inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-amber-900 ${className}`}
  >
    <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
    Upgrade to {tierName}
  </span>
);

/**
 * Locked module card — for use in settings or feature list pages.
 */
export const LockedModuleCard = ({
  feature,
  title,
  description,
  upgradeTarget,
  onUpgrade,
  className = '',
}) => {
  const FEATURE_LABELS = {
    installments: 'Installment Plans',
    lmsQuizzes: 'Quizzes & Grading',
    lmsAnalytics: 'LMS Analytics',
    multiCampusControls: 'Multi-Campus Controls',
    customAuditReports: 'Custom Audit Reports',
    successAccountManager: 'Dedicated Account Manager',
    customSenderId: 'Custom Sender ID',
    lmsAdvanced: 'Advanced LMS',
    arrearsDashboard: 'Arrears Dashboard',
    cashFlowAnalytics: 'Cash Flow Analytics',
  };

  return (
    <div
      className={`relative rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-soft backdrop-blur ${className}`}
    >
      <div className="absolute -top-3 -right-3">
        <UpgradeBadge tierName={upgradeTarget?.marketingName || 'Growth'} />
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h4 className="font-extrabold text-ink">{title || FEATURE_LABELS[feature] || feature}</h4>
          <p className="mt-1 text-sm text-slate-600">{description || `This feature requires the ${upgradeTarget?.marketingName || 'Growth'} plan.`}</p>
        </div>
        <div className="shrink-0">
          <Lock className="h-6 w-6 text-slate-300" aria-hidden="true" />
        </div>
      </div>

      {upgradeTarget?.features?.length && (
        <ul className="mt-4 space-y-1.5 text-sm text-slate-600 border-t border-slate-100 pt-4">
          {upgradeTarget.features.slice(0, 4).map(({ feature: f }) => (
            <li key={f.featureId} className="flex items-center gap-2">
              <Lock className="h-3.5 w-3.5 text-brand-500 shrink-0" aria-hidden="true" />
              {FEATURE_LABELS[f.featureId] || f.featureId}
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={onUpgrade}
        className="mt-4 w-full rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
      >
        Upgrade to {upgradeTarget?.marketingName || 'Growth'}
      </button>
    </div>
  );
};

export default FeatureGate;