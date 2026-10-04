/**
 * Mock route handlers.
 *
 * Each handler mirrors the corresponding Express route in Backend/src ó same
 * path, same status codes, same error codes, and the same validation rules.
 * That fidelity is the point: if the wizard's client-side validation lets
 * something through, the mock rejects it for the same reason the real API
 * would, so the bug surfaces here instead of during integration.
 *
 * A handler returns a plain value (sent as `{ data: <value> }`) or throws
 * `new MockError(status, message, code)`.
 */

import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import {
  findSchool,
  getDb,
  issueToken,
  MOCK_PASSWORD,
  refreshSession,
  resolveSchoolId,
  revokeToken,
  studentsFor,
  userForToken,
} from './db';
import { getScenario } from './scenarios';
import { buildStudents, CITY_BY_REGION, ghanaPhone, makeRng, objectId, slugify, token } from './fixtures';
import { getScenarioId } from './db';

// The schedule maths, imported rather than reimplemented. This is the *fourth*
// place the split-and-step logic could live (the server's `planHelpers`, the
// client's projection mirror, the fixture generator, and here) and the mock is
// the one place a copy does the most damage: a mock that dates tranches by its own
// rules makes the create screen's projection check pass against a schedule no
// server would ever build. One import keeps the mock honest by construction.
import { addInterval as mockAddInterval } from '../services/paymentPlans';

export class MockError extends Error {
  /**
   * @param {number} status  HTTP status, matching the real route.
   * @param {string} message The user-facing message the real controller returns.
   * @param {string} [code]  The API's machine-readable code.
   * @param {object} [details] Field-keyed messages, as the API returns for a
   *   Joi validation failure. `details.errors` is what the client surfaces.
   */
  constructor(status, message, code, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
    if (details?.errors) this.errors = details.errors;
  }
}

const GHANA_PHONE = /^(0[2-5]\d{8}|233[2-5]\d{8})$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const CURRENT_YEAR = new Date().getFullYear();
/** The School model's `region` enum, which Step 1's select is built from. */
const GHANA_REGIONS = Object.keys(CITY_BY_REGION).sort();
const STUDENT_CLASSES = ['JHS 1', 'JHS 2', 'JHS 3', 'Basic 1', 'Basic 2', 'Basic 3', 'SHS 1', 'SHS 2', 'SHS 3'];

/** The School model's `type` enum. */
const SCHOOL_TYPES = ['public', 'private', 'international', 'mission', 'charter'];

/**
 * Signup classification ? `School.type`, mirroring
 * Backend/src/utils/schoolTypeMapping.js. The mock has to reproduce this or the
 * "Senior High School" path would pass here and 422 against the real API.
 */
const CLASSIFICATION_TO_TYPE = {
  private: 'private',
  international: 'international',
  senior_high: 'public',
  university: 'private',
};

const toSchoolType = (value) => {
  if (typeof value !== 'string' || !value) return null;
  const key = value.trim().toLowerCase();
  if (SCHOOL_TYPES.includes(key)) return key;
  return CLASSIFICATION_TO_TYPE[key] ?? null;
};

/**
 * Mirrors `onboardingBlock` in Backend/src/controllers/authController.js.
 *
 * The client used to infer link state from `schoolId === null`, which is exactly
 * why an unlinked account could only be shown an error. Producing the same block
 * here is what lets the whole CREATE-mode path be demonstrated offline.
 */
const onboardingBlock = (user) => {
  if (!user) {
    return {
      linked: false,
      reason: 'ANONYMOUS',
      schoolId: null,
      completed: false,
      highestStep: 0,
      nextRoute: null,
    };
  }

  if (user.role === 'super_admin') {
    return {
      linked: true,
      reason: 'PLATFORM_STAFF',
      schoolId: null,
      completed: user.onboardingCompleted === true,
      highestStep: user.onboardingHighestStep ?? 0,
      nextRoute: user.onboardingCompleted ? '/dashboard' : '/onboarding/school-profile',
    };
  }

  const school = user.schoolId ? findSchool(user.schoolId) : null;
  // `findSchool` ignores `deletedAt`, so an archived school still resolves here.
  // The real controller checks `deletedAt: null`; the mock world only marks
  // schools 'suspended', so this stays simple without faking the branch.
  const linked = Boolean(school && school.status !== 'archived');

  const completed = linked && user.onboardingCompleted === true;

  return {
    linked,
    reason: linked ? 'LINKED' : user.schoolId ? 'DANGLING' : 'UNLINKED',
    schoolId: linked ? user.schoolId : null,
    completed,
    highestStep: user.onboardingHighestStep ?? 0,
    nextRoute: linked
      ? completed
        ? '/dashboard'
        : '/onboarding/school-profile'
      : '/onboarding/school-profile',
  };
};

const publicUser = (user) => {
  if (!user) return null;
  const { password, ...rest } = user;
  return rest;
};

/**
 * Roles a signup form may claim. Mirrors `SELF_SIGNUP_ROLES` in
 * Backend/src/validators/authValidators.js ó `super_admin` is a platform
 * operator and must never be self-granted.
 */
const SELF_SIGNUP_ROLES = ['school_admin', 'accountant', 'teacher', 'viewer'];


// -- Auth -------------------------------------------------------------------

const login = ({ body }) => {
  const email = String(body?.email || '').trim().toLowerCase();
  const password = String(body?.password || '');
  if (!EMAIL.test(email)) throw new MockError(422, 'Enter a valid email address', 'VALIDATION_ERROR');
  if (!password) throw new MockError(422, 'Password is required', 'VALIDATION_ERROR');

  const user = getDb().users.find((u) => u.email === email);
  // One message for both "no such user" and "wrong password", so the login
  // form cannot be used to enumerate which schools have accounts.
  if (!user || password !== MOCK_PASSWORD) {
    throw new MockError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
  }
  if (!user.isEmailVerified) {
    throw new MockError(403, 'Your email address is not verified yet', 'EMAIL_NOT_VERIFIED');
  }
  if (user.status !== 'active') {
    throw new MockError(403, 'This account has been deactivated. Contact support.', 'ACCOUNT_SUSPENDED');
  }

  return {
    user: publicUser(user),
    tokens: issueToken(user._id),
    onboarding: onboardingBlock(user),
    message: 'Signed in',
  };
};


const signup = ({ body }) => {
  // `features.selfSignupEnabled`, checked **before** the duplicate-email probe below
  // ó the same ordering the real handler uses, and for the same reason: with
  // registration closed, a probe that runs first is an oracle answering "does this
  // email have an account here?" to anyone who can fill in a form.
  const settings = currentPlatformSettings();
  if (settings.features.selfSignupEnabled === false) {
    throw new MockError(
      503,
      'Registration is closed at the moment. A school administrator can invite you by email.',
      'SELF_SIGNUP_DISABLED'
    );
  }

  const name = String(body?.name || '').trim();
  const email = String(body?.email || '').trim().toLowerCase();
  const phone = String(body?.phone || '').trim();
  const password = String(body?.password || '');

  if (name.length < 2) throw new MockError(422, '"name" length must be at least 2 characters long', 'VALIDATION_ERROR');
  if (!EMAIL.test(email)) throw new MockError(422, '"email" must be a valid email', 'VALIDATION_ERROR');
  if (phone.length < 7) throw new MockError(422, '"phone" length must be at least 7 characters long', 'VALIDATION_ERROR');
  if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    throw new MockError(422, 'Password must contain at least one letter and one number', 'VALIDATION_ERROR');
  }
  if (getDb().users.some((u) => u.email === email)) {
    throw new MockError(409, 'An account with that email already exists', 'EMAIL_TAKEN');
  }

  const db = getDb();
  const user = {
    _id: objectId(Date.now() % 999983),
    name,
    email,
    phone,
// Resolved from the "Other" text upstream, so whatever arrives is a concrete
    // title and never the sentinel.
    position: String(body?.position ?? '').trim(),
    // Mirrors `SELF_SIGNUP_ROLES` in the backend validator: `super_admin` is not
    // claimable by a signup form, and an unrecognised value falls back to
    // `school_admin` rather than erroring ó the same failure the real controller
    // produces, on a field the user can fix.
    role: SELF_SIGNUP_ROLES.includes(String(body?.role ?? ''))
      ? String(body.role)
      : 'school_admin',
    schoolId: null,
    isPlatformOwner: false,
    status: 'active',
    isEmailVerified: false,
    onboardingCompleted: false,
    onboardingHighestStep: 0,
    // What the bursar typed about their school. The real `signupSchema` had no
    // `school` key, so `stripUnknown` deleted this before the controller saw it
    // and Step 1 had nothing to prefill from; it is now kept and Step 1 renders
    // in CREATE mode pre-populated with it.
    schoolIntent: {
      name: String(body?.school?.name || '').trim(),
      classification: String(body?.school?.classification || '').trim(),
      region: String(body?.school?.region || '').trim(),
    },
    createdAt: new Date().toISOString(),
  };
  db.users.push(user);

  const code = String(Math.floor(Math.random() * 900000) + 100000);
  db.verificationTokens.set(code, user._id);

  // Reproduces the real `authController.signup` path where `user.save()` has
  // already committed but the provider send failed. The account exists; only
  // the email is missing. Without this, the partial-success branch in
  // `services/auth.js` ó the one that keeps a user off a dead-end signup form ó
  // cannot be exercised at all.
  if (getScenarioId() === 'email-send-fails') {
    const err = new MockError(
      502,
      'Account created but the verification email could not be sent. Please resend it.',
      'EMAIL_SEND_FAILED'
    );
    err.extra = { emailSent: false };
    throw err;
  }

  return {
    user: publicUser(user),
    // Surfaced so a tester can complete verification without reading the
    // console. The real API emails this; the mock cannot.
    verification: { code, email, expiresInMinutes: 15 },
    message: 'Account created. Check your email to verify it.',
  };
};

const verifyEmail = ({ params }) => {
  const db = getDb();
  const userId = db.verificationTokens.get(params.token);
  if (!userId) throw new MockError(400, 'This verification code is invalid or has expired', 'INVALID_TOKEN');
  const user = db.users.find((u) => u._id === userId);
  // Single-use: consuming the code is what marks the address verified.
  db.verificationTokens.delete(params.token);
  user.isEmailVerified = true;
  return { user: publicUser(user), tokens: issueToken(user._id), message: 'Email verified' };
};

/**
 * `POST /auth/resend-verification`
 *
 * The response is deliberately identical for a registered unverified address,
 * an already-verified address, and an address that does not exist ó which is
 * what `authController.resendVerification` does. An earlier version of this
 * mock answered 404 USER_NOT_FOUND for unknown addresses, which turned the
 * endpoint into a user-enumeration oracle: a caller could tell a registered
 * address from an unregistered one. Matching the real controller matters here
 * because the neutrality is a security property, not a cosmetic one.
 */
const resendVerification = ({ body }) => {
  const user = getDb().users.find((u) => u.email === String(body?.email || '').toLowerCase());
  const neutral = {
    message: 'If the account exists and is unverified, a new code has been sent.',
  };

  if (!user || user.isEmailVerified) return neutral;

  const code = String(Math.floor(Math.random() * 900000) + 100000);
  getDb().verificationTokens.set(code, user._id);
  return { ...neutral, verification: { code } };
};

const forgotPassword = ({ body }) => {
  const user = getDb().users.find((u) => u.email === String(body?.email || '').toLowerCase());
  if (!user) throw new MockError(404, 'No account found for that email', 'USER_NOT_FOUND');
  const code = token(makeRng(Date.now() % 99991), 10);
  getDb().verificationTokens.set(`reset:${code}`, user._id);
  return { message: 'Password reset instructions sent', resetToken: code };
};

const resetPassword = ({ params, body }) => {
  const db = getDb();
  const key = `reset:${params.token}`;
  const userId = db.verificationTokens.get(key);
  if (!userId) throw new MockError(400, 'This reset link is invalid or has expired', 'INVALID_TOKEN');
  const password = String(body?.password || '');
  if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    throw new MockError(422, 'Password must contain at least one letter and one number', 'VALIDATION_ERROR');
  }
  db.verificationTokens.delete(key);
  // Changing a password revokes every session, matching the real controller.
  [...db.sessions.entries()].forEach(([accessToken, session]) => {
    if (session.userId === userId) db.sessions.delete(accessToken);
  });
  return { message: 'Password updated. Sign in with your new password.' };
};

const me = ({ token: accessToken }) => {
  const user = userForToken(accessToken);
  if (!user) throw new MockError(401, 'Not authenticated', 'UNAUTHENTICATED');
  // The real controller wraps the user: `GET /auth/me` responds
  // `{ user, onboarding }`, and both `services/user.js` and `services/auth.js`
  // read them. `onboarding` is the server's resolved link state ó without it the
  // client has to infer "is this account linked" from a nullable `schoolId`,
  // which is how the dead end got there in the first place.
  return { user: publicUser(user), onboarding: onboardingBlock(user) };
};


// -- Schools ----------------------------------------------------------------

/**
 * `POST /schools/me` ó self-service provisioning. Mirrors
 * `provisionSchoolForUser` in Backend/src/services/school.service.js.
 *
 * This is the handler that makes the CREATE-mode branch of Step 1 real. Without
 * it the mock would reject the one call the whole feature depends on, and the
 * "no school linked" persona would have nothing but the old dead end to show.
 *
 * Idempotent by construction: a replayed submit finds `user.schoolId` already
 * set and returns `200` with the existing school instead of creating a second
 * one ó the same behaviour the real service has, and the reason a double-clicked
 * Continue is harmless.
 */
const provisionMySchool = ({ body, user }) => {
  if (!user) throw new MockError(401, 'Not authenticated', 'UNAUTHENTICATED');
if (user.role === 'super_admin') {
    throw new MockError(403, 'Platform staff accounts are not linked to a school', 'FORBIDDEN');
  }

  // Only a school administrator registers a school. Mirrors
  // `provisionSchoolForUser`: `POST /upload/school-logo` is separately guarded by
  // `authorize('super_admin', 'school_admin')`, so an accountant who created a
  // school would be refused their own logo afterwards.
  if (user.role !== 'school_admin') {
    throw new MockError(
      403,
      'Only a school administrator can create a school. Enter your school code to join one instead.',
      'ROLE_CANNOT_CREATE_SCHOOL'
    );
  }


  if (user.schoolId) {
    const existing = findSchool(user.schoolId);
    if (existing) {
      return { school: existing, user: publicUser(user) };
    }
    // Dangling reference: fall through and let them provision again.
  }

  const data = body || {};
  const errors = {};

  const name = String(data.name ?? '').trim();
  if (name.length < 2) errors.name = '"name" length must be at least 2 characters long';

  const type = toSchoolType(data.type);
  if (!type) errors.type = '"type" must be one of [public, private, international, mission, charter]';

  const phoneDigits = String(data.phone ?? '').replace(/\D/g, '');
  let phone = null;
  if (/^233\d{9}$/.test(phoneDigits)) phone = phoneDigits;
  else if (/^0\d{9}$/.test(phoneDigits)) phone = `233${phoneDigits.slice(1)}`;
  else if (/^\d{9}$/.test(phoneDigits)) phone = `233${phoneDigits}`;
  if (!phone) errors.phone = 'Invalid Ghana phone number format. Use format: 024xxxxxxx or 23324xxxxxxx';

  const email = String(data.email ?? '').trim().toLowerCase();
  if (!EMAIL.test(email)) errors.email = '"email" must be a valid email';

  const address = String(data.address ?? '').trim();
  if (address.length < 5) errors.address = '"address" length must be at least 5 characters long';

  const city = String(data.city ?? '').trim();
  if (city.length < 2) errors.city = '"city" length must be at least 2 characters long';

  const region = String(data.region ?? '').trim();
  if (!GHANA_REGIONS.includes(region)) {
    errors.region = `"region" must be one of [${GHANA_REGIONS.join(', ')}]`;
  }

  if (data.yearFounded !== undefined && data.yearFounded !== null && data.yearFounded !== '') {
    const year = Number(data.yearFounded);
    if (!Number.isInteger(year) || year < 1800 || year > CURRENT_YEAR) {
      errors.yearFounded = `"yearFounded" must be less than or equal to ${CURRENT_YEAR}`;
    }
  }
  if (data.motto !== undefined && String(data.motto).length > 200) {
    errors.motto = '"motto" length must be less than or equal to 200 characters long';
  }
  if (data.gpsAddress !== undefined && String(data.gpsAddress).trim()) {
    const match = String(data.gpsAddress).trim().match(/^([A-Za-z]{2})[-\s]*(\d{3})[-\s]*(\d{4})$/);
    if (!match) {
      errors.gpsAddress =
        'Enter a valid Ghana Post GPS address, e.g. GA-183-8164 (2 letters, then 3 digits, then 4 digits)';
    } else {
      data.gpsAddress = `${match[1].toUpperCase()}-${match[2]}-${match[3]}`;
    }
  }
  // Same half-pair guard as the update path: a single coordinate would place the
  // pin in the Gulf of Guinea, which is worse than no pin.
  if (data['location.latitude'] !== undefined || data['location.longitude'] !== undefined) {
    const lat = data['location.latitude'];
    const lng = data['location.longitude'];
    if (typeof lat !== 'number' || typeof lng !== 'number' || !isFinite(lat) || !isFinite(lng)) {
      errors.location = 'Give both coordinates, or neither.';
    } else if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      errors.location = 'Those coordinates are outside Ghana.';
    }
  }

  if (Object.keys(errors).length) {
    const [field, message] = Object.entries(errors)[0];
    throw new MockError(422, message, 'VALIDATION_ERROR', errors, field);
  }

  // Checked after validation so a malformed request reports its own field error
  // rather than the duplicate-email message.
  if (findSchoolByEmail(email)) {
    throw new MockError(
      409,
      'A school with this email is already registered. Enter your school code to join it instead.',
      'SCHOOL_ALREADY_REGISTERED'
    );
  }

  const db = getDb();
  const school = {
    _id: objectId(Date.now() % 999979),
    name,
    slug: `${slugify(name)}-${Math.floor(Date.now() % 97)}`,
    // Six characters, matching `generateSchoolCode` (3 initials + 3 digits).
    schoolCode: makeSchoolCode(name, db.schools),
    type,
    motto: String(data.motto ?? '').trim(),
    yearFounded: data.yearFounded ? Number(data.yearFounded) : null,
    phone,
    email,
    website: String(data.website ?? '').trim(),
    address,
    city,
    region,
    gpsAddress: data.gpsAddress || '',
    // Coordinates land here as the nested object the School model defines; the
    // dotted transport keys are reassembled, matching `provisionSchoolForUser`.
    location: {
      latitude: typeof data['location.latitude'] === 'number' ? data['location.latitude'] : null,
      longitude: typeof data['location.longitude'] === 'number' ? data['location.longitude'] : null,
      source: ['gps_address', 'map_pin', 'device', 'manual'].includes(data['location.source'])
        ? data['location.source']
        : typeof data['location.latitude'] === 'number'
          ? 'manual'
          : null,
      updatedAt:
        typeof data['location.latitude'] === 'number' ? new Date().toISOString() : null,
    },
    logo: data.logo || null,
    stamp: null,
    brandColor: '#0F5132',
    payment: { gatewayMode: 'hubtel', platformMarkupPercent: 1.5, settlement: null },
    sms: { provider: 'arke', senderId: 'SukuuPay', balance: 0 },
    // The real service grants the trial here, so a self-provisioned school is
    // indistinguishable from an operator-created one.
    subscription: { plan: 'trial', status: 'trial' },
    academic: {
      currentTerm: '',
      currentYear: `${new Date().getFullYear() - 1}/${new Date().getFullYear()}`,
      termsPerYear: 3,
      classes: [],
      gradingSystem: 'WAEC',
    },
    notifications: { email: true, sms: true, inApp: true, whatsapp: true },
    status: 'active',
    stats: { totalStudents: 0, totalTeachers: 0, totalParents: 0, totalPaymentsThisMonth: 0 },
    createdBy: user._id,
    createdAt: new Date().toISOString(),
  };
  db.schools.push(school);

  user.schoolId = school._id;
  db.joinRequests = db.joinRequests || [];

  return { school, user: publicUser(user) };
};

/** Same shape as `generateSchoolCode`: three initials, then the lowest free counter. */
function makeSchoolCode(name, schools) {
  const words = String(name).trim().split(/\s+/).filter(Boolean);
  let initials;
  if (words.length === 1) initials = words[0].substring(0, 3);
  else if (words.length === 2) initials = words[0].substring(0, 2) + words[1].substring(0, 1);
  else initials = words.slice(0, 3).map((w) => w.substring(0, 1)).join('');

  initials = initials.replace(/[^A-Z]/gi, '').toUpperCase().substring(0, 3);
  if (initials.length < 3) initials = initials.padEnd(3, 'X');

  let counter = 1;
  while (schools.some((s) => s.schoolCode === `${initials}${String(counter).padStart(3, '0')}`)) {
    counter += 1;
    if (counter > 999) {
      initials = `${initials.substring(0, 2)}${String.fromCharCode(65 + (counter % 26))}`;
      counter = 1;
    }
  }
  return `${initials}${String(counter).padStart(3, '0')}`;
}

const findSchoolByEmail = (email) =>
  getDb().schools.find((s) => String(s.email || '').toLowerCase() === email);

/**
 * `POST /schools/join` ó request to join a school that already exists.
 *
 * The code identifies the school; it does not authenticate the applicant, so the
 * mock mirrors the real service and parks the request as `pending` rather than
 * linking anybody. Handing out access on the code alone would be the one thing
 * this flow must not do ó codes are initials plus a three-digit counter.
 */
const joinSchool = ({ body, user }) => {
  if (!user) throw new MockError(401, 'Not authenticated', 'UNAUTHENTICATED');
  if (user.schoolId) {
    throw new MockError(409, 'Your account is already linked to a school', 'ALREADY_LINKED');
  }

  const code = String(body?.schoolCode ?? '').trim().toUpperCase();
  const school = getDb().schools.find((s) => s.schoolCode === code);
  if (!school) throw new MockError(404, 'That school code is not recognised', 'INVALID_SCHOOL_CODE');
  if (school.status !== 'active') {
    throw new MockError(409, 'That school is not accepting new staff right now', 'SCHOOL_NOT_ACCEPTING');
  }

  const db = getDb();
  db.joinRequests = db.joinRequests || [];
  const existing = db.joinRequests.find(
    (r) => r.userId === user._id && r.schoolId === school._id && r.status === 'pending'
  );
  if (existing) {
    return { requestId: existing._id, status: 'pending', schoolName: school.name };
  }

  const request = {
    _id: objectId(Date.now() % 999961),
    userId: user._id,
    schoolId: school._id,
    applicantName: String(body?.applicantName || user.name || ''),
    applicantPosition: String(body?.applicantPosition || user.position || ''),
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  db.joinRequests.push(request);

  return { requestId: request._id, status: 'pending', schoolName: school.name };
};

const getSchool = ({ params, user }) => {
  const user2 = user || null;
  const school = findSchool(params.schoolId);
  if (!school) throw new MockError(404, 'School not found', 'SCHOOL_NOT_FOUND');
  if (user2?.role !== 'super_admin' && user2?.schoolId !== school._id) {
    throw new MockError(403, 'You do not have access to this school', 'FORBIDDEN');
  }
  return school;
};

/**
 * `PUT /schools/:id` ó mirrors `updateSchoolSchema`.
 *
 * Joi runs with `stripUnknown: true`, so anything not in the schema is dropped
 * silently rather than rejected. The mock reproduces that: passing a payment
 * object here is a no-op, exactly as it would be against the real API. This is
 * the single most important behaviour in the whole mock.
 */
const updateSchool = ({ params, body, user }) => {
  const school = getSchool({ params, user });
  if (school.status === 'archived') {
    throw new MockError(409, 'This school is archived and can no longer be updated', 'SCHOOL_ARCHIVED');
  }

  const data = body || {};
  const errors = [];
  const pick1 = (field, label) => {
    const list = data.errors?.[field];
    return Array.isArray(list) && list[0] ? list[0] : label;
  };

  if (data.name !== undefined) {
    if (typeof data.name !== 'string' || data.name.trim().length < 2) errors.name = '"name" length must be at least 2 characters long';
  }
  if (data.type !== undefined && !['public', 'private', 'international', 'mission', 'charter'].includes(data.type)) {
    errors.type = '"type" must be one of [public, private, international, mission, charter]';
  }
  if (data.yearFounded !== undefined) {
    if (!Number.isInteger(data.yearFounded) || data.yearFounded < 1800 || data.yearFounded > CURRENT_YEAR) {
      errors.yearFounded = `"yearFounded" must be less than or equal to ${CURRENT_YEAR}`;
    }
  }
  if (data.motto !== undefined && String(data.motto).length > 200) {
    errors.motto = '"motto" length must be less than or equal to 200 characters long';
  }
  if (data.phone !== undefined) {
    if (!GHANA_PHONE.test(String(data.phone))) {
      errors.phone = 'Invalid Ghana phone number format. Use format: 024xxxxxxx or 23324xxxxxxx';
    }
  }
  if (data.email !== undefined && !EMAIL.test(String(data.email))) {
    errors.email = '"email" must be a valid email';
  }
  if (data.region !== undefined && !GHANA_REGIONS.includes(String(data.region))) {
    // `region` is an enum on the School model. Step 1 offers a select, so an
    // arbitrary value here means something bypassed the control ó the server
    // must still refuse it, exactly as Mongoose would.
    errors.region = `"region" must be one of [${GHANA_REGIONS.join(', ')}]`;
  }
  if (data.website !== undefined && data.website !== '') {
    try {
      // eslint-disable-next-line no-new
      new URL(data.website);
    } catch {
      errors.website = '"website" must be a valid uri';
    }
  }
  if (data.address !== undefined && String(data.address).trim().length < 5) {
    errors.address = '"address" length must be at least 5 characters long';
  }
  if (data.city !== undefined && String(data.city).trim().length < 2) {
    errors.city = '"city" length must be at least 2 characters long';
  }
  if (data.gpsAddress !== undefined && String(data.gpsAddress).trim()) {
    // Mirrors `gpsAddressValidator`: the undashed spelling is accepted on input
    // and normalised on write, so nothing downstream sees two formats.
    const raw = String(data.gpsAddress).trim();
    const match = raw.match(/^([A-Za-z]{2})[-\s]*(\d{3})[-\s]*(\d{4})$/);
    if (!match) {
      errors.gpsAddress =
        'Enter a valid Ghana Post GPS address, e.g. GA-183-8164 (2 letters, then 3 digits, then 4 digits)';
    } else {
      data.gpsAddress = `${match[1].toUpperCase()}-${match[2]}-${match[3]}`;
    }
  }

  // Coordinates arrive as flattened dotted keys, exactly as `updateSchoolSchema`
  // and `provisionMySchoolSchema` accept them. `School` has no literal
  // `"location.latitude"` property, so writing the key straight onto the school
  // object would create one ó the reassembly below mirrors `updateSchool`.
  const LOCATION_SOURCES = ['gps_address', 'map_pin', 'device', 'manual'];
  if (data['location.latitude'] !== undefined || data['location.longitude'] !== undefined) {
    const lat = data['location.latitude'];
    const lng = data['location.longitude'];
    if (typeof lat !== 'number' || typeof lng !== 'number' || !isFinite(lat) || !isFinite(lng)) {
      errors.location = 'Give both coordinates, or neither.';
    } else if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      errors.location = 'Those coordinates are outside Ghana.';
    } else if (
      data['location.source'] !== undefined &&
      !LOCATION_SOURCES.includes(data['location.source'])
    ) {
      // Rejected, not coerced. The backend's Joi schema 422s on an unknown
      // source, and silently rewriting it to 'manual' here would hide a real
      // divergence behind a passing mock run.
      errors.location = `"location.source" must be one of [${LOCATION_SOURCES.join(', ')}]`;
    } else {
      data.__location = {
        latitude: lat,
        longitude: lng,
        source: data['location.source'] ?? 'manual',
      };
    }
  }

  // Never persisted verbatim ó the dotted keys are transport, not fields.
  delete data['location.latitude'];
  delete data['location.longitude'];
  delete data['location.source'];

  // `academic.classes` is the one nested write a school admin actually needs:
  // a self-provisioned school gets no classes, and without them the roster's
  // class filter, the Add Student dropdown, the import validator and the
  // graduation guard are all empty. `updateSchoolSchema` accepts the flattened
  // dotted key, so the real API persists it ó dropping it here would make a
  // mock-mode class save silently no-op, which is the one failure mode this
  // mock exists to prevent.
  if (data['academic.classes'] !== undefined) {
    const list = data['academic.classes'];
    if (!Array.isArray(list)) {
      errors.classes = '"academic.classes" must be an array';
    } else if (list.some((c) => typeof c !== 'string' || c.trim().length > 50)) {
      errors.classes = '"academic.classes" items must be strings of at most 50 characters';
    } else {
      data.__classes = list.map((c) => c.trim());
    }
  }
  // Never persisted verbatim ó the dotted key is transport, not a field.
  delete data['academic.classes'];

  if (Object.keys(errors).length) {
    const [field, message] = Object.entries(errors)[0];
    throw new MockError(422, message, 'VALIDATION_ERROR', errors, field);
  }

  // stripUnknown: only the schema keys are written.
  const ALLOWED = [
    'name', 'type', 'motto', 'yearFounded', 'phone', 'email', 'website',
    'address', 'city', 'region', 'gpsAddress', 'brandColor',
  ];
  ALLOWED.forEach((field) => {
    if (data[field] !== undefined) {
      school[field] = typeof data[field] === 'string' ? data[field].trim() : data[field];
    }
  });

  // Coordinates reassembled into the nested object the School model defines,
  // with the freshness stamp the service adds.
  if (data.__location) {
    const previous = school.location || {};
    const moved =
      previous.latitude !== data.__location.latitude ||
      previous.longitude !== data.__location.longitude;
    school.location = {
      latitude: data.__location.latitude,
      longitude: data.__location.longitude,
      source: data.__location.source,
      updatedAt: moved ? new Date().toISOString() : previous.updatedAt || null,
    };
  }

  // Same treatment for the class list: written onto the existing `academic`
  // object rather than replacing it, so currentTerm, currentYear, termsPerYear,
  // gradingSystem and finalYearClasses survive a class save. The real service
  // assigns the one nested key; replacing the subdocument would drop them.
  if (data.__classes) {
    school.academic = { ...(school.academic || {}), classes: data.__classes };
  }

  return {
    ...school,
    __stripped: Object.keys(data).filter(
      (k) => !ALLOWED.includes(k) && !k.startsWith('location.') && !k.startsWith('__')
    ),
  };
};

