export const ROUTES = {
  HOME: '/',
  FEATURES: '/features',
  PRICING: '/pricing',
  HOW_IT_WORKS: '/how-it-works',
  FOR_SCHOOLS: '/for-schools',
  ADVERTISEMENTS: '/advertisements',
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
  DASHBOARD_SMS_PURCHASE: '/dashboard/sms-requests',
  DASHBOARD_REPORTS: '/dashboard/reports',
  DASHBOARD_MESSAGES: '/dashboard/messages',
  DASHBOARD_ACTIVITY: '/dashboard/activity-log',
  DASHBOARD_USERS: '/dashboard/user-management',
   DASHBOARD_SETTINGS: '/dashboard/settings',
   DASHBOARD_ACADEMICS: '/dashboard/academics',
   DASHBOARD_ACADEMICS_GRADES: '/dashboard/academics/grades',
   DASHBOARD_ACADEMICS_CLASSES: '/dashboard/academics/classes',
   DASHBOARD_ACADEMICS_TEACHER_ASSIGNMENT: '/dashboard/academics/teacher-assignment',
   DASHBOARD_ACADEMICS_TEACHER_ATTENDANCE: '/dashboard/academics/teacher-attendance',
   DASHBOARD_ACADEMICS_REPORTS: '/dashboard/academics/reports',
   DASHBOARD_ADVERTISEMENTS: '/dashboard/advertisements',
  ONBOARDING: '/onboarding',
  // The one onboarding screen for roles that join a school instead of creating
  // one: a school-code field and a waiting room. The server names it as
  // `nextRoute` for `accountant`, `teacher` and `viewer` (see `SCHOOL_JOIN_ROLES`
  // in `Backend/src/config/constants.js`); the wizard's five steps are not
  // reachable for those roles at all.
  ONBOARDING_JOIN_SCHOOL: '/onboarding/join-school',

  // The platform console. A sibling of DASHBOARD, not a child of it, and the
  // path matches the API's base path (`/api/admin`) exactly — so the service
  // layer below maps one-to-one onto `Backend/src/routes/admin.routes.js` with no
  // prefix translation, and a route in one is findable in the other by name.
  //
  // Separate rather than nested for a structural reason: `DashboardLayout` binds
  // to school data (`useDashboardOverview(user?.schoolId)`, the school-scoped SMS
  // pill, the school card in the rail), and a `super_admin` has `schoolId: null`
  // by design. Nested under /dashboard it would mount a school console around a
  // platform admin and read "Your school" forever.
  ADMIN: '/admin',
  ADMIN_SCHOOLS: '/admin/schools',
  ADMIN_USERS: '/admin/users',
  ADMIN_CONTENT: '/admin/content',
  // A **sibling page of Content, not a nav entry.** It is reached from that page's
  // "New creative" action rather than from the rail, for the reason
  // `announcements/new` works the same way: the rail answers "which module am I
  // in?" and authoring is not a module. `isNavItemActive` is prefix-aware, so
  // `/admin/content/new` still lights Content as the current module.
  ADMIN_CONTENT_NEW: '/admin/content/new',
  ADMIN_SETTINGS: '/admin/settings',
  ADMIN_PAYMENTS: '/admin/payments',
  ADMIN_FINANCE: '/admin/finance',
  ADMIN_SMS: '/admin/sms',
  ADMIN_ANNOUNCEMENTS: '/admin/announcements',
  ADMIN_AUDIT_LOGS: '/admin/audit-logs',
  ADMIN_ANALYTICS: '/admin/analytics',
  ADMIN_HEALTH: '/admin/health',
  ADMIN_REPORTS: '/admin/reports',
   ADMIN_IMPERSONATION: '/admin/impersonation',
};

/**
 * The three terms the report-card pipeline is keyed by, shared between the
 * overview's term picker and the approval/grade scopes. Mirrors the server's
 * `ACADEMIC_TERMS` so a term sent in the query is one the backend accepts.
 */
export const ACADEMIC_TERMS = ['Term 1', 'Term 2', 'Term 3'];

/**
 * Every platform-console path in one object.
 *
 * `ROUTES` above is flat and is what components actually import. This is the same
 * thing grouped by subject, for the two places that want the whole console
 * enumerated at once rather than a single path: the impersonation banner's "leave
 * and go back to where you were" behaviour, and the tests that assert every nav
 * entry resolves to a real route.
 *
 * The two must not drift. `ADMIN_ROUTES` is the single source for the grouped form
 * and every value here is written out longhand rather than derived, because a
 * derived map cannot be checked against the router — and a nav entry pointing at a
 * route that was never registered is a dead link that renders perfectly.
 */
