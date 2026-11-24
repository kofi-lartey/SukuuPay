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
    tier: 'campus',
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
  lmsAdvanced: {
    id: 'lmsAdvanced',
    label: 'Multi-Campus Content & API',
    module: 'academics',
    tier: 'campus',
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
  multiCampusControls: {
    id: 'multiCampusControls',
    label: 'Multi-Campus & Multi-Signatory Financial Controls',
    module: 'administration',
    tier: 'campus',
  },
  customAuditReports: {
    id: 'customAuditReports',
    label: 'Custom Audit Reports & MoE Compliance Exports',
    module: 'insight',
    tier: 'campus',
  },
  successAccountManager: {
    id: 'successAccountManager',
    label: 'Dedicated School Success Account Manager',
    module: 'administration',
    tier: 'campus',
  },
  customSenderId: {
    id: 'customSenderId',
    label: 'Custom SMS Sender ID Branding',
    module: 'outreach',
    tier: 'campus',
  },
};

/** Tier order — higher is richer. Used for inheritance and upgrade paths. */
export const TIER_ORDER = ['starter', 'growth', 'campus'];

/** Maps marketing tier names (as published) to the server subscription plans. */
export const MARKETING_TO_SERVER = {
  Starter: ['trial', 'basic'],
  Growth: ['standard', 'premium'],
  Campus: ['enterprise'],
};

/**
 * Resolves the tier key for a given server plan value.
 *
 * @param {string} serverPlan - e.g. 'trial', 'basic', 'standard', 'premium', 'enterprise'
 * @returns {string | null}
 */
export const tierKeyForServerPlan = (serverPlan) => {
  if (!serverPlan) return null;
  const plan = String(serverPlan).toLowerCase();
  /*
   * `subscription.plan` holds BOTH the legacy server aliases and the published
   * marketing names: the School model enum accepts `starter`/`growth`/`campus`
   * alongside `trial`/`basic`/`standard`/`premium`/`enterprise`, and the
   * manual-payment flow stores the marketing name directly. Resolving only the
   * aliases left a school on `plan: "starter"` with no tier — and therefore no
   * entitlements at all — so both spellings are mapped here.
   */
  const aliases = {
    starter: ['trial', 'free', 'basic', 'starter'],
    growth: ['standard', 'premium', 'growth'],
    campus: ['enterprise', 'campus'],
  };
  for (const tierKey of TIER_ORDER) {
    if (aliases[tierKey].includes(plan)) return tierKey;
  }
  return null;
};

/**
 * Resolves the set of enabled feature IDs for a school.
 *
 * @param {object} school - School object with `subscription.plan` and optional `subscription.featureFlags`
 * @returns {Set<string>}
 */
export const resolveEntitlements = (school) => {
  const tierKey = tierKeyForServerPlan(school?.subscription?.plan);
  if (!tierKey) return new Set();

  // Feature IDs per tier, with explicit inheritance:
  // - Each tier's array includes its own features + all features from lower tiers.
  // - The arrays below are flat to avoid conditional ternaries.
  const tierFeatures = {
    starter: [
      'bulkStudentUpload',
      'momoPayments',
      'smsReminders',
      'pdfReceipts',
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
      // Inherited from starter
      'bulkStudentUpload',
      'momoPayments',
      'smsReminders',
      'pdfReceipts',
      'idCards',
      'whatsapp',
      'lmsBasic',
    ],
    campus: [
      'multiCampusControls',
      'customAuditReports',
      'successAccountManager',
      'customSenderId',
      // Inherited from growth
      'installments',
      'arrearsDashboard',
      'cashFlowAnalytics',
      'lmsQuizzes',
      'lmsAnalytics',
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

  const enabled = new Set(tierFeatures[tierKey] || tierFeatures.starter || []);

  // Merge any explicitly enabled per-school feature flags.
  const flags = school?.subscription?.featureFlags;
  if (flags) {
    if (flags.installments) enabled.add('installments');
    if (flags.idCards) enabled.add('idCards');
    if (flags.whatsapp) enabled.add('whatsapp');
    if (flags.apiAccess) enabled.add('apiAccess');
  }

  return enabled;
};

/**
 * Whether a feature is enabled for a school.
 *
 * @param {object} school - School object
 * @param {string} featureId - Feature ID
 * @returns {boolean}
 */
export const hasFeature = (school, featureId) => resolveEntitlements(school).has(featureId);

/**
 * The upgrade path from a tier to the next.
 *
 * @param {string} tierKey - Current tier ('starter', 'growth', 'campus')
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
    starter: ['installments', 'arrearsDashboard', 'cashFlowAnalytics', 'lmsQuizzes', 'lmsAnalytics'],
    growth: ['multiCampusControls', 'customAuditReports', 'successAccountManager', 'customSenderId', 'lmsAdvanced'],
    campus: [],
  }[tierKey] || [];

  return nextTierOnly
    .filter((fid) => FEATURES[fid])
    .map((fid) => ({ featureId: fid, feature: FEATURES[fid], tier: next }));
};