const uploadSchoolLogo = async ({ data, user }) => {
  const file = data instanceof FormData ? data.get('file') : null;
  if (!file) throw new MockError(400, 'No image file uploaded', 'NO_FILE');
  if (!/^image\//.test(file.type)) {
    throw new MockError(400, 'Only image files are allowed', 'INVALID_FILE_TYPE');
  }
  if (file.size > 2 * 1024 * 1024) {
    throw new MockError(400, 'File size exceeds the 2MB limit', 'FILE_TOO_LARGE');
  }

  const school = findSchool(resolveSchoolId(user, null));
  if (!school) throw new MockError(403, 'No school in scope', 'NO_SCHOOL_SCOPE');

  // A real object URL keeps the preview honest: it has to survive being stored
  // in localStorage and re-read on the next page load, which a blob URL
  // scoped to the document would not.
  const url = `data:${file.type};base64,${await fileToDataUrlPlaceholder(file)}`;
  school.logo = url;
  return { url, logo: url, publicId: `mock/school-logo/${school._id}` };
};

const fileToDataUrlPlaceholder = (file) =>
  new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });

/**
 * `PUT /schools/:id/payout` ó **does not exist on the real API.**
 *
 * Present so the Step 2 success path can be tested end to end. The default
 * scenario returns 404 so the wizard's "not persisted" branch is exercised too;
 * the `payout-enabled` scenario makes this succeed.
 */
const updatePayout = ({ params, body, user }) => {
  if (getScenarioId() === 'payout-unsupported') {
    throw new MockError(404, 'Cannot POST /schools/payout', 'NOT_FOUND');
  }
  const school = findSchool(resolveSchoolId(user, params.schoolId));
  if (!school) throw new MockError(403, 'No school in scope', 'NO_SCHOOL_SCOPE');

  if (!body || typeof body !== 'object' || !Object.keys(body).length) {
    throw new MockError(422, 'Payout details are required', 'VALIDATION_ERROR');
  }
  if (body.bankAccount) {
    const { accountName, accountNumber, bankName } = body.bankAccount;
    if (!accountName || String(accountName).trim().length < 2) {
      throw new MockError(422, 'Account name is required', 'VALIDATION_ERROR');
    }
    if (!/^\d{10}$/.test(String(accountNumber || '').replace(/\s/g, ''))) {
      throw new MockError(422, 'Account number must be 10 digits', 'VALIDATION_ERROR');
    }
    if (!bankName) throw new MockError(422, 'Bank name is required', 'VALIDATION_ERROR');
  }

  // The default scenario adds no mock-only fields, so the response matches the
  // real School document exactly and the frontend is exercised against the real
  // shape. `healthy` opts in, which is how the Step 2 success path can be tested
  // before the backend has the endpoint.
  if (getScenario(getScenarioId()).config?.mockOnlyEnabled) {
    school.payment.settlement = {
      ...(body.bankAccount || body),
      method: body.method || (body.bankAccount ? 'bank' : 'momo'),
      savedAt: new Date().toISOString(),
    };
  }
  return school;
};

/** `POST /schools/:id/verify-hubtel` ó also not on the real API. */
const verifyHubtel = ({ body }) => {
  const scenario = getScenarioId();
  if (scenario === 'hubtel-unsupported') {
    throw new MockError(405, 'Hubtel verification is not enabled', 'NOT_IMPLEMENTED');
  }
  const { clientId, clientSecret, merchantId, apiKey } = body || {};
  if (!clientId || !clientSecret || !merchantId || !apiKey) {
    throw new MockError(422, 'All four Hubtel credentials are required', 'VALIDATION_ERROR');
  }
  // A credential containing "invalid" is rejected, so the error path is
  // reachable without waiting for a real provider.
  if (String(clientId).toLowerCase().includes('invalid')) {
    throw new MockError(422, 'Hubtel rejected those credentials: invalid client ID', 'HUBTEL_REJECTED');
  }
  return { verified: true, merchantId, checkedAt: new Date().toISOString() };
};

// -- Students ---------------------------------------------------------------

const listStudents = ({ query, user }) => {
  const schoolId = resolveSchoolId(user, query?.schoolId);
  if (!schoolId) throw new MockError(400, 'A schoolId is required to list students', 'NO_SCHOOL_SCOPE');

  let rows = studentsFor(schoolId);
  if (query?.search) {
    const needle = String(query.search).toLowerCase();
    rows = rows.filter((s) => s.studentName.toLowerCase().includes(needle));
  }
  if (query?.class) rows = rows.filter((s) => s.studentClass === query.class);
  // `'all'` means "no filter", exactly as `buildRosterFilter` treats it on the
  // real service. The mock used to compare `s.status === query.status` for any
  // truthy value, so a client sending `status=all` ó which is what the Students
  // module's "All Records" option does ó got an empty roster here and the whole
  // roster in production. A mock that disagrees with the backend about the one
  // value both accept is worse than no mock.
  if (query?.status && query.status !== 'all') {
    rows = rows.filter((s) => s.status === query.status);
  }
  // `balance` is not a real sortable field on the real API; the wizard uses it
  // to show the worst debtor first, so the mock honours it.
  if (query?.sortBy === 'balance') {
    rows = [...rows].sort((a, b) => (query.sortOrder === 'asc' ? a.balance - b.balance : b.balance - a.balance));
  }

  const perPage = Number(query?.perPage) || 20;
  const page = Number(query?.page) || 1;
  const total = rows.length;
  // Key names mirror `student.service.js` exactly ó `total`/`totalPages`, not
  // `totalItems`/`limit`. The adapter hoists `meta` to the top level and
  // unwraps `students` into `data`, reproducing the real `{ data, meta }`.
  return {
    students: rows.slice((page - 1) * perPage, page * perPage),
    meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
  };
};

// -- Cohorts and alumni ------------------------------------------------------
//
// The Cohorts and Alumni tabs call these, and without them the mock 404s and
// the feature reads as broken even though it works against a seeded database.
//
// The grouping mirrors the real `getCohorts` exactly: a cohort is everyone with a
// `graduationYear`, and `graduatedCount` / `transferredCount` / `droppedCount`
// are three different statuses counted within it. The real service needed a
// `$toString` around its `$subtract` for the same reason these are computed in JS
// rather than by string surgery ó `$concat` refuses a number.

const studentsOfSchool = (schoolId) => studentsFor(schoolId);

const listCohorts = ({ params, query }) => {
  const schoolId = params.schoolId;
  const members = studentsOfSchool(schoolId).filter((s) => s.graduationYear && !s.deletedAt);

  const byYear = new Map();
  members.forEach((student) => {
    const year = String(student.graduationYear);
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year).push(student);
  });

  let cohorts = [...byYear.entries()]
    .map(([year, rows]) => {
      const by = (status) => rows.filter((s) => s.status === status).length;
      const honorsBreakdown = rows.reduce((acc, s) => {
        if (s.honors) acc[s.honors] = (acc[s.honors] || 0) + 1;
        return acc;
      }, {});

      return {
        _id: `cohort_${year}`,
        id: `cohort_${year}`,
        name: `Class of ${year}`,
        // The same arithmetic the real pipeline does, string-safe: `year - 1` is
        // a number, and the real bug was handing one to `$concat`.
        academicYear: `${Number(year) - 1}/${year}`,
        startDate: rows
          .map((r) => new Date(r.createdAt).getTime())
          .reduce((min, t) => Math.min(min, t), Infinity),
        endDate: rows
          .map((r) => (r.graduationDate ? new Date(r.graduationDate).getTime() : 0))
          .reduce((max, t) => Math.max(max, t), 0),
        studentCount: rows.length,
        graduatedCount: by('graduated'),
        transferredCount: by('transferred_out'),
        droppedCount: by('removed'),
        honorsBreakdown,
        classes: [...new Set(rows.map((r) => r.studentClass))],
      };
    })
    .sort((a, b) => Number(b._id.split('_')[1]) - Number(a._id.split('_')[1]));

  const search = String(query?.search || '').toLowerCase();
  if (search) {
    cohorts = cohorts.filter(
      (c) => c.name.toLowerCase().includes(search) || c.academicYear.includes(search)
    );
  }

  const page = Number(query?.page) || 1;
  const limit = Number(query?.limit) || 20;
  return {
    cohorts: cohorts.slice((page - 1) * limit, page * limit),
    pagination: {
      page,
      limit,
      totalItems: cohorts.length,
      totalPages: Math.max(1, Math.ceil(cohorts.length / limit)),
      hasNext: page * limit < cohorts.length,
    },
  };
};

const getCohortDetail = ({ params, query }) => {
  const year = String(params.cohortId || '').replace('cohort_', '');
  if (!/^\d{4}$/.test(year)) {
    throw new MockError(400, 'Invalid cohort ID ó expected cohort_2026', 'INVALID_COHORT_ID');
  }

  // The query first, never `params.schoolId`.
  //
  // `extractParams` fills the positional slots `id`/`token`/`schoolId`/`userId`
  // from the matched path segment, so on this route `params.schoolId` is the
  // literal string `"cohort_2025"`. It looks like a school id and silently
  // matches nothing ó the detail came back with zero students and the list said
  // 26. The real service scopes from the caller, not the path, so the query is
  // the right source here too.
  const schoolId = query?.schoolId;
  const rows = studentsFor(schoolId).filter((s) => s.graduationYear === year);

  const by = (status) => rows.filter((s) => s.status === status).length;
  const honorsBreakdown = rows.reduce((acc, s) => {
    if (s.honors) acc[s.honors] = (acc[s.honors] || 0) + 1;
    return acc;
  }, {});

  const classes = [...new Set(rows.map((s) => s.studentClass))].map((name) => ({
    id: name,
    name,
    level: Number(name.match(/\d+/)?.[0] || 12),
    teacher: null,
    studentCount: rows.filter((s) => s.studentClass === name).length,
  }));

  const page = Number(query?.page) || 1;
  const limit = Number(query?.limit) || 50;

  return {
    // `__raw` because the real response has a `students` field of its own, which
    // the adapter would otherwise hoist into `data`.
    __raw: {
      cohort: {
      _id: `cohort_${year}`,
      id: `cohort_${year}`,
      name: `Class of ${year}`,
      academicYear: `${Number(year) - 1}/${year}`,
      classes,
      statistics: {
        totalStudents: rows.length,
        graduated: by('graduated'),
        transferred: by('transferred_out'),
        dropped: by('removed'),
        repeating: rows.filter((s) => s.isRepeating).length,
        honorsBreakdown,
      },
      },
      honorsBreakdown,
      students: rows
        .slice()
        .sort((a, b) => String(a.lastName || a.studentName).localeCompare(String(b.lastName || b.studentName)))
        .slice((page - 1) * limit, page * limit)
        // The real detail query excludes the guardian sub-documents.
        .map(({ parents, emergencyContacts, uniquePayLinkToken, payLink, ...rest }) => rest),
    },
  };
};

const listAlumni = ({ params, query }) => {
  let rows = studentsFor(params.schoolId).filter(
    (s) => s.status === 'graduated' && s.isAlumni
  );

  if (query?.graduationYear) rows = rows.filter((r) => r.graduationYear === String(query.graduationYear));
  if (query?.honors) rows = rows.filter((r) => r.honors === query.honors);

  const search = String(query?.search || '').toLowerCase();
  if (search) {
    // Literal substring, escaped ó the real service had `$regex` interpolation
    // and a `.*` search returned the entire roll.
    rows = rows.filter((r) =>
      [r.studentName, r.studentId, r.certificateNumber]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(search))
    );
  }

  const sortBy = query?.sortBy || 'lastName';
  const dir = query?.sortOrder === 'desc' ? -1 : 1;
  rows = rows.slice().sort((a, b) =>
    String(a[sortBy] ?? a.studentName).localeCompare(String(b[sortBy] ?? b.studentName)) * dir
  );

  const page = Number(query?.page) || 1;
  const limit = Number(query?.limit) || 50;

  return {
    alumni: rows.slice((page - 1) * limit, page * limit),
    pagination: {
      page,
      limit,
      totalItems: rows.length,
      totalPages: Math.max(1, Math.ceil(rows.length / limit)),
      hasNext: page * limit < rows.length,
    },
  };
};

// -- Academic lifecycle ------------------------------------------------------
//
// The promotion, graduation and transfer-out writes the end-of-year wizard
// makes. They mirror the real services rather than returning a canned success,
// because the wizard's whole value is that the numbers it shows before you
// commit are the numbers the write produces.
//
// Two behaviours are copied deliberately because they are what the UI has to
// respect: promotion refuses a repeating student, and a repeat is refused a
// second time. If the mock were permissive, the wizard would look correct here
// and fail against the real API.

/** The classes a student may graduate from ó the same fallback as the service. */
const finalYearClassesOf = (school) => {
  const named = school?.academic?.finalYearClasses || [];
  if (named.length) return named;
  return (school?.academic?.classes || []).slice(-3);
};

/** `getNextClass`: the class after this one, or null at the top of the list. */
const nextClassOf = (school, currentClass) => {
  const classes = school?.academic?.classes || [];
  const index = classes.indexOf(currentClass);
  if (index === -1 || index === classes.length - 1) return null;
  return classes[index + 1];
};

const requireStudent = (id) => {
  const db = getDb();
  const student = db.students.find((s) => s._id === id || s.studentId === id);
  if (!student) throw new MockError(404, 'Student not found', 'NOT_FOUND');
  return student;
};

/** `POST /students/promote/preview` ó the class mapping the matrix is built on. */
/**
 * The payload key is `body`, not `data`.
 *
 * The adapter passes both: `body` is the *parsed* JSON, and `data` is the raw
 * `config.data` axios was handed ó a string for a JSON post. Reading `data` here
 * gives a string, so `data.studentIds` is `undefined`, and the handler's
 * `studentIds` check rejects a request that was perfectly well formed. The
 * symptom is a validation error on a valid batch, which sends you looking at the
 * schema instead of at the mock.
 *
 * `data` is only correct for multipart, where the body genuinely is a
 * `FormData` ó that is why `/upload/student-photo` reads `data`.
 */
const previewPromotion = ({ body, user }) => {
  // `resolveSchoolId(user, requested)`: a school admin is pinned to their own
  // school, and only a `super_admin` may target another. Passing a hand-built
  // `user` here would make every caller look like the second case.
  const schoolId = resolveSchoolId(user, body?.schoolId);
  if (!schoolId) throw new MockError(403, 'No school in scope', 'NO_SCHOOL_SCOPE');
  const school = findSchool(schoolId);

  const requested = body?.classNames || [];
  if (!requested.length) {
    throw new MockError(422, 'Provide at least one of classNames, gradeLevels or studentIds', 'VALIDATION_ERROR');
  }

  const inScope = studentsFor(schoolId).filter(
    (s) =>
      !s.deletedAt &&
      s.status === 'active' &&
      !s.isRepeating &&
      requested.includes(s.studentClass)
  );

  const mapping = [];
  const unmappedStudents = [];

  inScope.forEach((student) => {
    const next = nextClassOf(school, student.studentClass);
    if (!next) {
      unmappedStudents.push({
        studentId: student._id,
        reason: 'No next level defined for current class',
      });
      return;
    }
    let entry = mapping.find((m) => m.currentClass === student.studentClass);
    if (!entry) {
      entry = { currentClass: student.studentClass, targetClass: next, studentCount: 0, students: [] };
      mapping.push(entry);
    }
    entry.studentCount += 1;
    entry.students.push({
      id: student._id,
      studentNumber: student.studentId,
      name: student.studentName,
    });
  });

  // The preview returns *every* in-scope student as eligible, including the
  // final-year ones it cannot map. The client filters them by class position
  // rather than by absence from `mapping`, so it has to see them here too.
  return {
    previewDate: new Date().toISOString(),
    schoolId,
    totalEligibleStudents: inScope.length,
    mapping,
    warnings: [],
    unmappedStudents,
  };
};

/** `POST /students/:id/promote` */
const promoteStudent = ({ params, body }) => {
  const student = requireStudent(params.id);
  if (student.status !== 'active') {
    throw new MockError(409, 'Only active students can be promoted', 'INVALID_STATUS');
  }
  if (student.isRepeating) {
    throw new MockError(
      409,
      'Repeating students cannot be promoted until repeat period ends',
      'STUDENT_REPEATING'
    );
  }

  const school = findSchool(student.schoolId);
  const classes = school.academic?.classes || [];
  let target = body?.targetClass;

  if (!target) {
    target = nextClassOf(school, student.studentClass);
    if (!target) {
      throw new MockError(409, 'No next class level defined for student\'s current class', 'NO_NEXT_LEVEL');
    }
  } else if (!classes.includes(target)) {
    throw new MockError(400, 'Target class not found in school', 'INVALID_TARGET_CLASS');
  }

  student.promotedFrom = student.studentClass;
  student.promotedTo = target;
  student.promotionDate = body?.promotionDate || new Date().toISOString();
  student.studentClass = target;
  return student;
};

/** `POST /students/:id/repeat` */
const repeatStudent = ({ params, body }) => {
  const student = requireStudent(params.id);
  if (student.status !== 'active') {
    throw new MockError(409, 'Only active students can be marked as repeating', 'INVALID_STATUS');
  }
  if ((student.repeatCount || 0) >= 1) {
    throw new MockError(
      409,
      'Student has reached maximum repeat limit for this grade',
      'MAX_REPEATS_EXCEEDED'
    );
  }
  student.isRepeating = true;
  student.repeatCount = (student.repeatCount || 0) + 1;
  student.repeatReason = body?.repeatReason || 'ACADEMIC';
  return student;
};

/** `POST /students/:id/unrepeat` */
const clearRepeat = ({ params, body }) => {
  const student = requireStudent(params.id);
  if (!body?.reason || String(body.reason).trim().length < 3) {
    throw new MockError(422, 'A reason of at least 3 characters is required', 'VALIDATION_ERROR');
  }
  student.isRepeating = false;
  return student;
};

/** `POST /students/bulk-graduate/:schoolId` */
const bulkGraduate = ({ params, body, user }) => {
  const schoolId = resolveSchoolId(user, params.schoolId);
  if (!schoolId) throw new MockError(403, 'No school in scope', 'NO_SCHOOL_SCOPE');
  const school = findSchool(schoolId);

  // `classNames`, matching the schema. The service this mirrors used to read a
  // `classIds` field that no schema defines, so graduating a class threw
  // MISSING_CRITERIA and only an already-graduated cohort could be selected.
  const classNames = body?.classNames || [];
  if (!classNames.length) {
    throw new MockError(400, 'Either cohortId or classNames must be provided', 'MISSING_CRITERIA');
  }
  if (!body?.graduationDate) {
    throw new MockError(422, 'graduationDate is required', 'VALIDATION_ERROR');
  }

  const targets = studentsFor(schoolId).filter(
    (s) => !s.deletedAt && s.status === 'active' && classNames.includes(s.studentClass)
  );
  if (!targets.length) {
    throw new MockError(400, 'No eligible students found for graduation', 'NO_ELIGIBLE_STUDENTS');
  }

  const finalClasses = finalYearClassesOf(school);
  const gradDate = new Date(body.graduationDate);
  const year = gradDate.getFullYear();

  const graduated = [];
  const ineligible = [];
  // From a shared counter per school-year, mirroring the service's `certCounter`
  // so a second batch cannot hand out a number the first one already used.
  const issued = dbCertCounters(schoolId, year, body.certificatePrefix || 'CERT');

  targets.forEach((student) => {
    if (!finalClasses.includes(student.studentClass)) {
      ineligible.push({ studentId: student._id, reason: 'Not in final year class' });
      return;
    }
    const certificateNumber = body.autoAssignCertificates === false ? '' : issued.next();
    student.status = 'graduated';
    student.isAlumni = true;
    student.graduationDate = gradDate.toISOString();
    student.graduationYear = String(year);
    student.graduationType = body.graduationType || 'STANDARD';
    student.certificateNumber = certificateNumber;
    student.honors = 'NONE';
    graduated.push({
      studentId: student._id,
      studentNumber: student.studentId,
      certificateNumber,
      honors: 'NONE',
    });
  });

  return {
    summary: {
      totalProcessed: targets.length,
      graduated: graduated.length,
      ineligible: ineligible.length,
      failed: 0,
    },
    graduatedStudents: graduated,
    ineligibleStudents: ineligible,
    failedStudents: [],
    cohort: null,
  };
};

/** Per-school, per-year certificate counter, kept on the mock db. */
const dbCertCounters = (schoolId, year, prefix) => {
  const db = getDb();
  db.certificateCounters = db.certificateCounters || {};
  const key = `${schoolId}:${year}:${prefix}`;
  db.certificateCounters[key] = (db.certificateCounters[key] || 0) + 1;
  return { next: () => `${prefix}-${year}-${String(db.certificateCounters[key]).padStart(4, '0')}` };
};

/** `POST /students/:id/transfer-out` */
const transferOutStudent = ({ params, body }) => {
  const student = requireStudent(params.id);

  if (!body?.destinationInstitution || String(body.destinationInstitution).trim().length < 2) {
    throw new MockError(422, 'destinationInstitution is required', 'VALIDATION_ERROR');
  }
  if (!body?.transferDate) {
    throw new MockError(422, 'transferDate is required', 'VALIDATION_ERROR');
  }
  if (!body?.transferReason) {
    throw new MockError(422, 'transferReason is required', 'VALIDATION_ERROR');
  }
  if (body.transferReason === 'OTHER' && String(body.customReason || '').trim().length < 5) {
    throw new MockError(422, 'A custom reason of at least 5 characters is required', 'VALIDATION_ERROR');
  }

  student.status = 'transferred_out';
  student.transferOutDate = body.transferDate;
  student.transferOutRecord = {
    destinationInstitution: body.destinationInstitution,
    destinationInstitutionType: body.destinationInstitutionType || 'PUBLIC_SCHOOL',
    transferDate: body.transferDate,
    transferReason: body.transferReason,
    customReason: body.customReason,
    recordsTransferred: body.recordsTransferred !== false,
    notes: body.notes,
    studentId: student._id,
    schoolId: student.schoolId,
  };

  // The ledger is deliberately left intact ó that is the point of the form.
  return { student, transferRecord: student.transferOutRecord };
};

// -- ID cards ------------------------------------------------------------------
//
// The batch flow is asynchronous for real ó the server answers 202 and a
// background job renders the PDF ó so the mock reproduces the same handshake
// rather than handing back a file immediately. A mock that answered 200 with a
// finished PDF would let the studio's polling loop pass while unexercised, and
// the first time it met a real 202 it would try to download a pending batch.
//
// One poll is `pending` and the next is `ready`, so the loop is exercised
// exactly once rather than spun forever or skipped entirely.

const batchStore = () => {
  getDb().idCardBatches = getDb().idCardBatches || {};
  return getDb().idCardBatches;
};

/** POST /id-cards/batch */
const createIdCardBatch = ({ body, user }) => {
  const schoolId = resolveSchoolId(user);
  if (!schoolId) throw new MockError(403, 'No school in scope', 'NO_SCHOOL_SCOPE');

  const studentIds = body?.studentIds || [];
  if (!Array.isArray(studentIds) || studentIds.length === 0) {
    throw new MockError(422, 'Provide at least one student ID', 'VALIDATION_ERROR');
  }

  const owned = studentsFor(schoolId).filter((s) => studentIds.includes(s._id));
  if (owned.length !== studentIds.length) {
    throw new MockError(
      `${studentIds.length - owned.length} of the provided student IDs do not belong to your school`,
      400,
      'INVALID_STUDENTS'
    );
  }

  const batchId = objectId(31);
  batchStore()[batchId] = {
    _id: batchId,
    schoolId,
    studentIds: owned.map((s) => s._id),
    totalCards: owned.length,
    status: 'pending',
    pdfUrl: null,
    // Counts polls, not milliseconds: the studio polls on its own timer and a
    // wall-clock delay would make the mock slow for no added confidence.
    polls: 0,
  };

  return { __raw: { batchId, status: 'pending' }, __status: 202 };
};

/** The shared 202 ? ready handshake for both batch endpoints. */
const advanceBatch = (batchId, schoolId) => {
  const batch = batchStore()[batchId];
  if (!batch || batch.schoolId !== schoolId) {
    throw new MockError(404, 'Batch not found', 'NOT_FOUND');
  }
  if (batch.status === 'ready') return batch;

  batch.polls += 1;
  // The first poll is pending, the second is ready. One pending response is
  // enough for the studio's loop to prove it retries, and two is enough to get
  // it to the download without making the mock slow.
  if (batch.polls < 2) return batch;

  batch.status = 'ready';
  batch.pdfUrl = `https://res.cloudinary.com/mock/id-cards/${batchId}.pdf`;
  return null;
};

/** GET /id-cards/batch/:batchId ó HTML preview */
const getIdCardBatchPreview = ({ params, user }) => {
  const schoolId = resolveSchoolId(user);
  const batchId = params.batchId;
  const store = batchStore();

  if (!store[batchId]) throw new MockError(404, 'Batch not found', 'NOT_FOUND');
  if (store[batchId].schoolId !== schoolId) {
    throw new MockError(404, 'Batch not found', 'NOT_FOUND');
  }

  const pending = advanceBatch(batchId, schoolId);
  if (pending) {
    return { __raw: { status: 'pending', retryAfter: 3 }, __status: 202 };
  }

  const school = findSchool(schoolId);
  const students = studentsFor(schoolId).filter((s) =>
    store[batchId].studentIds.includes(s._id)
  );

  const cards = students
    .map(
      (student) => `
      <div class="id-card-preview">
        <div class="card-header">${escapeHtml(school?.name || 'School')}</div>
        <div class="card-body">
          <div class="student-name">${escapeHtml(student.studentName)}</div>
          <div class="student-id">ID: ${escapeHtml(student.studentId || '')}</div>
          <div class="student-class">${escapeHtml(student.studentClass)}</div>
          ${
            student.studentImage
              ? `<img class="student-photo" src="${student.studentImage}" alt="Photo" />`
              : '<div class="photo-placeholder">No Photo</div>'
          }
        </div>
      </div>`
    )
    .join('');

  return {
    __text: {
      mimeType: 'text/html; charset=utf-8',
      filename: 'id-card-batch-preview.html',
      body: `<!DOCTYPE html><html><head><meta charset="utf-8"><title>ID card batch preview</title></head><body><h1>${escapeHtml(
        school?.name || 'School'
      )}</h1><p>${store[batchId].totalCards} cards</p>${cards}</body></html>`,
    },
  };
};

/** GET /id-cards/batch/:batchId/pdf */
const getIdCardBatchPdf = ({ params, user }) => {
  const schoolId = resolveSchoolId(user);
  const batchId = params.batchId;
  const store = batchStore();

  if (!store[batchId] || store[batchId].schoolId !== schoolId) {
    throw new MockError(404, 'Batch not found', 'NOT_FOUND');
  }

  const pending = advanceBatch(batchId, schoolId);
  if (pending) {
    return { __raw: { status: 'pending' }, __status: 202 };
  }

  // Not a real PDF: it only has to be bytes the browser will download, and a
  // hand-written PDF header is not worth the maintenance.
  return {
    __file: {
      mimeType: 'application/pdf',
      filename: `id-cards-${store[batchId].totalCards}.pdf`,
      body: `%PDF-1.4 mock batch ${batchId}`,
    },
  };
};

/** GET /id-cards/:studentId ó single card */
const getStudentIdCard = ({ params, user }) => {
  const schoolId = resolveSchoolId(user);
  const student = studentsFor(schoolId).find((s) => s._id === params.studentId);
  if (!student) throw new MockError(404, 'Student not found', 'STUDENT_NOT_FOUND');

  return {
    __file: {
      mimeType: 'application/pdf',
      filename: `id-card-${student.studentId}.pdf`,
      body: `%PDF-1.4 mock card for ${student.studentName}`,
    },
  };
};

