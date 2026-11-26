/**
 * Feature catalog for tier-based access control — frontend mirror of the backend
 * resolver at `Backend/src/utils/featureCatalog.js`.
 *
 * ### Why a mirror
 *
 * The repo already duplicates contracts where there is no shared package
 * (`frontend/src/components/students/idcards/cardContract.js` says so itself). The
 * backend is the source of truth for what a school is entitled to; this module is
 * the read-side projection the UI needs, and it must be kept in step with the
 * server resolver. Server wins on conflict — the client only ever filters what it
 * renders.
 *
 * ### Inheritance
 *
 * `features` on a tier include every feature of its ancestor tiers, so resolving
 * "is this feature on for this school" is a pure lookup:
 *
 *   - Starter  → Starter features
 *   - Growth   → Starter ∪ Growth features
 *   - Campus  → Starter ∪ Growth ∪ Campus features
 *
 * The resolver below encodes that by seeding each tier from its parent.
 */

export const FEATURES = {
  bulkStudentUpload: {
    id: 'bulkStudentUpload',
    label: 'Bulk Student Upload (CSV/Excel)',
    module: 'records',
    tier: 'starter',
  },
  momoPayments: {
    id: 'momoPayments',
    label: 'All MoMo Networks (MTN, Telecel, AT)',
    module: 'payments',
    tier: 'starter',
  },
  smsReminders: {
    id: 'smsReminders',
    label: 'Automated SMS Fee Reminders',
    module: 'outreach',
    tier: 'starter',
  },
  pdfReceipts: {
    id: 'pdfReceipts',
    label: 'Instant Downloadable PDF Receipts',
    module: 'payments',
    tier: 'starter',
  },
  installments: {
    id: 'installments',
    label: 'Structured Installment Plans (2–6 tranches)',
    module: 'plans',
    tier: 'growth',
  },
  idCards: {
    id: 'idCards',
    label: 'ID Cards',
    module: 'records',
    tier: 'starter',
  },
  whatsapp: {
    id: 'whatsapp',
    label: 'WhatsApp Integration',
    module: 'outreach',
    tier: 'starter',
  },
  apiAccess: {
    id: 'apiAccess',
    label: 'SIS & School ERP API Integration',
    module: 'academics',
    tier: 'growth',
  },

  lmsBasic: {
    id: 'lmsBasic',
    label: 'Lesson Library & Basic Assignments',
    module: 'academics',
    tier: 'starter',
  },
  lmsQuizzes: {
    id: 'lmsQuizzes',
    label: 'Quizzes & Grading',
    module: 'academics',
    tier: 'growth',
  },
  lmsAnalytics: {
    id: 'lmsAnalytics',
    label: 'Basic LMS Analytics',
    module: 'insight',
    tier: 'growth',
  },

  arrearsDashboard: {
    id: 'arrearsDashboard',
    label: 'Installment Compliance & Arrears Dashboard',
    module: 'insight',
    tier: 'growth',
  },
  cashFlowAnalytics: {
    id: 'cashFlowAnalytics',
    label: 'Cash Flow Forecasting & Velocity Analytics',
    module: 'insight',
    tier: 'growth',
  },
};

/** Tier order — higher is richer. Used for inheritance and upgrade paths. */
export const TIER_ORDER = ['free', 'starter', 'growth'];

/** Maps marketing tier names (as published) to the server subscription plans. */
export const MARKETING_TO_SERVER = {
  Free: ['trial', 'free'],
  Starter: ['starter'],
  Growth: ['growth'],
};

/**
 * Retired plan names mapped onto their surviving tier. The published tiers are
 * Free / Starter / Growth; older records (and status-suffixed values like
 * `"premiumactive"`) may still carry a retired name. Mapping them keeps a
 * legacy school on the entitlements and billing it was sold.
 */
export const LEGACY_PLAN_ALIASES = {
  basic: 'free',
  standard: 'starter',
  premium: 'growth',
  enterprise: 'growth',
};

/**
 * Resolves the tier key for a given server plan value.
 *
 * @param {string} serverPlan - e.g. 'trial', 'free', 'starter', 'growth'
 * @returns {string | null}
 */
export const tierKeyForServerPlan = (serverPlan) => {
  if (!serverPlan) return null;
  let plan = String(serverPlan).toLowerCase();
  /*
   * `subscription.plan` may carry a status suffix concatenated to it
   * (e.g. `"growthactive"` instead of `"growth"`). Strip any known trailing
   * status so the plan portion is recovered; clean values pass through unchanged.
   */
  const STATUSES = ['active', 'suspended', 'expired', 'cancelled', 'pending', 'trial'];
  for (const status of STATUSES) {
    if (plan.endsWith(status)) {
      const candidate = plan.slice(0, -status.length);
      if (['trial', 'free', 'starter', 'growth'].includes(candidate)) {
        plan = candidate;
        break;
      }
      // A retired name with a status suffix (e.g. "premiumactive").
      if (LEGACY_PLAN_ALIASES[candidate]) {
        plan = LEGACY_PLAN_ALIASES[candidate];
        break;
      }
    }
  }
  // A bare retired name (e.g. "premium").
  if (LEGACY_PLAN_ALIASES[plan]) plan = LEGACY_PLAN_ALIASES[plan];
  const aliases = {
    free: ['trial', 'free'],
    starter: ['starter'],
    growth: ['growth'],
  };
  for (const tierKey of TIER_ORDER) {
    if (aliases[tierKey].includes(plan)) return tierKey;
  }
  return null;
};

