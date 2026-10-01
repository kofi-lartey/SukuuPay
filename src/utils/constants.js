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
  // Dashboard modules nest under DASHBOARD so the whole management system is one
  // guarded subtree: a single `<Route path="/dashboard">` owns the shell, and
  // the guard's one dashboard check covers every module beneath it.
  DASHBOARD_STUDENTS: '/dashboard/students',
  DASHBOARD_PAYMENTS: '/dashboard/payments',
  DASHBOARD_PLANS: '/dashboard/installment-plans',
  DASHBOARD_SMS: '/dashboard/sms-reminders',
  DASHBOARD_REPORTS: '/dashboard/reports',
  DASHBOARD_ACTIVITY: '/dashboard/activity-log',
  DASHBOARD_USERS: '/dashboard/user-management',
  DASHBOARD_SETTINGS: '/dashboard/settings',
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

// ── Academic lifecycle enums ────────────────────────────────────────────────
//
// These mirror `REPEAT_REASON_ENUM`, `GRADUATION_TYPE_ENUM`, `HONORS_ENUM`,
// `TRANSFER_REASON_ENUM` and `INSTITUTION_TYPE_ENUM` in
// `Backend/src/validations/student.validation.js`. The *values* are the wire
// format — those Joi schemas reject anything else with a 422 — so the labels
// are ours to word but the values are not ours to choose. A list that drifts
// from the server does not fail loudly on the way in; it 422s on submit,
// after the user has already filled the form, so the two must be changed
// together.

export const REPEAT_REASONS = [
  { value: 'ACADEMIC', label: 'Academic remediation' },
  { value: 'ATTENDANCE', label: 'Attendance shortfall' },
  { value: 'MEDICAL', label: 'Medical' },
  { value: 'PARENTAL_REQUEST', label: 'Parental request' },
  { value: 'OTHER', label: 'Other' },
];

export const GRADUATION_TYPES = [
  { value: 'STANDARD', label: 'Standard' },
  { value: 'EARLY', label: 'Early graduation' },
  { value: 'HONORARY', label: 'Honorary' },
  { value: 'DEFERRED', label: 'Deferred' },
];

export const HONORS_LEVELS = [
  { value: 'NONE', label: 'No honors' },
  { value: 'HONORS', label: 'Honors' },
  { value: 'HIGH_HONORS', label: 'High Honors' },
  { value: 'HIGHEST_HONORS', label: 'Highest Honors' },
];

export const TRANSFER_REASONS = [
  { value: 'RELOCATION', label: 'Family relocation' },
  { value: 'ACADEMIC', label: 'Academic transfer' },
  { value: 'FINANCIAL', label: 'Financial' },
  { value: 'PERSONAL', label: 'Personal' },
  { value: 'EXPULSION', label: 'Expulsion' },
  { value: 'OTHER', label: 'Other' },
];

export const INSTITUTION_TYPES = [
  { value: 'PUBLIC_SCHOOL', label: 'Public school' },
  { value: 'PRIVATE_SCHOOL', label: 'Private school' },
  { value: 'INTERNATIONAL_SCHOOL', label: 'International school' },
  { value: 'HOMESCHOOL', label: 'Homeschool' },
  { value: 'VOCATIONAL', label: 'Vocational school' },
  { value: 'COLLEGE_UNIVERSITY', label: 'College / University' },
  { value: 'OTHER', label: 'Other' },
];


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

// ── Dashboard (management system) navigation ─────────────────────────────────

/**
 * The management system's navigation, as one definition.
 *
 * `DashboardSidebar` renders this and nothing else hardcodes a module link, so
 * the sidebar, the mobile drawer and the active-route logic cannot drift apart —
 * the same contract `NAV_LINKS` gives the marketing navbar.
 *
 * Grouped rather than a flat list of eight. A bursar's working day is a
 * sequence — find the student, check what they owe, take the money, remind the
 * stragglers — and the groups name those sequences. It also keeps the rail
 * scannable at eight items without a sub-menu, which is worth more here than
 * saving the four group labels: a school admin uses this dozens of times a day
 * and the section heading is a landmark, not decoration.
 *
 * `icon` is a lucide *name*, not a component, exactly as `ONBOARDING_STEPS` does
 * it. This module is imported by things that must stay free of JSX, so it
 * resolves the name in `DashboardSidebar`'s lookup map.
 *
 * `exact: true` on the overview is load-bearing, not cosmetic: `/dashboard` is a
 * prefix of every other module path, so a `startsWith` match would light up
 * "Dashboard" at the same time as the module being viewed.
 */