/** GET /id-cards/qr-links/:schoolId ó CSV */
const getQrLinksExport = ({ params, user, query }) => {
  const schoolId = resolveSchoolId(user);
  if (String(params.schoolId) !== String(schoolId)) {
    throw new MockError(403, 'No school in scope', 'NO_SCHOOL_SCOPE');
  }

  const page = Number(query?.page) || 1;
  const perPage = Number(query?.perPage) || 20;
  const all = studentsFor(schoolId).filter((s) => s.payLink);
  const slice = all.slice((page - 1) * perPage, page * perPage);

  const header = 'Student ID,Student Name,Class,Pay Link,QR Image URL';
  const lines = slice.map(
    (s) =>
      `${csvCell(s.studentId)},${csvCell(s.studentName)},${csvCell(
        s.studentClass
      )},${csvCell(s.payLink)},${csvCell(`https://api.qrserver.com/v1/?data=${s.payLink}`)}`
  );

  return {
    __file: {
      mimeType: 'text/csv; charset=utf-8',
      filename: `qr-links-${all.length}.csv`,
      body: [header, ...lines].join('\n'),
    },
  };
};

/**
 * HTML-escape for the string interpolated into the batch preview markup.
 *
 * Fixture names are generated, but the preview page is assembled from record
 * fields, and an unescaped `&` or `<` in a student name would break the markup
 * ó which in a mock looks exactly like a broken preview endpoint and sends you
 * looking at the wrong file.
 *
 * CSV quoting reuses the existing `csvCell`, which also neutralises formula
 * prefixes ó worth having here too, since a pay link or a name beginning with
 * `=` is exactly what a spreadsheet would execute.
 */
const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// -- Public pay surface ------------------------------------------------------
//
// Unauthenticated, reached by an SMS link, and keyed on the pay token rather
// than a session. The mock keeps its own token map because a fixture student has
// a `payLink` but no real token, and the client reads the token off the end of
// the URL.

const payTokenOf = (student) => String(student.payLink || '').split('/').pop();

// A deliberately narrow projection, mirroring the real `getStudentByPayToken`:
// a name, a class, three figures, a deadline and the school. No guardian phone
// numbers cross this boundary, so the mock must not invent any.
const publicStudent = (student, school) => ({
  id: student._id,
  studentId: student.studentId,
  studentName: student.studentName,
  studentClass: student.studentClass,
  totalOwed: student.totalOwed,
  totalPaid: student.totalPaid,
  balance: student.balance,
  deadline: student.deadline,
  school: school
    ? { _id: school._id, schoolCode: school.schoolCode, name: school.name }
    : null,
});

const getPayView = ({ params }) => {
  const db = getDb();
  const student = db.students.find((s) => payTokenOf(s) === params.token);
  if (!student) {
    throw new MockError(404, 'Invalid or expired payment link', 'INVALID_TOKEN');
  }
  const school = db.schools.find((s) => s._id === student.schoolId);
  return {
    student: publicStudent(student, school),
    payLink: student.payLink,
  };
};

const initiatePay = ({ params, body }) => {
  const db = getDb();
  const student = db.students.find((s) => payTokenOf(s) === params.token);
  if (!student) {
    throw new MockError(404, 'Invalid or expired payment link', 'INVALID_TOKEN');
  }
  if (!Number.isInteger(body?.amount) || body.amount < 1) {
    throw new MockError(422, 'Amount must be at least 1 pesewa', 'VALIDATION_ERROR');
  }
  if (body.amount > (student.balance || 0)) {
    throw new MockError(400, 'That is more than the balance due', 'AMOUNT_EXCEEDS_BALANCE');
  }

  // Stays pending: the real gateway settles by webhook, and the client polls.
  // Returning `completed` here would skip the only state a real parent sees.
  db.payments.push({
    _id: objectId(db.payments.length + 500),
    paymentId: `MOCK-PAY-${db.payments.length + 1}`,
    studentId: student._id,
    schoolId: student.schoolId,
    amount: body.amount,
    currency: 'GHS',
    status: 'pending',
    paymentMethod: 'momo',
    provider: 'mtn',
    momoPhoneNumber: body.phoneNumber || null,
    momoNetwork: body.momoNetwork || 'UNKNOWN',
    reference: `TXN-MOCK-${db.payments.length + 1}`,
    description: body.description || 'Mobile Money payment',
    createdAt: new Date().toISOString(),
  });

  return {
    status: 'pending',
    hubtelTransactionId: `MOCK-TXN-${db.payments.length + 1}`,
    hubtelOrderId: `MOCK-ORD-${db.payments.length + 1}`,
    message: 'Check your phone for the prompt',
  };
};

const verifyPay = ({ params }) => {
  const db = getDb();
  const student = db.students.find((s) => payTokenOf(s) === params.token);
  if (!student) {
    throw new MockError(404, 'Invalid or expired payment link', 'INVALID_TOKEN');
  }
  const pending = db.payments.find(
    (p) => p.studentId === student._id && p.status === 'pending'
  );
  return { status: pending ? pending.status : 'completed' };
};

// -- Payments -----------------------------------------------------------------
//
// The admin half of the ledger: the transaction list, the aggregates behind the
// dashboard's KPI band, the CSV, one payment in full, its receipt, and a refund.
// The parent-facing half is the public pay surface above.
//
// Everything below reads one filter, `filterPayments`. The real service does the
// same through `buildPaymentFilter` in `payment.service.js`, for the same reason:
// there are three readers of this filter and a condition added to one and
// forgotten in the other two is a report that quietly disagrees with the table
// above it. A list that honours `class` while the export beside it does not
// produces a CSV that is not the screen it was exported from, and reconciling
// that file is the entire reason the export exists.

/**
 * The `momoNetwork` enum in its declared order, and the labels the summary shows.
 *
 * Every network is returned whether or not it collected anything. A row that
 * lists only the networks present leaves the client to invent the missing ones,
 * and "MTN collected nothing this month" has to be told apart from "MTN was
 * filtered out". Ties fall back to the enum order, so two calls over the same
 * data return the same array.
 */
const NETWORK_ORDER = ['MTN', 'VODAFONE', 'AIRTELTELIGO', 'UNKNOWN'];
const NETWORK_LABELS = {
  MTN: 'MTN MoMo',
  VODAFONE: 'Vodafone Cash',
  AIRTELTELIGO: 'AT Money',
  UNKNOWN: 'Unidentified',
};

/** The `paymentMethod` enum's human names, for the summary and the CSV channel column. */
const METHOD_LABELS = {
  momo: 'Mobile Money',
  cash: 'Cash',
  card: 'Card',
  bank_transfer: 'Bank transfer',
  unknown: 'Unknown',
};

/**
 * Mirrors of `round` / `rate` from `payment.service.js`, deliberately not a
 * shared import ó that module keeps both private, and a share percentage that
 * rounds differently in two modules is worse than a duplicated three-line
 * function.
 *
 * The zero-denominator guard is the point of `mockRate`: an empty window has no
 * percentage, and returning 0 rather than NaN is what keeps the KPI tile
 * renderable instead of showing "NaN%".
 */
const mockRound = (num, dp = 2) => {
  const factor = 10 ** dp;
  return Math.round((Number(num) || 0) * factor) / factor;
};
const mockRate = (collected, expected) => (expected ? mockRound((collected / expected) * 100) : 0);

/** `startOfDayAccra` / `endOfDayAccra` from the server's `dateHelpers.js`. */
const startOfDay = (value) => {
  const d = new Date(value);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
};
const endOfDay = (value) => {
  const d = new Date(value);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 0, 0));
};

/** `createdAt` as milliseconds, with a missing or unparseable value as 0. */
const createdAtMs = (payment) => {
  const time = new Date(payment.createdAt).getTime();
  return Number.isNaN(time) ? 0 : time;
};

/**
 * The one filter behind `GET /payments`, `GET /payments/summary` and
 * `GET /payments/export` ó `buildPaymentFilter` in `payment.service.js`, in JS.
 *
 * Two of its conditions belong to the *Student* document rather than the Payment:
 * `class`, and the student half of `search`. A Payment stores no copy of
 * `studentClass` or `studentName`, so there is nothing on this collection to
 * match them against, and they are resolved through the school's students here
 * exactly as the server resolves them to `studentId: { $in: ids }`. They are
 * applied as separate row filters, which intersects them ó resolving each to an
 * id list and merging the lists afterwards would have taken the union, so
 * "class JHS 2 AND search Ama" would have returned every payment for any student
 * in the school.
 *
 * **`search` uses `includes`, not a RegExp.** The server escapes the term before
 * splicing it into `$regex`: it used not to, and `?search=.*` matched every
 * payment in the school while `?search=[` threw a driver error that surfaced as a
 * 500. A search box is an injection point until it is escaped, and escaping is
 * also what makes it the literal substring search a user typing into one
 * expects ó which is precisely `includes`, so the mock gets the same semantics
 * without carrying an escape helper it could get wrong.
 */
const filterPayments = (query, schoolId) => {
  const db = getDb();
  const students = studentsFor(schoolId);
  const classOf = new Map(students.map((s) => [s._id, s.studentClass]));

  let rows = db.payments.filter((p) => p.schoolId === schoolId && !p.deletedAt);

  // `'all'` is the enum's own "no filter" value ó `paymentsQuerySchema` defaults
  // `status` to it, and `usePayments` sends it on every request ó so comparing it
  // as a status string empties the module's *unfiltered* view. Same rule, and the
  // same reasoning, as `listStudents`.
  if (query?.status && query.status !== 'all') rows = rows.filter((p) => p.status === query.status);
  if (query?.paymentMethod) rows = rows.filter((p) => p.paymentMethod === query.paymentMethod);
  if (query?.provider) rows = rows.filter((p) => p.provider === query.provider);
  // `UNKNOWN` is a bucket, not a stored value, and it expands to the rows that
  // actually land in it ó a null, missing or literally-`UNKNOWN` network. That is
  // what the summary's `$ifNull` facet counts, so the chip the filter bar offers
  // and the rows the table shows are the same set.
  if (query?.network) {
    rows =
      query.network === 'UNKNOWN'
        ? rows.filter((p) => !p.momoNetwork || p.momoNetwork === 'UNKNOWN')
        : rows.filter((p) => p.momoNetwork === query.network);
  }
  if (query?.studentId) rows = rows.filter((p) => p.studentId === query.studentId);
  if (query?.class) rows = rows.filter((p) => classOf.get(p.studentId) === query.class);

  // `minAmount` / `maxAmount`, as written in the schema. The falsy-zero quirk is
  // the server's (`if (query.minAmount || Ö)` ignores an explicit 0) and is
  // harmless: 0 is a no-op bound in either reading.
  if (query?.minAmount) rows = rows.filter((p) => (p.amount || 0) >= Number(query.minAmount));
  if (query?.maxAmount) rows = rows.filter((p) => (p.amount || 0) <= Number(query.maxAmount));

  // Both ends snapped to whole Accra calendar days, matching `buildPaymentFilter`'s
  // `startOfDayAccra` / `endOfDayAccra`. A bare `new Date(endDate)` ends the
  // window at *midnight* on that day, so "This month" stopped short of today and
  // the band above the table disagreed with it ó one query parameter, one
  // inclusive-day definition, on both surfaces.
  if (query?.startDate) {
    const from = startOfDay(query.startDate).getTime();
    if (!Number.isNaN(from)) rows = rows.filter((p) => createdAtMs(p) >= from);
  }
  if (query?.endDate) {
    const to = endOfDay(query.endDate).getTime();
    if (!Number.isNaN(to)) rows = rows.filter((p) => createdAtMs(p) <= to);
  }

  const search = String(query?.search || '').trim().toLowerCase();
  if (search) {
    // The payment-side fields first ó the reference a bursar actually pastes in
    // from a receipt or a gateway dashboard ó then the students whose name or
    // human id matched. The two are ORed, so searching for a receipt number is
    // unaffected by the student half finding nobody. A whitespace-only box
    // matches nothing rather than everything, for the same reason
    // `buildPaymentFilter` keys on the trimmed term.
    const studentById = new Map(students.map((s) => [s._id, s]));
    const hit = (value) => Boolean(value) && String(value).toLowerCase().includes(search);
    rows = rows.filter((p) => {
      if ([p.paymentId, p.receiptNumber, p.hubtelTransactionId].some(hit)) return true;
      const student = studentById.get(p.studentId);
      return Boolean(student && (hit(student.studentName) || hit(student.studentId)));
    });
  }

  return rows;
};

/** The `sortBy` allow-list from `paymentsQuerySchema`; anything else falls back. */
const SORTABLE_PAYMENT_FIELDS = ['createdAt', 'amount', 'completedAt', 'paymentId'];

/**
 * `sortBy` / `sortOrder`, with the schema's allow-list.
 *
 * The allow-list is the point, not defensive coding: `TransactionTable` offers
 * `status` as a sortable column and `paymentsQuerySchema` does not accept it, so
 * that click is a 422 against the real API. Falling back to `createdAt` here
 * keeps the mock's answer stable instead of sorting by an undefined field,
 * which would leave the order arbitrary and read as a broken table.
 */
const sortPayments = (rows, query) => {
  const sortBy = SORTABLE_PAYMENT_FIELDS.includes(query?.sortBy) ? query.sortBy : 'createdAt';
  const direction = query?.sortOrder === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const left = a[sortBy];
    const right = b[sortBy];
    if (typeof left === 'number' && typeof right === 'number') return (left - right) * direction;
    return String(left ?? '').localeCompare(String(right ?? '')) * direction;
  });
};

/**
 * `studentId` populated, the way `listPayments` populates it on the server.
 *
 * The table renders the student's name, class and **guardian** out of this
 * object, so a row that left `studentId` as a bare id would still draw ó with an
 * empty guardian column, which reads as "this payment has no parent on file"
 * rather than as a limitation of the mock. The phone numbers are not masked,
 * matching the server's projection: unlike the roster, this surface exists so a
 * bursar can chase a payment that did not arrive, and the route is already
 * behind `authenticate` + `requireSchoolAdmin`.
 *
 * A payment whose student no longer resolves keeps the raw id, which is what
 * mongoose's `.populate()` leaves behind too.
 */
const withStudent = (payment) => {
  const student = getDb().students.find((s) => s._id === payment.studentId);
  if (!student) return payment;
  return {
    ...payment,
    studentId: {
      studentId: student.studentId,
      studentName: student.studentName,
      studentClass: student.studentClass,
      parents: student.parents || [],
    },
  };
};

/**
 * Payment lookup, school-scoped.
 *
 * Scoped twice over, as every admin payment route is: by `paymentId` within the
 * caller's own school, and by `deletedAt: null`. Without the school half a
 * bursar who guessed or leaked a reference could read another school's
 * transaction.
 */
const findPaymentFor = (paymentId, schoolId) =>
  getDb().payments.find((p) => p.paymentId === paymentId && p.schoolId === schoolId && !p.deletedAt) || null;

/**
 * Record a payment taken at the bursar's desk.
 *
 * Mirrors `manualPayment.service.js`: the payment row *and* the student's
 * `totalPaid`/`balance` move together. A mock that only wrote the payment would
 * make the feature look finished while the roster, the KPI band and every report
 * still showed the old figure ó which is the exact failure the real service's
 * transaction exists to prevent.
 *
 * The guards match too: `momo` is refused (a Mobile Money payment is confirmed
 * by the gateway, so a hand-recorded one is a second claim on the same money),
 * and an amount above the balance needs `allowOverpayment`.
 */
const recordManualPayment = ({ body, user }) => {
  const db = getDb();
  const schoolId = resolveSchoolId(user, body?.schoolId);
  if (!schoolId) throw new MockError(403, 'No school in scope', 'NO_SCHOOL_SCOPE');

  if (!body?.studentRef) throw new MockError(400, 'A student is required', 'STUDENT_REQUIRED');
  if (!Number.isInteger(body.amount) || body.amount <= 0) {
    throw new MockError(400, 'Amount must be a positive whole number of pesewas', 'INVALID_AMOUNT');
  }
  if (!['cash', 'card', 'bank_transfer'].includes(body.method || 'cash')) {
    throw new MockError(400, 'Method must be cash, card or bank_transfer', 'INVALID_METHOD');
  }

  const ref = String(body.studentRef).toUpperCase();
  const student = studentsFor(schoolId).find(
    (s) => s.studentId === ref || s._id === body.studentRef
  );
  if (!student) throw new MockError(404, 'Student not found', 'NOT_FOUND');

  const balance = student.balance || 0;
  if (body.amount > balance && !body.allowOverpayment) {
    throw new MockError(
      400,
      `That is more than the ${balance} pesewas outstanding. Set allowOverpayment to record a credit.`,
      'AMOUNT_EXCEEDS_BALANCE'
    );
  }

  const at = new Date().toISOString();
  const sequence = db.payments.length + 1;
  const paymentId = `MOCK-MAN-${sequence}`;

  db.payments.push({
    _id: objectId(90000 + sequence),
    paymentId,
    studentId: student._id,
    schoolId,
    amount: body.amount,
    currency: 'GHS',
    status: 'completed',
    paymentMethod: body.method || 'cash',
    provider: 'manual',
    reference: body.reference || null,
    description: body.notes || `Manual payment ó ${(body.method || 'cash').replace(/_/g, ' ')}`,
    receiptNumber: `RCP-${paymentId}`,
    initiatedAt: at,
    completedAt: at,
    // Set, so a later provider webhook is a no-op ó as on the real service.
    settlement: { appliedAt: at, reference: body.reference || null },
    createdAt: at,
    createdBy: user._id,
  });

  student.totalPaid = (student.totalPaid || 0) + body.amount;
  student.balance = (student.totalOwed || 0) - student.totalPaid;

  const school = db.schools.find((s) => s._id === schoolId);
  if (school?.stats) {
    school.stats.totalPaymentsThisMonth = (school.stats.totalPaymentsThisMonth || 0) + 1;
  }

  return {
    payment: { paymentId, amount: body.amount, status: 'completed', provider: 'manual' },
    student: {
      _id: student._id,
      studentId: student.studentId,
      studentName: student.studentName,
      totalPaid: student.totalPaid,
      balance: student.balance,
    },
  };
};

/**
 * `GET /payments` ó the dashboard's recent activity and the Payments module.
 *
 * **`__rows`, not a `payments` key.** This is the one response envelope the
 * adapter cannot infer: `listPaymentsController` puts a bare ARRAY in `data` and
 * the count in `meta`, and `services/payments.js` reads
 * `Array.isArray(data?.data) ? data.data : []`. Handing the adapter
 * `{ payments, meta }` produced `data: { payments, meta }` ó an object ó so the
 * guard fell through to `[]` and the table rendered empty next to a `meta.total`
 * that said otherwise.
 *
 * **`meta.perPage` is filled from `limit`.** `limit` is the parameter
 * `paymentsQuerySchema` validates, and `usePayments` renames the pager's
 * `perPage` to it before sending. Reading only `perPage` pinned every page size
 * to the default 20 however the bursar chose, while the pager ó which reads
 * `perPage` ó showed them their own choice back. `perPage` is still accepted as
 * a fallback, because the shared `Pagination` component uses that spelling and a
 * caller that does should not be silently given the default.
 */
const listPayments = ({ query, user }) => {
  const schoolId = resolveSchoolId(user, query?.schoolId);
  if (!schoolId) throw new MockError(400, 'A schoolId is required', 'NO_SCHOOL_SCOPE');

  const rows = sortPayments(filterPayments(query, schoolId), query);
  const perPage = Number(query?.limit ?? query?.perPage) || 20;
  const page = Number(query?.page) || 1;

  return {
    __rows: rows.slice((page - 1) * perPage, page * perPage).map(withStudent),
    meta: { page, perPage, total: rows.length, totalPages: Math.ceil(rows.length / perPage) },
  };
};

/**
 * The window the summary is measured over, and the window immediately before it.
 * `resolveSummaryPeriod` in `payment.service.js`.
 *
 * Defaults to the 1st of the current calendar month through *now*, matching
 * `monthWindow()` in `reports.service.js` so an unfiltered dashboard and the
 * monthly report cover the same dates. `endDate` defaults to now rather than to
 * the end of the month, so a payment made a minute ago is inside the window; an
 * explicit date is snapped to the end of its day, so `?endDate=2026-09-30`
 * includes the whole of the 30th. That day-snapping is the one place the summary
 * and the list legitimately differ, and it is why `filterPayments` does not do
 * it.
 *
 * The previous window is derived by *length*: it ends one millisecond before this
 * one opens and is exactly as long. "The previous calendar month" would compare
 * a part-finished month against a full one and report a collapse in income that
 * never happened. The one-millisecond gap is deliberate ó with both sides
 * inclusive, a payment landing exactly on the boundary would be counted twice.
 */
const resolveSummaryPeriod = (query, now) => {
  const start = query?.startDate
    ? startOfDay(query.startDate)
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  const end = query?.endDate ? endOfDay(query.endDate) : now;
  const span = end.getTime() - start.getTime();

  return {
    start,
    end,
    previousStart: new Date(start.getTime() - span),
    previousEnd: new Date(start.getTime() - 1),
  };
};

/**
 * `GET /payments/summary` ó the aggregates behind `PaymentKpiRow`.
 *
 * Computed over the whole filtered set, never over the visible page, for the
 * reason the client states: the list is capped at 100 rows, so a client-side sum
 * reports the first twenty payments in the school as the school's income, and
 * the figure looks entirely plausible.
 *
 * **There is deliberately no escrow, pending-sweep or next-sweep figure.** Nothing
 * in this backend banks money. `Payment.settlement.appliedAt` is the stamp that
 * says a student's *balance* was credited, not that the money reached a bank
 * account, and there is no settlement batch or sweep job anywhere in the codebase
 * to compute one from. A dashboard tile implying otherwise could only have been
 * filled with a placeholder, and a plausible-looking cedi figure on a payments
 * screen is the single most dangerous thing this module could render, because a
 * bursar reconciles against it.
 *
 * `feesCollected` is `null` for the same family of reasons: Payment has no
 * `fees` field at all, and `feesBreakdown` is a breakdown *of* the amount, so
 * summing it would restate the inflow rather than add a fee to it. A number that
 * looks like a figure and is not one is worse than an acknowledged absence.
 */
const paymentSummary = ({ query, user }) => {
  const schoolId = resolveSchoolId(user, query?.schoolId);
  if (!schoolId) throw new MockError(400, 'A schoolId is required', 'NO_SCHOOL_SCOPE');

  const { start, end, previousStart, previousEnd } = resolveSummaryPeriod(query, new Date());

  // Built through the shared filter with the *resolved* window substituted in, so
  // every other condition is inherited rather than re-derived here, then the date
  // bound is dropped again: each facet below applies its own window, and the
  // trend needs the equally long one before it, which a single date filter cannot
  // express.
  const scoped = filterPayments({ ...query, startDate: undefined, endDate: undefined }, schoolId);
  const from = start.getTime();
  const to = end.getTime();
  const inWindow = (p) => {
    const at = createdAtMs(p);
    return at >= from && at <= to;
  };
  const sum = (rows) => rows.reduce((total, p) => total + (p.amount || 0), 0);

  const completed = scoped.filter((p) => p.status === 'completed' && inWindow(p));
  const totalInflow = sum(completed);

  const previousTotalInflow = sum(
    scoped.filter((p) => {
      if (p.status !== 'completed') return false;
      const at = createdAtMs(p);
      return at >= previousStart.getTime() && at <= previousEnd.getTime();
    })
  );

  const networks = NETWORK_ORDER.map((network) => {
    const rows = completed.filter((p) => (p.momoNetwork || 'UNKNOWN') === network);
    const amount = sum(rows);
    return {
      network,
      label: NETWORK_LABELS[network],
      amount,
      count: rows.length,
      sharePercent: mockRate(amount, totalInflow),
      // A null MSISDN is collected and then dropped: every non-Mobile-Money row
      // has one, and a cash payment is not a wallet. Counted as a set rather than
      // summed across the networks, so a parent who paid by both MTN and Vodafone
      // is one wallet rather than two.
      wallets: new Set(rows.map((p) => p.momoPhoneNumber).filter(Boolean)).size,
    };
  }).sort(
    (a, b) => b.amount - a.amount || NETWORK_ORDER.indexOf(a.network) - NETWORK_ORDER.indexOf(b.network)
  );

  const byMethod = [...new Set(completed.map((p) => p.paymentMethod || 'unknown'))]
    .map((method) => {
      const rows = completed.filter((p) => (p.paymentMethod || 'unknown') === method);
      const amount = sum(rows);
      return {
        method,
        label: METHOD_LABELS[method] || method,
        amount,
        count: rows.length,
        sharePercent: mockRate(amount, totalInflow),
      };
    })
    .sort((a, b) => b.amount - a.amount);

  // `pending` and `processing` only: those are the two states waiting on a
  // gateway callback that has not arrived. A `failed` attempt is not outstanding
  // money and a `cancelled` one never was.
  const awaiting = scoped.filter((p) => inWindow(p) && (p.status === 'pending' || p.status === 'processing'));

  return {
    // ISO strings, because the real controller JSON-serialises its `Date`s and the
    // mock hands its return value straight to the client without a round trip.
    period: { startDate: start.toISOString(), endDate: end.toISOString() },
    totalInflow,
    totalTransactions: completed.length,
    previousTotalInflow,
    // `null`, not 0, when the previous window was empty: "we collected money this
    // month and there is nothing to compare it against" is a different statement
    // from "we collected nothing", and `TrendBadge` renders nothing for the first
    // rather than a confident "+0.0%".
    trendPercent: previousTotalInflow
      ? mockRound(((totalInflow - previousTotalInflow) / previousTotalInflow) * 100)
      : null,
    networks,
    // Distinct MSISDNs across the whole window, not the sum of the per-network
    // counts ó the difference is a parent who used two networks, which is exactly
    // what "wallets" is supposed to mean.
    walletCount: new Set(completed.map((p) => p.momoPhoneNumber).filter(Boolean)).size,
    awaitingConfirmation: { amount: sum(awaiting), count: awaiting.length },
    byMethod,
    feesCollected: null,
  };
};

// The CSV columns, in the order `exportPayments` declares them on the server and
// declared *up front* rather than derived from the first row, for the reason
// `exportStudents` gives: a header derived from row zero makes an export that
// matched nothing produce an empty file, which opens as one blank line and reads
// to a bursar as data loss.
const PAYMENT_EXPORT_COLUMNS = [
  { key: 'transactionRef', header: 'Transaction Ref' },
  { key: 'dateTime', header: 'Date/Time' },
  { key: 'studentId', header: 'Student ID' },
  { key: 'studentName', header: 'Student Name' },
  { key: 'studentClass', header: 'Class' },
  { key: 'guardianName', header: 'Guardian Name' },
  { key: 'guardianPhone', header: 'Guardian Phone' },
  { key: 'channel', header: 'Channel' },
  { key: 'method', header: 'Method' },
  { key: 'provider', header: 'Provider' },
  { key: 'status', header: 'Status' },
  { key: 'amountCedis', header: 'Amount (Cedis)' },
  { key: 'receiptNumber', header: 'Receipt Number' },
  { key: 'description', header: 'Description' },
];

/**
 * `streamCsv`'s two rules from the server's `csvWriter.js`, reproduced exactly:
 * prefix a cell whose first character is a formula lead-in, then quote anything
 * holding a comma, a quote or a newline.
 *
 * The `-` prefix is why a refund arrives as the text `'-50.00` rather than the
 * number -50.00. That is the shared writer doing its job and it is not worked
 * around ó the Status column carries the meaning, and the JSON list still shows
 * the raw integer. Handing the rows to `papaparse` instead would quote
 * differently and silently break both rules.
 */