/**
 * Maps server subscription plan values to marketing labels for display.
 * The server uses: trial, free, starter, growth
 * Marketing tiers: Free, Free, Starter, Growth
 */
export const getPlanLabel = (plan) => {
  if (!plan) return 'Unknown';
  const labels = {
    trial: 'Free',
    free: 'Free',
    starter: 'Starter',
    growth: 'Growth',
  };
  // Strip status suffix if present (e.g., "growthactive" -> "growth")
  const basePlan = tierKeyForServerPlan(plan)
    ? Object.keys({ trial: 1, free: 1, starter: 1, growth: 1 }).find(
        (k) => tierKeyForServerPlan(k) === tierKeyForServerPlan(plan)
      )
    : plan;
  return labels[basePlan] || basePlan;
};

/**
 * Resolves the set of enabled feature IDs for a school.
 *
 * @param {object} school - School object with `subscription.plan` and optional `subscription.featureFlags` or top-level `featureFlags`
 * @returns {Set<string>}
 */
export const resolveEntitlements = (school) => {
  const tierKey = tierKeyForServerPlan(school?.subscription?.plan);
  if (!tierKey) return new Set();

  // Feature IDs per tier, with explicit inheritance:
  // - Each tier's array includes its own features + all features from lower tiers.
  // - The arrays below are flat to avoid conditional ternaries.
  const tierFeatures = {
    free: [
      'bulkStudentUpload',
      'momoPayments',
      'smsReminders',
      'pdfReceipts',
    ],
    starter: [
      // Inherited from free
      'bulkStudentUpload',
      'momoPayments',
      'smsReminders',
      'pdfReceipts',
      // Starter-specific (LMS)
      'idCards',
      'whatsapp',
      'lmsBasic',
    ],
    growth: [
      'installments',
      'arrearsDashboard',
      'cashFlowAnalytics',
      'lmsQuizzes',
      'lmsAnalytics',
      'apiAccess',
      // Inherited from starter
      'bulkStudentUpload',
      'momoPayments',
      'smsReminders',
      'pdfReceipts',
      'idCards',
      'whatsapp',
      'lmsBasic',
    ],
  };

  const enabled = new Set(tierFeatures[tierKey] || tierFeatures.free || []);

  // Merge any explicitly enabled per-school feature flags.
  // Check both school.featureFlags (top-level) and school.subscription.featureFlags
  const flags = school?.featureFlags || school?.subscription?.featureFlags;
  if (flags) {
    if (flags.installments) enabled.add('installments');
    if (flags.idCards) enabled.add('idCards');
    if (flags.whatsapp) enabled.add('whatsapp');
    if (flags.apiAccess) enabled.add('apiAccess');
  }

  return enabled;
};

/**
 * Boolean check for a single feature on a school.
 *
 * @param {object} school - School object
 * @param {string} featureId - Feature ID to check
 * @returns {boolean}
 */
export const hasFeature = (school, featureId) => {
  const enabled = resolveEntitlements(school);
  return enabled.has(featureId);
};

/**
 * The upgrade path from a tier to the next.
 *
 * @param {string} tierKey - Current tier ('free', 'starter', 'growth')
 * @returns {string | null} Next tier key, or null if already top tier.
 */
export const nextTier = (tierKey) => {
  const index = TIER_ORDER.indexOf(tierKey);
  if (index < 0 || index >= TIER_ORDER.length - 1) return null;
  return TIER_ORDER[index + 1];
};

/**
 * Features not yet enabled on a school, grouped by the tier that unlocks them.
 *
 * @param {object} school - School object
 * @returns {Array<{ featureId: string; feature: object; tier: string }>}
 */
export const lockedFeaturesFor = (school) => {
  const tierKey = tierKeyForServerPlan(school?.subscription?.plan);
  if (!tierKey) return [];

  const next = nextTier(tierKey);
  if (!next) return []; // Already top tier

  // Features that the next tier adds over the current tier
  const nextTierOnly = {
    free: ['idCards', 'whatsapp', 'lmsBasic'],
    starter: ['installments', 'arrearsDashboard', 'cashFlowAnalytics', 'lmsQuizzes', 'lmsAnalytics', 'apiAccess'],
    growth: [],
  }[tierKey] || [];

  return nextTierOnly
    .filter((fid) => FEATURES[fid])
    .map((fid) => ({ featureId: fid, feature: FEATURES[fid], tier: next }));
};
