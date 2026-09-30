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

/**
 * The deployed frontend origin.
 *
 * Only needed for links that must be absolute and clickable outside a running
 * app — emails, SMS, "open in a new tab" targets. Everything inside the SPA
 * should use `ROUTES` and a relative path instead, so the app keeps working on
 * a Netlify preview domain or `localhost` without a rebuild.
 *
 * This is the frontend, not the API. The backend has its own `CLIENT_URL`, and
 * the two must agree: the emailed verification and reset links are built there
 * and opened here, so a mismatch breaks sign-in.
 */
export const APP_URL = 'https://sukuupay.netlify.app';

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

// ── Account roles ───────────────────────────────────────────────────────────

/**
 * Roles a user may choose for themselves at signup.
 *
 * Deliberately excludes `super_admin`, which is the model enum's first member and
 * the only genuinely dangerous one. Self-service signup must not be able to mint a
 * platform operator; the backend enforces the same exclusion in
 * `SELF_SIGNUP_ROLES`, and this list is the client-side mirror of it.
 *
 * `school_admin` is first and preselected because it is the overwhelmingly common
 * case: one person registering their own school. It is also the only role
 * permitted to create a school — see `canCreateSchool`.
 */
export const SIGNUP_ROLES = [
  {
    value: 'school_admin',
    label: 'School administrator',
    description: 'Full access, including payments, staff and settings.',
    canCreateSchool: true,
  },
  {
    value: 'accountant',
    label: 'Accountant / bursar',
    description: 'Payments, receipts and financial reports.',
    canCreateSchool: false,
  },
  {
    value: 'teacher',
    label: 'Teacher',
    description: 'Student records and class information.',
    canCreateSchool: false,
  },
  {
    value: 'viewer',
    label: 'Viewer',
    description: 'Read-only access to reports and records.',
    canCreateSchool: false,
  },
];

/** Mirrors the `role` enum on the User model. */
export const USER_ROLES = ['super_admin', 'school_admin', 'accountant', 'teacher', 'viewer'];

/**
 * Only `school_admin` may create a school through `POST /schools/me`.
 *
 * The upload endpoint agrees: `POST /upload/school-logo` is guarded by
 * `authorize('super_admin', 'school_admin')`, so a teacher who created their own
 * school would finish provisioning and then be refused their own logo — an
 * incoherent state. Anyone else joins an existing school with a school code
 * instead.
 */
export const canCreateSchool = (role) => SIGNUP_ROLES.some((r) => r.value === role && r.canCreateSchool);

// ── Position (job title) ────────────────────────────────────────────────────

/**
 * Common job titles in a Ghanaian school.
 *
 * `OTHER` is a real option rather than a free-text box, because the overwhelmingly
 * most common answers are on this list and a dropdown beats typing. Picking it
 * reveals a text field rather than replacing the select, so the user can change
 * their mind without losing what they typed.
 *
 * `value: 'OTHER'` is a sentinel, never stored. The manual text is persisted to
 * `User.position` instead, which stays an unconstrained string — a school may have
 * a title this list never anticipated, and constraining the field to an enum would
 * force a wrong answer or a support ticket.
 */
export const OTHER_POSITION = 'OTHER';

export const POSITIONS = [
  { value: 'Headteacher / Headmistress', label: 'Headteacher / Headmistress' },
  { value: 'Proprietor / Proprietress', label: 'Proprietor / Proprietress' },
  { value: 'Administrator', label: 'Administrator' },
  { value: 'Accountant', label: 'Accountant' },
  { value: 'Bursar', label: 'Bursar' },
  { value: 'Registrar', label: 'Registrar' },
  { value: 'Librarian', label: 'Librarian' },
  { value: 'Senior Teacher', label: 'Senior Teacher' },
  { value: 'Teacher', label: 'Teacher' },
  { value: 'School Secretary', label: 'School Secretary' },
  { value: 'Parent / Guardian', label: 'Parent / Guardian' },
  { value: OTHER_POSITION, label: 'Other' },
];

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