const CSV_FORMULA_PREFIXES = ['=', '+', '-', '@', '\t', '\r'];
const csvCell = (value) => {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (text.length && CSV_FORMULA_PREFIXES.includes(text[0])) text = `'${text}`;
  if (/[",\n\r]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
};

/** The header line, then one line per row, then a trailing newline ó as `streamCsv` writes it. */
const toCsv = (columns, rows) =>
  [
    columns.map((column) => csvCell(column.header)).join(','),
    ...rows.map((row) => columns.map((column) => csvCell(row[column.key])).join(',')),
  ].join('\n') + '\n';

/**
 * An ISO timestamp, or an empty cell.
 *
 * Not decorative: `new Date("").toISOString()` throws, so one row with both
 * `completedAt` and `createdAt` missing would fail the whole export.
 */
const toIsoOrBlank = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
};

/**
 * `GET /payments/export` ó the filtered transactions as a CSV file.
 *
 * Same filter as the list, so "export what I am looking at" is literally the
 * rows on screen. `page`, `limit`, `sortBy` and `sortOrder` are accepted and
 * ignored on purpose: they stay in the query schema so an "export this view" link
 * can carry them without a 422, and a file that silently held only the first page
 * is the failure `paginationFor()` in `reports.service.js` exists to prevent ó a
 * bursar reconciling a partial file is reconciling the wrong thing.
 *
 * `__file` is how a mock returns a *file* rather than a JSON body; the adapter
 * turns it into the `Blob` and `Content-Disposition` header
 * `services/payments.js` reads to name and save the download.
 */
const exportPayments = ({ query, user }) => {
  const schoolId = resolveSchoolId(user, query?.schoolId);
  if (!schoolId) throw new MockError(400, 'A schoolId is required', 'NO_SCHOOL_SCOPE');

  const school = findSchool(schoolId);
  // Newest first whatever the table is sorted by ó the real service hard-codes
  // `createdAt: -1` here, so a bursar who exports from an amount-ascending table
  // gets the same file either way.
  const rows = sortPayments(filterPayments(query, schoolId), { sortOrder: 'desc' });
  const slug = school?.slug || school?.schoolCode || 'payments';

  return {
    __file: {
      filename: `payments-${slug}-${new Date().toISOString().slice(0, 10)}.csv`,
      mimeType: 'text/csv; charset=utf-8',
      body: toCsv(
        PAYMENT_EXPORT_COLUMNS,
        rows.map((payment) => {
          const student = withStudent(payment).studentId;
          const parents = (student && student.parents) || [];
          // The primary parent, falling back to the first: a record written before
          // "exactly one isPrimary" was enforced can have none, and an empty
          // guardian column is worse than a second parent's name.
          const guardian = parents.find((p) => p.isPrimary) || parents[0] || null;
          const isMomo = payment.paymentMethod === 'momo';
          return {
            transactionRef: payment.paymentId || '',
            // `completedAt` when it settled, `createdAt` otherwise. A refund and a
            // failed attempt are not "when it completed", and a reconciliation
            // file that dates them all to the moment the row was created is wrong
            // for exactly the rows a bursar most wants to find.
            dateTime: toIsoOrBlank(payment.completedAt || payment.createdAt),
            studentId: student?.studentId || '',
            studentName: student?.studentName || '',
            studentClass: student?.studentClass || '',
            // Unmasked: an export is taken off-system and reconciled against a
            // statement, so a masked number makes the file useless for the one
            // thing it is exported for.
            guardianName: guardian?.parentName || '',
            guardianPhone: guardian?.phone || '',
            // The network for a Mobile Money payment, the method for everything
            // else. A cash payment carries `momoNetwork: "UNKNOWN"` on its record,
            // and printing that would tell the bursar the network was unknown when
            // the real answer is that no network was involved. The raw method sits
            // in the next column, so the file is still filterable in a spreadsheet.
            channel: isMomo
              ? NETWORK_LABELS[payment.momoNetwork] || NETWORK_LABELS.UNKNOWN
              : METHOD_LABELS[payment.paymentMethod] || payment.paymentMethod || '',
            method: payment.paymentMethod || '',
            provider: payment.provider || '',
            status: payment.status || '',
            // Cedis, named in the header. The stored integer is pesewas (85000 =
            // GH? 850.00), and a header that said `amount` over a pesewa count
            // gets read as a hundred-fold error by anyone who opens the file.
            amountCedis: ((payment.amount || 0) / 100).toFixed(2),
            receiptNumber: payment.receiptNumber || '',
            description: payment.description || '',
          };
        })
      ),
    },
  };
};

/**
 * `GET /payments/:paymentId` ó one payment in full.
 *
 * Both references are populated, because that is what the drawer reads: the
 * student's name, class and guardians, and the school's name and code. The list's
 * projection is deliberately thinner ó `hubtelTransactionId`, `feesBreakdown` and
 * the provider reference are not on it ó so a drawer built from the row it was
 * opened from would show blanks in exactly the fields a bursar opens it to check.
 * That is the whole reason this is a second request.
 *
 * `includeWebhookData` is not honoured: the mock has no `webhookPayload` to
 * withhold, so the flag has nothing to strip. It is passed by `getPayment` only
 * when a caller explicitly asks for it, and the drawer never does.
 */
const getPaymentDetail = ({ params, query, user }) => {
  const schoolId = resolveSchoolId(user, query?.schoolId);
  if (!schoolId) throw new MockError(400, 'A schoolId is required', 'NO_SCHOOL_SCOPE');

  const payment = findPaymentFor(params.paymentId, schoolId);
  if (!payment) throw new MockError(404, 'Payment not found', 'NOT_FOUND');

  const student = getDb().students.find((s) => s._id === payment.studentId);
  const school = findSchool(payment.schoolId);

  return {
    ...payment,
    studentId: student
      ? {
          studentId: student.studentId,
          studentName: student.studentName,
          studentClass: student.studentClass,
          schoolId: student.schoolId,
          parents: student.parents || [],
        }
      : payment.studentId,
    schoolId: school
      ? { _id: school._id, name: school.name, schoolCode: school.schoolCode }
      : payment.schoolId,
  };
};

/**
 * `GET /payments/:paymentId/receipt` ó the receipt document, as JSON.
 *
 * Not a file. `generateReceipt` builds the document and its number and returns
 * it, and `ReceiptDialog` renders it and hands `window.print()` the PDF ó the
 * endpoint itself never produces one. An earlier mock route claimed receipts
 * were a PDF, which was false in both modes and hid the fact that nothing here
 * was mocking the real response.
 *
 * **The number is minted when the payment has none, and written back onto the
 * row**, exactly as `generateReceipt` does through its `findByIdAndUpdate`. That
 * is what makes the print flow work for a payment taken before receipts existed:
 * the dialog's title, the printed header and the row's own `receiptNumber` all
 * read this field, and a handler that returned a freshly computed number without
 * storing it would hand the bursar a different receipt every time they opened it.
 */
const getPaymentReceipt = ({ params, query, user }) => {
  const schoolId = resolveSchoolId(user, query?.schoolId);
  if (!schoolId) throw new MockError(400, 'A schoolId is required', 'NO_SCHOOL_SCOPE');

  const payment = findPaymentFor(params.paymentId, schoolId);
  if (!payment) throw new MockError(404, 'Payment not found', 'NOT_FOUND');
  if (payment.status !== 'completed') {
    throw new MockError(
      400,
      'Can only generate receipt for completed payments',
      'INVALID_PAYMENT_STATUS'
    );
  }

  if (!payment.receiptNumber) {
    const now = new Date();
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(now);
    dayEnd.setHours(23, 59, 59, 999);
    // Counts the school's completed payments from today, *including this one* ó
    // it is already stored, exactly as `countDocuments` sees it. Hence +1.
    const today = getDb().payments.filter(
      (p) =>
        p.schoolId === schoolId &&
        p.status === 'completed' &&
        createdAtMs(p) >= dayStart.getTime() &&
        createdAtMs(p) <= dayEnd.getTime()
    ).length;
    payment.receiptNumber = `RCP-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${String(today + 1).padStart(4, '0')}`;
    payment.receiptGeneratedAt = now.toISOString();
  }

  const student = getDb().students.find((s) => s._id === payment.studentId);
  const school = findSchool(payment.schoolId);

  return {
    receipt: {
      receiptNumber: payment.receiptNumber,
      paymentId: payment.paymentId,
      date: payment.completedAt,
      student: {
        studentId: student?.studentId,
        studentName: student?.studentName,
        studentClass: student?.studentClass,
      },
      school: {
        name: school?.name,
        schoolCode: school?.schoolCode,
        address: school?.address,
        city: school?.city,
        region: school?.region,
      },
      amount: payment.amount,
      currency: payment.currency,
      paymentMethod: payment.paymentMethod,
      description: payment.description,
      feesBreakdown: payment.feesBreakdown,
    },
  };
};

/**
 * `POST /payments/:paymentId/refund` ó reverse a payment against a balance.
 *
 * The reversal is a **new** payment row with a negative amount, never an edit of
 * the original. The ledger stays additive, so a full refund shows the original
 * beside the row that cancelled it and neither overwrites the evidence of what
 * was taken ó which is also why `TransactionTable` renders a negative amount in
 * red instead of hiding it.
 *
 * The original is only marked `refunded` when the reversal covers all of it. A
 * partial one leaves it `completed`, because "this payment was refunded" and
 * "part of this payment was refunded" are different facts, and the second is
 * carried by the negative row rather than smeared over the first.
 *
 * The student's `totalPaid` and `balance` move in the same step, for the reason
 * `recordManualPayment` above moves them together: a mock that reversed the
 * payment and left the balance alone would show the feature working while the
 * roster, the KPI band and every report kept the old figure.
 */
const refundPayment = ({ params, body, user }) => {
  const schoolId = resolveSchoolId(user, body?.schoolId);
  if (!schoolId) throw new MockError(400, 'A schoolId is required', 'NO_SCHOOL_SCOPE');

  const payment = findPaymentFor(params.paymentId, schoolId);
  if (!payment) throw new MockError(404, 'Payment not found', 'NOT_FOUND');
  if (payment.status !== 'completed') {
    throw new MockError(400, 'Can only refund completed payments', 'INVALID_PAYMENT_STATUS');
  }

  // The reason is required and is the only part of the reversal a bursar cannot
  // reconstruct later: it is the whole of what the activity log records. A refund
  // with no reason is a balance change nobody can audit.
  const reason = String(body?.reason || '').trim();
  if (!reason) throw new MockError(400, 'A reason is required', 'VALIDATION_ERROR');

  // Omitted means "all of it", which is the right default for a mis-keyed row and
  // exactly why `RefundPaymentDialog` pre-fills the full amount and spells the
  // consequence out in the confirm button rather than leaving it implied.
  const amount = body?.amount === undefined || body?.amount === null ? payment.amount : body.amount;
  if (!Number.isInteger(amount) || amount < 1) {
    throw new MockError(400, 'Amount must be a positive whole number of pesewas', 'INVALID_REFUND_AMOUNT');
  }
  if (amount > payment.amount) {
    throw new MockError(400, 'Refund amount cannot exceed payment amount', 'INVALID_REFUND_AMOUNT');
  }

  const db = getDb();
  const at = new Date().toISOString();
  const sequence = db.payments.length + 1;
  const refund = {
    _id: objectId(95000 + sequence),
    // The model's pre-save hook mints `PAY-<date>-<6 chars>`; this is the same
    // shape with a counter in the random slot, so it is visibly a mock id and
    // still unique.
    paymentId: `PAY-${at.slice(0, 10).replace(/-/g, '')}-MOCK${String(sequence).padStart(4, '0')}`,
    studentId: payment.studentId,
    schoolId: payment.schoolId,
    parentId: payment.parentId ?? null,
    amount: -amount,
    currency: payment.currency || 'GHS',
    status: 'completed',
    paymentMethod: payment.paymentMethod,
    provider: payment.provider,
    momoNetwork: payment.momoNetwork,
    momoPhoneNumber: payment.momoPhoneNumber ?? null,
    description: `Refund: ${reason}`,
    // No `receiptNumber`: the receipt route above mints one on demand, which is
    // the same path a real refund row takes.
    initiatedAt: at,
    completedAt: at,
    settlement: { appliedAt: at, reference: payment.settlement?.reference ?? null },
    createdAt: at,
    createdBy: user?._id,
  };
  db.payments.push(refund);

  const isFullRefund = amount === payment.amount;
  payment.status = isFullRefund ? 'refunded' : 'completed';
  if (isFullRefund) payment.refundedAt = at;

  const student = db.students.find((s) => s._id === payment.studentId);
  if (student) {
    student.totalPaid = (student.totalPaid || 0) - amount;
    student.balance = (student.balance || 0) + amount;
  }

  const school = db.schools.find((s) => s._id === payment.schoolId);
  if (school?.stats) {
    // Faithfully odd, and worth spelling out: the real service runs the same
    // `$inc`, subtracting a *pesewa amount* from a field that
    // `recordManualPayment` increments by **1** as a count. One refund therefore
    // drives this school's "payments this month" thousands below zero. Mirrored
    // rather than quietly corrected, because a mock that quietly corrected it
    // would hide a real bug in the one place the two numbers get compared.
    school.stats.totalPaymentsThisMonth = (school.stats.totalPaymentsThisMonth || 0) - amount;
  }

  return { originalPayment: payment, refundPayment: refund };
};

/**
 * The roster aggregates behind the Students module KPI band.
 *
 * Mirrors `getStudentStats` on the server: one pass over the school's students,
 * because the real endpoint exists precisely so the client never derives these
 * by summing a page of twenty rows out of a thousand.
 */
const studentStats = ({ query, user }) => {
  const schoolId = resolveSchoolId(user, query?.schoolId);
  if (!schoolId) throw new MockError(400, 'A schoolId is required', 'NO_SCHOOL_SCOPE');

  let rows = studentsFor(schoolId);
  if (query?.class) rows = rows.filter((s) => s.studentClass === query.class);
  if (query?.status && query.status !== 'all') rows = rows.filter((s) => s.status === query.status);

  const now = Date.now();
  const cleared = rows.filter((s) => (s.balance || 0) <= 0);
  const overdue = rows.filter(
    (s) => (s.balance || 0) > 0 && s.deadline && new Date(s.deadline).getTime() < now
  );
  const withPlan = rows.filter((s) => s.planStatus && s.planStatus !== 'none');
  const sum = (list, key) => list.reduce((total, s) => total + (s[key] || 0), 0);

  return {
    totalRoster: rows.length,
    fullyCleared: cleared.length,
    clearedPercent: rows.length ? Math.round((cleared.length / rows.length) * 1000) / 10 : 0,
    activePlans: withPlan.length,
    activePlanStudents: withPlan.length,
    overdueStudents: overdue.length,
    overdueAmount: sum(overdue, 'balance'),
    totalOwed: sum(rows, 'totalOwed'),
    totalPaid: sum(rows, 'totalPaid'),
    outstanding: sum(rows.filter((s) => (s.balance || 0) > 0), 'balance'),
  };
};
/** One student plus the aggregate the profile drawer renders. */
const studentProfile = ({ params, query, user }) => {
  const schoolId = resolveSchoolId(user, query?.schoolId);
  if (!schoolId) throw new MockError(400, 'A schoolId is required', 'NO_SCHOOL_SCOPE');

  const student = studentsFor(schoolId).find(
    (s) => s._id === params.id || s.studentId === params.id
  );
  if (!student) throw new MockError(404, 'Student not found', 'NOT_FOUND');

  return {
    student,
    guardians: student.parents || [],
    emergencyContacts: student.emergencyContacts || [],
    plans: [],
    activePlan: null,
    installmentProgress: null,
    recentPayments: db.payments.filter((p) => p.studentId === student._id).slice(-20).reverse(),
    classHistory: student.classHistory || [],
    auditTrail: [],
  };
};

/**
 * A dry run of the bulk endpoints: report what would change, write nothing.
 *
 * The mock honours `dryRun` because the real endpoints do, and the whole point
 * of the preview is that a developer can see the dialog state without a
 * backend.
 */
const bulkDryRun = ({ body }) => {
  const matched = body?.ids?.length || 0;
  // Returned bare, not nested: the adapter sets `data` to the handler's object,
  // so a `{ data: Ö }` return would arrive as `data.data` and read as undefined.
  return {
    committed: false,
    matched,
    updated: 0,
    changed: 0,
    archived: 0,
    regenerated: 0,
    failed: 0,
    errors: [],
    preview: [],
  };
};

const validateStudentPayload = (payload, school) => {
  const errors = [];
  if (!payload.studentName || String(payload.studentName).trim().length < 2) errors.push('"studentName" is required');
  if (!payload.studentClass || String(payload.studentClass).trim().length < 2) errors.push('"studentClass" is required');
  if (!['male', 'female'].includes(payload.gender)) errors.push('"gender" must be one of [male, female]');
  if (!Number.isInteger(payload.totalOwed) || payload.totalOwed < 0) {
    errors.push('"totalOwed" must be a positive integer');
  }
  if (!payload.deadline) errors.push('"deadline" is required');
  else if (new Date(payload.deadline) < new Date(new Date().toDateString())) {
    errors.push('"deadline" must be greater than or equal to the current date');
  }
  if (!Array.isArray(payload.parents) || payload.parents.length < 1) {
    errors.push('"parents" must contain at least 1 items');
  } else {
    const primary = payload.parents.find((p) => p.isPrimary) || payload.parents[0];
    if (!primary.parentName) errors.push('"parents[0].parentName" is required');
    if (!primary.phone) errors.push('"parents[0].phone" is required');
    else if (!GHANA_PHONE.test(String(primary.phone))) {
      errors.push('Invalid Ghana phone number format. Use format: 024xxxxxxx or 23324xxxxxxx');
    }
  }
  if (school && payload.studentClass && !school.academic.classes.includes(payload.studentClass)) {
    errors.push(`Student class '${payload.studentClass}' is not defined for this school`);
  }
  return errors;
};

const createStudent = ({ body, user }) => {
  const db = getDb();
  const schoolId = resolveSchoolId(user, body?.schoolId);
  if (!schoolId) throw new MockError(403, 'No school in scope', 'NO_SCHOOL_SCOPE');
  const school = findSchool(schoolId);

  const errors = validateStudentPayload(body || {}, school);
  if (errors.length) throw new MockError(422, errors[0], 'VALIDATION_ERROR', { errors });

  const rng = makeRng(db.students.length + 7);
  const student = {
    _id: objectId(Date.now() % 999979 + db.students.length),
    studentId: `SK-${String(1000 + db.students.length).padStart(4, '0')}`,
    studentName: String(body.studentName).trim(),
    studentClass: String(body.studentClass).trim(),
    gender: body.gender,
    studentImage: null,
    schoolId,
    status: 'active',
    totalOwed: body.totalOwed,
    totalPaid: 0,
    balance: body.totalOwed,
    deadline: body.deadline,
    academicYear: body.academicYear || school.academic.currentYear,
    parents: body.parents,
    emergencyContacts: body.emergencyContacts || [],
    uniquePayLinkToken: token(rng, 7),
    payLink: `https://sukuupay.com/pay/${token(rng, 7)}`,
    term: school.academic.currentTerm,
    isAlumni: false,
    createdAt: new Date().toISOString(),
  };
  db.students.push(student);
  school.stats.totalStudents += 1;
  return student;
};

/** `POST /students/bulk` ó mirrors `bulkCreateStudents`, row by row. */
const bulkImport = async ({ data, user }) => {
  const scenario = getScenarioId();
  const file = data instanceof FormData ? data.get('file') : null;
  if (!file) throw new MockError(400, 'No file uploaded', 'NO_FILE');
  if (file.size > 10 * 1024 * 1024) {
    throw new MockError(400, 'File size exceeds the 10MB limit', 'FILE_TOO_LARGE');
  }

  const meta = data instanceof FormData ? Object.fromEntries(data.entries()) : {};
  const db = getDb();
  const schoolId = resolveSchoolId(user, meta.schoolId);
  if (!schoolId) throw new MockError(403, 'No school in scope', 'NO_SCHOOL_SCOPE');
  const school = findSchool(schoolId);

  if (scenario === 'import-reject-all') {
    throw new MockError(422, 'The uploaded file has no recognisable header row', 'INVALID_IMPORT_FILE');
  }

  const name = file.name || 'roster.csv';
  let rows = [];
  let format = 'csv';
  if (/\.xlsx?$/i.test(name)) {
    format = 'xlsx';
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(sheet, { raw: false, defval: '' });
  } else {
    const text = await file.text();
    rows = Papa.parse(text, { header: true, skipEmptyLines: true }).data;
  }

  if (!rows.length) {
    throw new MockError(422, 'The uploaded file contains no student rows', 'EMPTY_IMPORT_FILE');
  }

  // The 5,000 ceiling the frontend warns about. The mock truncates rather than
  // erroring, so the warning's claim ("only the first 5,000 will be imported")
  // is actually true.
  if (rows.length > 5000) rows = rows.slice(0, 5000);

  const errors = [];
  const docs = [];
  const acceptAll = scenario === 'import-all-valid';

  rows.forEach((raw, index) => {
    // Row 1 is the header, so data rows start at 2 ó the numbering the real
    // importer uses and that the error list on Step 3 shows.
    const rowNum = index + 2;
    const row = Object.fromEntries(
      Object.entries(raw || {}).map(([k, v]) => [String(k).toLowerCase().replace(/[^a-z0-9]/g, ''), v])
    );

    if (!acceptAll) {
      if (!row.parentname) { errors.push({ row: rowNum, reason: 'Missing parentName' }); return; }
      if (!row.parentphone) { errors.push({ row: rowNum, reason: 'Missing parentPhone' }); return; }
      if (!GHANA_PHONE.test(String(row.parentphone).replace(/[\s-]/g, ''))) {
        errors.push({ row: rowNum, reason: 'Invalid Ghana phone number format. Use format: 024xxxxxxx or 23324xxxxxxx' });
        return;
      }
    }
    if (!row.studentname) { errors.push({ row: rowNum, reason: '"studentName" is required' }); return; }
    if (!row.studentclass) { errors.push({ row: rowNum, reason: '"studentClass" is required' }); return; }

    const gender = String(row.gender || '').toLowerCase();
    if (gender && !['male', 'female'].includes(gender)) {
      errors.push({ row: rowNum, reason: '"gender" must be one of [male, female]' });
      return;
    }
    if (!school.academic.classes.includes(String(row.studentclass).trim())) {
      errors.push({ row: rowNum, reason: `Student class '${row.studentclass}' is not defined for this school` });
      return;
    }

    // Cedis in the file, pesewas on the wire ó the conversion the real
    // importer does, and a classic source of 100x errors if it is missed.
    const totalOwed = row.totalowed
      ? Math.round(Number(String(row.totalowed).replace(/,/g, '')) * 100)
      : meta.defaultowed
        ? Math.round(Number(meta.defaultowed) * 100)
        : 0;

    const deadline = row.deadline || meta.defaultdeadline;
    if (!deadline) { errors.push({ row: rowNum, reason: 'Missing deadline' }); return; }
    if (new Date(deadline) < new Date(new Date().toDateString())) {
      errors.push({ row: rowNum, reason: '"deadline" must be greater than or equal to the current date' });
      return;
    }

    docs.push({
      _id: objectId(Date.now() % 999961 + index),
      studentId: `SK-${String(9000 + index).padStart(4, '0')}`,
      studentName: String(row.studentname).trim(),
      studentClass: String(row.studentclass).trim(),
      gender: gender || 'male',
      studentImage: null,
      schoolId,
      status: 'active',
      totalOwed,
      totalPaid: 0,
      balance: totalOwed,
      deadline,
      academicYear: meta.academicyear || school.academic.currentYear,
      parents: [
        {
          parentName: String(row.parentname || '').trim(),
          relationship: row.parentrelationship || 'guardian',
          phone: String(row.parentphone || '').replace(/[\s-]/g, ''),
          email: row.parentemail || null,
          isPrimary: true,
          isAlive: true,
        },
      ],
      emergencyContacts: [],
      uniquePayLinkToken: token(makeRng(index + 3), 7),
      payLink: `https://sukuupay.com/pay/${token(makeRng(index + 11), 7)}`,
      term: school.academic.currentTerm,
      isAlumni: false,
      createdAt: new Date().toISOString(),
    });
  });

  db.students.push(...docs);
  school.stats.totalStudents += docs.length;

  return { created: docs.length, failed: errors.length, errors, format };
};

// -- Installment plans ------------------------------------------------------

/**
 * The compliance classifier, mirrored from
 * `classifyPlan` in `Backend/src/services/paymentPlan.service.js`.
 *
 * The order is load-bearing and is the whole definition: `overdue` beats
 * `approaching`, and both are decided *before* `on_track`. A plan with one
 * slipped tranche and another due tomorrow is in default, not approaching ó a
 * school that chases it as "approaching" has told a family in arrears that it is
 * merely early.
 */
const COMPLIANCE_WINDOW_DAYS = 3;
const LIVE_PLAN_STATUSES = ['active', 'pending_acceptance'];

const mockOutstanding = (plan) =>
  (plan.installments || []).reduce(
    (sum, i) => sum + Math.max((i.amount || 0) - (i.amountPaid || 0), 0),
    0
  );

const mockArrears = (plan) => {
  const now = Date.now();
  return (plan.installments || []).reduce((sum, i) => {
    if (!['pending', 'partial', 'overdue'].includes(i.status)) return sum;
    if (new Date(i.dueDate).getTime() > now) return sum;
    return sum + Math.max((i.amount || 0) - (i.amountPaid || 0), 0);
  }, 0);
};

const mockNextUnsettled = (plan) =>
  (plan.installments || []).find(
    (i) => !['paid', 'waived'].includes(i.status) && i.amount > i.amountPaid
  ) || null;

const mockClassifyPlan = (plan) => {
  if (plan.planStatus === 'completed') return 'completed';
  if (plan.planStatus === 'defaulted') return 'defaulted';
  if (['cancelled', 'expired'].includes(plan.planStatus)) return null;
  if (plan.planStatus === 'pending_acceptance') return 'pending_acceptance';

  if ((plan.installments || []).some((i) => i.status === 'overdue')) return 'overdue';

  const next = mockNextUnsettled(plan);
  if (next) {
    const horizon = Date.now() + COMPLIANCE_WINDOW_DAYS * 86400000;
    if (new Date(next.dueDate).getTime() <= horizon) return 'approaching_due';
  }
  return 'on_track';
};

/**
 * The `summary` keys for the three in-flight buckets.
 *
 * Deliberately *not* the classifier's return values. `classifyPlan` answers
 * `on_track` / `approaching_due`; the summary counts them under `onTrack` /
 * `approachingDue`. Summing the first vocabulary into a summary keyed by the
 * second yields three `undefined`s, and this is exactly the bug the mockcheck
 * caught in the service before it shipped: `activePlans: 0` with a
 * `complianceRate` of `null`, so every tile on the dashboard read "ó".
 */
const ACTIVE_SUMMARY_KEYS = ['onTrack', 'approachingDue', 'overdue'];

const getSchoolComplianceHandler = ({ params, query, user }) => {
  const schoolId = resolveSchoolId(user, params.schoolId);
  if (!schoolId) throw new MockError(403, 'No school in scope', 'NO_SCHOOL_SCOPE');
  const school = findSchool(schoolId);
  if (!school) throw new MockError(404, 'School not found', 'SCHOOL_NOT_FOUND');

  const db = getDb();
  let plans = (db.paymentPlans || []).filter((p) => p.schoolId === schoolId && !p.deletedAt);
  const students = studentsFor(schoolId);
  const studentById = new Map(students.map((s) => [s._id, s]));

  if (query.class) {
    plans = plans.filter((plan) => studentById.get(plan.studentId)?.studentClass === query.class);
  }
  if (query.term) {
    plans = plans.filter((plan) => plan.term === query.term);
  }
  if (query.search) {
    const needle = String(query.search).toLowerCase();
    plans = plans.filter((plan) => {
      const student = studentById.get(plan.studentId);
      if (!student) return false;
      const parent = student.parents.find((p) => p.isPrimary) || student.parents[0];
      return (
        student.studentName.toLowerCase().includes(needle) ||
        String(student.studentId).toLowerCase().includes(needle) ||
        String(parent?.parentName || '').toLowerCase().includes(needle)
      );
    });
  }

  // -- Summary, over the whole filtered set, not the page --
  const summary = {
    totalPlans: plans.length,
    onTrack: 0,
    approachingDue: 0,
    overdue: 0,
    completed: 0,
    defaulted: 0,
    pendingAcceptance: 0,
    onTrackValue: 0,
    approachingDueValue: 0,
    overdueValue: 0,
    committedAmount: 0,
    overdueArrears: 0,
    approachingInflow: 0,
  };

  const decorated = plans.map((plan) => {
    const bucket = mockClassifyPlan(plan);
    if (bucket === 'on_track') summary.onTrack += 1;
    else if (bucket === 'approaching_due') summary.approachingDue += 1;
    else if (bucket === 'overdue') summary.overdue += 1;
    else if (bucket === 'completed') summary.completed += 1;
    else if (bucket === 'defaulted') summary.defaulted += 1;
    else if (bucket === 'pending_acceptance') summary.pendingAcceptance += 1;

    const next = mockNextUnsettled(plan);
    const nextView = next
      ? {
          installmentNumber: next.installmentNumber,
          amount: next.amount,
          amountPaid: next.amountPaid,
          dueDate: next.dueDate,
          status: next.status,
          outstanding: next.amount - (next.amountPaid || 0),
        }
      : null;

    if (ACTIVE_SUMMARY_KEYS.includes(
      bucket === 'on_track' ? 'onTrack' : bucket === 'approaching_due' ? 'approachingDue' : bucket
    )) {
      const outstanding = mockOutstanding(plan);
      summary.committedAmount += outstanding;
      if (bucket === 'on_track') summary.onTrackValue += outstanding;
      else if (bucket === 'approaching_due') {
        summary.approachingDueValue += outstanding;
        summary.approachingInflow += nextView ? nextView.outstanding : 0;
      } else {
        summary.overdueValue += outstanding;
        summary.overdueArrears += mockArrears(plan);
      }
    }

    return { ...plan, complianceStatus: bucket, nextInstallment: nextView, outstandingAmount: mockOutstanding(plan) };
  });

  const filtered =
    query.status && query.status !== 'all'
      ? decorated.filter((plan) => plan.complianceStatus === query.status)
      : decorated;

  const direction = query.sortOrder === 'desc' ? -1 : 1;
  const sortBy = query.sortBy || 'endDate';
  filtered.sort((a, b) => {
    const left = a[sortBy] ?? 0;
    const right = b[sortBy] ?? 0;
    if (left === right) return 0;
    return (left > right ? 1 : -1) * direction;
  });

  const page = Number(query.page) || 1;
  const perPage = Number(query.perPage) || 20;
  const pagePlans = filtered.slice((page - 1) * perPage, page * perPage);

  summary.activePlans = ACTIVE_SUMMARY_KEYS.reduce((sum, key) => sum + summary[key], 0);
  summary.complianceRate = summary.activePlans
    ? Math.round((summary.onTrack / summary.activePlans) * 1000) / 10
    : null;
  summary.atRiskPlans = summary.overdue + summary.approachingDue;

  return {
    summary,
    plans: pagePlans.map((plan) => {
      const student = studentById.get(plan.studentId);
      const parent = student?.parents.find((p) => p.isPrimary) || student?.parents[0];
      return {
        ...plan,
        acceptanceToken: undefined,
        student: student
          ? {
              _id: student._id,
              studentId: student.studentId,
              studentName: student.studentName,
              studentClass: student.studentClass,
              balance: student.balance,
              parentName: parent?.parentName || null,
            }
          : null,
      };
    }),
    meta: {
      page,
      perPage,
      total: filtered.length,
      totalPages: Math.max(1, Math.ceil(filtered.length / perPage)),
    },
  };
};

const getStudentPlanHandler = ({ params, user }) => {
  const schoolId = resolveSchoolId(user);
  if (schoolId) assertMockSchoolAccess(user, schoolId);

  const db = getDb();
  const student = studentsFor(schoolId).find((s) => s._id === params.studentId);
  if (!student) throw new MockError(404, 'Student not found', 'STUDENT_NOT_FOUND');

  const plans = (db.paymentPlans || []).filter(
    (p) => p.studentId === params.studentId && !p.deletedAt
  );
  const plan =
    plans
      .filter((p) => LIVE_PLAN_STATUSES.includes(p.planStatus))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] ||
    plans.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];

  if (!plan) throw new MockError(404, 'No payment plan found', 'PLAN_NOT_FOUND');

  return {
    plan: { ...plan, acceptanceToken: undefined },
    student: {
      _id: student._id,
      studentId: student.studentId,
      studentName: student.studentName,
      studentClass: student.studentClass,
      status: student.status,
      totalOwed: student.totalOwed,
      totalPaid: student.totalPaid,
      balance: student.balance,
      parents: student.parents,
      schoolId: student.schoolId,
    },
  };
};