export const ADMIN_ROUTES = {
  OVERVIEW: ROUTES.ADMIN,
  SCHOOLS: ROUTES.ADMIN_SCHOOLS,
  USERS: ROUTES.ADMIN_USERS,
  PAYMENTS: ROUTES.ADMIN_PAYMENTS,
  FINANCE: ROUTES.ADMIN_FINANCE,
  SMS: ROUTES.ADMIN_SMS,
  ANNOUNCEMENTS: ROUTES.ADMIN_ANNOUNCEMENTS,
  AUDIT_LOGS: ROUTES.ADMIN_AUDIT_LOGS,
  ANALYTICS: ROUTES.ADMIN_ANALYTICS,
  HEALTH: ROUTES.ADMIN_HEALTH,
  SETTINGS: ROUTES.ADMIN_SETTINGS,
  REPORTS: ROUTES.ADMIN_REPORTS,

  // Nested paths, split out rather than concatenated at each call site so a
  // `/admin/finance/disbursements/:id` route is written once.
  SCHOOL_DETAIL: `${ROUTES.ADMIN_SCHOOLS}/:schoolId`,
  USER_DETAIL: `${ROUTES.ADMIN_USERS}/:userId`,
  PAYMENT_DETAIL: `${ROUTES.ADMIN_PAYMENTS}/:paymentId`,
  LEDGER: `${ROUTES.ADMIN_FINANCE}/ledger`,
  DISBURSEMENTS: `${ROUTES.ADMIN_FINANCE}/disbursements`,
  DISBURSEMENT_DETAIL: `${ROUTES.ADMIN_FINANCE}/disbursements/:batchId`,
  RECONCILIATION: `${ROUTES.ADMIN_FINANCE}/reconciliation`,
  INVOICES: `${ROUTES.ADMIN_FINANCE}/invoices`,
  SMS_CREDITS: `${ROUTES.ADMIN_SMS}/credits`,
  SMS_LOGS: `${ROUTES.ADMIN_SMS}/logs`,
  // The pool and the approval queue live under SMS rather than beside it, because they
  // are two views of one decision — an operator comparing "units promised" against
  // "units left" is doing a single calculation, and splitting them across sibling
  // top-level routes makes that read as two pages.
  SMS_REQUESTS: `${ROUTES.ADMIN_SMS}/requests`,
  REVENUE_ANALYTICS: `${ROUTES.ADMIN_ANALYTICS}/revenue`,
  SCHOOLS_ANALYTICS: `${ROUTES.ADMIN_ANALYTICS}/schools`,
  COLLECTION_RATE_ANALYTICS: `${ROUTES.ADMIN_ANALYTICS}/collection-rate`,
  IMPERSONATION_SESSION: `${ROUTES.ADMIN_IMPERSONATION}/:sessionId`,
};

/**
 * The parent pay portal.
 *
 * **Separate from `ROUTES` on purpose.** Every route in `ROUTES` is inside the
 * authenticated shell or is a marketing page with no user in it. The pay portal is
 * neither: it is reached from an SMS, with no session, and its whole surface is one
 * token. Keeping its paths here — rather than inline `/pay/${token}` at each call
 * site — means the token's position in a path is written once, so a link shared
 * into a family group always resolves to the same student's page.
 *
 * `TOKEN` is a path segment, not a query string. A pay link is typed by hand, read
 * aloud over a phone, and copied out of a message bubble; the shorter and more
 * visible a URL is, the more often it arrives intact.
 *
 * `INVALID` is a real route rather than a component rendered on a 404, because
 * "this link has expired" is a *known, common* state for a parent — links are
 * reissued each term — and it needs somewhere to say what to do next. A generic
 * not-found page leaves them with no action.
 */
