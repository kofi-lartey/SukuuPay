/**
 * Mock route handlers.
 *
 * Each handler mirrors the corresponding Express route in Backend/src — same
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
 * Signup classification → `School.type`, mirroring
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
 * Backend/src/validators/authValidators.js — `super_admin` is a platform
 * operator and must never be self-granted.
 */
const SELF_SIGNUP_ROLES = ['school_admin', 'accountant', 'teacher', 'viewer'];


// ── Auth ───────────────────────────────────────────────────────────────────

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
    // `school_admin` rather than erroring — the same failure the real controller
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
  // `services/auth.js` — the one that keeps a user off a dead-end signup form —
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
 * an already-verified address, and an address that does not exist — which is
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
  // read them. `onboarding` is the server's resolved link state — without it the
  // client has to infer "is this account linked" from a nullable `schoolId`,
  // which is how the dead end got there in the first place.
  return { user: publicUser(user), onboarding: onboardingBlock(user) };
};


// ── Schools ────────────────────────────────────────────────────────────────

/**
 * `POST /schools/me` — self-service provisioning. Mirrors
 * `provisionSchoolForUser` in Backend/src/services/school.service.js.
 *
 * This is the handler that makes the CREATE-mode branch of Step 1 real. Without
 * it the mock would reject the one call the whole feature depends on, and the
 * "no school linked" persona would have nothing but the old dead end to show.
 *
 * Idempotent by construction: a replayed submit finds `user.schoolId` already
 * set and returns `200` with the existing school instead of creating a second
 * one — the same behaviour the real service has, and the reason a double-clicked
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
 * `POST /schools/join` — request to join a school that already exists.
 *
 * The code identifies the school; it does not authenticate the applicant, so the
 * mock mirrors the real service and parks the request as `pending` rather than
 * linking anybody. Handing out access on the code alone would be the one thing
 * this flow must not do — codes are initials plus a three-digit counter.
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
 * `PUT /schools/:id` — mirrors `updateSchoolSchema`.
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
    // arbitrary value here means something bypassed the control — the server
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
  // object would create one — the reassembly below mirrors `updateSchool`.
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

  // Never persisted verbatim — the dotted keys are transport, not fields.
  delete data['location.latitude'];
  delete data['location.longitude'];
  delete data['location.source'];

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

  return {
    ...school,
    __stripped: Object.keys(data).filter((k) => !ALLOWED.includes(k) && !k.startsWith('location.')),
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
 * `PUT /schools/:id/payout` — **does not exist on the real API.**
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

/** `POST /schools/:id/verify-hubtel` — also not on the real API. */
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

// ── Students ───────────────────────────────────────────────────────────────

const listStudents = ({ query, user }) => {
  const schoolId = resolveSchoolId(user, query?.schoolId);
  if (!schoolId) throw new MockError(400, 'A schoolId is required to list students', 'NO_SCHOOL_SCOPE');

  let rows = studentsFor(schoolId);
  if (query?.search) {
    const needle = String(query.search).toLowerCase();
    rows = rows.filter((s) => s.studentName.toLowerCase().includes(needle));
  }
  if (query?.class) rows = rows.filter((s) => s.studentClass === query.class);
  if (query?.status) rows = rows.filter((s) => s.status === query.status);
  // `balance` is not a real sortable field on the real API; the wizard uses it
  // to show the worst debtor first, so the mock honours it.
  if (query?.sortBy === 'balance') {
    rows = [...rows].sort((a, b) => (query.sortOrder === 'asc' ? a.balance - b.balance : b.balance - a.balance));
  }

  const perPage = Number(query?.perPage) || 20;
  const page = Number(query?.page) || 1;
  const total = rows.length;
  // Key names mirror `student.service.js` exactly — `total`/`totalPages`, not
  // `totalItems`/`limit`. The adapter hoists `meta` to the top level and
  // unwraps `students` into `data`, reproducing the real `{ data, meta }`.
  return {
    students: rows.slice((page - 1) * perPage, page * perPage),
    meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
  };
};

// ── Cohorts and alumni ──────────────────────────────────────────────────────
//
// The Cohorts and Alumni tabs call these, and without them the mock 404s and
// the feature reads as broken even though it works against a seeded database.
//
// The grouping mirrors the real `getCohorts` exactly: a cohort is everyone with a
// `graduationYear`, and `graduatedCount` / `transferredCount` / `droppedCount`
// are three different statuses counted within it. The real service needed a
// `$toString` around its `$subtract` for the same reason these are computed in JS
// rather than by string surgery — `$concat` refuses a number.

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
    throw new MockError(400, 'Invalid cohort ID — expected cohort_2026', 'INVALID_COHORT_ID');
  }

  // The query first, never `params.schoolId`.
  //
  // `extractParams` fills the positional slots `id`/`token`/`schoolId`/`userId`
  // from the matched path segment, so on this route `params.schoolId` is the
  // literal string `"cohort_2025"`. It looks like a school id and silently
  // matches nothing — the detail came back with zero students and the list said
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
    // Literal substring, escaped — the real service had `$regex` interpolation
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
  // so a `{ data: … }` return would arrive as `data.data` and read as undefined.
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