/**
 * `POST /payment-plans/create/:studentId`.
 *
 * Builds the schedule with the same `splitAmount` + `addInterval` maths the
 * service uses, because the create screen previews it client-side and the two
 * must not disagree. The mockcheck assertion "the client and the server agree on
 * the schedule" is what fails loudly if they drift.
 */
const createPaymentPlanHandler = ({ params, body, user }) => {
  const schoolId = resolveSchoolId(user, body.schoolId);
  if (!schoolId) throw new MockError(403, 'No school in scope', 'NO_SCHOOL_SCOPE');
  const school = findSchool(schoolId);

  const student = studentsFor(schoolId).find((s) => s._id === params.studentId);
  if (!student) throw new MockError(404, 'Student not found', 'STUDENT_NOT_FOUND');
  if (student.status !== 'active') {
    throw new MockError(400, 'A payment plan can only be created for an active student', 'STUDENT_NOT_ACTIVE');
  }
  if (!student.balance) {
    throw new MockError(400, 'Student has no outstanding balance to plan for', 'NO_OUTSTANDING_BALANCE');
  }

  const db = getDb();
  const existing = (db.paymentPlans || []).find(
    (p) => p.studentId === student._id && LIVE_PLAN_STATUSES.includes(p.planStatus) && !p.deletedAt
  );
  if (existing) {
    throw new MockError(
      409,
      `Student already has a ${existing.planStatus} payment plan (${existing.planName})`,
      'PLAN_ALREADY_EXISTS'
    );
  }

  const count = Number(body.numberOfInstallments);
  if (!Number.isInteger(count) || count < 2 || count > 6) {
    throw new MockError(422, '"numberOfInstallments" must be between 2 and 6', 'VALIDATION_ERROR');
  }
  const start = new Date(`${body.startDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime())) {
    throw new MockError(422, '"startDate" is required', 'VALIDATION_ERROR');
  }
  if (start.getTime() < new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z').getTime()) {
    throw new MockError(422, 'Date cannot be in the past', 'VALIDATION_ERROR');
  }

  const interval = body.interval || 'monthly';
  const base = Math.floor(student.balance / count);
  const amounts = Array.from({ length: count }, () => base);
  amounts[count - 1] = student.balance - base * (count - 1);

  const plan = {
    _id: objectId((db.paymentPlans?.length || 0) + 1),
    studentId: student._id,
    schoolId,
    planName: body.planName || 'Custom Plan',
    totalAmount: student.balance,
    numberOfInstallments: count,
    interval,
    installments: amounts.map((amount, index) => ({
      installmentNumber: index + 1,
      amount,
      dueDate: mockAddInterval(start, interval, index).toISOString(),
      status: 'pending',
      amountPaid: 0,
      paidAt: null,
      paymentIds: [],
      reminderSentAt: null,
      overdueNotifiedAt: null,
      notes: '',
    })),
    planStatus: 'pending_acceptance',
    acceptanceToken: 'ACCEPT',
    startDate: start.toISOString(),
    endDate: mockAddInterval(start, interval, count - 1).toISOString(),
    adminNotes: body.adminNotes || '',
    term: school.academic?.currentTerm || '',
    academicYear: school.academic?.currentYear || '',
    installmentsPaid: 0,
    installmentsRemaining: count,
    amountPaid: 0,
    totalRemaining: student.balance,
    progressPercent: 0,
    acceptedAt: null,
    acceptedVia: null,
    cancelledAt: null,
    cancellationReason: '',
    deletedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.paymentPlans = db.paymentPlans || [];
  db.paymentPlans.push(plan);

  // `__raw` + `meta`, reproducing `createPaymentPlanController`'s exact shape: the
  // plan in `data`, the parent-notification result in `meta`. The create screen
  // reads `meta.sms` to say whether a family was actually told about the plan, and
  // a payload that flattened both into `data` would hand it a plan object
  // containing a plan object.
  return { __raw: { ...plan, acceptanceToken: undefined }, meta: { sms: { sent: true, reason: null } } };
};

const updatePaymentPlanHandler = ({ params, body, user }) => {
  const schoolId = resolveSchoolId(user);
  const plan = findMockPlan(params.planId, schoolId);

  if (
    plan.planStatus !== 'pending_acceptance' &&
    !(plan.planStatus === 'active' && (plan.installmentsPaid || 0) === 0)
  ) {
    throw new MockError(
      400,
      'A plan can only be edited while it is awaiting acceptance or while it is active with no installments paid. Cancel it and create a new one instead.',
      'PLAN_NOT_EDITABLE'
    );
  }

  if (body.planName !== undefined) plan.planName = body.planName;
  if (body.adminNotes !== undefined) plan.adminNotes = body.adminNotes || '';
  if (body.interval !== undefined) plan.interval = body.interval;

  if (body.installments) {
    const sum = body.installments.reduce((total, i) => total + i.amount, 0);
    if (sum !== plan.totalAmount) {
      throw new MockError(400, 'Installment amounts must sum to the plan total amount', 'INVALID_INSTALLMENT_SPLIT');
    }
    body.installments.forEach((entry) => {
      const target = plan.installments.find((i) => i.installmentNumber === entry.installmentNumber);
      if (!target) return;
      target.amount = entry.amount;
      if (entry.notes !== undefined) target.notes = entry.notes || '';
    });
  }

  recomputeMockPlan(plan);
  return { ...plan, acceptanceToken: undefined };
};

const cancelPaymentPlanHandler = ({ params, body, user }) => {
  const schoolId = resolveSchoolId(user);
  const plan = findMockPlan(params.planId, schoolId);

  if (!LIVE_PLAN_STATUSES.includes(plan.planStatus)) {
    throw new MockError(400, `A ${plan.planStatus} plan cannot be cancelled`, 'PLAN_NOT_CANCELLABLE');
  }

  plan.planStatus = 'cancelled';
  plan.cancelledAt = new Date().toISOString();
  plan.cancellationReason = body?.reason || '';
  plan.deletedAt = new Date().toISOString();
  return { ...plan, acceptanceToken: undefined };
};

const updateInstallmentHandler = ({ params, body, user }) => {
  const schoolId = resolveSchoolId(user);
  const plan = findMockPlan(params.planId, schoolId);

  if (['cancelled', 'expired', 'completed'].includes(plan.planStatus)) {
    throw new MockError(400, `Installments cannot be changed on a ${plan.planStatus} plan`, 'PLAN_NOT_EDITABLE');
  }

  const num = Number(params.num);
  const installment = plan.installments.find((i) => i.installmentNumber === num);
  if (!installment) throw new MockError(404, 'Installment not found', 'INSTALLMENT_NOT_FOUND');

  switch (body.action) {
    case 'mark_paid':
      installment.status = 'paid';
      installment.amountPaid = body.amount ?? installment.amount;
      installment.paidAt = new Date().toISOString();
      break;
    case 'mark_unpaid':
      installment.status =
        new Date(installment.dueDate).getTime() < Date.now() ? 'overdue' : 'pending';
      installment.amountPaid = 0;
      installment.paidAt = null;
      break;
    case 'adjust_amount':
      if (!body.amount) {
        throw new MockError(400, 'amount is required for the adjust_amount action', 'VALIDATION_ERROR');
      }
      if (body.amount < installment.amountPaid) {
        throw new MockError(400, 'Installment amount cannot be lower than the amount already paid', 'INVALID_AMOUNT');
      }
      installment.amount = body.amount;
      break;
    case 'waive':
      installment.status = 'waived';
      installment.amountPaid = installment.amount;
      break;
    default:
      throw new MockError(400, 'Unsupported installment action', 'INVALID_ACTION');
  }

  if (body.notes !== undefined) installment.notes = body.notes || '';
  recomputeMockPlan(plan);
  return { ...plan, acceptanceToken: undefined };
};

const findMockPlan = (planId, schoolId) => {
  const plan = (getDb().paymentPlans || []).find(
    (p) => p._id === planId && (!schoolId || p.schoolId === schoolId)
  );
  if (!plan) throw new MockError(404, 'Payment plan not found', 'PLAN_NOT_FOUND');
  return plan;
};

/** The model pre-save hook's arithmetic, so the mock's derived fields stay true. */
const recomputeMockPlan = (plan) => {
  const installments = plan.installments || [];
  plan.installmentsPaid = installments.filter((i) => i.status === 'paid' || i.status === 'waived').length;
  plan.installmentsRemaining = installments.length - plan.installmentsPaid;
  plan.amountPaid = installments.reduce((sum, i) => sum + (i.amountPaid || 0), 0);
  plan.totalRemaining = Math.max(plan.totalAmount - plan.amountPaid, 0);
  plan.progressPercent = installments.length
    ? Math.round((plan.installmentsPaid / installments.length) * 100)
    : 0;
  if (plan.installmentsPaid >= installments.length) plan.planStatus = 'completed';
  plan.updatedAt = new Date().toISOString();
  return plan;
};

const assertMockSchoolAccess = (user, schoolId) => {
  if (user?.role !== 'super_admin' && user?.schoolId && String(user.schoolId) !== String(schoolId)) {
    throw new MockError(403, 'You do not have access to this school', 'SCHOOL_ACCESS_DENIED');
  }
};

// -- SMS --------------------------------------------------------------------

/**
 * The client-side mirror of the SMS module's pure logic.
 *
 * `countSegments`, `renderBodyLocally` and the token helpers are duplicated in
 * `services/sms.js` and in `Backend/src/services/sms.service.js`. This is a
 * *third* copy, and it is here for one reason: the mock must reject the same
 * inputs the real API rejects, at the same threshold, or a message that costs
 * two segments here and three there is a discrepancy the tester has no way to
 * explain. The three must stay in step; the assertions in
 * `.mockcheck/sms-*.jsx` exist to catch it when they drift.
 */
const SMS_TOKENS = [
  'parentName',
  'studentName',
  'studentClass',
  'balance',
  'amountPaid',
  'dueDate',
  'schoolName',
  'payLink',
  'term',
];

const SMS_CREDIT_RATE_PES = 12;
const SMS_PRESETS = [
  {
    key: 'gentle_prompt',
    name: 'Gentle Prompt',
    category: 'fee_reminder',
    requiredTokens: ['balance', 'payLink'],
    body: 'Dear {parentName}, {studentName} owes GHC {balance} for this term at {schoolName}. Please pay via MTN MoMo, Telecel Cash or AirtelTigo: {payLink}',
  },
  {
    key: 'final_warning',
    name: 'Final Warning',
    category: 'final_warning',
    requiredTokens: ['balance', 'dueDate', 'payLink'],
    body: "Dear {parentName}, this is a final reminder for {studentName}'s GHC {balance} outstanding at {schoolName}. Fees must be cleared by {dueDate}. Pay now: {payLink}",
  },
  {
    key: 'pta_special',
    name: 'PTA Special',
    category: 'pta',
    requiredTokens: ['balance', 'payLink'],
    body: 'Dear {parentName}, the PTA of {schoolName} requests GHC {balance} from you for {studentName}. Pay via {payLink}. Thank you.',
  },
  {
    key: 'custom',
    name: 'Custom Message',
    category: 'custom',
    requiredTokens: ['balance', 'payLink'],
    body: 'Dear {parentName}, kindly settle the outstanding balance of GHC {balance} for {studentName} at {schoolName}. Payment link: {payLink}',
  },
];

const mockExtractTokens = (body = '') => {
  const found = [];
  const pattern = /\{([a-zA-Z][a-zA-Z0-9_]*)\}/g;
  let match = pattern.exec(String(body));
  while (match) {
    if (!found.includes(match[1])) found.push(match[1]);
    match = pattern.exec(String(body));
  }
  return found;
};

const mockRender = (body = '', values = {}) =>
  String(body).replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g, (match, token) =>
    values[token] === undefined || values[token] === null || values[token] === ''
      ? match
      : String(values[token])
  );

const mockSegments = (body = '') => {
  const text = String(body ?? '');
  const gsm7 =
    /^[\x20-\x7E\n\r]*$/.test(text) || /^[\x20-\x7E\n\r@£$•ËÈ˘ÏÚ«ÿ¯≈Â]*$/.test(text);
  const perSegment = gsm7 ? 160 : 70;
  if (text.length <= perSegment) return 1;
  return Math.ceil((text.length - perSegment) / (perSegment - 7)) + 1;
};

/** Mirrors the server's token check, including the message it produces. */
const assertMockTokens = (body, context = 'Message body') => {
  const unknown = mockExtractTokens(body).filter((token) => !SMS_TOKENS.includes(token));
  if (unknown.length) {
    throw new MockError(
      400,
      `${context} uses unknown ${unknown.length === 1 ? 'token' : 'tokens'}: ${unknown
        .map((t) => `{${t}}`)
        .join(', ')}. Available tokens: ${SMS_TOKENS.map((t) => `{${t}}`).join(', ')}`,
      'UNKNOWN_SMS_TOKEN'
    );
  }
};

const GHANA_NETWORK_PREFIXES = {
  mtn: ['24', '54', '55', '59'],
  telecel: ['22', '72'],
  airteltigo: ['20', '26', '27', '57', '58'],
};

const mockNetwork = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  const national = digits.startsWith('233') ? digits.slice(3) : digits.replace(/^0/, '');
  if (national.length !== 9) return null;
  const prefix = national.slice(0, 2);
  for (const [network, prefixes] of Object.entries(GHANA_NETWORK_PREFIXES)) {
    if (prefixes.includes(prefix)) return network;
  }
  return null;
};

/** Enough shape for the audience preview, without a real aggregation pipeline. */
const mockSmsStudent = (student, school) => {
  const parent = student.parents.find((p) => p.isPrimary) || student.parents[0];
  return {
    parentName: parent?.parentName || '',
    phone: parent?.phone || '',
    studentName: student.studentName,
    studentClass: student.studentClass,
    balance: student.balance || 0,
    payLink: student.payLink || '',
    schoolName: school.name,
  };
};

const mockAudience = ({ schoolId, audience }) => {
  const school = findSchool(schoolId);
  if (!school) throw new MockError(404, 'School not found', 'SCHOOL_NOT_FOUND');

  let rows = studentsFor(schoolId).filter((s) => s.status === 'active');

  if (audience.type === 'class') {
    const wanted = Array.isArray(audience.class) ? audience.class : [audience.class].filter(Boolean);
    if (!wanted.length) {
      throw new MockError(422, 'audience.type "class" requires a class name', 'VALIDATION_ERROR');
    }
    rows = rows.filter((s) => wanted.includes(s.studentClass));
  }

  if (audience.type === 'students') {
    const ids = audience.studentIds || [];
    if (!ids.length) {
      throw new MockError(422, 'audience.type "students" requires studentIds', 'VALIDATION_ERROR');
    }
    rows = rows.filter((s) => ids.includes(String(s._id)));
  }

  const floor = audience.minBalance ?? 1;
  const includeZero = Boolean(audience.includeZeroBalance);
  rows = rows.filter((s) => (includeZero ? s.balance >= 0 : s.balance >= floor));

  if (audience.type === 'overdue') {
    const cutoff = Date.now() - (audience.overdueDays ?? 30) * 86400000;
    rows = rows.filter((s) => s.deadline && new Date(s.deadline).getTime() < cutoff);
  }

  if (audience.type === 'installment_due_soon' || audience.type === 'at_risk') {
    // Both rules are properties of a *plan*, not of a student, so they are
    // resolved from `paymentPlans` and the students intersected in. `at_risk` adds
    // the slipped branch ó a tranche already past its date is the family a chaser
    // most needs to reach, and dropping them would make the compliance footer
    // count families its own button will not message.
    const now = Date.now();
    const horizon = now + (audience.dueSoonDays ?? 5) * 86400000;
    const unsettled = ['pending', 'overdue', 'partial'];

    const eligible = new Set(
      (getDb().paymentPlans || [])
        .filter((plan) => plan.schoolId === schoolId && ['active', 'defaulted'].includes(plan.planStatus))
        .filter((plan) =>
          (plan.installments || []).some((i) => {
            if (!unsettled.includes(i.status)) return false;
            const due = new Date(i.dueDate).getTime();
            return audience.type === 'at_risk' ? due <= horizon : due >= now && due <= horizon;
          })
        )
        .map((plan) => plan.studentId)
    );

    rows = rows.filter((s) => eligible.has(s._id));
  }

  const recipients = rows
    .map((student) => mockSmsStudent(student, school))
    .filter((entry) => GHANA_PHONE.test(String(entry.phone).replace(/[\s-]/g, '')));

  const skippedInvalid = rows.length - recipients.length;
  const networkSplit = { mtn: 0, telecel: 0, airteltigo: 0, unknown: 0 };
  recipients.forEach((entry) => {
    networkSplit[mockNetwork(entry.phone) || 'unknown'] += 1;
  });

  const sample = recipients[0]
    ? {
        parentName: recipients[0].parentName,
        phoneDisplay: recipients[0].phone,
        phoneMasked: `${String(recipients[0].phone).slice(0, 6)} ïïïïï ${String(recipients[0].phone).slice(-3)}`,
        network: mockNetwork(recipients[0].phone),
        studentName: recipients[0].studentName,
        studentClass: recipients[0].studentClass,
        balance: recipients[0].balance,
        balanceDisplay: `GHC ${(recipients[0].balance / 100).toFixed(2)}`,
        payLink: recipients[0].payLink,
      }
    : null;

  return {
    audience,
    matchCount: recipients.length,
    studentCount: rows.length,
    totalBalance: rows.reduce((sum, s) => sum + (s.balance || 0), 0),
    networkSplit,
    skipped: { no_match: 0, no_parent: 0, no_balance: 0, opted_out: 0, recent_payer: 0, invalid_number: skippedInvalid },
    sample,
  };
};

const getSmsCreditsHandler = ({ params, user }) => {
  const schoolId = resolveSchoolId(user, params.schoolId);
  if (!schoolId) throw new MockError(403, 'No school in scope', 'NO_SCHOOL_SCOPE');
  const school = findSchool(schoolId);
  if (!school) throw new MockError(404, 'School not found', 'SCHOOL_NOT_FOUND');

  const sent = getDb().sentSms.filter((m) => m.schoolId === schoolId);
  const charged = sent.reduce((sum, m) => sum + (m.creditsCharged ?? 1), 0);
  const refunded = sent.reduce((sum, m) => sum + (m.creditsRefunded ?? 0), 0);
  const delivered = sent.filter((m) => m.status === 'delivered').length;
  const submitted = sent.filter((m) => m.status === 'submitted').length;
  const failed = sent.filter((m) => m.status === 'failed').length;
  const settled = submitted + delivered;
  const balance = school.sms?.balance ?? 0;

  return {
    school: { id: school._id, name: school.name },
    balance,
    units: balance,
    ratePes: SMS_CREDIT_RATE_PES,
    balancePes: balance * SMS_CREDIT_RATE_PES,
    balanceCedis: `GHC ${((balance * SMS_CREDIT_RATE_PES) / 100).toFixed(2)}`,
    provider: school.sms?.provider || 'arke',
    senderId: school.sms?.senderId || 'SukuuPay',
    // The scenario that mirrors a deployment with no gateway key, so the
    // composer's "this will fail" warning is reachable without editing env.
    canSend: getScenarioId() !== 'sms-no-gateway',
    gateway: {
      configured: getScenarioId() !== 'sms-no-gateway',
      hasSenderId: true,
      senderIdValid: true,
      senderIdIssue: null,
      dlrCallbackConfigured: getScenarioId() !== 'sms-no-gateway',
    },
    usage: {
      charged,
      refunded,
      netCharged: Math.max(charged - refunded, 0),
      sent: submitted,
      delivered,
      failed,
      deliveryRate: settled ? Math.round((delivered / settled) * 1000) / 10 : null,
    },
    topUps: (getDb().smsTopUps || []).filter((t) => t.schoolId === schoolId).slice(0, 20),
  };
};

const topUpSmsCreditsHandler = ({ body, user }) => {
  const schoolId = resolveSchoolId(user, body.schoolId);
  if (!schoolId) throw new MockError(403, 'No school in scope', 'NO_SCHOOL_SCOPE');
  const school = findSchool(schoolId);
  if (!school) throw new MockError(404, 'School not found', 'SCHOOL_NOT_FOUND');

  const units = Number(body.units);
  if (!Number.isInteger(units) || units < 1) {
    throw new MockError(422, '"units" must be a positive integer', 'VALIDATION_ERROR');
  }

  const db = getDb();
  db.smsTopUps = db.smsTopUps || [];
  const topUp = {
    _id: objectId(db.smsTopUps.length + 1),
    schoolId,
    units,
    source: body.reference ? 'purchase' : 'grant',
    createdAt: new Date().toISOString(),
  };
  db.smsTopUps.push(topUp);
  school.sms.balance = (school.sms.balance || 0) + units;

  return { topUp, balance: school.sms.balance };
};

const previewAudienceHandler = ({ body, user }) => {
  const schoolId = resolveSchoolId(user, body.schoolId);
  if (!schoolId) throw new MockError(403, 'No school in scope', 'NO_SCHOOL_SCOPE');
  return mockAudience({ schoolId, audience: body.audience });
};

const listSmsTemplatesHandler = ({ query, user }) => {
  const schoolId = resolveSchoolId(user, query.schoolId);
  if (!schoolId) throw new MockError(403, 'No school in scope', 'NO_SCHOOL_SCOPE');

  const db = getDb();
  db.smsTemplates = db.smsTemplates || [];
  const own = db.smsTemplates.filter((t) => t.schoolId === schoolId && !t.deletedAt);

  // Presets are seeded on read, exactly as the service does, so the mock's
  // template list cannot drift into "presets appear only after a save".
  return [
    ...SMS_PRESETS.map((preset) => ({
      _id: `preset-${preset.key}`,
      key: preset.key,
      name: preset.name,
      category: preset.category,
      body: preset.body,
      tokens: mockExtractTokens(preset.body),
      requiredTokens: preset.requiredTokens,
      isPreset: true,
      schoolId: null,
      isModifiedPreset: false,
    })),
    ...own,
  ];
};

const createSmsTemplateHandler = ({ body, user }) => {
  const schoolId = resolveSchoolId(user, body.schoolId);
  if (!schoolId) throw new MockError(403, 'No school in scope', 'NO_SCHOOL_SCOPE');
  assertMockTokens(body.body, 'Template body');

  const db = getDb();
  db.smsTemplates = db.smsTemplates || [];
  const key = String(body.name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (db.smsTemplates.some((t) => t.schoolId === schoolId && t.key === key && !t.deletedAt)) {
    throw new MockError(409, `You already have a template called "${body.name}".`, 'TEMPLATE_KEY_TAKEN');
  }

  const template = {
    _id: objectId(db.smsTemplates.length + 1),
    key,
    name: body.name,
    category: body.category || 'custom',
    body: body.body,
    tokens: mockExtractTokens(body.body),
    requiredTokens: body.requiredTokens || [],
    isPreset: false,
    schoolId,
    deletedAt: null,
    createdAt: new Date().toISOString(),
  };
  db.smsTemplates.push(template);
  return template;
};

const updateSmsTemplateHandler = ({ params, body, user }) => {
  const schoolId = resolveSchoolId(user);
  if (!schoolId) throw new MockError(403, 'No school in scope', 'NO_SCHOOL_SCOPE');

  const db = getDb();
  const template = (db.smsTemplates || []).find((t) => t._id === params.templateId);
  if (!template) throw new MockError(404, 'Template not found', 'TEMPLATE_NOT_FOUND');
  if (!template.schoolId) {
    throw new MockError(403, 'This is a platform template and cannot be edited.', 'PRESET_TEMPLATE_IMMUTABLE');
  }
  if (template.schoolId !== schoolId) {
    throw new MockError(403, 'You do not have access to this template', 'SCHOOL_ACCESS_DENIED');
  }
  if (body.body !== undefined) {
    assertMockTokens(body.body, 'Template body');
    template.body = body.body;
    template.tokens = mockExtractTokens(body.body);
  }
  if (body.name !== undefined) template.name = body.name;
  if (body.category !== undefined) template.category = body.category;
  return template;
};

const deleteSmsTemplateHandler = ({ params, user }) => {
  const schoolId = resolveSchoolId(user);
  if (!schoolId) throw new MockError(403, 'No school in scope', 'NO_SCHOOL_SCOPE');

  const db = getDb();
  const template = (db.smsTemplates || []).find((t) => t._id === params.templateId);
  if (!template) throw new MockError(404, 'Template not found', 'TEMPLATE_NOT_FOUND');
  if (!template.schoolId) {
    throw new MockError(403, 'This is a platform template and cannot be deleted.', 'PRESET_TEMPLATE_IMMUTABLE');
  }
  template.deletedAt = new Date().toISOString();
  return { id: template._id, deletedAt: template.deletedAt };
};

const previewTemplateHandler = ({ body }) => {
  const text = body.templateId
    ? SMS_PRESETS.find((p) => p._id === body.templateId || p.key === body.templateId)?.body
    : body.body;
  if (!text) throw new MockError(404, 'Template not found', 'TEMPLATE_NOT_FOUND');
  assertMockTokens(text, 'Template body');

  const rendered = mockRender(text, {
    parentName: 'Mr. Mensah',
    studentName: 'Kwame Mensah',
    studentClass: 'JHS 2A',
    balance: '550.00',
    amountPaid: '0.00',
    dueDate: '30 Nov 2025',
    schoolName: 'Prampram Basic School',
    payLink: 'https://sukuupay.com/pay/STU-8F3K9D2L',
    term: 'Term 1',
  });

  return {
    rendered,
    segments: mockSegments(rendered),
    length: rendered.length,
    tokens: mockExtractTokens(rendered),
    unresolvedTokens: mockExtractTokens(rendered).filter((t) => rendered.includes(`{${t}}`)),
    estimatedCost: mockSegments(rendered),
  };
};

const bulkSendSmsHandler = ({ body, user }) => {
  const schoolId = resolveSchoolId(user, body.schoolId);
  if (!schoolId) throw new MockError(403, 'No school in scope', 'NO_SCHOOL_SCOPE');
  if (body.scenarioOnly) {
    throw new MockError(404, 'Cannot POST /sms/bulk', 'NOT_FOUND');
  }

  const school = findSchool(schoolId);
  if (!school) throw new MockError(404, 'School not found', 'SCHOOL_NOT_FOUND');

  const text = body.body;
  if (!text) throw new MockError(400, 'A message body is required', 'BODY_REQUIRED');
  assertMockTokens(text, 'Message body');

  const { matchCount, totalBalance } = mockAudience({ schoolId, audience: body.audience });
  if (!matchCount) {
    throw new MockError(422, 'No parents matched this audience.', 'NO_RECIPIENTS');
  }

  const segments = mockSegments(mockRender(text, { balance: '0.00', parentName: 'x'.repeat(20) }));
  const units = segments * matchCount;

  if ((school.sms?.balance ?? 0) < units) {
    throw new MockError(
      402,
      `Insufficient SMS credit: this broadcast costs ${units} credits and the school has ${school.sms?.balance ?? 0} available.`,
      'INSUFFICIENT_SMS_CREDIT'
    );
  }
  school.sms.balance -= units;

  const db = getDb();
  const job = {
    _id: objectId((db.smsJobs?.length || 0) + 1),
    schoolId,
    body: text,
    category: body.category || 'fee_reminder',
    audienceType: body.audience.type,
    status: body.scheduledAt ? 'scheduled' : 'queued',
    progressPercent: 0,
    recipientsResolved: matchCount,
    creditsCharged: units,
    creditsRefunded: 0,
    totalBalance,
    scheduledAt: body.scheduledAt || null,
    createdAt: new Date().toISOString(),
  };
  db.smsJobs = db.smsJobs || [];
  db.smsJobs.unshift(job);

  return {
    job: {
      id: job._id,
      status: job.status,
      category: job.category,
      audienceType: job.audienceType,
      recipients: matchCount,
      segments,
      creditsCharged: units,
      balanceAfter: school.sms.balance,
      scheduledAt: job.scheduledAt,
      totalBalance,
      totalBalanceDisplay: `GHC ${(totalBalance / 100).toFixed(2)}`,
      skipped: { invalid_number: 0 },
    },
  };
};

const listSmsJobsHandler = ({ query, user }) => {
  const schoolId = resolveSchoolId(user, query.schoolId);
  if (!schoolId) throw new MockError(403, 'No school in scope', 'NO_SCHOOL_SCOPE');
  const jobs = (getDb().smsJobs || []).filter((j) => j.schoolId === schoolId);
  return { jobs, meta: { page: 1, perPage: 20, total: jobs.length, totalPages: 1 } };
};

const cancelSmsJobHandler = ({ params, body, user }) => {
  const schoolId = resolveSchoolId(user);
  if (!schoolId) throw new MockError(403, 'No school in scope', 'NO_SCHOOL_SCOPE');

  const job = (getDb().smsJobs || []).find((j) => j._id === params.jobId && j.schoolId === schoolId);
  if (!job) throw new MockError(404, 'Job not found', 'JOB_NOT_FOUND');
  if (['completed', 'cancelled', 'failed'].includes(job.status)) {
    throw new MockError(409, `This job is already ${job.status} and cannot be cancelled`, 'JOB_NOT_CANCELLABLE');
  }
  if (job.status === 'processing') {
    throw new MockError(409, 'This broadcast is already sending.', 'JOB_ALREADY_RUNNING');
  }

  const school = findSchool(schoolId);
  school.sms.balance = (school.sms.balance || 0) + (job.creditsCharged || 0);
  job.creditsRefunded = job.creditsCharged || 0;
  job.status = 'cancelled';
  job.cancellationReason = body?.reason || '';
  job.cancelledAt = new Date().toISOString();

  return {
    jobId: job._id,
    status: job.status,
    cancellationReason: job.cancellationReason,
    cancelledAt: job.cancelledAt,
    creditsRefunded: job.creditsRefunded,
    result: job.result || null,
  };
};

const listSmsMessagesHandler = ({ query, user }) => {
  const schoolId = resolveSchoolId(user, query.schoolId);
  if (!schoolId) throw new MockError(403, 'No school in scope', 'NO_SCHOOL_SCOPE');

  let rows = getDb().sentSms.filter((m) => m.schoolId === schoolId);
  if (query.status && query.status !== 'all') rows = rows.filter((m) => m.status === query.status);
  if (query.category && query.category !== 'all') rows = rows.filter((m) => m.category === query.category);

  const statusCounts = rows.reduce((acc, row) => {
    acc[row.status] = (acc[row.status] || 0) + 1;
    return acc;
  }, {});

  return {
    messages: rows.slice(0, Number(query.perPage) || 20),
    meta: {
      page: 1,
      perPage: Number(query.perPage) || 20,
      total: rows.length,
      totalPages: 1,
      statusCounts,
    },
  };
};

/**
 * `POST /sms/bulk/:schoolId` ó **superseded by `POST /sms/bulk`.**
 *
 * Kept for the onboarding wizard, which still posts the old path. It 404s unless
 * the `sms-enabled` scenario is on, exactly as before, so the wizard's
 * honest-failure branch still runs.
 */
const sendBulkSms = ({ params, body, user }) => {
  if (!getScenario(getScenarioId()).config?.mockOnlyEnabled) {
    throw new MockError(404, 'Cannot POST /sms/bulk', 'NOT_FOUND');
  }

  const schoolId = resolveSchoolId(user, params.schoolId);
  if (!schoolId) throw new MockError(403, 'No school in scope', 'NO_SCHOOL_SCOPE');
  const school = findSchool(schoolId);

  const owing = studentsFor(schoolId)
    .filter((s) => s.balance > 0)
    .filter(() => getScenarioId() !== 'sms-no-recipients');
  if (!owing.length) {
    throw new MockError(422, 'No parents have an outstanding balance', 'NO_RECIPIENTS');
  }
  if (school.sms.balance <= 0) {
    throw new MockError(402, 'Your SMS balance is exhausted. Top up to send reminders.', 'SMS_BALANCE_EXHAUSTED');
  }

  const recipients = owing.flatMap((student) => {
    const parent = student.parents.find((p) => p.isPrimary) || student.parents[0];
    return parent?.phone ? [{ name: parent.parentName, phone: parent.phone, studentId: student.studentId }] : [];
  });

  const cost = Math.round(recipients.length * 4);
  if (cost > school.sms.balance) {
    throw new MockError(402, 'Insufficient SMS balance for this many recipients', 'SMS_BALANCE_EXHAUSTED');
  }
  school.sms.balance -= cost;

  const db = getDb();
  db.sentSms = db.sentSms.concat(
    recipients.map((r) => ({
      id: objectId(db.sentSms.length + recipients.length),
      to: r.phone,
      toName: r.name,
      studentId: r.studentId,
      message: String(body?.message || ''),
      creditsCharged: 1,
      cost: 4,
      status: 'submitted',
      sentAt: new Date().toISOString(),
    }))
  );

  return { sent: recipients.length, failed: 0, cost, remainingBalance: school.sms.balance };
};

const getSmsBalance = ({ user }) => {
  if (user?.role !== 'super_admin') {
    // Matches the real route, which is super_admin only. The wizard treats a
    // null balance as "no estimate available" rather than an error.
    throw new MockError(403, 'Forbidden', 'FORBIDDEN');
  }
  return adminSmsBalancePayload();
};

// -- Platform admin (/api/admin/*) --------------------------------------------
//
// Mirrors `Backend/src/routes/admin.routes.js`, which wraps every route in
// `authenticate` + `authorize("super_admin")` at the router level. That is
// reproduced per handler rather than once in the adapter, matching how every
// other role check in this file works ó and it matters here more than usual,
// because the frontend's own `AdminGuard` is presentation and the mock is the
// only place a non-super_admin gets to discover that the server would refuse.
//
// The platform fixture below is deterministic and small. It is deliberately *not*
// derived from the seeded school: the school console's fixture asserts its own
// internal consistency (see `.mockcheck/dashboard-render.jsx`), and a platform
// list that included "Prampram Basic School" would drag that assertion's school
// into a second, unrelated set of totals.

const PLATFORM_SCHOOLS = [
  { name: 'Sunnyvale Schools', code: 'SUN-001', region: 'Greater Accra', city: 'Accra', plan: 'standard', status: 'active', students: 450, staff: 25 },
  { name: 'Greenfield Academy', code: 'GRN-002', region: 'Ashanti', city: 'Kumasi', plan: 'premium', status: 'active', students: 812, staff: 54 },
  { name: 'Riverside International', code: 'RIV-003', region: 'Western', city: 'Takoradi', plan: 'enterprise', status: 'active', students: 1240, staff: 96 },
  { name: 'New Horizon School', code: 'NHS-042', region: 'Central', city: 'Cape Coast', plan: 'trial', status: 'active', students: 180, staff: 12 },
  { name: "St Mary's College", code: 'STM-007', region: 'Greater Accra', city: 'Accra', plan: 'standard', status: 'active', students: 965, staff: 71 },
  { name: 'Northern Hills Secondary', code: 'NTH-011', region: 'Northern', city: 'Tamale', plan: 'basic', status: 'active', students: 540, staff: 33 },
  { name: 'Coastal View Academy', code: 'CST-014', region: 'Eastern', city: 'Koforidua', plan: 'basic', status: 'active', students: 310, staff: 19 },
  { name: 'Ashanti Grove School', code: 'ASH-018', region: 'Ashanti', city: 'Kumasi', plan: 'standard', status: 'suspended', students: 425, staff: 27 },
  { name: 'Volta Basic School', code: 'VOL-021', region: 'Volta', city: 'Ho', plan: 'trial', status: 'active', students: 205, staff: 11 },
  { name: 'Bono Senior High', code: 'BON-023', region: 'Bono', city: 'Sunyani', plan: 'premium', status: 'active', students: 1102, staff: 78 },
  { name: 'Upper West Model', code: 'UWM-026', region: 'Upper West', city: 'Wa', plan: 'basic', status: 'archived', students: 288, staff: 16 },
  { name: 'Savannah Preparatory', code: 'SAV-029', region: 'North East', city: 'Nalerigu', plan: 'trial', status: 'active', students: 156, staff: 9 },
];

/**
 * Deterministic per-school payment volume in **pesewas**.
 *
 * A hash of the school code rather than a counter, so a school's figure does not
 * change when another school is added to the list above ó an unstable fixture
 * makes a mock that looks broken every time it is extended.
 */
const platformVolume = (code) => {
  let hash = 0;
  for (let i = 0; i < code.length; i += 1) hash = (hash * 31 + code.charCodeAt(i)) % 1000000;
  return 4000000 + hash * 9000;
};

/**
 * The platform's schools, as mutable module state.
 *
 * Built **once** and mutated, not regenerated per request. Suspending a school is
 * a mutation, and a handler that rebuilt the list on every call would forget the
 * suspension immediately ó so the second suspend attempt would succeed, the
 * "already suspended" 400 would never fire, and the console's unsuspend button
 * would appear to work twice. A mock that forgets its own writes cannot test a
 * lifecycle.
 *
 * Rebuilt whenever the persona changes, via `resetPlatformSchools()`.
 */
let platformSchools = null;
let platformSchoolsKey = null;

const resetPlatformSchools = () => {
  platformSchools = PLATFORM_SCHOOLS.map((school, index) => ({
    _id: objectId(200 + index),
    name: school.name,
    schoolCode: school.code,
    slug: slugify(school.name),
    type: 'private',
    email: `office@${slugify(school.name).slice(0, 18)}.edu.gh`,
    // `ghanaPhone` takes a seeded rng, not an index ó passing a number would call
    // it as a function and produce an `intBetween` of NaN, i.e. a phone number
    // this mock's own GHANA_PHONE validator rejects.
    phone: ghanaPhone(makeRng(index + 3)),
    city: school.city,
    region: school.region,
    status: school.status,
    subscription: {
      plan: school.plan,
      status: school.status === 'suspended' ? 'suspended' : school.plan === 'trial' ? 'trial' : 'active',
      currentPeriodEnd: new Date(Date.UTC(2026, 2, 1)).toISOString(),
    },
    studentCount: school.students,
    staffCount: school.staff,
    paymentVolume: platformVolume(school.code),
  }));
  return platformSchools;
};

/**
 * The platform's schools, reset whenever the mock world is rebuilt.
 *
 * The reset is keyed on the seeded school's id rather than driven by `resetDb`,
 * because `handlers.js` imports `db.js` and the reverse edge would be circular.
 * `resetDb(persona)` rebuilds the world from a persona-specific seed, so a
 * different persona means a different seeded school ó which is exactly the signal
 * that the platform's own state belongs to the previous world and has to go.
 * Same persona twice keeps the state, which is what lets a lifecycle be exercised
 * across several requests.
 */
const platformSchoolRows = () => {
  const key = getDb()?.schools?.[0]?._id || 'none';
  if (!platformSchools || platformSchoolsKey !== key) {
    platformSchoolsKey = key;
    return resetPlatformSchools();
  }
  return platformSchools;
};

/** Accounts across the platform. See `ensurePlatformUsers` for why these live in the db. */
const platformUserRows = () => {
  const roles = ['school_admin', 'accountant', 'teacher', 'viewer'];
  return platformSchoolRows().flatMap((school, schoolIndex) =>
    [0, 1].map((seat) => ({
      _id: objectId(400 + schoolIndex * 2 + seat),
      name: `${roles[seat % roles.length]} ${school.name.split(' ')[0]}`,
      email: `staff${schoolIndex}${seat}@${slugify(school.name).slice(0, 14)}.edu.gh`,
      phone: ghanaPhone(makeRng(schoolIndex + seat + 11)),
      role: roles[seat % roles.length],
      status: 'active',
      schoolId: school._id,
      createdAt: new Date(Date.UTC(2025, schoolIndex % 12, 1)).toISOString(),
      isEmailVerified: true,
      isPlatformOwner: false,
    }))
  );
};

/**
 * Puts the platform's accounts into `db.users`, once per mock world.
 *
 * They used to be synthesised fresh inside `listUsersHandler`, which was a lie in
 * two ways that only showed up when the console started *acting* on them: the
 * console's role-change and remove dialogs call `PUT /users/:id/role` and
 * `DELETE /users/:id`, and those handlers look accounts up in `db.users` ó so a row
 * the list had just rendered 404'd the moment it was acted on. Development would
 * have failed loudly while production worked, which is the mock's whole purpose
 * inverted.
 *
 * Seeding them makes them ordinary world records, so every existing handler finds
 * them, mutations persist, and a removal really removes.
 *
 * Idempotent, and correct across resets: membership is tested against `db.users`
 * on every call rather than cached behind a world key. A cache keyed on the
 * persona's seeded school id looked fine ó same persona, same seed, same id ó and
 * then skipped seeding entirely after `resetDb` rebuilt the world, leaving the
 * platform list with nothing but the seeded super_admin. Twenty-four membership
 * checks per call is cheaper than a cache that can go stale, and it cannot.
 */
const ensurePlatformUsers = () => {
  const db = getDb();
  const ids = new Set(db.users.map((entry) => entry._id));
  for (const account of platformUserRows()) {
    if (!ids.has(account._id)) db.users.push(account);
  }
  return db.users;
};

const requireSuperAdmin = (user) => {
  if (user?.role !== 'super_admin') {
    throw new MockError(403, 'Forbidden', 'FORBIDDEN');
  }
};

/** The seeded school is a super_admin's own login in CREATE mode ó keep it visible. */
const adminDashboardPayload = () => {
  const schools = platformSchoolRows();
  const active = schools.filter((s) => s.status === 'active');
  const paid = schools.filter((s) => s.subscription.status === 'active');
  const onTrial = schools.filter((s) => s.subscription.status === 'trial');
  const users = platformUserRows();

  const totalRevenue = schools.reduce((sum, s) => sum + s.paymentVolume, 0);
  const totalCompleted = Math.round(totalRevenue / 21500);

  return {
    schools: {
      total: schools.length + 73,
      active: active.length + 65,
      suspended: schools.filter((s) => s.status === 'suspended').length,
      archived: schools.filter((s) => s.status === 'archived').length,
      onTrial: onTrial.length + 5,
      paid: paid.length + 52,
    },
    users: {
      total: users.length + 45186,
      students: 38500,
      staff: users.length + 6686,
    },
    payments: {
      totalCompleted,
      totalRevenue,
      mtdRevenue: Math.round(totalRevenue * 0.11),
      mtdCount: Math.round(totalCompleted * 0.05),
      ytdRevenue: Math.round(totalRevenue * 0.9),
      ytdCount: Math.round(totalCompleted * 0.85),
      platformMarkup: Math.round(totalRevenue * 0.05),
      pendingPayouts: 8500000,
    },
    sms: { totalBalance: 125000 },
    recentSchools: [...schools]
      .sort((a, b) => (a._id < b._id ? 1 : -1))
      .slice(0, 5)
      .map((s) => ({
        _id: s._id,
        name: s.name,
        schoolCode: s.schoolCode,
        status: s.status,
        subscription: s.subscription,
        createdAt: new Date(Date.UTC(2026, 0, 20)).toISOString(),
      })),
  };
};

const adminSmsBalancePayload = () => ({
  totalBalance: 125000,
  totalSchools: platformSchoolRows().filter((s) => s.status === 'active').length,
});

const adminDashboard = ({ user }) => {
  requireSuperAdmin(user);
  return adminDashboardPayload();
};

const adminRevenue = ({ user, query }) => {
  requireSuperAdmin(user);
  const period = query.period || 'all';
  // The real route intersects `period` with an explicit date range; the mock
  // applies the period alone, which is enough for a client that sends only one.
  const share = period === 'mtd' ? 0.11 : period === 'ytd' ? 0.9 : period === 'last30' ? 0.18 : 1;
  const totalRevenue = Math.round(285000000 * share);

  return {
    summary: {
      totalRevenue,
      totalPayments: Math.round(13240 * share),
      avgPayment: Math.round(totalRevenue / Math.max(1, Math.round(13240 * share))),
      platformMarkupRevenue: Math.round(totalRevenue * 0.05),
    },
    filters: {
      period,
      startDate: query.startDate || null,
      endDate: query.endDate || null,
      plan: query.plan || null,
      region: query.region || null,
    },
  };
};

const adminListSchools = ({ user, query }) => {
  requireSuperAdmin(user);

  let rows = platformSchoolRows();
  if (query.status) rows = rows.filter((s) => s.status === query.status);
  if (query.region) rows = rows.filter((s) => s.region === query.region);
  if (query.plan) rows = rows.filter((s) => s.subscription.plan === query.plan);
  if (query.search) {
    const term = String(query.search).toLowerCase();
    rows = rows.filter((s) =>
      [s.name, s.schoolCode, s.email, s.phone, s.city]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }

  const sortBy = query.sortBy || 'createdAt';
  const direction = query.sortOrder === 'asc' ? 1 : -1;
  rows.sort((a, b) => {
    const left = a[sortBy] ?? '';
    const right = b[sortBy] ?? '';
    return (left < right ? -1 : left > right ? 1 : 0) * direction;
  });

  const page = Number(query.page) || 1;
  const perPage = Number(query.perPage) || 20;
  const start = (page - 1) * perPage;
  return {
    __rows: rows.slice(start, start + perPage),
    __status: 200,
    meta: { page, perPage, total: rows.length, pages: Math.max(1, Math.ceil(rows.length / perPage)) },
  };
};

const adminSchoolUsage = ({ user, params }) => {
  requireSuperAdmin(user);
  const school = platformSchoolRows().find((s) => s._id === params.schoolId);
  if (!school) throw new MockError(404, 'School not found', 'SCHOOL_NOT_FOUND');

  const completed = Math.round(school.paymentVolume / 21500);
  return {
    school: {
      _id: school._id,
      name: school.name,
      schoolCode: school.schoolCode,
      status: school.status,
      subscription: school.subscription,
      sms: { provider: 'hubtel', balance: 1500, senderId: school.schoolCode },
    },
    counts: { students: school.studentCount, staff: school.staffCount, parents: 312 },
    payments: {
      totalRevenue: school.paymentVolume,
      statusBreakdown: {
        completed: { count: completed, amount: school.paymentVolume },
        pending: { count: 5, amount: 45000 },
        failed: { count: 3, amount: 2300 },
      },
      pendingAmount: 45000,
      pendingPlans: 5,
    },
    stats: {
      totalStudents: school.studentCount,
      totalTeachers: Math.round(school.staffCount * 0.8),
      totalParents: 312,
      totalPaymentsThisMonth: Math.round(completed * 0.05),
    },
    recentActivity: [],
  };
};

const adminSuspendSchool = ({ user, params, body }) => {
  requireSuperAdmin(user);
  const reason = String(body?.reason || '').trim();
  if (reason.length < 10 || reason.length > 500) {
    throw new MockError(422, '"reason" length must be between 10 and 500 characters long', 'VALIDATION_ERROR');
  }
  const school = platformSchoolRows().find((s) => s._id === params.schoolId);
  if (!school) throw new MockError(404, 'School not found', 'SCHOOL_NOT_FOUND');
  if (school.status !== 'active') throw new MockError(400, 'School is not active', 'SCHOOL_NOT_ACTIVE');

  const at = new Date().toISOString();
  school.status = 'suspended';
  school.suspendedReason = reason;
  school.suspendedAt = at;
  school.subscription = { ...school.subscription, status: 'suspended' };

  return {
    __raw: {
      _id: school._id,
      name: school.name,
      status: school.status,
      suspendedReason: school.suspendedReason,
      suspendedAt: school.suspendedAt,
      subscription: school.subscription,
    },
  };
};

const adminUnsuspendSchool = ({ user, params }) => {
  requireSuperAdmin(user);
  const school = platformSchoolRows().find((s) => s._id === params.schoolId);
  if (!school) throw new MockError(404, 'School not found', 'SCHOOL_NOT_FOUND');
  if (school.status !== 'suspended') throw new MockError(400, 'School is not suspended', 'SCHOOL_NOT_SUSPENDED');

  school.status = 'active';
  school.suspendedReason = '';
  school.suspendedAt = null;
  school.subscription = {
    ...school.subscription,
    status: school.subscription.plan === 'trial' ? 'trial' : 'active',
  };

  return {
    __raw: {
      _id: school._id,
      name: school.name,
      status: school.status,
      suspendedReason: school.suspendedReason,
      suspendedAt: school.suspendedAt,
      subscription: school.subscription,
    },
  };
};

const PLATFORM_ADS = [
  { _id: objectId(31), schoolName: 'Greenfield Academy', headline: 'Admissions open for 2026', placement: 'auth_aside', status: 'pending', imageAlt: 'Greenfield Academy senior school campus building', linkUrl: 'https://example.com/greenfield/apply', sortWeight: 10, endsAt: '2026-12-31T00:00:00.000Z' },
  { _id: objectId(32), schoolName: 'Riverside International', headline: 'Now boarding, grades 1ñ12', placement: 'home_hero', status: 'pending', imageAlt: 'Riverside International School main gate', linkUrl: 'https://example.com/riverside/apply', sortWeight: 5, endsAt: '2026-11-30T00:00:00.000Z' },
  { _id: objectId(33), schoolName: 'New Horizon School', headline: 'Term fees payable in three parts', placement: 'dashboard_sidebar', status: 'approved', imageAlt: 'New Horizon School fee payment announcement', linkUrl: 'https://example.com/newhorizon/plans', sortWeight: 0, endsAt: '2026-10-31T00:00:00.000Z' },
  { _id: objectId(34), schoolName: 'Ashanti Grove School', headline: 'Scholarships available', placement: 'auth_aside', status: 'rejected', imageAlt: 'Ashanti Grove School scholarship advert', linkUrl: 'https://example.com/grove/scholarship', sortWeight: 0, endsAt: '2026-09-30T00:00:00.000Z', rejectedReason: 'The creative names a fee discount. Fee terms cannot be advertised without the school confirming them in writing.' },
];

/**
 * `GET /admin/revenue/series`
 *
 * Reproduces the one behaviour that matters and is easy to get wrong: **the series
 * has no gaps.** A month nobody paid is an explicit `0`, not a missing point, because
 * a chart that draws a straight line across a month of no revenue presents nothing as
 * growth. The calendar is walked rather than the totals mapped, for that reason.
 *
 * Every fifth month is deliberately left empty, so the gap-filling is observable in
 * development and not only in a test.
 */
const adminRevenueSeries = ({ user, query }) => {
  requireSuperAdmin(user);

  const now = new Date();
  const bucket = query.bucket === 'day' ? 'day' : 'month';
  const period = query.period || 'ytd';

  let from;
  if (period === 'mtd') from = new Date(now.getFullYear(), now.getMonth(), 1);
  else if (period === 'last30') from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  else if (period === 'all') from = new Date(now.getFullYear() - 2, 0, 1);
  else from = new Date(now.getFullYear(), 0, 1);

  const to = new Date(now.getFullYear(), now.getMonth(), 15);
  const rng = makeRng(4242);
  const totals = new Map();
  const pad = (value) => String(value).padStart(2, '0');
  const keyFor = (date) =>
    bucket === 'day'
      ? `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
      : `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;

  const series = [];
  const walk = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  let index = 0;
  while (walk <= to && series.length < (bucket === 'day' ? 400 : 120)) {
    index += 1;
    const empty = index % 5 === 3;
    if (!empty) {
      const entry = totals.get(keyFor(walk)) || { totalRevenue: 0, totalPayments: 0 };
      entry.totalRevenue += 180000 + Math.round(rng() * 420000);
      entry.totalPayments += 1;
      totals.set(keyFor(walk), entry);
    }
    const entry = totals.get(keyFor(walk)) || { totalRevenue: 0, totalPayments: 0 };
    series.push({ period: keyFor(walk), totalRevenue: entry.totalRevenue, totalPayments: entry.totalPayments });
    if (bucket === 'day') walk.setDate(walk.getDate() + 1);
    else walk.setMonth(walk.getMonth() + 1);
  }

  return {
    series,
    filters: { bucket, period, startDate: from, endDate: to, plan: null, region: null },
    totals: {
      totalRevenue: series.reduce((sum, point) => sum + point.totalRevenue, 0),
      totalPayments: series.reduce((sum, point) => sum + point.totalPayments, 0),
    },
  };
};

/**
 * `GET`/`PUT /admin/settings`
 *
 * A module-level singleton keyed the same way the platform schools are: rebuilt when
 * the mock world is, and mutated in place between calls, because a settings write
 * that resets on every read is a settings page that appears to save nothing.
 */
let platformSettingsState = null;
let platformSettingsKey = null;

const currentPlatformSettings = () => {
  const key = getDb()?.schools?.[0]?._id || 'none';
  if (platformSettingsState && platformSettingsKey === key) return platformSettingsState;

  platformSettingsKey = key;
  platformSettingsState = {
    _id: objectId(1),
    singletonKey: 'platform',
    defaultMarkupPercent: 5,
    features: { adsEnabled: true, selfSignupEnabled: true, trialDays: 30 },
    maintenance: { mode: 'off', message: '' },
    updatedBy: null,
    updatedAt: null,
  };
  return platformSettingsState;
};

/**
 * The mock's platform settings, for `adapter.js`'s maintenance check.
 *
 * Exported because the adapter is the only place every request passes through, and
 * the mock has no middleware chain to hang the rule on.
 */
export const getMockPlatformSettings = () => currentPlatformSettings();

const adminGetSettings = ({ user }) => {
  requireSuperAdmin(user);
  return currentPlatformSettings();
};

const adminUpdateSettings = ({ user, body }) => {
  requireSuperAdmin(user);

  const current = currentPlatformSettings();
  // Deep-merged per branch, mirroring the server: a patch that omits `features` must
  // not blank it. A shallow merge here is the bug the real endpoint is shaped to
  // avoid, and reproducing it here would teach the frontend to send whole documents.
  const next = {
    ...current,
    ...body,
    features: { ...current.features, ...(body?.features || {}) },
    maintenance: { ...current.maintenance, ...(body?.maintenance || {}) },
    updatedAt: new Date().toISOString(),
    updatedBy: user?._id || null,
  };

  // Bookkeeping fields are excluded from the diff, as they are on the server: `before`
  // has `updatedAt: null` and `after` carries the stamp mongoose just wrote, so
  // without this every save would report `updatedAt` and `updatedBy` alongside the
  // field that actually changed ó and the real change is the one being looked for.
  const DIFF_EXCLUDED = new Set([
    '_id',
    '__v',
    'createdAt',
    'updatedAt',
    'updatedBy',
    'singletonKey',
  ]);

  const changed = [];
  const walk = (before, after, path) => {
    if (path && DIFF_EXCLUDED.has(path.split('.').pop())) return;
    if (before && after && typeof before === 'object' && typeof after === 'object') {
      Object.keys({ ...before, ...after }).forEach((key) =>
        walk(before[key], after[key], path ? `${path}.${key}` : key)
      );
      return;
    }
    if (String(before ?? '') !== String(after ?? '')) {
      changed.push({ path, from: before ?? null, to: after ?? null });
    }
  };
  walk(current, next, '');

  platformSettingsState = next;
  return { ...next, changed };
};

const adminListSchoolAds = ({ user, query }) => {
  requireSuperAdmin(user);

  let rows = PLATFORM_ADS;
  // No default placement here, and that mirrors the server: the schema shares
  // this route with the public slider, so a default would hide every placement
  // but one from the moderation queue.
  if (query.status) rows = rows.filter((ad) => ad.status === query.status);
  if (query.placement) rows = rows.filter((ad) => ad.placement === query.placement);

  const page = Number(query.page) || 1;
  const perPage = Number(query.perPage) || 20;
  const start = (page - 1) * perPage;
  return {
    __rows: rows.slice(start, start + perPage),
    meta: { page, perPage, total: rows.length, pages: Math.max(1, Math.ceil(rows.length / perPage)) },
  };
};

const adminReviewSchoolAd = ({ user, params, body }) => {
  requireSuperAdmin(user);
  const ad = PLATFORM_ADS.find((entry) => entry._id === params.adId);
  if (!ad) throw new MockError(404, 'Ad not found', 'AD_NOT_FOUND');

  const status = body?.status;
  if (!['approved', 'rejected'].includes(status)) {
    throw new MockError(422, 'status must be approved or rejected', 'VALIDATION_ERROR');
  }
  // The real schema makes the reason mandatory on a rejection, and the reason is
  // what the submitting school is told. A mock that accepted a bare rejection
  // would let the client ship a reject button that produces no explanation.
  if (status === 'rejected' && !String(body?.rejectedReason || '').trim()) {
    throw new MockError(422, 'A reason is required when rejecting an ad', 'VALIDATION_ERROR');
  }

  ad.status = status;
  ad.rejectedReason = status === 'rejected' ? String(body.rejectedReason).trim() : '';
  return ad;
};

// ???????????????????? Parent messages ????????????????????
//
// Seeded here rather than generated per-request so the mock has the shape the real
// collection does: a mix of `new`, `read` and `resolved`, one with audio, and one
// whose `smsAlerted` is false with a reason ó because that last row is the one the
// school's "add a phone number" hint is written for, and a mock where it never
// appears is a mock where that hint is never seen.
const PARENT_MESSAGES = [
  {
    _id: 'pmsg0000000000000000000a1',
    messageId: 'PMSG-20260918-7KQ2M1',
    schoolId: null, // resolved to the signed-in user's school on read
    studentId: null,
    studentRef: 'STU-A1B2C3',
    studentName: 'Kwame Mensah',
    studentClass: 'JHS 2A',
    parentName: 'Mrs. Akosua Mensah',
    parentPhone: '0244123456',
    message: 'I paid 300 cedis at the office last Friday and this page still shows the full amount.',
    audio: null,
    hasAudio: false,
    status: 'new',
    readAt: null,
    resolvedAt: null,
    resolutionNote: null,
    smsAlerted: true,
    smsAlertFailure: null,
    createdAt: '2026-09-18T09:14:00.000Z',
  },
  {
    _id: 'pmsg0000000000000000000a2',
    messageId: 'PMSG-20260917-3D8R5X',
    schoolId: null,
    studentId: null,
    studentRef: 'STU-D4E5F6',
    studentName: 'Ama Serwaa Boateng',
    studentClass: 'Basic 7',
    parentName: 'Mr. Kojo Boateng',
    parentPhone: '0551234567',
    message: null,
    audio: {
      url: 'https://res.cloudinary.com/demo/video/upload/sample.webm',
      mimeType: 'audio/webm',
      bytes: 284_000,
      durationSeconds: 34,
    },
    hasAudio: true,
    status: 'new',
    readAt: null,
    resolvedAt: null,
    resolutionNote: null,
    smsAlerted: true,
    smsAlertFailure: null,
    createdAt: '2026-09-17T16:02:00.000Z',
  },
  {
    _id: 'pmsg0000000000000000000a3',
    messageId: 'PMSG-20260915-9BNP4L',
    schoolId: null,
    studentId: null,
    studentRef: 'STU-G7H8I9',
    studentName: 'Efua Nyameye',
    studentClass: 'KG 1',
    parentName: 'Mrs. Ama Nyameye',
    parentPhone: '0271234567',
    message: 'Can I move my daughter to a different class before term ends?',
    audio: null,
    hasAudio: false,
    status: 'resolved',
    readAt: '2026-09-16T08:30:00.000Z',
    resolvedAt: '2026-09-16T08:41:00.000Z',
    resolutionNote:
      'Called and confirmed the transfer to KG 2. Roster updated and the parent told in person.',
    smsAlerted: true,
    smsAlertFailure: null,
    createdAt: '2026-09-15T11:20:00.000Z',
  },
  {
    _id: 'pmsg0000000000000000000a4',
    messageId: 'PMSG-20260914-2TQZ8C',
    schoolId: null,
    studentId: null,
    studentRef: 'STU-J0K1L2',
    studentName: 'Yaw Osei',
    studentClass: 'JHS 3B',
    parentName: 'Mr. Samuel Osei',
    parentPhone: '0209876543',
    message: 'I need the receipt for last term, my son says it was not sent.',
    audio: null,
    hasAudio: false,
    status: 'read',
    readAt: '2026-09-15T07:05:00.000Z',
    resolvedAt: null,
    resolutionNote: null,
    // The case the "no alert was sent" hint exists for.
    smsAlerted: false,
    smsAlertFailure: 'No administrator phone number and no school phone number on file',
    createdAt: '2026-09-14T13:45:00.000Z',
  },
];

/** Scopes the fixture rows to whoever is signed in, the way the server does. */
const scopedParentMessages = (user) =>
  PARENT_MESSAGES.map((row) => ({
    ...row,
    schoolId: user?.schoolId || row.schoolId,
  }));

const listParentMessages = ({ user, query }) => {
  let rows = scopedParentMessages(user);

  if (query.status && query.status !== 'all') {
    rows = rows.filter((row) => row.status === query.status);
  }
  if (query.hasAudio === 'true') rows = rows.filter((row) => row.hasAudio);

  if (query.q) {
    const needle = String(query.q).toLowerCase();
    rows = rows.filter((row) =>
      [row.parentName, row.studentName, row.studentRef, row.message]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(needle))
    );
  }

  // The counts are computed over the *unfiltered* set except for the search, matching
  // `parentMessage.service.js` ó where `countByStatus` takes the school id only. A mock
  // that counted the active tab would make the tab labels move as you clicked them,
  // which is the exact behaviour the page was built to avoid.
  const counts = PARENT_MESSAGES.reduce(
    (acc, row) => {
      acc[row.status] = (acc[row.status] || 0) + 1;
      acc.all += 1;
      return acc;
    },
    { all: 0, new: 0, read: 0, resolved: 0, archived: 0 }
  );

  const page = Number(query.page) || 1;
  const perPage = Number(query.perPage) || 20;
  const start = (page - 1) * perPage;

  return {
    __rows: rows.slice(start, start + perPage),
    meta: {
      page,
      perPage,
      total: rows.length,
      totalPages: Math.max(1, Math.ceil(rows.length / perPage)),
    },
    counts,
  };
};

const markParentMessageRead = ({ params }) => {
  const row = PARENT_MESSAGES.find((entry) => entry._id === params.id);
  if (!row) throw new MockError(404, 'Message not found', 'NOT_FOUND');
  row.status = row.status === 'new' ? 'read' : row.status;
  row.readAt = row.readAt || new Date().toISOString();
  return row;
};

const resolveParentMessage = ({ params, body }) => {
  const row = PARENT_MESSAGES.find((entry) => entry._id === params.id);
  if (!row) throw new MockError(404, 'Message not found', 'NOT_FOUND');

  const note = String(body?.resolutionNote || '').trim();
  // The floor is mirrored here because "resolved" with nothing written down is the
  // same as unanswered, and a mock that let it through would ship a resolve button
  // that produces no record.
  if (note.length < 3) {
    throw new MockError(
      400,
      'Say what was done about it, so there is a record',
      'RESOLUTION_NOTE_REQUIRED'
    );
  }

  row.status = 'resolved';
  row.resolutionNote = note.slice(0, 500);
  row.resolvedAt = new Date().toISOString();
  return row;
};

/**
 * `GET /notifications` and its three mutations.
 *
 * The unread count lives in `meta` because `services/notifications.js` reads it from
 * there on every load rather than counting the rows it holds ó a bell that disagrees
 * with its own panel is the failure this whole module exists to prevent, and the mock
 * has to model it to be worth anything.
 */
const MOCK_NOTIFICATIONS = [
  {
    _id: 'ntf0000000000000000000b1',
    type: 'parent.message',
    title: 'Parent message ó Kwame Mensah',
    message: 'Mrs. Akosua Mensah asked about Kwame Mensah (JHS 2A).',
    link: '/dashboard/messages',
    read: false,
    createdAt: '2026-09-18T09:14:00.000Z',
    meta: {
      parentMessageId: 'PMSG-20260918-7KQ2M1',
      parentMessageRef: 'pmsg0000000000000000000a1',
      parentName: 'Mrs. Akosua Mensah',
      parentPhone: '0244123456',
      message: 'I paid 300 cedis at the office last Friday and this page still shows the full amount.',
      audioUrl: null,
      hasAudio: false,
    },
  },
  {
    _id: 'ntf0000000000000000000b2',
    type: 'parent.audio_message',
    title: 'Parent voice note ó Ama Serwaa Boateng',
    message: 'Mr. Kojo Boateng sent a voice note about Ama Serwaa Boateng (Basic 7).',
    link: '/dashboard/messages',
    read: false,
    createdAt: '2026-09-17T16:02:00.000Z',
    meta: {
      parentMessageId: 'PMSG-20260917-3D8R5X',
      parentMessageRef: 'pmsg0000000000000000000a2',
      parentName: 'Mr. Kojo Boateng',
      parentPhone: '0551234567',
      message: '',
      audioUrl: 'https://res.cloudinary.com/demo/video/upload/sample.webm',
      hasAudio: true,
    },
  },
  {
    _id: 'ntf0000000000000000000b3',
    type: 'plan.requested',
    title: 'Installment request ó Ama Serwaa Boateng',
    message: 'Mr. Kojo Boateng asked to split Basic 7 fees into 3 monthly installments.',
    link: '/dashboard/installment-plans',
    read: true,
    createdAt: '2026-09-16T10:00:00.000Z',
    meta: {},
  },
];

const listNotifications = ({ query }) => {
  let rows = [...MOCK_NOTIFICATIONS];

  // `read` arrives as the string `'true'`/`'false'` from the query string, which is
  // how `services/notifications.js` sends it.
  if (query.read !== undefined && query.read !== '') {
    rows = rows.filter((row) => row.read === (query.read === 'true' || query.read === true));
  }
  if (query.type) rows = rows.filter((row) => row.type === query.type);

  const page = Number(query.page) || 1;
  const perPage = Number(query.perPage) || 20;

  return {
    __rows: rows.slice((page - 1) * perPage, (page - 1) * perPage + perPage),
    meta: {
      page,
      perPage,
      total: rows.length,
      totalPages: Math.max(1, Math.ceil(rows.length / perPage)),
      // Counted across every notification for this user, never across the filtered
      // page ó the same rule the service follows.
      unreadCount: MOCK_NOTIFICATIONS.filter((row) => !row.read).length,
    },
  };
};

const markNotificationRead = ({ params }) => {
  const row = MOCK_NOTIFICATIONS.find((entry) => entry._id === params.id);
  if (!row) throw new MockError(404, 'Notification not found', 'NOT_FOUND');
  row.read = true;
  return row;
};

const markAllNotificationsRead = () => {
  const updatedCount = MOCK_NOTIFICATIONS.filter((row) => !row.read).length;
  MOCK_NOTIFICATIONS.forEach((row) => {
    row.read = true;
  });
  return { updatedCount };
};

const deleteNotification = ({ params }) => {
  const index = MOCK_NOTIFICATIONS.findIndex((entry) => entry._id === params.id);
  if (index === -1) throw new MockError(404, 'Notification not found', 'NOT_FOUND');
  MOCK_NOTIFICATIONS.splice(index, 1);
  return { message: 'Notification deleted' };
};

/**
 * `POST /pay/:token/notify-school`.
 *
 * Public, like the real route. The mock mirrors the two rules that were changed: a
 * voice note alone is a complete message, and the reply reports `adminsNotified` rather
 * than a bare `delivered` ó the confirmation screen branches on it, so a mock that
 * always returned `true` would make that screen untestable.
 */
const notifySchool = ({ body }) => {
  // Reads from either a plain object (the text-only JSON submission) or a `FormData`
  // (the multipart one carrying a recording). The mock adapter's `parseBody` returns
  // `config.data` untouched when it is not a string, so a `FormData` arrives here as a
  // `FormData` ó hence the duck-typed `get` rather than a property access.
  const read = (key) => {
    if (!body) return null;
    if (typeof body.get === 'function') return body.get(key);
    return body[key] ?? null;
  };

  const text = String(read('message') || '').trim();
  const hasAudio = Boolean(read('audio'));

  if (!text && !hasAudio) {
    throw new MockError(
      400,
      'Please write a message or record a voice note so the school can help',
      'VALIDATION_ERROR'
    );
  }
  if (text && text.length < 10) {
    throw new MockError(
      422,
      'Please write at least a short message so the school can help',
      'VALIDATION_ERROR'
    );
  }

  return {
    messageId: `PMSG-MOCK-${Date.now().toString(36).toUpperCase()}`,
    hasAudio,
    audioUrl: hasAudio ? 'https://res.cloudinary.com/demo/video/upload/sample.webm' : null,
    delivered: true,
    notificationLogged: true,
    adminsNotified: 2,
    schoolPhone: '030 200 1000',
  };
};

/**
 * `GET /users` ó and the platform-wide case is the interesting one.
 *
 * `userController.listUsers` computes
 * `targetSchoolId = query.schoolId || req.user.schoolId`, and a platform admin's
 * `schoolId` is `null`, so the `schoolId` filter is never applied and the query
 * returns **every user on the platform**. That is the whole reason the platform
 * console's user page needs no new endpoint, and reproducing it here is what
 * stops a mock from quietly scoping that page to one school.
 */
/** Mirrors `INVITABLE_BY_SCHOOL_ADMIN` in `Backend/src/validators/userValidators.js`. */
const INVITABLE_MOCK_ROLES = ['school_admin', 'accountant', 'teacher', 'viewer'];

/**
 * `POST /users/invite`
 *
 * Was absent from this table, which meant the school console's invite dialog and
 * the console's own invite path both 404'd against the mock while working against
 * the real API.
 *
 * It carries the single-owner rule for the same reason the other three do: the
 * real `resolveInvitableRole` refused `super_admin` only *after* being rewritten,
 * and before that it passed the requested role straight through for a caller who
 * already held it. The mock now refuses it first and unconditionally.
 */
const inviteUser = ({ body, user }) => {
  const requestedRole = body?.role || 'teacher';

  if (requestedRole === 'super_admin') {
    throw new MockError(
      403,
      'The platform admin role cannot be granted. It is assigned to a single account from the server environment.',
      'PLATFORM_ROLE_NOT_GRANTABLE'
    );
  }
  if (user?.role !== 'super_admin' && !INVITABLE_MOCK_ROLES.includes(requestedRole)) {
    throw new MockError(403, 'You cannot grant that role', 'ROLE_NOT_GRANTABLE');
  }

  ensurePlatformUsers();

  const invited = {
    _id: objectId(900 + getDb().users.length),
    name: String(body?.name || '').trim(),
    email: String(body?.email || '').trim().toLowerCase(),
    phone: body?.phone || null,
    position: body?.position || null,
    role: requestedRole,
    status: 'invited',
    isEmailVerified: true,
    isPlatformOwner: false,
    // School-scoped like the real handler: a super_admin inviting picks the school,
    // and a school admin can only ever invite into their own.
    schoolId: user?.role === 'super_admin' ? body?.schoolId || null : user?.schoolId || null,
    createdAt: new Date().toISOString(),
  };

  getDb().users.push(invited);
  return { user: invited, emailSent: true };
};

const listUsersHandler = ({ user, query }) => {
  const isPlatform = user?.role === 'super_admin';
  const targetSchoolId = isPlatform ? query.schoolId || user.schoolId : user?.schoolId;

  if (!isPlatform && query.schoolId && String(query.schoolId) !== String(user?.schoolId)) {
    throw new MockError(403, 'You can only view users from your school', 'FORBIDDEN');
  }

  // Seeded into the world first, so the accounts the list shows are the same
  // objects the mutation handlers resolve. See `ensurePlatformUsers`.
  const all = ensurePlatformUsers().filter((entry) => !entry.deletedAt);

  // A super_admin sees every account; anyone else sees only their school's. The
  // platform accounts carry their own `schoolId`, so the school-scoped case
  // filters them out without needing to know they exist.
  let rows = all;
  if (targetSchoolId) rows = rows.filter((entry) => String(entry.schoolId) === String(targetSchoolId));
  if (query.role) rows = rows.filter((entry) => entry.role === query.role);
  if (query.status) rows = rows.filter((entry) => entry.status === query.status);

  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 50;
  const start = (page - 1) * limit;
  return {
    users: rows.slice(start, start + limit),
pagination: { page, limit, total: rows.length, pages: Math.max(1, Math.ceil(rows.length / limit)) },
  };
};

// -- Users / settings / ads -------------------------------------------------

const updateUser = ({ params, body, user }) => {
  const target = getDb().users.find((u) => u._id === params.userId);
  if (!target) throw new MockError(404, 'User not found', 'USER_NOT_FOUND');
  if (user?.role !== 'super_admin' && user?._id !== target._id) {
    throw new MockError(403, 'You can only update your own profile', 'FORBIDDEN');
  }
  // The role is refused here as well as in the two dedicated endpoints, because
  // `PUT /users/:userId` carries no `authorize` middleware and is a second,
  // undocumented way to change a role. A mock that honoured it would make the
  // console's row dialogs pass while the real API refused ó and would let the
  // platform console appear to mint a second owner.
  if (body?.role === 'super_admin') {
    throw new MockError(
      403,
      'The platform admin role cannot be assigned. It is assigned to a single account from the server environment.',
      'PLATFORM_ROLE_NOT_GRANTABLE'
    );
  }
  if (body?.name) target.name = String(body.name).trim();
  if (body?.phone) target.phone = body.phone;
  if (body?.position !== undefined) target.position = body.position;
  if (body?.avatar !== undefined) target.avatar = body.avatar;
  if (body?.role) target.role = body.role;
  return target;
};

/**
 * `PUT /users/:userId/role`
 *
 * Reproduces the single-owner rule rather than the old check that any super_admin
 * could promote anyone. That old rule read as sensible and permitted exactly the
 * thing it appeared to prevent, and the seeded mock had only one super_admin, so
 * a mock that kept it would have made the console look correct in development and
 * failed in production.
 */
const changeUserRole = ({ params, body, user }) => {
  const target = getDb().users.find((u) => u._id === params.userId);
  if (!target) throw new MockError(404, 'User not found', 'USER_NOT_FOUND');
  if (user?.role !== 'super_admin') {
    throw new MockError(403, 'Only a super admin can change roles', 'FORBIDDEN');
  }
  if (body?.role === 'super_admin') {
    throw new MockError(
      403,
      'The platform admin role cannot be assigned. It is assigned to a single account from the server environment.',
      'PLATFORM_ROLE_NOT_GRANTABLE'
    );
  }
target.role = body.role;
  // The real handler answers `{ success, message, user }`, and
  // `services/user.js` reads `data.user` ó so returning the bare document here
  // would hand the caller `undefined` and fail at the call site rather than in
  // this mock, which is a far worse place to find out.
  return { success: true, message: 'User role updated successfully', user: target };
};

/**
 * `DELETE /users/:userId`
 *
 * Soft delete, matching the real handler, plus its two refusals: a caller cannot
 * remove themselves, and neither can anyone remove the platform owner. The owner
 * check is what makes "one super admin" survive an operator who decides the
 * account is no longer needed.
 */
const deleteUser = ({ params, user }) => {
  const target = getDb().users.find((u) => u._id === params.userId);
  if (!target || target.deletedAt) throw new MockError(404, 'User not found', 'USER_NOT_FOUND');

  if (String(params.userId) === String(user?._id)) {
    throw new MockError(400, 'You cannot delete your own account', 'CANNOT_DELETE_SELF');
  }
  if (target.isPlatformOwner || target.role === 'super_admin') {
    throw new MockError(403, 'Cannot delete a super admin account', 'FORBIDDEN');
  }

  target.deletedAt = new Date().toISOString();
  target.status = 'deactivated';
  target.tokenVersion = (target.tokenVersion || 0) + 1;
  return { success: true };
};

const getSettings = ({ params, user }) => {
  const school = getSchool({ params, user });
  return {
    brandColor: school.brandColor,
    motto: school.motto,
    yearFounded: school.yearFounded,
    website: school.website,
    gpsAddress: school.gpsAddress,
    classes: school.academic.classes,
    termsPerYear: school.academic.termsPerYear,
    gradingSystem: school.academic.gradingSystem,
    academic: school.academic,
  };
};

// ?? Regulated SMS credit purchase ??
//
// The pool and the queue, as *one* fixture pair. That pairing is the point: an
// operator's every decision here is "units promised" against "units left", so a mock
// with a queue and no pool would make the queue render without the number the
// approval depends on ó which is the same class of omission as the missing `/admin/
// school-ads` routes that hid a 404 until production.

const SMS_POOL_ENTRIES = [
  {
    _id: 'pool000000000000000000001',
    entryId: 'POOL-20260901-4KL2M9',
    direction: 'topup',
    units: 250000,
    amountPes: 3000000,
    provider: 'arke',
    reference: 'ARKE-INV-88213',
    balanceAfter: 250000,
    note: 'Quarterly purchase',
    createdBy: null,
    createdAt: '2026-09-01T08:00:00.000Z',
  },
  {
    _id: 'pool000000000000000000002',
    entryId: 'POOL-20260912-9WQ1ZX',
    direction: 'allocation',
    units: 25000,
    amountPes: 1250000,
    provider: 'arke',
    reference: 'SMS-PAY-20260912-7KQ2M1',
    schoolId: null,
    balanceAfter: 225000,
    note: 'Allocated to SMS-REQ-20260912-AB12CD',
    createdBy: null,
    createdAt: '2026-09-12T11:20:00.000Z',
  },
  {
    _id: 'pool000000000000000000003',
    entryId: 'POOL-20260916-5RT8YN',
    direction: 'allocation',
    units: 5000,
    amountPes: 250000,
    provider: 'arke',
    reference: 'SMS-PAY-20260916-3D8R5X',
    schoolId: null,
    balanceAfter: 220000,
    note: 'Allocated to SMS-REQ-20260916-EF34GH',
    createdBy: null,
    createdAt: '2026-09-16T14:05:00.000Z',
  },
];

const SMS_PURCHASE_REQUESTS = [
  {
    _id: 'smsreq000000000000000000a1',
    requestId: 'SMS-REQ-20260918-7KQ2M1',
    schoolId: null,
    requestedBy: { _id: 'u1', firstName: 'Adwoa', lastName: 'Sarpong' },
    units: 10000,
    unitPricePes: 25,
    totalPes: 250000,
    status: 'awaiting_approval',
    payment: {
      reference: 'SMS-PAY-20260918-7KQ2M1',
      provider: 'mtn',
      status: 'completed',
      financialTransactionId: 'MP250916.1805.A2B3C4',
      phoneNumber: '0241234567',
      completedAt: '2026-09-18T09:16:00.000Z',
    },
    approvedBy: null,
    approvedAt: null,
    decisionNote: null,
    rejectionReason: null,
    refundedAt: null,
    createdAt: '2026-09-18T09:14:00.000Z',
  },
  {
    _id: 'smsreq000000000000000000a2',
    requestId: 'SMS-REQ-20260918-2LMN9P',
    schoolId: null,
    requestedBy: { _id: 'u2', firstName: 'Kofi', lastName: 'Owusu' },
    units: 2000,
    unitPricePes: 25,
    totalPes: 50000,
    status: 'awaiting_payment',
    payment: {
      reference: 'SMS-PAY-20260918-2LMN9P',
      provider: 'mtn',
      status: 'processing',
      phoneNumber: '0551234567',
      promptedAt: '2026-09-18T10:02:00.000Z',
    },
    approvedBy: null,
    approvedAt: null,
    createdAt: '2026-09-18T10:02:00.000Z',
  },
  {
    _id: 'smsreq000000000000000000a3',
    requestId: 'SMS-REQ-20260915-QW56RT',
    schoolId: null,
    requestedBy: { _id: 'u3', firstName: 'Efua', lastName: 'Asante' },
    units: 500,
    unitPricePes: 25,
    totalPes: 12500,
    status: 'rejected',
    payment: {
      reference: 'SMS-PAY-20260915-QW56RT',
      provider: 'mtn',
      status: 'completed',
      financialTransactionId: 'MP250915.0912.X9Y8Z7',
      phoneNumber: '0201234567',
      completedAt: '2026-09-15T09:14:00.000Z',
    },
    rejectionReason: 'Duplicate of SMS-REQ-20260914-4BV2NX, already approved.',
    // Deliberately unrefunded: this is the row that shows the "Record refund" action,
    // and a mock where it never appears is a mock where that action is never seen.
    refundedAt: null,
    createdAt: '2026-09-15T09:12:00.000Z',
  },
];

/**
 * The pool balance, computed from the entries rather than stored.
 *
 * A stored number would drift the moment an entry is added, and the whole value of the
 * ledger is that the figure is derived. Same `$cond`-on-`direction` shape the server's
 * `getPoolTotals` aggregation uses, so the two cannot disagree about the sign
 * convention.
 */
const mockPoolTotals = () => {
  const sum = (directions) =>
    SMS_POOL_ENTRIES.filter((entry) => directions.includes(entry.direction)).reduce(
      (total, entry) => total + entry.units,
      0
    );

  const totalToppedUp = sum(['topup', 'reversal']);
  const totalAllocated = sum(['allocation']);

  return { totalToppedUp, totalAllocated, availableUnits: totalToppedUp - totalAllocated };
};

const UNIT_PRICE_PES = 25;

const mockQuoteSmsRequest = ({ body }) => {
  const units = Number(body?.units);
  if (!Number.isFinite(units) || units < 1) {
    throw new MockError(422, '"units" must be a positive number', 'VALIDATION_ERROR');
  }

  const { availableUnits } = mockPoolTotals();
  const totalPes = units * UNIT_PRICE_PES;

  return {
    units,
    unitPricePes: UNIT_PRICE_PES,
    totalPes,
    poolAvailable: availableUnits,
    canRequest: units <= availableUnits && UNIT_PRICE_PES > 0,
    reason:
      units > availableUnits
        ? 'Only part of that is available. Please reduce the quantity.'
        : null,
  };
};

const mockCreateSmsRequest = ({ body }) => {
  const quote = mockQuoteSmsRequest({ body });

  // The refusal is modelled, not skipped. A mock that always succeeded would make the
  // pool-exhausted path untestable ó and that path is the one that stops a school
  // being charged for units the platform does not have.
  if (!quote.canRequest) {
    throw new MockError(409, quote.reason || 'Only part of that is available.', 'SMS_POOL_EXHAUSTED');
  }

  const stamp = Date.now().toString(36).slice(-6).toUpperCase();
  return {
    requestId: `SMS-REQ-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${stamp}`,
    units: quote.units,
    unitPricePes: quote.unitPricePes,
    totalPes: quote.totalPes,
    status: 'awaiting_payment',
    paymentReference: `SMS-PAY-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${stamp}`,
    prompted: true,
  };
};

const mockListSmsRequests = ({ query }) => {
  const rows = SMS_PURCHASE_REQUESTS.map((row) => ({ ...row }));
  const filtered =
    query.status && query.status !== 'all'
      ? rows.filter((row) => row.status === query.status)
      : rows;

  const page = Number(query.page) || 1;
  const perPage = Number(query.perPage) || 20;

  return {
    __rows: filtered.slice((page - 1) * perPage, (page - 1) * perPage + perPage),
    meta: {
      page,
      perPage,
      total: filtered.length,
      totalPages: Math.max(1, Math.ceil(filtered.length / perPage)),
    },
  };
};

const mockGetSmsRequest = ({ params }) => {
  const row = SMS_PURCHASE_REQUESTS.find((entry) => entry.requestId === params.requestId);
  if (!row) throw new MockError(404, 'Request not found', 'SMS_REQUEST_NOT_FOUND');
  return row;
};

const mockGetSmsPool = () => {
  const totals = mockPoolTotals();

  return {
    ...totals,
    heldBySchools: 184500,
    unitPricePes: UNIT_PRICE_PES,
    poolLowThreshold: 10000,
    isLow: totals.availableUnits <= 10000,
    entries: [...SMS_POOL_ENTRIES].reverse(),
  };
};

const mockPoolTopUp = ({ body }) => {
  const units = Number(body?.units);
  if (!Number.isFinite(units) || units < 1) {
    throw new MockError(422, '"units" must be a positive number', 'VALIDATION_ERROR');
  }

  const before = mockPoolTotals().availableUnits;
  SMS_POOL_ENTRIES.unshift({
    _id: `pool${Date.now().toString(36)}`,
    entryId: `POOL-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-NEW01`,
    direction: 'topup',
    units,
    amountPes: body.amountPes ?? null,
    provider: body.provider || 'arke',
    reference: body.reference || null,
    balanceAfter: before + units,
    note: body.note || '',
    createdBy: null,
    createdAt: new Date().toISOString(),
  });

  return { entry: SMS_POOL_ENTRIES[0], availableUnits: before + units };
};

const mockAdminListSmsRequests = ({ query }) => mockListSmsRequests({ query });

const mockApproveSmsRequest = ({ params }) => {
  const row = SMS_PURCHASE_REQUESTS.find((entry) => entry.requestId === params.requestId);
  if (!row) throw new MockError(404, 'Request not found', 'NOT_FOUND');

  // Already approved is answered, not refused ó mirroring the server, where a
  // double-click is a UI event rather than a second allocation.
  if (row.status === 'approved') {
    return { requestId: row.requestId, schoolBalance: null, alreadyApproved: true };
  }

  if (row.status !== 'awaiting_approval') {
    throw new MockError(
      409,
      `A request that is ${row.status.replace(/_/g, ' ')} cannot be approved`,
      'SMS_REQUEST_NOT_APPROVABLE'
    );
  }

  const { availableUnits } = mockPoolTotals();
  if (row.units > availableUnits) {
    throw new MockError(
      409,
      `Only ${availableUnits} units are left in the pool.`,
      'SMS_POOL_EXHAUSTED'
    );
  }

  row.status = 'approved';
  row.approvedAt = new Date().toISOString();
  SMS_POOL_ENTRIES.unshift({
    _id: `pool${Date.now().toString(36)}`,
    entryId: `POOL-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-ALLOC`,
    direction: 'allocation',
    units: row.units,
    amountPes: row.totalPes,
    provider: 'arke',
    reference: row.payment?.reference || null,
    balanceAfter: availableUnits - row.units,
    note: `Allocated to ${row.requestId}`,
    createdBy: null,
    createdAt: new Date().toISOString(),
  });

  return { requestId: row.requestId, schoolBalance: null, alreadyApproved: false };
};

const mockRejectSmsRequest = ({ params, body }) => {
  const reason = String(body?.reason || '').trim();
  if (reason.length < 3) {
    throw new MockError(422, 'Give a reason ó the school is told what it is', 'VALIDATION_ERROR');
  }

  const row = SMS_PURCHASE_REQUESTS.find((entry) => entry.requestId === params.requestId);
  if (!row) throw new MockError(404, 'Request not found', 'NOT_FOUND');

  if (row.status === 'approved') {
    throw new MockError(
      409,
      'This request was already approved and the units released',
      'SMS_REQUEST_ALREADY_APPROVED'
    );
  }

  row.status = 'rejected';
  row.rejectionReason = reason;
  return { requestId: row.requestId, alreadyRejected: false };
};

const mockMarkSmsRequestRefunded = ({ params }) => {
  const row = SMS_PURCHASE_REQUESTS.find((entry) => entry.requestId === params.requestId);
  if (!row) throw new MockError(404, 'Request not found', 'NOT_FOUND');

  row.refundedAt = row.refundedAt || new Date().toISOString();
  if (row.payment) row.payment.status = 'refunded';
  return { requestId: row.requestId };
};

// ?? School-side advertisement requests ??
//
// Keyed to the *signed-in* user's school, the way the real routes are: the request
// path has no school id at all (`/schools/me/ad-requests`), so the mock has nothing to
// key on either. `scopedAdRequests` stamps `schoolId` from the session, which is also a
// standing check that nothing here ever starts trusting a body field.

const AD_REQUESTS = [
  {
    _id: 'adreq000000000000000000a1',
    schoolId: null,
    schoolName: 'Prampram Basic School',
    headline: 'Admissions open for 2026/27',
    writeup:
      'Applications for the new academic year are now open. We offer the full primary curriculum with qualified teachers, and places are limited in JHS 2A.',
    imageUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
    imageAlt: 'Students in the school assembly hall',
    linkUrl: 'https://example.edu.gh/admissions',
    placement: 'auth_aside',
    status: 'pending',
    endsAt: '2026-11-30T00:00:00.000Z',
    requestedBy: 'u1',
    authoredByPlatform: false,
    copyEditedByReview: false,
    rejectedReason: '',
    createdAt: '2026-09-18T08:30:00.000Z',
  },
  {
    _id: 'adreq000000000000000000a2',
    schoolId: null,
    schoolName: 'Prampram Basic School',
    headline: 'Boarding places available',
    writeup:
      'Secure boarding for senior students, with a resident matron and a study hall every evening from 6pm.',
    imageUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
    imageAlt: 'The school dormitory block',
    linkUrl: 'https://example.edu.gh/boarding',
    placement: 'home_hero',
    status: 'approved',
    endsAt: '2026-10-31T00:00:00.000Z',
    requestedBy: 'u2',
    authoredByPlatform: false,
    // The case the "wording was adjusted" notice exists for. Without it in the
    // fixture, that branch of the page never renders.
    copyEditedByReview: true,
    rejectedReason: '',
    createdAt: '2026-09-10T12:00:00.000Z',
  },
  {
    _id: 'adreq000000000000000000a3',
    schoolId: null,
    schoolName: 'Prampram Basic School',
    headline: 'Free JHS scholarship drive',
    writeup: null,
    imageUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
    imageAlt: 'A student receiving a certificate',
    linkUrl: 'https://example.edu.gh/scholarship',
    placement: 'dashboard_sidebar',
    status: 'rejected',
    endsAt: '2026-09-30T00:00:00.000Z',
    requestedBy: 'u1',
    authoredByPlatform: false,
    copyEditedByReview: false,
    rejectedReason:
      'The link goes to an external site we cannot verify, and ìfreeî needs a stated eligibility rule.',
    createdAt: '2026-09-05T15:45:00.000Z',
  },
];

const scopedAdRequests = (user) =>
  AD_REQUESTS.map((row) => ({ ...row, schoolId: user?.schoolId || row.schoolId }));

const mockListMyAdRequests = ({ user, query }) => {
  let rows = scopedAdRequests(user);

  if (query.status && query.status !== 'all') {
    rows = rows.filter((row) => row.status === query.status);
  }

  const page = Number(query.page) || 1;
  const perPage = Number(query.perPage) || 20;

  return {
    __rows: rows.slice((page - 1) * perPage, (page - 1) * perPage + perPage),
    meta: {
      page,
      perPage,
      total: rows.length,
      totalPages: Math.max(1, Math.ceil(rows.length / perPage)),
    },
  };
};

/**
 * `POST /schools/me/ad-requests`
 *
 * Reads via `FormData.get`, because `mockAdapter`'s `parseBody` returns `config.data`
 * untouched when it is not a string ó so a `FormData` arrives here as a `FormData`.
 *
 * The validation is modelled rather than assumed: the `linkUrl` https rule is the
 * security-relevant one, and a mock that skipped it would let a `javascript:` URL
 * through development and only fail on the server that actually enforces it.
 */
const mockCreateMyAdRequest = ({ body }) => {
  const read = (key) => {
    if (!body) return null;
    if (typeof body.get === 'function') return body.get(key);
    return body[key] ?? null;
  };

  const headline = String(read('headline') || '').trim();
  const linkUrl = String(read('linkUrl') || '').trim();
  const endsAt = read('endsAt');
  const imageAlt = String(read('imageAlt') || '').trim();

  const errors = {};
  if (headline.length < 4) errors.headline = 'Give the advertisement a headline of at least 4 characters';
  if (headline.length > 60) errors.headline = 'The headline is limited to 60 characters ó put the detail in the writeup';
  if (imageAlt.length < 5) errors.imageAlt = 'Describe the image';

  if (!/^https:\/\/\S+$/i.test(linkUrl)) {
    errors.linkUrl = 'linkUrl must be a valid https URL';
  }
  if (!endsAt) errors.endsAt = 'Choose an end date in the future';
  else if (new Date(endsAt) <= new Date()) errors.endsAt = 'Choose an end date in the future';

  if (Object.keys(errors).length) {
    throw new MockError(422, Object.values(errors).join(' '), 'VALIDATION_ERROR');
  }

  const created = {
    _id: `adreq${Date.now().toString(36)}`,
    schoolId: null,
    schoolName: 'Your school',
    headline,
    writeup: String(read('writeup') || '') || null,
    imageUrl:
      read('image') && typeof read('image') !== 'string'
        ? 'https://res.cloudinary.com/demo/image/upload/sample.jpg'
        : String(read('image') || ''),
    imageAlt,
    linkUrl,
    placement: read('placement') || 'auth_aside',
    status: 'pending',
    endsAt: new Date(endsAt).toISOString(),
    requestedBy: 'u1',
    authoredByPlatform: false,
    copyEditedByReview: false,
    rejectedReason: '',
    createdAt: new Date().toISOString(),
  };

  AD_REQUESTS.unshift(created);
  return created;
};

const mockWithdrawMyAdRequest = ({ params }) => {
  const row = AD_REQUESTS.find((entry) => entry._id === params.adId);
  if (!row) throw new MockError(404, 'Advertisement not found', 'AD_NOT_FOUND');

  // Modelled because the real service refuses anything already decided on, and the
  // page hides the action on exactly that condition. A mock that always withdrew would
  // let the 409 branch ship untested.
  if (!['pending', 'draft'].includes(row.status)) {
    throw new MockError(
      409,
      row.status === 'approved'
        ? 'This advertisement is live. Contact support to take it down.'
        : 'Only a request that has not been reviewed can be withdrawn.',
      'AD_NOT_WITHDRAWABLE'
    );
  }

  row.status = 'expired';
  return { _id: row._id, status: row.status };
};

/**
 * `GET /public/school-ads`
 *
 * Honours `features.adsEnabled`, exactly as the real handler does: an **empty list
 * with `adsEnabled: false`**, never an error. The login page's only "no ads" state
 * today is an empty array, and a mock that answered with a 503 here would give it a
 * failure mode it does not have against the real API.
 */
const listSchoolAds = () => {
  const settings = currentPlatformSettings();
  if (settings.features.adsEnabled === false) return { ads: [], adsEnabled: false };

  return {
    ads: [
    {
      _id: objectId(11),
      schoolName: 'Greenfield Academy',
      headline: 'Admissions open for 2026',
      imageUrl: 'https://picsum.photos/seed/sukuupay-greenfield/960/540',
      imageAlt: 'Greenfield Academy senior school campus building',
      linkUrl: 'https://example.com/greenfield/apply',
    },
    {
      _id: objectId(12),
      schoolName: 'Riverside International',
      headline: 'Now boarding, grades 1ñ12',
      imageUrl: 'https://picsum.photos/seed/sukuupay-riverside/960/540',
      imageAlt: 'Riverside International School main gate',
      linkUrl: 'https://example.com/riverside/apply',
    },
    ],
    adsEnabled: true,
  };
};

const health = () => ({ status: 'ok', mock: true, uptimeSeconds: Math.round(process.uptime?.() || 0) });

// -- Route table ------------------------------------------------------------

/**
 * Order matters: the first pattern whose regex matches the path wins, so
 * `/schools/:schoolId/verify-hubtel` is listed before `/schools/:schoolId`.
 */
export const ROUTES = [
  ['POST', /^\/auth\/login$/, login, { public: true }],
  ['POST', /^\/auth\/signup$/, signup, { public: true }],
  ['POST', /^\/auth\/logout$/, ({ token }) => {
    // Must actually revoke. `authController.logout` deletes the session server
    // side, so a token that survives the call would let a "signed out" tab keep
    // reading a school's student data. The access token arrives as `token`; the
    // user object has no such field.
    revokeToken(token);
    return { message: 'Signed out' };
  }],
  ['GET', /^\/auth\/me$/, me],
  ['POST', /^\/auth\/verify-email\/([^/]+)$/, verifyEmail, { public: true }],
  ['POST', /^\/auth\/resend-verification$/, resendVerification, { public: true }],
  ['POST', /^\/auth\/forgot-password$/, forgotPassword, { public: true }],
  ['POST', /^\/auth\/reset-password\/([^/]+)$/, resetPassword, { public: true }],
  ['POST', /^\/auth\/refresh$/, ({ body }) => {
    const tokens = refreshSession(body?.refreshToken);
    if (!tokens) throw new MockError(401, 'Refresh token is invalid or expired', 'INVALID_REFRESH_TOKEN');
    return { tokens };
  }, { public: true }],

  // Self-service school provisioning and join-by-code. Declared before the
  // `/schools/:schoolId` patterns for readability; they cannot collide, since
  // "me" and "join" are not ObjectIds.
  ['POST', /^\/schools\/me$/, provisionMySchool],
  ['POST', /^\/schools\/join$/, joinSchool],

  // `verifyHubtel` is a POST: `services/school.js` calls
  // `api.post('/schools/:id/verify-hubtel', credentials)`. Registering it as PUT
  // made the mock 404 on a call the frontend genuinely makes.
  ['POST', /^\/schools\/([^/]+)\/verify-hubtel$/, verifyHubtel, { mockOnly: true }],
  ['PUT', /^\/schools\/([^/]+)\/payout$/, updatePayout, { mockOnly: true }],
  ['PUT', /^\/schools\/([^/]+)\/logo$/, ({ params, user, data }) =>
    uploadSchoolLogo({ data, user: { ...user, schoolId: params.schoolId } }).then((r) => ({ data: r }))],
  ['GET', /^\/schools\/([^/]+)$/, getSchool],
  ['PUT', /^\/schools\/([^/]+)$/, updateSchool],

  ['POST', /^\/upload\/school-logo$/, uploadSchoolLogo],
  // Mirrors `uploadStudentImage`: the same MIME and 2MB limits the real service
  // enforces, and ó unlike the previous stub, which returned a URL and wrote
  // nothing ó it persists onto the student when a `studentId` is supplied.
  //
  // That matters because the photo field uploads on its own timer and the
  // roster reads `studentImage` back. A mock that discards the write makes the
  // upload look like it silently failed: the preview shows the photo, the row
  // underneath keeps its monogram, and the obvious conclusion is that the app
  // is broken rather than the mock.
  ['POST', /^\/upload\/student-photo$/, async ({ data, user }) => {
    const form = data instanceof FormData ? data : null;
    const file = form?.get('file');
    if (!file) throw new MockError(400, 'No file provided', 'NO_FILE');

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      throw new MockError(400, 'Only JPG, PNG, and WebP images are allowed', 'INVALID_MIME');
    }
    if (file.size > 2 * 1024 * 1024) {
      throw new MockError(400, 'Image must be smaller than 2MB', 'FILE_TOO_LARGE');
    }

    const url = `https://res.cloudinary.com/mock/image/upload/${objectId(21)}`;
    const studentId = form.get('studentId');

    if (studentId) {
      const db = getDb();
      const student = db.students.find((s) => s._id === studentId);
      if (!student) throw new MockError(404, 'Student not found', 'STUDENT_NOT_FOUND');
      student.studentImage = url;
    }

    return { url };
  }],

  // Literal segments before the parameter, matching `student.routes.js`. The
  // mock has the same ordering dependency the real router does, and getting it
  // wrong here would hide a real bug.
  ['POST', /^\/students\/bulk\/update$/, bulkDryRun],
  ['POST', /^\/students\/bulk\/archive$/, bulkDryRun],
  ['POST', /^\/students\/bulk\/status$/, bulkDryRun],
  ['POST', /^\/students\/bulk\/pay-links$/, bulkDryRun],
  // ID cards. Order matters twice over, mirroring `idCard.routes.js`.
  //
  // `/id-cards/qr-links/:schoolId` and `/id-cards/batch/:batchId/pdf` are both
  // four-segment paths that would otherwise be swallowed by
  // `/id-cards/:studentId`Ö which takes two segments and so cannot match them,
  // but `qr-links` is placed first anyway because it is the one whose first
  // segment is a literal word, and reading it in the same order as the real
  // router is what keeps the two files diffable.
  ['POST', /^\/id-cards\/batch$/, createIdCardBatch],
  ['GET', /^\/id-cards\/qr-links\/(?<schoolId>[^/]+)$/, getQrLinksExport],
  ['GET', /^\/id-cards\/batch\/(?<batchId>[^/]+)\/pdf$/, getIdCardBatchPdf],
  ['GET', /^\/id-cards\/batch\/(?<batchId>[^/]+)$/, getIdCardBatchPreview],
  ['GET', /^\/id-cards\/(?<studentId>[^/]+)$/, getStudentIdCard],

  // `promote/preview` is a literal two-segment path and must precede
  // `/students/:id/...`, or the router would read "promote" as the student id
  // and the wizard's mapping step would 404 on every load.
  ['POST', /^\/students\/promote\/preview$/, previewPromotion],
  ['POST', /^\/students\/bulk-graduate\/(?<schoolId>[^/]+)$/, bulkGraduate],
  ['POST', /^\/students\/(?<id>[^/]+)\/promote$/, promoteStudent],
  ['POST', /^\/students\/(?<id>[^/]+)\/repeat$/, repeatStudent],
  ['POST', /^\/students\/(?<id>[^/]+)\/unrepeat$/, clearRepeat],
  ['POST', /^\/students\/(?<id>[^/]+)\/transfer-out$/, transferOutStudent],
  ['POST', /^\/students\/bulk$/, bulkImport],
  ['POST', /^\/students\/single$/, createStudent],
  ['GET', /^\/students\/stats$/, studentStats],
  ['GET', /^\/students\/(?<id>[^/]+)\/profile$/, studentProfile],
  ['GET', /^\/students\/([^/]+)\/parents$/, ({ params }) => {
    // `params.token`, not `params.id`: the adapter's positional fallback names
    // the first group `token`, and this route has one unnamed group.
    const student = db.students.find((s) => s._id === params.token);
    if (!student) throw new MockError(404, 'Student not found', 'NOT_FOUND');
    return { parents: student.parents || [] };
  }],
  ['GET', /^\/students$/, listStudents],

  // Two segments for the cohort detail, matching the real route. The mock has the
  // same ordering dependency the Express router does: a single-segment
  // `/cohorts/:id` would be captured by `/cohorts/:schoolId` and the detail
  // handler would be unreachable ó which is exactly how the real route was
  // broken.
  ['GET', /^\/cohorts\/detail\/(?<cohortId>[^/]+)$/, getCohortDetail],
  ['GET', /^\/cohorts\/(?<schoolId>[^/]+)$/, listCohorts],
  ['GET', /^\/alumni\/(?<schoolId>[^/]+)$/, listAlumni],

  // Unauthenticated, and registered last: the mock resolves routes in order, and
  // a pay token looks like any other single segment.
  ['POST', /^\/pay\/(?<token>[^/]+)\/initiate$/, initiatePay],
  ['POST', /^\/pay\/(?<token>[^/]+)\/verify$/, verifyPay],
  ['GET', /^\/pay\/(?<token>[^/]+)\/receipt\/(?<paymentId>[^/]+)$/, () => ({
    // A deliberate stub, and the message now says so. The real `getReceipt`
    // returns the same receipt document as the admin route ó JSON, not a file ó
    // and this handler no longer claims otherwise: "receipts are a PDF in
    // production" was false in both modes, and a reader who believed it had no
    // way to tell a scoped-out stub from a wrong assumption about the endpoint.
    // The admin receipt, `GET /payments/:paymentId/receipt`, is fully mocked.
    __raw: {
      receipt: null,
      message:
        'The public receipt route is not mocked. The admin receipt at GET /payments/:paymentId/receipt is.',
    },
  })],
  ['GET', /^\/pay\/(?<token>[^/]+)$/, getPayView],

  // Before `/payments`, whose id segment is `:paymentId`. Both use a named group
  // because the adapter's positional fallback would call the first segment
  // `token`.
  ['POST', /^\/payments\/record$/, recordManualPayment],
  ['GET', /^\/payments$/, listPayments],

  // `/payments/summary` and `/payments/export` ahead of the parameterised detail
  // route, mirroring `payment.routes.js` and for the reason it puts them there.
  // This table resolves in order and the first matching pattern wins, so a
  // `summary` entry listed below `/payments/:paymentId` is not a summary request
  // at all: "summary" reads as a payment id, the detail handler 404s, and the KPI
  // band reports "not available" for a school that has taken mobile money all
  // term. Express has the identical dependency and a louder one ó
  // `paymentIdParamSchema` demands at least five characters, so a request that
  // reached the detail route would have 422'd with a message about a payment id ó
  // which means a mock that got the order wrong would be testing the wrong
  // failure and looking correct while doing it.
  ['GET', /^\/payments\/summary$/, paymentSummary],
  ['GET', /^\/payments\/export$/, exportPayments],

  // The two-segment routes cannot collide with the single-segment one below
  // whatever order they sit in, because `[^/]+` cannot span a slash and the
  // patterns are anchored. Named groups throughout, for the `token` reason above.
  ['GET', /^\/payments\/(?<paymentId>[^/]+)\/receipt$/, getPaymentReceipt],
  ['POST', /^\/payments\/(?<paymentId>[^/]+)\/refund$/, refundPayment],
  ['GET', /^\/payments\/(?<paymentId>[^/]+)$/, getPaymentDetail],

  // Installment plans. The literal `school/:schoolId/compliance` is registered
  // before `/:studentId` because this table resolves in order ó a plan for a
  // student whose id happens to read "school" is a nice error message, not a
  // reason to leave the compliance route unreachable.
  ['GET', /^\/payment-plans\/school\/(?<schoolId>[^/]+)\/compliance$/, getSchoolComplianceHandler],
  ['POST', /^\/payment-plans\/create\/(?<studentId>[^/]+)$/, createPaymentPlanHandler],
  ['PUT', /^\/payment-plans\/(?<planId>[^/]+)\/installment\/(?<num>[^/]+)$/, updateInstallmentHandler],
  ['PUT', /^\/payment-plans\/(?<planId>[^/]+)$/, updatePaymentPlanHandler],
  ['DELETE', /^\/payment-plans\/(?<planId>[^/]+)$/, cancelPaymentPlanHandler],
  ['GET', /^\/payment-plans\/(?<studentId>[^/]+)$/, getStudentPlanHandler],

  // SMS. The table resolves in order and dispatches on method as well as path,
  // so `/sms/credits/top-up` (POST) and `/sms/credits/:schoolId` (GET) coexist
  // without either shadowing the other ó the method is what separates them, not
  // the position.
  ['GET', /^\/sms\/credits\/(?<schoolId>[^/]+)$/, getSmsCreditsHandler],
  ['POST', /^\/sms\/credits\/top-up$/, topUpSmsCreditsHandler],
  ['POST', /^\/sms\/audience\/preview$/, previewAudienceHandler],
  ['POST', /^\/sms\/bulk$/, bulkSendSmsHandler],
  ['GET', /^\/sms\/jobs$/, listSmsJobsHandler],
  ['POST', /^\/sms\/jobs\/(?<jobId>[^/]+)\/cancel$/, cancelSmsJobHandler],
  ['GET', /^\/sms\/messages$/, listSmsMessagesHandler],
  ['POST', /^\/sms\/templates\/preview$/, previewTemplateHandler],
  ['GET', /^\/sms\/templates$/, listSmsTemplatesHandler],
  ['POST', /^\/sms\/templates$/, createSmsTemplateHandler],
  ['PATCH', /^\/sms\/templates\/(?<templateId>[^/]+)$/, updateSmsTemplateHandler],
  ['DELETE', /^\/sms\/templates\/(?<templateId>[^/]+)$/, deleteSmsTemplateHandler],
  ['POST', /^\/sms\/bulk\/([^/]+)$/, sendBulkSms, { mockOnly: true }],
  ['GET', /^\/admin\/sms-balance$/, getSmsBalance],

  // The platform console. `admin.routes.js` applies
  // `authenticate` + `authorize("super_admin")` at the router level, so each
  // handler re-checks the role rather than the adapter doing it once ó the same
  // way every other guarded route in this file behaves.
  //
  // Ordered longest-first within each resource: `/admin/schools/:id/usage` has to
  // be matched before `/admin/schools/:id`, and the `*` below would swallow both
  // otherwise.
  ['GET', /^\/admin\/schools\/(?<schoolId>[^/]+)\/usage$/, adminSchoolUsage],
  ['PUT', /^\/admin\/schools\/(?<schoolId>[^/]+)\/suspend$/, adminSuspendSchool],
  ['PUT', /^\/admin\/schools\/(?<schoolId>[^/]+)\/unsuspend$/, adminUnsuspendSchool],
  ['PUT', /^\/admin\/school-ads\/(?<adId>[^/]+)\/approve$/, adminReviewSchoolAd],
  ['GET', /^\/admin\/schools$/, adminListSchools],
  ['GET', /^\/admin\/school-ads$/, adminListSchoolAds],
  ['GET', /^\/admin\/revenue\/series$/, adminRevenueSeries],
  ['GET', /^\/admin\/revenue$/, adminRevenue],
  ['GET', /^\/admin\/settings$/, adminGetSettings],
  ['PUT', /^\/admin\/settings$/, adminUpdateSettings],
  ['GET', /^\/admin\/dashboard$/, adminDashboard],

  // `GET /users` was absent from this table, which meant the school console's
  // User Management 404'd against the mock while working against the real API ó
  // the exact drift this file exists to catch, found by the platform console
  // needing the same route.
  ['GET', /^\/users$/, listUsersHandler],

  // Registered before `/users/:userId`, which its pattern would otherwise match.
  // `resolveRoute` walks the table in order, so ordering is what separates the two
  // PUTs ó the same rule the invite route depends on.
  //
  // The named group is load-bearing. `extractParams` falls back to naming the
  // *last* path segment `userId`, so an unnamed `/users/([^/]+)/role` pattern hands
  // the handler the literal string `'role'` and every lookup 404s. Named groups
  // win over that fallback in `resolveRoute`.
  ['PUT', /^\/users\/(?<userId>[^/]+)\/role$/, changeUserRole],
  ['DELETE', /^\/users\/(?<userId>[^/]+)$/, deleteUser],
  ['PUT', /^\/users\/([^/]+)$/, updateUser],

  // Registered before `/users/:userId` for the same ordering reason.
  ['POST', /^\/users\/invite$/, inviteUser],
  ['GET', /^\/settings\/([^/]+)$/, getSettings],

  // ?? Parent messages and notifications ??
  //
  // Both were absent here while the real API served them, which is the mock drifting
  // from the product in the same direction as the ad routes did ó it is what made
  // those look fine in development and 404 in production. Mock coverage is the only
  // early warning this repo has for a route that exists on one side only.
  //
  // Ordered longest-first: `/parent-messages/student/:id` and
  // `/parent-messages/:id/read` both have to beat the bare `/parent-messages/:id`, or
  // `resolveRoute`'s first match hands the handler `student` as an id.
  ['GET', /^\/parent-messages\/student\/(?<studentId>[^/]+)$/, ({ query, user }) => {
    const rows = scopedParentMessages(user).filter((row) => row.studentRef === query.studentRef);
    return { __rows: rows, meta: { page: 1, perPage: 20, total: rows.length, totalPages: 1 } };
  }],
  ['PUT', /^\/parent-messages\/(?<id>[^/]+)\/read$/, markParentMessageRead],
  ['PUT', /^\/parent-messages\/(?<id>[^/]+)\/resolve$/, resolveParentMessage],
  ['GET', /^\/parent-messages$/, listParentMessages],
  ['GET', /^\/parent-messages\/(?<id>[^/]+)$/, ({ params }) => {
    const row = PARENT_MESSAGES.find((entry) => entry._id === params.id);
    if (!row) throw new MockError(404, 'Message not found', 'NOT_FOUND');
    return row;
  }],

  // `read-all` before `/:id/read` is not required ó the two differ in position ó but
  // it is written in path order so a future reordering is visibly deliberate.
  ['PUT', /^\/notifications\/read-all$/, markAllNotificationsRead],
  ['PUT', /^\/notifications\/(?<id>[^/]+)\/read$/, markNotificationRead],
  ['DELETE', /^\/notifications\/(?<id>[^/]+)$/, deleteNotification],
  ['GET', /^\/notifications$/, listNotifications],

  // Public, like the real route ó `payment.routes.js` mounts this under the pay token
  // with a per-token rate limiter and no `authenticate`.
  ['POST', /^\/pay\/[^/]+\/notify-school$/, notifySchool, { public: true }],

  // ?? Regulated SMS credit purchase ??
  //
  // Ordered so the concrete literal beats the parameterised sibling: `/sms-requests/
  // quote` and `/sms-requests/:requestId` are both two-segment paths under the same
  // prefix, and `resolveRoute` walks this table in order.
  ['POST', /^\/sms-requests\/quote$/, mockQuoteSmsRequest],
  ['POST', /^\/sms-requests$/, mockCreateSmsRequest],
  ['GET', /^\/sms-requests\/(?<requestId>[^/]+)$/, mockGetSmsRequest],
  ['GET', /^\/sms-requests$/, mockListSmsRequests],

  ['POST', /^\/admin\/sms\/pool\/topup$/, mockPoolTopUp],
  ['POST', /^\/admin\/sms\/requests\/(?<requestId>[^/]+)\/approve$/, mockApproveSmsRequest],
  ['POST', /^\/admin\/sms\/requests\/(?<requestId>[^/]+)\/reject$/, mockRejectSmsRequest],
  ['POST', /^\/admin\/sms\/requests\/(?<requestId>[^/]+)\/refund$/, mockMarkSmsRequestRefunded],
  ['GET', /^\/admin\/sms\/requests$/, mockAdminListSmsRequests],
  ['GET', /^\/admin\/sms\/pool$/, mockGetSmsPool],

  // ?? A school's own advertisement requests ??
  //
  // `/schools/me/Ö` with no school id anywhere ó matching the real routes, so a mock
  // handler that ever wanted a school parameter would have nowhere to get one from.
  ['DELETE', /^\/schools\/me\/ad-requests\/(?<adId>[^/]+)$/, mockWithdrawMyAdRequest],
  ['POST', /^\/schools\/me\/ad-requests$/, mockCreateMyAdRequest],
  ['GET', /^\/schools\/me\/ad-requests$/, mockListMyAdRequests],

  ['GET', /^\/public\/school-ads$/, listSchoolAds, { public: true }],
  ['GET', /^\/health$/, health, { public: true }],
];

export { publicUser, validateStudentPayload, GHANA_PHONE, ghanaPhone, buildStudents };