export const PARENT_ROUTES = {
  TOKEN: '/pay/:token',
  /** Factory, for the `to` prop of a `Link`. The token is always encoded. */
  portal: (token) => `/pay/${encodeURIComponent(token ?? '')}`,
  history: (token) => `/pay/${encodeURIComponent(token ?? '')}/history`,
  plan: (token) => `/pay/${encodeURIComponent(token ?? '')}/plan`,
  support: (token) => `/pay/${encodeURIComponent(token ?? '')}/support`,
  INVALID: '/pay/invalid',

  // ── The portal's full surface ──
  //
  // The portal began as one page with a task and grew into the whole parent
  // experience, and every new surface stays under the same token: the token is
  // still the only credential, and a link shared into a family group resolves
  // to the same child's pages no matter which one is opened.
  fees: (token) => `/pay/${encodeURIComponent(token ?? '')}/fees`,
  attendance: (token) => `/pay/${encodeURIComponent(token ?? '')}/attendance`,
  records: (token) => `/pay/${encodeURIComponent(token ?? '')}/records`,
  timetable: (token) => `/pay/${encodeURIComponent(token ?? '')}/timetable`,
  messages: (token) => `/pay/${encodeURIComponent(token ?? '')}/messages`,
  messageThread: (token, threadId) =>
    `/pay/${encodeURIComponent(token ?? '')}/messages/${encodeURIComponent(threadId ?? '')}`,
  notifications: (token) => `/pay/${encodeURIComponent(token ?? '')}/notifications`,
  profile: (token) => `/pay/${encodeURIComponent(token ?? '')}/profile`,
};

/**
 * The teacher portal.
 *
 * A third shell beside the parent portal and the two consoles, and unlike all
 * three of them it is keyed by **class name, not id** — `JHS 2A` rather than an
 * ObjectId. That is a product decision with a routing consequence: a class name
 * is written by hand, contains spaces, and can contain a slash (a stream is
 * routinely "JHS 2/A"), so every factory below encodes it. Without that, React
 * Router reads `JHS 2/A` as two path segments, the detail page loses its own
 * subject, and the roster query asks for a class that does not exist.
 *
 * The teacher arrives here from a `teacher` session in `AuthContext`; the
 * subtree itself is gated in `App.jsx`, because a guard is a routing rule and
 * not a property of a component.
 *
 * The detail factories (`classDetail`, `attendanceFor`, `gradesFor`,
 * `recordsFor`) exist so a class name's position in a path is written once —
 * the same contract `PARENT_ROUTES` uses for its token, for the same reason: a
 * link built by hand in one place and by a factory in another is two paths that
 * will eventually disagree.
 */
export const TEACHER_ROUTES = {
  dashboard: '/teacher',
  classes: '/teacher/classes',
  classDetail: (className) => `/teacher/classes/${encodeURIComponent(className ?? '')}`,
  attendance: '/teacher/attendance',
  attendanceFor: (className) => `/teacher/attendance/${encodeURIComponent(className ?? '')}`,
  grades: '/teacher/grades',
  gradesFor: (className) => `/teacher/grades/${encodeURIComponent(className ?? '')}`,
  records: '/teacher/records',
  recordsFor: (className) => `/teacher/records/${encodeURIComponent(className ?? '')}`,
  schedule: '/teacher/schedule',
  timetables: '/teacher/timetables',
  notifications: '/teacher/notifications',
  profile: '/teacher/profile',
};

/**
 * Headmaster console routes, with a `classesDetail` factory for the same reason
 * `TEACHER_ROUTES.classDetail` exists: a class name is a URL segment and must be
 * `encodeURIComponent`-ed at every call site, or a slash in the name splits the
 * route. This front-encodes the one place that varies so the pages cannot drift.
 */
export const ACADEMICS_ROUTES = {
  overview: '/dashboard/academics',
  grades: '/dashboard/academics/grades',
  classes: '/dashboard/academics/classes',
  classesDetail: (className) => `/dashboard/academics/classes/${encodeURIComponent(className ?? '')}`,
  // Which students each teacher looks after — a different question from which
  // classes they teach, and one no class list can answer. See
  // `Backend/src/models/TeacherAssignment.js`.
  teacherAssignment: '/dashboard/academics/teacher-assignment',
  teacherAttendance: '/dashboard/academics/teacher-attendance',
  timetables: '/dashboard/academics/timetables',
  reports: '/dashboard/academics/reports',
};