/** `POST /students/bulk` — mirrors `bulkCreateStudents`, row by row. */
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
    // Row 1 is the header, so data rows start at 2 — the numbering the real
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

    // Cedis in the file, pesewas on the wire — the conversion the real
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

// ── SMS ────────────────────────────────────────────────────────────────────

/**
 * `POST /sms/bulk/:schoolId` — **does not exist on the real API.**
 *
 * 404s by default so the wizard's honest-failure branch is what runs. The
 * `sms-enabled` scenario makes it succeed, which is how the *full* happy path
 * (celebrate → send → count → dashboard) gets tested before the backend exists.
 */
const sendBulkSms = ({ params, body, user }) => {
  // Gated the same way as the payout route: the scenario that mirrors the real
  // backend (`sms-unsupported`) 404s, and `healthy` lets the send succeed so the
  // full celebrate → send → count → dashboard path is testable before the
  // endpoint exists.
  if (!getScenario(getScenarioId()).config?.mockOnlyEnabled) {
    throw new MockError(404, 'Cannot POST /sms/bulk', 'NOT_FOUND');
  }

  const db = getDb();
  const schoolId = resolveSchoolId(user, params.schoolId);
  if (!schoolId) throw new MockError(403, 'No school in scope', 'NO_SCHOOL_SCOPE');
  const school = findSchool(schoolId);

  const owing = studentsFor(schoolId)
    .filter((s) => s.balance > 0)
    // `sms-no-recipients` empties the list without touching the data, so a
    // tester can switch back and still have the 500-student roster.
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

  const message = String(body?.message || '');
  const sent = db.sentSms.concat(
    recipients.map((r) => ({
      id: objectId(db.sentSms.length + recipients.length),
      to: r.phone,
      toName: r.name,
      studentId: r.studentId,
      message,
      cost: 4,
      status: 'submitted',
      sentAt: new Date().toISOString(),
    }))
  );
  db.sentSms = sent;

  return { sent: recipients.length, failed: 0, cost, remainingBalance: school.sms.balance };
};

const getSmsBalance = ({ user }) => {
  if (user?.role !== 'super_admin') {
    // Matches the real route, which is super_admin only. The wizard treats a
    // null balance as "no estimate available" rather than an error.
    throw new MockError(403, 'Forbidden', 'FORBIDDEN');
  }
  return getDb().schools[0].sms;
};

// ── Users / settings / ads ─────────────────────────────────────────────────

const updateUser = ({ params, body, user }) => {
  const target = getDb().users.find((u) => u._id === params.userId);
  if (!target) throw new MockError(404, 'User not found', 'USER_NOT_FOUND');
  if (user?.role !== 'super_admin' && user?._id !== target._id) {
    throw new MockError(403, 'You can only update your own profile', 'FORBIDDEN');
  }
  if (body?.name) target.name = String(body.name).trim();
  if (body?.phone) target.phone = body.phone;
  if (body?.position !== undefined) target.position = body.position;
  if (body?.avatar !== undefined) target.avatar = body.avatar;
  return target;
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

const listSchoolAds = () => ({
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
      headline: 'Now boarding, grades 1–12',
      imageUrl: 'https://picsum.photos/seed/sukuupay-riverside/960/540',
      imageAlt: 'Riverside International School main gate',
      linkUrl: 'https://example.com/riverside/apply',
    },
  ],
});

const health = () => ({ status: 'ok', mock: true, uptimeSeconds: Math.round(process.uptime?.() || 0) });

// ── Route table ────────────────────────────────────────────────────────────

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
  ['POST', /^\/upload\/student-photo$/, async ({ data }) => {
    const file = data instanceof FormData ? data.get('file') : null;
    if (!file) throw new MockError(400, 'No image file uploaded', 'NO_FILE');
    return { url: `https://res.cloudinary.com/mock/image/upload/${objectId(21)}` };
  }],

  // Literal segments before the parameter, matching `student.routes.js`. The
  // mock has the same ordering dependency the real router does, and getting it
  // wrong here would hide a real bug.
  ['POST', /^\/students\/bulk\/update$/, bulkDryRun],
  ['POST', /^\/students\/bulk\/archive$/, bulkDryRun],
  ['POST', /^\/students\/bulk\/status$/, bulkDryRun],
  ['POST', /^\/students\/bulk\/pay-links$/, bulkDryRun],
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
  // handler would be unreachable — which is exactly how the real route was
  // broken.
  ['GET', /^\/cohorts\/detail\/(?<cohortId>[^/]+)$/, getCohortDetail],
  ['GET', /^\/cohorts\/(?<schoolId>[^/]+)$/, listCohorts],
  ['GET', /^\/alumni\/(?<schoolId>[^/]+)$/, listAlumni],

  ['POST', /^\/sms\/bulk\/([^/]+)$/, sendBulkSms, { mockOnly: true }],
  ['GET', /^\/admin\/sms-balance$/, getSmsBalance],

  ['PUT', /^\/users\/([^/]+)$/, updateUser],
  ['GET', /^\/settings\/([^/]+)$/, getSettings],

  ['GET', /^\/public\/school-ads$/, listSchoolAds, { public: true }],
  ['GET', /^\/health$/, health, { public: true }],
];

export { publicUser, validateStudentPayload, GHANA_PHONE, ghanaPhone, buildStudents };