export const DASHBOARD_NAV = [
  {
    id: 'overview',
    label: null,
    items: [
      {
        to: ROUTES.DASHBOARD,
        label: 'Dashboard',
        icon: 'LayoutDashboard',
        exact: true,
        description: 'Collection position and what needs attention today.',
      },
    ],
  },
  {
    id: 'records',
    label: 'Records',
    items: [
      {
        to: ROUTES.DASHBOARD_STUDENTS,
        label: 'Students',
        icon: 'Users',
        description: 'Roster, imports, class transfers and parent contacts.',
      },
      {
        to: ROUTES.DASHBOARD_PAYMENTS,
        label: 'Payments',
        icon: 'CreditCard',
        description: 'Every MoMo payment, its receipt and its refunds.',
      },
      {
        to: ROUTES.DASHBOARD_PLANS,
        label: 'Installment Plans',
        icon: 'CalendarClock',
        description: 'Split a student bill into dated installments.',
      },
    ],
  },
  {
    id: 'outreach',
    label: 'Outreach',
    items: [
      {
        to: ROUTES.DASHBOARD_SMS,
        label: 'SMS Reminders',
        icon: 'MessageSquare',
        description: 'Nudge parents who have not paid, and track delivery.',
      },
    ],
  },
  {
    id: 'insight',
    label: 'Insight',
    items: [
      {
        to: ROUTES.DASHBOARD_REPORTS,
        label: 'Reports',
        icon: 'ChartColumn',
        description: 'Daily, term, outstanding and compliance reporting.',
      },
      {
        to: ROUTES.DASHBOARD_ACTIVITY,
        label: 'Activity Log',
        icon: 'ScrollText',
        description: 'Who changed what, and when.',
      },
    ],
  },
  {
    id: 'administration',
    label: 'Administration',
    items: [
      {
        to: ROUTES.DASHBOARD_USERS,
        label: 'User Management',
        icon: 'UserCog',
        // Same audience as Settings, and for a sharper reason. Inviting a
        // colleague mints a credential and names them to a third party, so it is
        // an administrative act with an audit trail — not something a teacher or
        // a bursar should be able to do for their colleagues. Hiding the module
        // keeps the rail honest about who administers what; the server's
        // `authorize('super_admin', 'school_admin')` remains the boundary, and
        // this must never be the thing that enforces it.
        roles: ['super_admin', 'school_admin'],
        description: 'Invite colleagues, manage roles and review who has access.',
      },
      {
        to: ROUTES.DASHBOARD_SETTINGS,
        label: 'Settings',
        icon: 'Settings',
        // A teacher's job is records; a bursar's is money. Both would find the
        // school's paystack settings and billing page in Settings irrelevant at
        // best and alarming at worst, so the module is hidden rather than shown
        // disabled — a rail full of dead entries trains people to ignore it.
        // This is presentation only: the server's `authorize` is the boundary,
        // and hiding an entry must never be the thing that enforces it.
        roles: ['super_admin', 'school_admin'],
        description: 'School profile, academic year, paystack and billing.',
      },
    ],
  },
];

/**
 * Whether `role` may see a nav module.
 *
 * A module with no `roles` is visible to everyone; otherwise the role must be
 * listed. Unknown/absent roles (the pre-`/auth/me` paint, where `user` is still
 * null) get the *full* rail rather than an empty one, and the sidebar hides
 * until the identity resolves — see `DashboardLayout`. Hiding nothing is the
 * safe failure direction: a nav that flickers as it loads is worse than one
 * that briefly shows an entry the guard would refuse anyway.
 */
export const canAccessNavItem = (role, item) => {
  if (!item?.roles) return true;
  if (!role) return true;
  return item.roles.includes(role);
};

/** Flattens `DASHBOARD_NAV` to a single list, honouring role visibility. */
export const visibleDashboardNav = (role) =>
  DASHBOARD_NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => canAccessNavItem(role, item)),
  })).filter((group) => group.items.length > 0);

/**
 * Whether `pathname` is inside `item`'s module.
 *
 * Segment-aware, deliberately. A bare `startsWith` makes `/dashboard/payments`
 * light up on `/dashboard/payments-archive` and — worse — `/dashboard` light up
 * on every module, because it is their common prefix. `exact: true` is what
 * rescues the overview; this is what rescues every other entry, and it is why
 * new modules need no matching logic of their own.
 */
export const isNavItemActive = (pathname, item) =>
  item.exact ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`);

/** The nav entry for the current route, or null for an unmatched path. */
export const activeDashboardItem = (pathname, role) => {
  const groups = visibleDashboardNav(role);
  for (const group of groups) {
    const match = group.items.find((item) => isNavItemActive(pathname, item));
    if (match) return match;
  }
  return null;
};

/**
 * Company contact details.
 *
 * `whatsappDisplay` and `whatsappHref` were `+233 24 000 0000` /
 * `https://wa.me/233240000000` — a number with all eleven digits zeroed, which is
 * the clearest possible statement that nobody was ever going to answer it. It was
 * rendered as "Talk to us on WhatsApp" on the contact page and in the footer, so
 * the site was inviting people to message a line that does not exist.
 *
 * They are empty now and every consumer hides the link rather than rendering a
 * blank or a broken `wa.me` link. **Set these to the real line before launch** —
 * an absent contact route is honest, an unassigned number is not.
 */
export const COMPANY_ADDRESS = {

  office: 'Prampram Technology Center',
  street: 'Opposite District Assembly, Greater Accra Region, Ghana',
  email: 'hello@sukuupay.com',
  whatsappDisplay: '',
  whatsappHref: '',
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

/**
 * The support line, empty until it is a real one.
 *
 * It was `+233 24 456 7890`, which reads as the example value it is — 024 123 4567
 * is this codebase's own canonical fake number. It was published in the site
 * footer as a `tel:` link and in the contact page's details, next to a promise to
 * help a bursar who cannot get into their account. Empty is honest; see
 * `COMPANY_ADDRESS` for the same reasoning on the WhatsApp line. Consumers hide
 * the link when this is blank.
 */
export const HELPDESK_PHONE = '';

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