export const ACCOUNTANT_ROUTES = {
  dashboard: '/dashboard',
  payments: '/dashboard/payments',
  plans: '/dashboard/installment-plans',
  reports: '/dashboard/reports',
  settings: '/dashboard/settings',
  sms: '/dashboard/sms-reminders',
  smsPurchase: '/dashboard/sms-requests',
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
  { label: 'Advertisements', to: ROUTES.ADVERTISEMENTS },
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
        roles: ['super_admin', 'school_admin', 'teacher'],
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
      {
        to: ROUTES.DASHBOARD_SMS_PURCHASE,
        label: 'Buy SMS Credit',
        icon: 'Coins',
        // A bursar and an accountant only — the same roles the server admits
        // (`smsRequest.routes.js` → `authorize('school_admin', 'accountant')`).
        // Spending the school's money is not a teacher's decision, and this entry sits
        // next to a read-only one, so a visible purchase button would be the first sign
        // that role separation here is decorative.
        roles: ['super_admin', 'school_admin', 'accountant'],
        description: 'Pay for messages, with an administrator releasing the credit.',
      },
      {
        to: ROUTES.DASHBOARD_MESSAGES,
        label: 'Parent Messages',
        icon: 'Inbox',
        // `school_admin` and `accountant` — the same two roles
        // `findSchoolRecipients` in `pay.service.js` alerts about a parent message.
        //
        // **`teacher` is deliberately excluded.** This module carries every parent
        // phone number in the school in full, alongside what they wrote about a
        // balance. `findSchoolRecipients` already draws that line and states why:
        // "a teacher has no business acting on a balance dispute". Reading the
        // dispute is the same act as acting on it. Letting the rail expose this to
        // every teacher would hand the entire staff room the contact list, which is
        // the one thing the masked copy in `Notification` exists to prevent — and it
        // would make that masking pointless, since the inbox sits one click away.
        roles: ['super_admin', 'school_admin', 'accountant'],
        description: 'What parents wrote or recorded from their fee link.',
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
        roles: ['super_admin', 'school_admin'],
        description: 'Who changed what, and when.',
      },
    ],
  },
  {
    /**
     * The headmaster's academic console.
     *
     * A `school_admin`-only group, deliberately not shown to `teacher` or
     * `accountant`: every endpoint behind it is `requireSchoolAdmin` on the
     * server (`adminAcademicRoute`), and a teacher reaching these screens would
     * only hit the 403s the design already hides. The teacher-facing surfaces —
     * entering marks, compiling reports and editing timetables — stay in the
     * teacher portal, where the `requireTeacher` gates match the rail.
     *
     * `className` is a name, addressed as a URL-encoded segment, exactly like
     * the teacher portal's `TEACHER_ROUTES` factories.
     */
    id: 'academics',
    label: 'Academics',
    items: [
      {
        to: ROUTES.DASHBOARD_ACADEMICS,
        label: 'Overview',
        icon: 'GraduationCap',
        exact: true,
        roles: ['school_admin'],
        description: 'Class averages, grade approval state and top pupils.',
      },
      {
        to: ROUTES.DASHBOARD_ACADEMICS_GRADES,
        label: 'Grade Approval',
        icon: 'ClipboardCheck',
        roles: ['school_admin'],
        description: 'Review submitted marks and approve or reject them.',
      },
      {
        to: ROUTES.DASHBOARD_ACADEMICS_CLASSES,
        label: 'Classes',
        icon: 'School',
        roles: ['school_admin'],
        description: 'Class list and class-teacher / subject-teacher assignments.',
      },
      {
        to: ROUTES.DASHBOARD_ACADEMICS_TEACHER_ASSIGNMENT,
        label: 'Teacher Assignment',
        icon: 'UserCheck',
        roles: ['school_admin'],
        description: 'See which students each teacher looks after, and assign new ones.',
      },
      {
        to: ACADEMICS_ROUTES.timetables,
        label: 'Timetables',
        icon: 'Calendar',
        roles: ['school_admin'],
        description: 'Build and publish class timetables for teachers and parents.',
      },
      // {
      //   to: ROUTES.DASHBOARD_ACADEMICS_TEACHER_ATTENDANCE,
      //   label: 'Teacher Attendance',
      //   icon: 'Clock',
      //   roles: ['school_admin'],
      //   description: 'Monitor teacher presence during scheduled periods.',
      // },
      {
        to: ROUTES.DASHBOARD_ACADEMICS_REPORTS,
        label: 'Report Cards',
        icon: 'FileText',
        roles: ['school_admin'],
        description: 'Write the head remark, and publish or unpublish reports.',
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
        // school's payment settings and billing page in Settings irrelevant at
        // best and alarming at worst, so the module is hidden rather than shown
        // disabled — a rail full of dead entries trains people to ignore it.
        // This is presentation only: the server's `authorize` is the boundary,
        // and hiding an entry must never be the thing that enforces it.
        roles: ['super_admin', 'school_admin', 'accountant'],
      },
      {
        to: ROUTES.DASHBOARD_ADVERTISEMENTS,
        label: 'Advertisements',
        icon: 'Megaphone',
        // `school_admin` and `accountant`, matching
        // `requireAdvertiser` in `schoolAd.routes.js`.
        //
        // **`super_admin` was here and is deliberately gone.** It contradicted the
        // comment above it: this page is the school asking the *platform* for
        // something, and every route behind it refuses a platform admin —
        // `requireAdvertiser` excludes the role, `listSchoolAdRequests` throws
        // `SCHOOL_ACCESS_DENIED` without a `schoolId` to resolve, and a `super_admin`
        // has `schoolId: null` by design. So the entry could only ever have led to a
        // 403, from a shell `RoleLanding` redirects away from anyway.
        //
        // Where a platform admin authors instead: `ROUTES.ADMIN_CONTENT_NEW`, behind
        // `AdminGuard` and `POST /admin/school-ads`. That is the console's own
        // endpoint — it takes an optional `schoolId` and sets `authoredByPlatform` —
        // so an ad the platform writes needs no pretending to be a school's request.
        //
        // Deliberately **not** in the Outreach group. That group is read-and-act on the
        // school's own parents, and an ad request is the school asking the *platform*
        // for something — a different direction of travel, and it does not belong in
        // the same rail section as SMS reminders.
        roles: ['school_admin', 'accountant'],
        description: 'Ask to be advertised, and track the decision.',
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

/**
 * Applies role visibility to a nav tree.
 *
 * Generic over the tree so the dashboard rail and the platform console rail
 * cannot grow different hiding rules — they are the same rule applied to two
 * lists, and a second implementation is how one of them ends up hiding entries
 * the other shows.
 */
export const visibleNav = (nav, role) =>
  nav
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => canAccessNavItem(role, item)),
    }))
    .filter((group) => group.items.length > 0);

