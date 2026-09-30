/**
 * The mock database: plain objects in module scope.
 *
 * Deliberately not reactive and not persisted. State lives for the lifetime of
 * the tab and is rebuilt by `resetDb()`, which is what makes "start from a
 * known state" a one-click operation rather than a cleanup script. A tester
 * should never have to think about leftover state from the previous scenario.
 */

import {
  buildStudents,
  CLASS_SETS,
  ghanaPhone,
  intBetween,
  makeRng,
  objectId,
  pick,
  schoolName,
  slugify,
  SURNAMES,
  token,
  MALE_NAMES,
  FEMALE_NAMES,
  CITY_BY_REGION,
  SCHOOL_MOTTOS,
} from './fixtures';

/** Personas are the axes a tester actually wants to vary. */
export const PERSONAS = [
  {
    id: 'new-admin',
    label: 'New admin — empty school',
    description:
      'Brand-new sign-up. The school exists with placeholder details, so Step 1 has something to overwrite and the full four-step flow runs from the top.',
    build: () => buildWorld({ studentCount: 0, completedProfile: false }),
  },
  {
    id: 'established',
    label: 'Big school — 500 students',
    description:
      'A school that has been running for two terms. Use this to jump straight to Steps 3 and 4, to see a real SMS preview, and to test a large roster.',
    build: () => buildWorld({ studentCount: 500, completedProfile: true, seed: 42 }),
  },
  {
    id: 'already-onboarded',
    label: 'Already onboarded',
    description:
      'onboardingCompleted = true. Verifies the guard sends /onboarding to /dashboard and that the wizard is unreachable.',
    build: () => buildWorld({ studentCount: 120, completedProfile: true, onboardingCompleted: true, seed: 99 }),
  },
  {
    id: 'no-school',
    label: 'Account with no school',
    description:
      'A user whose account was never linked to a school — exactly the state every self-service signup used to end up in. Step 1 must now render in CREATE mode (prefilled from schoolIntent) and POST /schools/me, not show a support message.',
    build: () =>
      buildWorld({
        studentCount: 0,
        completedProfile: false,
        unlinked: true,
        // Stands in for the school details the bursar typed at `/signup`, which
        // the real `signupSchema` used to strip before the controller saw it.
        schoolIntent: {
          name: 'Prampram Basic & JHS',
          classification: 'senior_high',
          region: 'Greater Accra',
        },
      }),
  },
  {
    id: 'unverified',
    label: 'Unverified email',
    description: 'Login returns EMAIL_NOT_VERIFIED, which drives the "Verify now" branch on the login screen.',
    build: () => buildWorld({ studentCount: 0, completedProfile: false, verified: false }),
  },
  {
    id: 'suspended',
    label: 'Suspended school',
    description: 'A school with status "suspended". Verifies error copy on save rather than a silent no-op.',
    build: () => buildWorld({ studentCount: 30, completedProfile: true, status: 'suspended', seed: 77 }),
  },
  {
    id: 'super-admin',
    label: 'Super admin',
    description: 'Platform staff. Not a school admin, so it should not be pushed through the school wizard.',
    build: () => buildWorld({ studentCount: 0, completedProfile: false, role: 'super_admin' }),
  },
];

const ACADEMIC_YEAR = `${new Date().getFullYear() - 1}/${new Date().getFullYear()}`;

/** Password for every mock account. Dev-only, fixed on purpose. */
export const MOCK_PASSWORD = 'MockPass123!';

let db = null;
let activePersonaId = 'new-admin';
let activeScenarioId = 'healthy';

export const getDb = () => db;
export const getPersonaId = () => activePersonaId;
export const getScenarioId = () => activeScenarioId;

/**
 * A rolling request log for the control panel.
 *
 * Deliberately capped: the panel re-renders on every entry, and a runaway loop
 * of failing requests should not turn into an unbounded array that makes the
 * page slower with each one.
 */
