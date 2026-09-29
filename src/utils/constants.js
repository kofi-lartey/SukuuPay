export const ROUTES = {
  HOME: '/',
  FEATURES: '/features',
  PRICING: '/pricing',
  HOW_IT_WORKS: '/how-it-works',
  FOR_SCHOOLS: '/for-schools',
  CONTACT: '/contact',
  LOGIN: '/login',
  SIGNUP: '/signup',
  VERIFY_EMAIL: '/verify-email',
  RESET_PASSWORD: '/reset-password',
  TERMS: '/terms',
  PRIVACY: '/privacy',
  DASHBOARD: '/dashboard',
  ONBOARDING: '/onboarding',
};

export const APP_NAME = 'SukuuPay';

/** Single source of truth for the copyright year across every page. */
export const APP_YEAR = 2025;

/**
 * The one and only navigation definition. `Navbar` renders this; nothing else
 * should hardcode a marketing link, otherwise the header and footer drift.
 */
export const NAV_LINKS = [
  { label: 'Features', to: ROUTES.FEATURES },
  { label: 'Pricing', to: ROUTES.PRICING },
  { label: 'How It Works', to: ROUTES.HOW_IT_WORKS },
  { label: 'For Schools', to: ROUTES.FOR_SCHOOLS, accent: true },
  { label: 'Contact', to: ROUTES.CONTACT },
];

export const COMPANY_ADDRESS = {
  office: 'Prampram Technology Center',
  street: 'Opposite District Assembly, Greater Accra Region, Ghana',
  email: 'hello@sukuupay.com',
  whatsappDisplay: '+233 24 000 0000',
  whatsappHref: 'https://wa.me/233240000000',
};

/** Mirrors the `region` enum on the School model. */
export const GHANA_REGIONS = [
  'Ahafo',
  'Ashanti',
  'Bono',
  'Bono East',
  'Central',
  'Eastern',
  'Greater Accra',
  'North East',
  'Northern',
  'Oti',
  'Savannah',
  'Upper East',
  'Upper West',
  'Volta',
  'Western',
  'Western North',
];

export const SCHOOL_CLASSIFICATIONS = [
  { value: 'private', label: 'Private Basic School' },
  { value: 'international', label: 'International School' },
  { value: 'senior_high', label: 'Senior High School' },
  { value: 'university', label: 'University / College' },
];

export const HELPDESK_PHONE = '+233 24 456 7890';

// ── School onboarding wizard ───────────────────────────────────────────────

/** Mirrors the `type` enum on the School model. */
export const GHANA_SCHOOL_TYPES = [
  { value: 'public', label: 'Public School' },
  { value: 'private', label: 'Private School' },
  { value: 'international', label: 'International School' },
  { value: 'mission', label: 'Mission / Church School' },
  { value: 'charter', label: 'Charter School' },
];

export const GHANA_BANKS = [
  'GCB Bank',
  'Ecobank Ghana',
  'Absa Bank Ghana',
  'Stanbic Bank Ghana',
  'Fidelity Bank Ghana',
  'CalBank',
  'Zenith Bank Ghana',
  'Access Bank Ghana',
  'Agricultural Development Bank',
  'National Investment Bank',
  'Republic Bank Ghana',
  'Standard Chartered Bank Ghana',
  'Other',
];

export const MOMO_NETWORKS = [
  { value: 'mtn', label: 'MTN Mobile Money' },
  { value: 'telecel', label: 'Telecel Cash' },
  { value: 'airteltigo', label: 'AirtelTigo Money' },
];

/**
 * The four wizard steps. `id` doubles as the route segment, so the stepper and
 * the router can never drift apart.
 */
export const ONBOARDING_STEPS = [
  { id: 'school-profile', label: 'School Profile', icon: 'Building2' },
  { id: 'payment-setup', label: 'Payment Setup', icon: 'CreditCard' },
  { id: 'import-students', label: 'Import Students', icon: 'Users' },
  { id: 'send-reminder', label: 'Send Reminder', icon: 'MessageSquare' },
];

/** localStorage key holding the highest step the admin has unlocked. */
export const ONBOARDING_PROGRESS_KEY = 'sukuupay_onboarding';

/** Per-step draft key prefix, e.g. `sukuupay_onboarding_step2`. */
export const ONBOARDING_STEP_KEY_PREFIX = 'sukuupay_onboarding_step';

/**
 * Column headers the backend's bulk importer expects (see
 * `bulkCreateStudents` in Backend/src/services/student.service.js — it
 * lower-cases and strips spaces from every header, so `Student Name` and
 * `studentname` are the same column).
 */
export const STUDENT_IMPORT_COLUMNS = [
  'Student Name',
  'Student Class',
  'Gender',
  'Date Of Birth',
  'Parent Name',
  'Parent Phone',
  'Parent Email',
  'Parent Relationship',
  'Total Owed',
  'Deadline',
];

/** Longest a single SMS segment can be before the gateway splits it. */
export const SMS_SEGMENT_LENGTH = 160;