/** Flattens `DASHBOARD_NAV` to a single list, honouring role visibility. */
export const visibleDashboardNav = (role) => visibleNav(DASHBOARD_NAV, role);

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

/**
 * The nav entry for the current route in `nav`, or null for an unmatched path.
 *
 * The active match is also what a shell's header describes itself with, so the
 * search runs over the *visible* entries rather than the raw tree: naming the
 * module a user cannot open would contradict the rail directly beneath it.
 */
export const activeNavItem = (nav, pathname, role) => {
  const groups = visibleNav(nav, role);
  for (const group of groups) {
    const match = group.items.find((item) => isNavItemActive(pathname, item));
    if (match) return match;
  }
  return null;
};

/** The nav entry for the current route, or null for an unmatched path. */
export const activeDashboardItem = (pathname, role) =>
  activeNavItem(DASHBOARD_NAV, pathname, role);

// ── Platform console navigation ─────────────────────────────────────────────

/**
 * The platform console's navigation, as one definition.
 *
 * Same contract as `DASHBOARD_NAV` — grouped, lucide names rather than
 * components, `description` for the tooltip — so `AdminSidebar` is a straight
 * adaptation of `DashboardSidebar` rather than a second idea about what a rail
 * is. It carries no `roles` keys because the entire tree sits behind
 * `AdminGuard`, which admits `super_admin` and nothing else. Role filtering is
 * still applied on the way out (via `visibleNav`), so the day a second role is
 * granted the console the rail already does the right thing; the guard is what
 * has to be widened deliberately, not the config.
 */