const REQUEST_LOG_LIMIT = 60;
let requestLog = [];
const logListeners = new Set();

export const getRequestLog = () => requestLog;

export const onRequestLog = (listener) => {
  logListeners.add(listener);
  return () => logListeners.delete(listener);
};

export const logRequest = (entry) => {
  requestLog = [{ id: `${Date.now()}-${Math.random()}`, ...entry }, ...requestLog].slice(0, REQUEST_LOG_LIMIT);
  logListeners.forEach((listener) => listener(requestLog));
};

export const setPersona = (id) => {
  const persona = PERSONAS.find((p) => p.id === id);
  if (!persona) return;
  activePersonaId = id;
  db = persona.build();
  requestLog = [];
  logListeners.forEach((listener) => listener(requestLog));
  try {
    localStorage.setItem('sukuupay_mock_persona', id);
  } catch {
    // Private mode: the persona simply will not survive a reload.
  }
};

export const setScenario = (id) => {
  activeScenarioId = id;
  try {
    localStorage.setItem('sukuupay_mock_scenario', id);
  } catch {
    // As above.
  }
};

export const resetDb = (personaId = activePersonaId) => {
  setPersona(personaId);
};

function buildWorld({
  studentCount,
  completedProfile,
  onboardingCompleted = false,
  unlinked = false,
  verified = true,
  status = 'active',
  role = 'school_admin',
  seed = 1337,
  schoolIntent = null,
}) {
  const rng = makeRng(seed);
  const schoolId = objectId(seed);
  const name = schoolName(rng);
  const region = 'Greater Accra';
  const classes = [...CLASS_SETS.jhs, ...CLASS_SETS.basic];

  const school = {
    _id: schoolId,
    name,
    slug: slugify(name),
    schoolCode: `SCH-MOCK-${String(seed).slice(0, 4)}`,
    type: 'private',
    // Left blank for a new school so the admin genuinely has to fill Step 1.
    // For an established school the fields are pre-populated, which is what
    // Step 1's server-prefill path needs in order to be observable.
    motto: completedProfile ? pick(rng, SCHOOL_MOTTOS) : '',
    yearFounded: completedProfile ? intBetween(rng, 1960, 2015) : null,
    phone: completedProfile ? ghanaPhone(rng) : '',
    email: completedProfile ? 'office@example.net' : '',
    website: completedProfile ? 'https://example.net' : '',
    address: completedProfile ? '12 Independence Avenue, Cantonments' : '',
    city: completedProfile ? 'Accra' : '',
    region: completedProfile ? region : '',
    gpsAddress: completedProfile ? 'GA-183-8164' : '',
    // Independence Avenue, Cantonments. Present only once the profile is complete
    // so the map picker has a pin to restore, and the mock exercises the
    // "edit mode hydrates a stored coordinate" path rather than always starting
    // empty.
    location: completedProfile
      ? { latitude: 5.5601, longitude: -0.2053, source: 'map_pin', updatedAt: new Date().toISOString() }
      : { latitude: null, longitude: null, source: null, updatedAt: null },

    logo: null,
    stamp: null,
    brandColor: '#0F5132',
    payment: {
      gatewayMode: 'hubtel',
      platformMarkupPercent: 1.5,
      // `settlement` is NOT a real School field — see handlers.js. The mock
      // stores it so the onboarding flow has somewhere to put it while the
      // real API has nowhere.
      settlement: null,
    },
    sms: { provider: 'arke', senderId: 'SukuuPay', balance: 4200 },
    subscription: { plan: 'trial', status: 'trial' },
    academic: {
      currentTerm: 'Term 2',
      currentYear: ACADEMIC_YEAR,
      termsPerYear: 3,
      classes,
      gradingSystem: 'WAEC',
    },
    notifications: { email: true, sms: true, inApp: true, whatsapp: true },
    status,
    stats: {
      totalStudents: studentCount,
      totalTeachers: 0,
      totalParents: 0,
      totalPaymentsThisMonth: 0,
    },
    createdAt: new Date().toISOString(),
  };

  const user = {
    _id: objectId(seed + 1),
    name: role === 'super_admin' ? 'Mock Platform Admin' : 'Cynthia Osei-Tutu',
    email: personaEmail(activePersonaId, role),
    phone: ghanaPhone(rng),
    position: role === 'super_admin' ? 'Platform Operations' : 'Head of Bursary',
    role,
    schoolId: unlinked ? null : schoolId,
    isPlatformOwner: role === 'super_admin',
    status: 'active',
    isEmailVerified: verified,
    // Real field on the real model, mocked so the guard can be exercised
    // without the backend having one. With `onboardingCompleted` true *and* no
    // schoolId this is the flag/school mismatch the guard now refuses to wave
    // into the dashboard.
    onboardingCompleted,
    onboardingHighestStep: onboardingCompleted ? 3 : completedProfile ? 2 : 0,
    // Only meaningful for an unlinked account, which is the one that renders
    // Step 1 in CREATE mode.
    schoolIntent: schoolIntent
      ? { name: '', classification: '', region: '', ...schoolIntent }
      : { name: '', classification: '', region: '' },
    lastLoginAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  return {
    schools: [school],
    users: [user],
    students: studentCount
      ? buildStudents(schoolId, studentCount, { seed: seed + 3, classes, academicYear: ACADEMIC_YEAR })
      : [],
    payments: [],
    verificationTokens: new Map(),
    sentSms: [],
    sessions: new Map(),
    // Populated by `POST /schools/join`. Kept on the world rather than in a
    // module-level Map so `setPersona` resets it with everything else.
    joinRequests: [],
  };
}

function personaEmail(personaId, role) {
  if (role === 'super_admin') return 'admin@example.com';
  switch (personaId) {
    case 'new-admin':
      return 'bursar@example.org';
    case 'established':
      return 'head.bursary@example.org';
    case 'already-onboarded':
      return 'bursar.done@example.org';
    case 'no-school':
      return 'unlinked@example.org';
    case 'unverified':
      return 'unverified@example.org';
    case 'suspended':
      return 'bursar.suspended@example.org';
    default:
      return 'bursar@example.org';
  }
}

/** Issues a session token and returns the bearer value the client will store. */
export const issueToken = (userId) => {
  const accessToken = `mock.${token(makeRng(Date.now() % 100000), 24)}`;
  const refreshToken = `mock.refresh.${token(makeRng((Date.now() % 99991) + 3), 24)}`;
  db.sessions.set(accessToken, { userId, refreshToken, issuedAt: Date.now() });
  return { accessToken, refreshToken };
};

export const userForToken = (accessToken) => {
  if (!accessToken) return null;
  const session = db.sessions.get(accessToken);
  if (!session) return null;
  return db.users.find((u) => u._id === session.userId) || null;
};

export const refreshSession = (refreshToken) => {
  for (const [accessToken, session] of db.sessions.entries()) {
    if (session.refreshToken === refreshToken) {
      db.sessions.delete(accessToken);
      return issueToken(session.userId);
    }
  }
  return null;
};

export const revokeToken = (accessToken) => {
  db.sessions.delete(accessToken);
};

/** School lookup scoped to the caller's own school, mirroring `resolveSchoolId`. */
export const resolveSchoolId = (user, requested) => {
  if (user?.role === 'super_admin' && requested) return requested;
  return user?.schoolId || null;
};

export const findSchool = (id) => db.schools.find((s) => s._id === id) || null;

export const studentsFor = (schoolId) => db.students.filter((s) => s.schoolId === schoolId);

/** Seeds the module with the default persona on import. */
setPersona('new-admin');

export { ACADEMIC_YEAR, CITY_BY_REGION, SCHOOL_MOTTOS, SURNAMES, MALE_NAMES, FEMALE_NAMES };