export const ADMIN_NAV = [
  {
    id: 'overview',
    label: null,
    items: [
      {
        to: ROUTES.ADMIN,
        label: 'Platform',
        icon: 'Gauge',
        exact: true,
        description: 'Schools, revenue and the platform SMS balance.',
      },
    ],
  },
  {
    id: 'tenants',
    label: 'Tenants',
    items: [
      {
        to: ROUTES.ADMIN_SCHOOLS,
        label: 'Schools',
        icon: 'Building2',
        description: 'Every school on the platform, and its lifecycle.',
      },
      {
        to: ROUTES.ADMIN_USERS,
        label: 'Users',
        icon: 'Users',
        description: 'Every account on the platform, across every school.',
      },
    ],
  },
  {
    id: 'platform',
    label: 'Platform',
    items: [
      {
        to: ROUTES.ADMIN_ANALYTICS,
        label: 'Analytics',
        icon: 'TrendingUp',
        description: 'Revenue, schools and collection rate across the platform.',
      },
      {
        to: ROUTES.ADMIN_REPORTS,
        label: 'Reports',
        icon: 'FileBarChart',
        description: 'Platform, school-performance, growth and churn reports.',
      },
      {
        to: ROUTES.ADMIN_SMS,
        label: 'SMS',
        icon: 'MessageSquare',
        description: 'Platform SMS credits, delivery history and broadcasts.',
      },
      {
        to: ROUTES.ADMIN_ANNOUNCEMENTS,
        label: 'Announcements',
        icon: 'Megaphone',
        description: 'Notices shown to every school, or to selected schools.',
      },
    ],
  },
  {
    id: 'money',
    label: 'Money',
    items: [
      {
        to: ROUTES.ADMIN_PAYMENTS,
        label: 'Payments',
        icon: 'Receipt',
        description: 'Every payment taken on the platform, and refunds.',
      },
      {
        to: ROUTES.ADMIN_FINANCE,
        label: 'Finance',
        icon: 'Wallet',
        description: 'Platform revenue, the ledger, and school disbursements.',
      },
    ],
  },
  {
    id: 'oversight',
    label: 'Oversight',
    items: [
      {
        to: ROUTES.ADMIN_AUDIT_LOGS,
        label: 'Audit log',
        icon: 'ScrollText',
        description: 'Who changed what, across every school and every admin.',
      },
      {
        /*
          Not a generic oversight module like the two above it. Impersonation is the
          only way the platform owner can see a tenant's records as that tenant sees
          them, so "has anyone been inside a school, and what did they look at" is
          a question a school admin is entitled to ask about their own data and
          deserves a dedicated screen with the reason and the action count on it.

          Listed beside the audit log rather than inside it because the audit log
          filters by action and would need `admin.impersonate_start` plumbed through
          three filters to show the same rows with less context.
        */
        to: ROUTES.ADMIN_IMPERSONATION,
        label: 'Impersonation',
        icon: 'Eye',
        description: 'Every session opened on a school, and what was looked at.',
      },
      {
        to: ROUTES.ADMIN_HEALTH,
        label: 'Health',
        icon: 'Activity',
        description: 'Databases, gateways, SMS provider and scheduled jobs.',
      },
    ],
  },
  {
    id: 'configuration',
    label: 'Configuration',
    items: [
      {
        to: ROUTES.ADMIN_CONTENT,
        label: 'Content',
        icon: 'Images',
        description: 'Review the creatives shown on the public pages.',
      },
      {
        to: ROUTES.ADMIN_SETTINGS,
        label: 'Settings',
        icon: 'Settings',
        description: 'Platform defaults, commission, disbursement and support.',
      },
    ],
  },
];

/** `ADMIN_NAV`, honouring role visibility. */
export const visibleAdminNav = (role) => visibleNav(ADMIN_NAV, role);

/** The platform-console nav entry for the current route. */
export const activeAdminItem = (pathname, role) => activeNavItem(ADMIN_NAV, pathname, role);

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
// ── Subjects ─────────────────────────────────────────────────────────────

/**
 * Pre-populated subjects from the Ghanaian basic-school curriculum, shared
 * between the timetable grid and any surface that needs a subject list.
 *
 * `OTHER` is a real option rather than a free-text box: picking it reveals a
 * text field so the teacher can name a subject this list never anticipated.
 * `value: OTHER_SUBJECT` is a sentinel, never stored. The manual text is
 * persisted to `customSubjects` (localStorage) and surfaced in every subject
 * select, so a subject added once is available to every timetable after it.
 */
export const OTHER_SUBJECT = 'OTHER';

export const SUBJECTS = [
  { value: 'Mathematics', label: 'Mathematics' },
  { value: 'English Language', label: 'English Language' },
  { value: 'Integrated Science', label: 'Integrated Science' },
  { value: 'Social Studies', label: 'Social Studies' },
  { value: 'ICT', label: 'ICT (Computing)' },
  { value: 'French', label: 'French' },
  { value: 'Career Technology', label: 'Career Technology' },
  { value: 'R.M.E.', label: 'R.M.E.' },
  { value: 'Ghanaian Language', label: 'Ghanaian Language' },
  { value: 'Creative Arts', label: 'Creative Arts' },
  { value: 'Physical Education', label: 'Physical Education' },
  { value: OTHER_SUBJECT, label: 'Other…' },
];

/** localStorage key holding the school's custom subject names. */
export const CUSTOM_SUBJECTS_KEY = 'sukuupay_custom_subjects';

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

// ── ID Card constants ─────────────────────────────────────────────────────────

export const ID_CARD_AUDIENCES = [
  { value: 'student', label: 'Students' },
  { value: 'staff', label: 'Staff' },
  { value: 'prefect', label: 'Prefects' },
  { value: 'visitor', label: 'Visitors' },
  { value: 'custom', label: 'Custom' },
];

export const SHEET_LAYOUTS = [
  {
    value: '6up_a4_landscape',
    label: '6 per sheet (3×2)',
    caption: 'Recommended — standard card size',
    cols: 3,
    rows: 2,
  },
  {
    value: '9up_a4_landscape',
    label: '9 per sheet (3×3)',
    caption: 'Compact — for large batches',
    cols: 3,
    rows: 3,
  },
];

export const PRINT_SIDES = [
  { value: 'front_back', label: 'Front + Back', description: 'Fronts on odd pages, backs on even' },
  { value: 'front', label: 'Front Only', description: 'Single-sided printing' },
];

export const TEMPLATE_FIELDS = [
  { key: 'showPhoto', label: 'Student photo', icon: 'User' },
  { key: 'showQr', label: 'QR code', icon: 'QrCode' },
  { key: 'showStamp', label: 'School stamp', icon: 'Stamp' },
  { key: 'showEmergency', label: 'Emergency contact', icon: 'Phone' },
  { key: 'showGuardian', label: 'Guardian info', icon: 'Users' },
  { key: 'showClass', label: 'Class / stream', icon: 'School' },
  { key: 'showStudentId', label: 'Student ID', icon: 'CreditCard' },
];

/**
 * How each role is written when the app names one to a person.
 *
 * Promoted out of `DashboardTopbar` because two shells now have to say the same
 * words: the school console's account menu and the platform console's, plus the
 * 403 page explaining which role was required. A per-shell copy is how the
 * product ends up calling the same person "Platform admin" in one header and
 * "Super admin" in another.
 */
export const ROLE_LABELS = {
  super_admin: 'Platform admin',
  school_admin: 'School administrator',
  accountant: 'School bursar',
  teacher: 'Teacher',
  viewer: 'Viewer',
};

/** `ROLE_LABELS[role]`, with a truthful fallback for an unknown or absent role. */
export const roleLabel = (role) => ROLE_LABELS[role] || 'Signed in';

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

/**
 * The complement of `canCreateSchool`: roles that join a school by code rather
 * than provisioning one.
 *
 * These roles never walk the setup wizard — there is nothing in it for them to
 * configure, and every step would end in a 403 on a school they do not own. They
 * are asked for one thing (the school code), parked as `pending`, and released
 * into the dashboard by the school's admin. The server is the authority: it
 * reports `flow: 'join'` and `nextRoute` on `/auth/me`, and this helper only
 * mirrors the rule so components can label themselves without a round trip.
 *
 * A role that is absent from `SIGNUP_ROLES` (`super_admin`, `parent`) answers
 * false, which is the safe answer: unknown roles stay on the wizard's side of
 * the fence rather than being quietly let into a join screen.
 */
export const joinsSchoolByCode = (role) => SIGNUP_ROLES.some((r) => r.value === role && !r.canCreateSchool);

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
 * The wizard steps. `id` doubles as the route segment, so the stepper and
 * the router can never drift apart.
 *
 * The count is deliberately not written down here or in `Stepper`, which reads
 * this array for both its rail and its "Step X of N" label. Both used to say
 * "four" in a comment while the array said four too — and adding a step left
 * every comment quietly lying. Derive the number from `length`, which is what
 * those call sites already do.
 */
export const ONBOARDING_STEPS = [
  { id: 'school-profile', label: 'School Profile', icon: 'Building2' },
  { id: 'payment-setup', label: 'Payment Setup', icon: 'CreditCard' },
  { id: 'import-students', label: 'Import Students', icon: 'Users' },
  // Between the roster and the first reminder, not after it. The roster is what
  // a plan is sized against — "how many students" is the question every tier is
  // quoted by — so pricing reads as a consequence of the step the admin has just
  // finished rather than an interruption before they have started.
  { id: 'pricing', label: 'Pricing', icon: 'Receipt' },
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
  { key: 'name', label: 'Student Name', required: true },
  { key: 'class', label: 'Class', required: true },
  { key: 'gender', label: 'Gender', required: false },
  { key: 'dob', label: 'Date of Birth', required: false },
  { key: 'parentName', label: 'Parent Name', required: true },
  { key: 'parentPhone', label: 'Parent Phone', required: true },
  { key: 'parentEmail', label: 'Parent Email', required: false },
  { key: 'parentRelationship', label: 'Parent Relationship', required: false },
  { key: 'totalOwed', label: 'Total Owed', required: true },
  { key: 'deadline', label: 'Deadline', required: false },
];

/** Longest a single SMS segment can be before the gateway splits it. */
export const SMS_SEGMENT_LENGTH = 160;

/**
 * The published plans, in one place.
 *
 * These were defined inside `Pricing.jsx`, which meant the marketing page and
 * the onboarding wizard's pricing step would each have needed their own copy of
 * the same prices. Two copies of a price list is not a style problem: it is a
 * number that will eventually be changed in one and quoted in the other, and the
 * school that notices is the one that trusted the cheaper figure.
 *
 * So the data lives here, beside `NAV_LINKS` and `ONBOARDING_STEPS`, and both
 * pages import it.
 *
 * ### `name` does not correspond to `subscription.plan` on the server
 *
 * `schoolModel.js` enumerates `["trial", "basic", "standard", "premium",
 * "enterprise"]`. These three marketing tiers do not map onto it one-to-one —
 * there are five server values for three published plans, and no field records
 * which published tier a given `subscription.plan` came from.
 *
 * That is why nothing here writes a plan anywhere. The onboarding step shows the
 * tiers and links out; choosing one would need a server-side mapping and a
 * self-service endpoint, and neither exists (`PUT /admin/schools/:id/subscription`
 * is behind `super_admin`). Resolve the mapping before anything sends a tier name
 * to the API.
 */
export const PRICING_PLANS = [
  {
    name: 'Starter',
    /** Upper bound on students this tier is sized for; see `planForRoster`. */
    maxStudents: 300,
    capacity: 'Up to 300 students',
    blurb: 'Ideal for small private basic schools, kindergartens, and nurseries.',
    termly: 150,
    monthly: 165,
    termNote: 'Billed GHS 450 per term (1 term = 3 months)',
    features: [
      'Bulk student upload (CSV/Excel)',
      'All MoMo networks (MTN, Telecel, AT)',
      'Automated SMS fee reminders',
      'Instant downloadable PDF receipts',
      'Basic bursar collections dashboard',
      'Email and WhatsApp support',
    ],
    cta: { label: 'Get Started', to: ROUTES.SIGNUP },
  },
  {
    name: 'Growth',
    maxStudents: 1000,
    capacity: '301–1,000 students',
    blurb: 'Established Basic, JHS, and growing preparatory academies.',
    termly: 250,
    monthly: 275,
    termNote: 'Billed GHS 750 per term (save 10% vs monthly)',
    highlight: true,
    highlightNote: {
      label: 'Direct Bank Sweep',
      value: 'Daily T+0',
    },
    features: [
      'Structured installment plans (2–6 tranches)',
      'Installment compliance & arrears dashboard',
      'Cash flow forecasting & velocity analytics',
      'Automated GhIPSS daily bank sweeps to GCB/Ecobank',
      'Priority Bursar WhatsApp support',
    ],
    cta: { label: 'Get Started with Growth', to: ROUTES.SIGNUP },
  },
  {
    name: 'Campus',
    maxStudents: Number.POSITIVE_INFINITY,
    capacity: '1,000+ students',
    blurb: 'Large schools, multi-campus groups, and Senior High Schools.',
    termly: 400,
    monthly: 440,
    termNote: 'Billed GHS 1,200 per term (dedicated infrastructure)',
    features: [
      'Multi-campus & multi-signatory financial controls',
      'Custom audit reports & MoE compliance exports',
      'Dedicated school success account manager',
      'SIS & School ERP API integration',
      'Custom SMS Sender ID branding (e.g. ACHIMOTA-SCH)',
    ],
    cta: { label: 'Contact Campus Sales', to: ROUTES.CONTACT },
  },
];

/**
 * The plan a roster of `count` students is sized for.
 *
 * `maxStudents` rather than parsing the `capacity` string, which is display copy
 * ("301–1,000 students") and contains an en dash, a comma and a trailing noun.
 * Matching on that is the kind of thing that works until someone rewords the
 * label, and then quietly recommends the wrong plan to a school.
 *
 * The tiers are contiguous and ascending, so a single `find` is the whole
 * implementation. `null` only when `count` is not a usable number — callers must
 * handle "roster size unknown" rather than defaulting to the cheapest tier, which
 * would tell a 1,000-student school it had bought Starter.
 *
 * @param {number} count  students on the roster
 * @returns {typeof PRICING_PLANS[number] | null}
 */
export const planForRoster = (count) => {
  /*
   * `null`/`undefined`/`''` are rejected before the numeric coercion, because
   * `Number(null)` is `0` and `Number('')` is `0` too. A `Number.isFinite` guard
   * alone therefore treats "we do not know the roster size" as "this school has
   * no students" and returns the cheapest tier — which is how a 1,000-student
   * school on an unread roster gets told it fits Starter.
   */
  if (count === null || count === undefined || count === '') return null;

  const size = Number(count);
  if (!Number.isFinite(size) || size < 0) return null;
  return PRICING_PLANS.find((plan) => size <= plan.maxStudents) || PRICING_PLANS[PRICING_PLANS.length - 1];
};
