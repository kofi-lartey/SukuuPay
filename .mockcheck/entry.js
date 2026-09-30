/**
 * Integration check for the mock environment.
 *
 * Exercises the REAL service layer (src/services/*) through the mock adapter, so
 * a pass means the frontend's services and the mocked API contract agree.
 *
 * Run with `.mockcheck/run.mjs` after building this entry (see the README).
 *
 * Two things this file is careful about:
 *
 *  1. The service imports are dynamic. `axios.create()` copies the adapter
 *     defaults when the instance is built, so `services/api.js` must be
 *     evaluated *after* the mock adapter is installed — the same ordering
 *     `main.jsx` uses. A static import hoists above `preinstallMockApi()` and
 *     leaves the refresh interceptor pointing at the real network.
 *
 *  2. Assertions read `error.status`, not `error.response.status`. Every service
 *     normalises failures through `toError`, which produces a plain
 *     `Error` carrying `{ status, code, message }`. That normalised object is
 *     what the UI actually receives, so it is the right thing to assert on.
 */
import { preinstallMockApi } from '../src/mocks/preinstall.js';
import { toCsv, IMPORT_HEADERS } from '../src/mocks/fixtures.js';

preinstallMockApi();

const { default: api } = await import('../src/services/api.js');
const { installMockApi } = await import('../src/mocks/index.jsx');
const { resetDb, setScenario, getDb, issueToken } = await import('../src/mocks/db.js');
const { getSchool, updateSchool, updatePayoutAccount, verifyHubtel, provisionMySchool, joinSchoolByCode } = await import('../src/services/school.js');
const { bulkImport, createStudent, listStudents } = await import('../src/services/students.js');
const { sendBulk } = await import('../src/services/sms.js');
const { getMe } = await import('../src/services/user.js');
const { login, signup, verifyEmail, resendVerificationEmail } = await import('../src/services/auth.js');

installMockApi();

let pass = 0;
let fail = 0;

const check = async (name, fn) => {
  try {
    const detail = await fn();
    pass += 1;
    console.log(`  OK   ${name}${detail ? ` — ${detail}` : ''}`);
  } catch (error) {
    fail += 1;
    console.log(`  FAIL ${name}: ${error.message}`);
  }
};

const expect = (condition, message) => {
  if (!condition) throw new Error(message);
};

const expectStatus = async (promise, status, label) => {
  try {
    await promise;
    throw new Error(`${label}: expected a ${status}, but the call succeeded`);
  } catch (error) {
    if (error.message.startsWith(`${label}:`)) throw error;
    expect(error.status === status, `${label}: expected ${status}, got ${error.status} (${error.code}: ${error.message})`);
  }
};

/** Signs in and leaves the tokens in localStorage, as the real login does. */
const signIn = async (email) => {
  const { user } = await login(email, 'MockPass123!');
  return user;
};

/**
 * Signs up a fresh account, verifies it, and returns the stored user.
 *
 * Signup issues no session and returns no user, so the only way to observe what
 * was persisted is to verify and then read `/auth/me` — the same two steps the
 * real flow goes through. Reading the request back instead would only prove the
 * form sent what we already know it sent.
 */
const signUp = async ({ email, position = '', role, school }) => {
  const result = await signup({
    name: 'Ama Serwa',
    email,
    phone: '+233241234567',
    password: 'MockPass123!',
    position,
    role,
    ...(school ? { school } : {}),
  });

  await verifyEmail(result.verification?.code || '123456');
  const { user } = await login(email, 'MockPass123!');
  return user;
};

const csvFile = (rows) => new File([toCsv(rows)], 'roster.csv', { type: 'text/csv' });

// The seeded schools configure JHS 1–3 and Basic 1–6. The API matches a
// student's class against that list exactly, so a fixture using "JHS 2A" is
// rejected — which is a real trap, covered by its own case below.
const VALID_CLASS = 'JHS 2';

const cleanRows = (n, className = VALID_CLASS) =>
  Array.from({ length: n }, (_, i) => ({
    'Student Name': `Ama Test ${i + 1}`,
    'Student Class': className,
    Gender: i % 2 ? 'male' : 'female',
    'Parent Name': `Parent ${i + 1}`,
    'Parent Phone': `02412345${String(i % 100).padStart(2, '0')}`,
    'Total Owed': '1200',
    Deadline: '2027-12-15',
  }));

// `updatePayoutAccount(schoolId, bankAccount)` — the service wraps the argument
// in `{ bankAccount }` itself, so the caller passes the inner object.
const payout = { accountName: 'Mock Preparatory', accountNumber: '0123456789', bankName: 'GCB Bank' };

// ?? Auth ???????????????????????????????????????????????????????????????????

await check('PROBE: adapter rejection carries .response', async () => {
  try {
    await api.get('/auth/me');
    throw new Error('expected a rejection');
  } catch (error) {
    expect(Boolean(error.response), 'adapter rejection had no .response');
    return `status ${error.response.status}`;
  }
});

await check('unauthenticated /auth/me is rejected', () =>
  expectStatus(getMe(), 401, 'GET /auth/me'));

await check('login stores tokens and returns a user', async () => {
  const user = await signIn('bursar@example.org');
  expect(user.email === 'bursar@example.org', 'wrong email returned');
  expect(localStorage.getItem('auth_token'), 'no access token was stored');
  return `${user.email}, school ${user.schoolId ? 'linked' : 'UNLINKED'}`;
});

await check('wrong password is a 401, not a 500', () =>
  expectStatus(login('bursar@example.org', 'nope'), 401, 'login'));

await check('unknown email is the same 401, not a 404', () =>
  expectStatus(login('nobody@example.org', 'MockPass123!'), 401, 'login'));

await check('unverified account returns EMAIL_NOT_VERIFIED', async () => {
  resetDb('unverified');
  setScenario('healthy');
  try {
    await login('unverified@example.org', 'MockPass123!');
    throw new Error('expected a rejection');
  } catch (error) {
    expect(error.code === 'EMAIL_NOT_VERIFIED', `expected EMAIL_NOT_VERIFIED, got ${error.code}`);
  }
});

// ?? Back on the default persona ????????????????????????????????????????????

resetDb('new-admin');
setScenario('healthy');
const me = await signIn('bursar@example.org');
const schoolId = me.schoolId;

await check('GET /auth/me round-trips the session', async () => {
  // The envelope, not a bare user: `onboarding` is the server's resolved link
  // state, and it is what replaced the client inferring "am I linked?" from a
  // nullable `schoolId`.
  const { user: fresh, onboarding } = await getMe();
  expect(fresh._id === me._id, 'different user returned');
  expect(onboarding?.linked === true, 'a linked account did not report linked');
  expect(onboarding?.reason === 'LINKED', `expected reason LINKED, got ${onboarding?.reason}`);
  return `${fresh.email}, linked=${onboarding.linked}, next=${onboarding.nextRoute}`;
});

await check('GET /schools/:id returns the school', async () => {
  const school = await getSchool(schoolId);
  expect(school._id === schoolId, 'wrong school returned');
  return `${school.name}, ${school.academic.classes.length} classes`;
});

await check('PUT /schools/:id persists a valid profile', async () => {
  const updated = await updateSchool(schoolId, {
    name: 'Mock Preparatory School',
    type: 'private',
    phone: '0241234567',
    email: 'office@example.net',
    address: '12 Independence Avenue, Cantonments',
    city: 'Accra',
    region: 'Greater Accra',
    yearFounded: 1998,
  });
  expect(updated.name === 'Mock Preparatory School', 'name did not persist');
  return `name = ${updated.name}`;
});

await check('PUT /schools/:id strips unknown keys (stripUnknown)', async () => {
  // The single most important behaviour in the mock. The real Joi schema has no
  // `payment` key, so it is dropped without an error — which is exactly what
  // silently breaks Step 2 against the real API.
  const result = await updateSchool(schoolId, {
    motto: 'Knowledge and Service',
    payment: { gatewayMode: 'hubtel' },
  });
  expect(result.motto === 'Knowledge and Service', 'motto did not persist');
  expect(
    result.payment?.gatewayMode === 'hubtel',
    'payment unexpectedly persisted — the mock does not mirror stripUnknown'
  );
  return 'motto persisted, payment correctly dropped';
});

await check('PUT /schools/:id rejects an invalid Ghana phone', () =>
  expectStatus(updateSchool(schoolId, { phone: '+1 415 555 0100' }), 422, 'PUT /schools'));

await check('PUT /schools/:id rejects an unknown region', () =>
  expectStatus(updateSchool(schoolId, { region: 'Wakanda' }), 422, 'PUT /schools'));

await check('PUT /schools/:id rejects a one-character name', () =>
  expectStatus(updateSchool(schoolId, { name: 'X' }), 422, 'PUT /schools'));

await check('PUT /schools/:id rejects a non-uri website', () =>
  expectStatus(updateSchool(schoolId, { website: 'sukuupay dot com' }), 422, 'PUT /schools'));

// ?? Payout: the endpoint that does not exist on the real API ???????????????

await check('payout 404s under payout-unsupported (the real API today)', async () => {
  setScenario('payout-unsupported');
  try {
    await updatePayoutAccount(schoolId, payout);
    throw new Error('expected a rejection');
  } catch (error) {
    expect(error.code === 'PAYOUT_NOT_SUPPORTED', `expected PAYOUT_NOT_SUPPORTED, got ${error.code}`);
  }
});

await check('payout succeeds under healthy', async () => {
  setScenario('healthy');
  const school = await updatePayoutAccount(schoolId, payout);
  expect(school.payment.settlement?.bankName === 'GCB Bank', 'settlement not stored');
  return 'stored';
});

await check('payout rejects a non-10-digit account number', async () => {
  try {
    await updatePayoutAccount(schoolId, { ...payout, accountNumber: '123' });
    throw new Error('expected a rejection');
  } catch (error) {
    expect(error.status === 422, `expected 422, got ${error.status}`);
  }
});

await check('Hubtel verification accepts valid credentials', async () => {
  const result = await verifyHubtel(schoolId, { clientId: 'c-1', clientSecret: 's', merchantId: 'm', apiKey: 'k' });
  expect(result.verified === true, 'not verified');
});

await check('Hubtel verification rejects an "invalid" client id', () =>
  expectStatus(
    verifyHubtel(schoolId, { clientId: 'invalid-123', clientSecret: 's', merchantId: 'm', apiKey: 'k' }),
    422,
    'verify-hubtel'
  ));

await check('Hubtel verification 405s under hubtel-unsupported', async () => {
  setScenario('hubtel-unsupported');
  try {
    await verifyHubtel(schoolId, { clientId: 'c', clientSecret: 's', merchantId: 'm', apiKey: 'k' });
    throw new Error('expected a rejection');
  } catch (error) {
    expect(error.code === 'HUBTEL_VERIFY_NOT_SUPPORTED', `expected HUBTEL_VERIFY_NOT_SUPPORTED, got ${error.code}`);
  }
  setScenario('healthy');
});

// ?? Students ???????????????????????????????????????????????????????????????

await check('POST /students/single creates a student', async () => {
  const student = await createStudent({
    studentName: 'Kwame Osei',
    studentClass: VALID_CLASS,
    gender: 'male',
    totalOwed: 150000, // pesewas
    deadline: '2027-12-15',
    parents: [{ parentName: 'Ama Osei', relationship: 'mother', phone: '0245550101', isPrimary: true, isAlive: true }],
  });
  expect(student.balance === 150000, 'balance not set from totalOwed');
  return `${student.studentId}, balance ${student.balance}`;
});

await check('POST /students/single rejects a suffixed class the school lacks', async () => {
  // "JHS 2A" is how Ghanaian schools really label classes, and the API matches
  // exactly. A school must configure "JHS 2A" before rows using it import.
  try {
    await createStudent({
      studentName: 'Suffixed Class', studentClass: 'JHS 2A', gender: 'male',
      totalOwed: 1000, deadline: '2027-12-15',
      parents: [{ parentName: 'X', phone: '0245550102', isPrimary: true, isAlive: true }],
    });
    throw new Error('expected a rejection');
  } catch (error) {
    expect(/not defined for this school/.test(error.message), `unexpected: ${error.message}`);
    return error.message;
  }
});

await check('POST /students/single rejects a past deadline', () =>
  expectStatus(
    createStudent({
      studentName: 'Past Deadline', studentClass: VALID_CLASS, gender: 'male',
      totalOwed: 1000, deadline: '2020-01-01',
      parents: [{ parentName: 'X', phone: '0245550103', isPrimary: true, isAlive: true }],
    }),
    422,
    'POST /students/single'
  ));

await check('POST /students/single rejects cedis sent as pesewas', () =>
  expectStatus(
    createStudent({
      studentName: 'Money Unit', studentClass: VALID_CLASS, gender: 'male',
      totalOwed: 1200.5, deadline: '2027-12-15',
      parents: [{ parentName: 'X', phone: '0245550104', isPrimary: true, isAlive: true }],
    }),
    422,
    'POST /students/single'
  ));

await check('POST /students/bulk imports every clean row', async () => {
  const result = await bulkImport(csvFile(cleanRows(20)), { schoolId });
  expect(result.created === 20, `expected 20 created, got ${result.created}`);
  expect(result.failed === 0, `expected 0 failed, got ${result.failed}`);
  expect(result.format === 'csv', `expected csv format, got ${result.format}`);
  return `${result.created} created, ${result.failed} failed`;
});

await check('POST /students/bulk converts cedis to pesewas', async () => {
  resetDb('new-admin');
  const user = await signIn('bursar@example.org');
  await bulkImport(csvFile(cleanRows(1)), { schoolId: user.schoolId });
  const { rows: students } = await listStudents({ perPage: 10 });
  const imported = students.find((s) => s.studentName === 'Ama Test 1');
  expect(imported, 'imported student not found');
  expect(imported.totalOwed === 120000, `expected 120000 pesewas, got ${imported.totalOwed}`);
  return `GHS 1200 -> ${imported.totalOwed} pesewas`;
});

await check('POST /students/bulk reports per-row errors with header-relative rows', async () => {
  const rows = await signIn('bursar@example.org');
  const mixed = [
    ...cleanRows(10),
    { 'Student Name': 'No Parent', 'Student Class': VALID_CLASS, Gender: 'male', 'Parent Name': '', 'Parent Phone': '0241234500', 'Total Owed': '500', Deadline: '2027-12-15' },
    { 'Student Name': 'Bad Phone', 'Student Class': VALID_CLASS, Gender: 'male', 'Parent Name': 'Someone', 'Parent Phone': '+1 415 555 0100', 'Total Owed': '500', Deadline: '2027-12-15' },
    { 'Student Name': 'Bad Class', 'Student Class': 'Form 9Z', Gender: 'male', 'Parent Name': 'Someone', 'Parent Phone': '0241234501', 'Total Owed': '500', Deadline: '2027-12-15' },
  ];
  const result = await bulkImport(csvFile(mixed), { schoolId: rows.schoolId });
  expect(result.created === 10, `expected 10 created, got ${result.created}`);
  expect(result.failed === 3, `expected 3 failed, got ${result.failed}`);
  // The header is row 1, so the first data row is row 2 — the numbering the
  // rejected-rows list on Step 3 shows a user.
  expect(result.errors[0].row === 12, `expected the first failure at row 12, got ${result.errors[0].row}`);
  return `10 ok, 3 rejected, first at row ${result.errors[0].row}`;
});

await check('POST /students/bulk normalises messy headers and spacing', async () => {
  const user = await signIn('bursar@example.org');
  const messy = new File(
    [toCsv(
      [{ studentname: '  Kofi  Osei  ', studentclass: VALID_CLASS, gender: 'MALE', parentname: 'Akosua, Ama', parentphone: ' 024 555 0101 ', totalowed: '1100', deadline: '2027-12-15' }],
      ['studentname', 'studentclass', 'gender', 'parentname', 'parentphone', 'totalowed', 'deadline']
    )],
    'messy.csv',
    { type: 'text/csv' }
  );
  const result = await bulkImport(messy, { schoolId: user.schoolId });
  expect(result.created === 1, `expected 1 created, got ${result.created} (${JSON.stringify(result.errors)})`);
  return 'trimmed, lower-cased and quoted headers all handled';
});

await check('POST /students/bulk rejects a header-only file', () =>
  expectStatus(
    bulkImport(new File([`${IMPORT_HEADERS.join(',')}\n`], 'empty.csv', { type: 'text/csv' }), { schoolId }),
    422,
    'POST /students/bulk'
  ));

await check('POST /students/bulk rejects a file over 10MB', () =>
  expectStatus(
    bulkImport(new File([new Uint8Array(11 * 1024 * 1024)], 'big.csv', { type: 'text/csv' }), { schoolId }),
    400,
    'POST /students/bulk'
  ));

await check('POST /students/bulk truncates at 5,000 rows', async () => {
  const user = await signIn('bursar@example.org');
  const before = getDb().students.length;
  const result = await bulkImport(csvFile(cleanRows(5200)), { schoolId: user.schoolId });
  expect(result.created === 5000, `expected 5000 created, got ${result.created}`);
  expect(getDb().students.length - before === 5000, 'more than 5000 were stored');
  return '5,200 rows in, 5,000 stored — the frontend warning is accurate';
});

await check('GET /students matches the real { data, meta } envelope', async () => {
  resetDb('established');
  const user = await signIn('head.bursary@example.org');
  const { data } = await api.get('/students', { params: { perPage: 25, sortBy: 'balance', sortOrder: 'desc' } });

  // Exactly `listStudentsController`: `data` is a bare ARRAY, `meta` is a
  // sibling. An object-under-`data` shape is what made the real
  // `data.data?.students` bug invisible.
  expect(Array.isArray(data.data), `expected data to be an array, got ${typeof data.data}`);
  expect(data.data.length === 25, `expected 25 students, got ${data.data?.length}`);
  expect(data.meta?.total === 500, `expected meta.total 500, got ${data.meta?.total}`);
  expect(data.meta?.totalPages === 20, `expected meta.totalPages 20, got ${data.meta?.totalPages}`);
  const balances = data.data.map((s) => s.balance);
  expect(balances.every((b, i) => i === 0 || balances[i - 1] >= b), 'not sorted descending');
  return `data[0].balance ${balances[0]}, meta.total ${data.meta.total}`;
});

await check('the service reads that envelope and returns a plain array', async () => {
  const { rows: students } = await listStudents({ perPage: 25, sortBy: 'balance', sortOrder: 'desc' });
  expect(Array.isArray(students), `expected an array, got ${typeof students}`);
  expect(students.length === 25, `expected 25 students, got ${students.length}`);
  return `${students.length} students`;
});

await check('seeded roster contains fully paid students (Step 4 filter)', async () => {
  const { rows: all } = await listStudents({ perPage: 100 });
  const paid = all.filter((s) => s.balance === 0).length;
  expect(paid > 0, 'no fully paid students in the fixture — the "all owing" filter is untestable');
  return `${paid} of ${all.length} fully paid`;
});

// ?? SMS ????????????????????????????????????????????????????????????????????

await check('the SMS balance helper is gone, not merely unused', async () => {
  // Step 4 used to call `GET /admin/sms-balance`, which is `authorize("super_admin")`
  // — so every school admin got `403 You do not have access to this resource` on
  // reaching the reminder step, including by skipping the import step. The old
  // helper swallowed the 403 and returned null, so the mock run looked healthy
  // while the real request was failing.
  //
  // The fix was to delete the caller rather than to keep tolerating a forbidden
  // request, so the assertion is that the export no longer exists.
  const sms = await import('../src/services/sms.js');
  expect(sms.getSmsBalance === undefined, 'getSmsBalance is still exported');
  return 'no school-admin call to a super_admin endpoint';
});

await check('POST /sms/bulk 404s under sms-unsupported (the real API today)', async () => {
  resetDb('established');
  const user = await signIn('head.bursary@example.org');
  setScenario('sms-unsupported');
  try {
    await sendBulk(user.schoolId, { owingOnly: true }, 'Reminder');
    throw new Error('expected a rejection');
  } catch (error) {
    expect(error.code === 'SMS_SEND_NOT_SUPPORTED', `expected SMS_SEND_NOT_SUPPORTED, got ${error.code}`);
  }
});

await check('POST /sms/bulk sends, counts and debits under healthy', async () => {
  setScenario('healthy');
  const user = await signIn('head.bursary@example.org');
  const before = getDb().schools[0].sms.balance;
  const result = await sendBulk(user.schoolId, { owingOnly: true }, 'Reminder text');
  expect(result.sent > 0, 'expected at least one recipient');
  expect(getDb().schools[0].sms.balance < before, 'balance was not debited');
  expect(getDb().sentSms.length === result.sent, 'sent log does not match the reported count');
  return `${result.sent} sent, balance ${before} -> ${getDb().schools[0].sms.balance}`;
});

await check('POST /sms/bulk refuses when nobody owes', async () => {
  const user = await signIn('head.bursary@example.org');
  setScenario('sms-no-recipients');
  try {
    await sendBulk(user.schoolId, { owingOnly: true }, 'Reminder text');
    throw new Error('expected a rejection');
  } catch (error) {
    expect(/outstanding balance/.test(error.message), `unexpected: ${error.message}`);
    return error.message;
  }
});

await check('POST /sms/bulk refuses when the balance is exhausted', async () => {
  const user = await signIn('head.bursary@example.org');
  setScenario('healthy');
  getDb().schools[0].sms.balance = 0;
  try {
    await sendBulk(user.schoolId, { owingOnly: true }, 'Reminder text');
    throw new Error('expected a rejection');
  } catch (error) {
    expect(error.status === 402, `expected 402, got ${error.status}`);
  }
});

// ?? Scenarios ??????????????????????????????????????????????????????????????

await check('offline: listStudents degrades to [] rather than throwing', async () => {
  // The service swallows failures on purpose — the SMS preview is decorative
  // and must never block the wizard. This asserts that contract holds.
  setScenario('offline');
  const { rows: students } = await listStudents({ perPage: 5 });
  expect(Array.isArray(students), 'expected an array');
  expect(students.length === 0, 'expected an empty list');
});

await check('offline: a mutating call surfaces a network error', async () => {
  try {
    await updateSchool(schoolId, { motto: 'x' });
    throw new Error('expected a rejection');
  } catch (error) {
    expect(
      error.message === 'Network Error' || error.code === 'ERR_NETWORK',
      `got ${error.code}: ${error.message}`
    );
  }
  setScenario('healthy');
});

await check('fail-profile blocks the Step 1 save with 422', () => {
  setScenario('fail-profile');
  return expectStatus(updateSchool(schoolId, { name: 'Anything' }), 422, 'PUT /schools');
});

await check('fail-school-update blocks the Step 1 save with 409', () => {
  setScenario('fail-school-update');
  return expectStatus(updateSchool(schoolId, { name: 'Anything' }), 409, 'PUT /schools');
});

await check('import-reject-all rejects the file wholesale', async () => {
  setScenario('import-reject-all');
  await expectStatus(bulkImport(csvFile(cleanRows(5)), { schoolId }), 422, 'POST /students/bulk');
});

await check('import-all-valid accepts rows the client would have flagged', async () => {
  setScenario('import-all-valid');
  const result = await bulkImport(csvFile(cleanRows(3)), { schoolId });
  expect(result.created === 3, `expected 3 created, got ${result.created}`);
  return '3 accepted with the phone/parent checks bypassed';
});

// -- Signup partial success: account created, verification email failed -----

const newSchoolSignup = (email, phone) => ({
  name: 'Dr. Kwame Mensah',
  email,
  phone,
  password: 'MockPass123!',
  position: 'Headteacher',
  school: { name: 'Prampram Basic & JHS', classification: 'Private', region: 'Greater Accra' },
});

await check('signup returns a created account with a code under healthy', async () => {
  resetDb('new-admin');
  setScenario('healthy');
  const result = await signup(newSchoolSignup('fresh@school.edu.gh', '+233244567890'));
  expect(result.partial === undefined, 'unexpected partial flag');
  expect(result.verification?.code, 'no verification code returned');
  return `code ${result.verification.code}`;
});

await check('a duplicate signup is a 409, not a partial success', () =>
  expectStatus(signup(newSchoolSignup('fresh@school.edu.gh', '+233244567890')), 409, 'signup'));

await check('email-send-fails: signup reports partial success rather than throwing', async () => {
  // The regression this guards. The API answers 502 / EMAIL_SEND_FAILED; the
  // service must turn that into a normal return so the page can route to the
  // resend screen. If it rethrows, the user is stranded on a completed signup
  // form for an account they already own, and resubmitting can only 409.
  resetDb('new-admin');
  setScenario('email-send-fails');
  const result = await signup(newSchoolSignup('unreachable@school.edu.gh', '+233244567891'));
  expect(result.partial === true, `expected partial true, got ${result.partial}`);
  expect(result.emailSent === false, 'expected emailSent false');
});

await check('the account really does exist after a failed send', async () => {
  // If this is false, the "your account was created" copy is a lie and the
  // resend would silently do nothing.
  const users = getDb().users.filter((u) => u.email === 'unreachable@school.edu.gh');
  expect(users.length === 1, `expected 1 persisted user, found ${users.length}`);
  expect(users[0].isEmailVerified === false, 'the account should be unverified');
  return 'persisted and unverified, as the copy claims';
});

await check('resend recovers the account after a failed send', async () => {
  await resendVerificationEmail('unreachable@school.edu.gh');
  const user = getDb().users.find((u) => u.email === 'unreachable@school.edu.gh');
  expect(user, 'user vanished');
  expect(user.isEmailVerified === false, 'resend must not verify the account by itself');
  return 'resend is neutral and leaves the account unverified';
});

await check('resend never reveals whether an address is registered', async () => {
  // A registered unverified address and a nonexistent one must be
  // indistinguishable, or this endpoint enumerates the user base.
  let knownFailed = false;
  let unknownFailed = false;
  try { await resendVerificationEmail('unreachable@school.edu.gh'); } catch { knownFailed = true; }
  try { await resendVerificationEmail('nobody-at-all@example.com'); } catch { unknownFailed = true; }
  expect(knownFailed === unknownFailed, 'registered and unknown addresses behaved differently');
  return 'both answered identically';
});

setScenario('healthy');

// ?? Authorisation ??????????????????????????????????????????????????????????

await check('a school admin cannot read another school', async () => {
  resetDb('new-admin');
  await signIn('bursar@example.org');
  const other = { _id: 'a'.repeat(24), name: 'Someone Else School', academic: {}, status: 'active' };
  getDb().schools.push(other);
  await expectStatus(getSchool(other._id), 403, 'GET /schools/:id');
});

await check('a cross-school bulk import is silently scoped to the caller own school', async () => {
  // `resolveSchoolId` in `student.service.js` returns `user.schoolId` for anyone
  // who is not a super_admin and IGNORES an explicit `schoolId`. So this is not
  // a 403 — it writes into the caller's own school. The mock matches that, and
  // the assertion pins the behaviour so a "fix" to 403 is a deliberate change
  // rather than an accident.
  //
  // `resetDb` issues fresh sessions, so re-authenticate rather than relying on
  // the token from an earlier block.
  resetDb('new-admin');
  const user = await signIn('bursar@example.org');
  const before = getDb().students.length;
  const result = await bulkImport(csvFile(cleanRows(2)), { schoolId: 'b'.repeat(24) });
  expect(result.created === 2, `expected 2 created, got ${result.created}`);
  const mine = getDb().students.slice(before);
  expect(mine.every((s) => s.schoolId === user.schoolId), 'rows were written to another school');
  return '2 rows landed in the caller own school, not the requested one';
});

await check('a super_admin can read any school', async () => {
  resetDb('super-admin');
  const admin = await signIn('admin@example.com');
  const target = { _id: 'c'.repeat(24), name: 'Platform Visible', academic: {}, status: 'active' };
  getDb().schools.push(target);
  const school = await getSchool(target._id);
  expect(school._id === target._id, 'super admin was blocked');
  return admin.role;
});

await check('logout clears the session and /auth/me then 401s', async () => {
  resetDb('new-admin');
  await signIn('bursar@example.org');
  await api.post('/auth/logout');
  localStorage.removeItem('auth_token');
  // The revoked token must be dead server side too, not just absent from
  // localStorage — otherwise a "signed out" tab keeps reading student data.
  await expectStatus(getMe(), 401, 'GET /auth/me');
});

await check('an unknown route is reported, not silently swallowed', () =>
  expectStatus(api.get('/does-not-exist'), 404, 'GET /does-not-exist'));

// ?? School provisioning: the unlinked-account path ??????????????????????????
//
// Everything above assumes the account already has a school. That was the only
// state any self-service signup could reach, and it terminated on a "contact
// support" card. These assertions pin the replacement: an unlinked account
// creates its own school and is linked, in one call.

const PROFILE = {
  name: 'Prampram Basic & JHS',
  type: 'private',
  phone: '0241234567',
  email: 'office@prampram.edu.gh',
  address: '12 Independence Avenue, Cantonments',
  city: 'Accra',
  region: 'Greater Accra',
};

/**
 * Signs in the unlinked persona.
 *
 * `resetDb` issues fresh sessions, so every block re-authenticates rather than
 * trusting a token captured earlier.
 */
const signInUnlinked = async () => {
  resetDb('no-school');
  setScenario('healthy');
  return signIn('unlinked@example.org');
};

await check('GET /auth/me reports an unlinked account as needing provisioning', async () => {
  // The regression that started all this. Before, this state could only be
  // detected client-side, and the only response the UI had for it was a
  // dead-end error.
  await signInUnlinked();
  const { user, onboarding } = await getMe();
  expect(user.schoolId === null, 'expected no schoolId');
  expect(onboarding.linked === false, 'expected linked false');
  expect(onboarding.reason === 'UNLINKED', `expected UNLINKED, got ${onboarding.reason}`);
  expect(
    onboarding.nextRoute === '/onboarding/school-profile',
    `expected the provisioning route, got ${onboarding.nextRoute}`
  );
  return `linked=false, routes to ${onboarding.nextRoute}`;
});

await check('POST /schools/me creates a school and links the account', async () => {
  const user = await signInUnlinked();
  expect(user.schoolId === null, 'precondition: should start unlinked');

  const result = await provisionMySchool(PROFILE);
  expect(result.school?.name === PROFILE.name, 'school not returned');
  expect(result.school?.slug, 'no slug generated');
  expect(result.school?.schoolCode, 'no school code generated');
  // A self-provisioned school must be indistinguishable from an operator-created
  // one, trial included — otherwise a bursar provisions and lands on a
  // subscription-less dashboard.
  expect(result.school?.subscription?.plan === 'trial', 'no trial granted');
  // `schoolId` is on the response so the client can swap the identity in without
  // a second round trip.
  expect(result.user?.schoolId === result.school._id, 'response user was not linked');
  return `${result.school.schoolCode}, slug ${result.school.slug}`;
});

await check('the account is linked in the store, not just in the response', async () => {
  // Guards the atomic write. If only the response were updated, the guard would
  // still see a null schoolId on the next page load and loop the bursar back to
  // Step 1 forever.
  const stored = getDb().users.find((u) => u.email === 'unlinked@example.org');
  expect(Boolean(stored.schoolId), 'schoolId was not persisted');
  const school = getDb().schools.find((s) => s._id === stored.schoolId);
  expect(Boolean(school), 'the persisted schoolId points at nothing');
  return `linked to ${school.name}`;
});

await check('POST /schools/me is idempotent for an already-linked account', async () => {
  const before = getDb().schools.length;
  const result = await provisionMySchool({ ...PROFILE, name: 'A Second Attempt' });
  // The real service returns the existing school rather than creating a
  // duplicate. A second School would leave the bursar administering two
  // institutions and break the 5000-student import against both.
  expect(getDb().schools.length === before, 'a duplicate school was created');
  expect(result.school?.name === PROFILE.name, 'did not return the existing school');
  return 'replay returned the original school, created nothing';
});

await check('POST /schools/me maps a signup classification onto School.type', async () => {
  // `senior_high` is offered by the signup form and is NOT in the School enum.
  // Unmapped, this is a 422 about an enum the bursar never saw — raised by the
  // last step of onboarding, after they filled in everything else.
  await signInUnlinked();
  const result = await provisionMySchool({ ...PROFILE, type: 'senior_high' });
  expect(result.school?.type === 'public', `expected public, got ${result.school?.type}`);
  return 'senior_high -> public';
});

await check('POST /schools/me maps university onto School.type', async () => {
  // Fresh persona per mapping: the previous call left this account linked, and
  // provisioning is idempotent, so a second call would return the school created
  // above rather than create a new one.
  await signInUnlinked();
  const result = await provisionMySchool({ ...PROFILE, type: 'university' });
  expect(result.school?.type === 'private', `expected private, got ${result.school?.type}`);
  return 'university -> private';
});

await check('POST /schools/me rejects a genuinely unknown type', async () => {
  await signInUnlinked();
  await expectStatus(provisionMySchool({ ...PROFILE, type: 'witchcraft_academy' }), 422, 'POST /schools/me');
});

await check('POST /schools/me rejects a non-Ghana phone', async () => {
  await signInUnlinked();
  await expectStatus(provisionMySchool({ ...PROFILE, phone: '+1 415 555 0100' }), 422, 'POST /schools/me');
});

await check('POST /schools/me reports a taken school email as SCHOOL_ALREADY_REGISTERED', async () => {
  // The second-bursar case, and the reason a join path has to exist. A bare 409
  // here is the same dead end in a smaller window.
  // A genuinely separate, unlinked account attempting the same address.
  const db = getDb();
  await provisionMySchool(PROFILE);
  const second = {
    _id: 'e'.repeat(24),
    name: 'Second Bursar',
    email: 'second@prampram.edu.gh',
    phone: '233245550101',
    role: 'school_admin',
    schoolId: null,
    status: 'active',
    isEmailVerified: true,
    onboardingCompleted: false,
    schoolIntent: { name: '', classification: '', region: '' },
  };
  db.users.push(second);
  const tokens = issueToken(second._id);
  localStorage.setItem('auth_token', tokens.accessToken);

  try {
    await provisionMySchool(PROFILE);
    throw new Error('expected a rejection');
  } catch (error) {
    expect(error.code === 'SCHOOL_ALREADY_REGISTERED', `expected SCHOOL_ALREADY_REGISTERED, got ${error.code}`);
    expect(/school code/.test(error.message), 'the message does not point at the join path');
    expect(second.schoolId === null, 'the rejected account was linked anyway');
    expect(
      db.schools.filter((s) => s.email === PROFILE.email).length === 1,
      'a duplicate school was created'
    );
    // The original owner's link must survive a failed attempt by someone else.
    const ownerRecord = db.users.find((u) => u.email === 'unlinked@example.org');
    expect(
      ownerRecord.schoolId === db.schools.find((s) => s.email === PROFILE.email)._id,
      "the original owner's link was disturbed"
    );
    return `${error.code}; original owner still linked, rejected applicant not`;
  }
});

await check('school-already-registered scenario opens the join branch', async () => {
  await signInUnlinked();
  setScenario('school-already-registered');
  try {
    await provisionMySchool(PROFILE);
    throw new Error('expected a rejection');
  } catch (error) {
    expect(error.code === 'SCHOOL_ALREADY_REGISTERED', `expected SCHOOL_ALREADY_REGISTERED, got ${error.code}`);
    return 'Step 1 branches to the join sheet';
  }
});

await check('fail-provision leaves the bursar on Step 1 with a 422', async () => {
  await signInUnlinked();
  setScenario('fail-provision');
  await expectStatus(provisionMySchool(PROFILE), 422, 'POST /schools/me');
});

await check('POST /schools/join rejects an unrecognised code', async () => {
  await signInUnlinked();
  await expectStatus(joinSchoolByCode({ schoolCode: 'ZZZ999' }), 404, 'POST /schools/join');
});

await check('POST /schools/join parks a valid request as pending, not linked', async () => {
  // The security property this whole path rests on: a school code identifies the
  // school, it does not authenticate the applicant. Codes are initials plus a
  // three-digit counter, so granting access on one alone would let a guess hand
  // out the bursary.
  const user = await signInUnlinked();
  const code = getDb().schools[0].schoolCode;

  const result = await joinSchoolByCode({ schoolCode: code, applicantName: user.name });
  expect(result.status === 'pending', `expected pending, got ${result.status}`);
  expect(result.schoolName === getDb().schools[0].name, 'wrong school resolved');

  const stored = getDb().users.find((u) => u.email === 'unlinked@example.org');
  expect(stored.schoolId === null, 'the applicant was linked by presenting a code');
  return `pending against ${result.schoolName}, still unlinked`;
});

await check('POST /schools/join is idempotent while a request is pending', async () => {
  const code = getDb().schools[0].schoolCode;
  await joinSchoolByCode({ schoolCode: code });
  const userId = getDb().users.find((u) => u.email === 'unlinked@example.org')._id;
  const pending = getDb().joinRequests.filter((r) => r.userId === userId);
  expect(pending.length === 1, `expected 1 pending request, found ${pending.length}`);
  return 'resubmitting did not duplicate the request';
});

await check('POST /schools/join refuses an account that already has a school', async () => {
  // Needs a linked persona: the previous blocks deliberately leave this account
  // unlinked, which is the state join exists for.
  resetDb('new-admin');
  setScenario('healthy');
  await signIn('bursar@example.org');
  await expectStatus(
    joinSchoolByCode({ schoolCode: getDb().schools[0].schoolCode }),
    409,
    'POST /schools/join'
  );
});

await check('a super_admin is never routed into provisioning', async () => {
  // Platform staff belong to no school by design. Sending them here would ask
  // the founder to invent a school just to use the platform.
  resetDb('super-admin');
  const admin = await signIn('admin@example.com');
  expect(admin.role === 'super_admin', 'wrong persona');

  // Reported as `linked` with no schoolId, so the guard treats it as onboarded
  // rather than diverting to Step 1.
  const { onboarding } = await getMe();
  expect(onboarding.reason === 'PLATFORM_STAFF', `expected PLATFORM_STAFF, got ${onboarding.reason}`);
  expect(onboarding.schoolId === null, 'platform staff should have no schoolId');
  expect(onboarding.linked === true, 'platform staff must not read as unlinked');

  await expectStatus(provisionMySchool(PROFILE), 403, 'POST /schools/me');
  return 'PLATFORM_STAFF — linked, and provisioning refused';
});

// ?? School location: Ghana Post GPS + map pin ????????????????????????????
//
// `gpsAddress` used to be an unvalidated free-text string and the school had no
// coordinates at all. Both now go through the wire, so the mock has to reproduce
// the normalisation and the guards or the two sides disagree.

await check('PUT /schools/:id persists a valid digital address', async () => {
  const updated = await updateSchool(schoolId, { gpsAddress: 'GA-183-8164' });
  expect(updated.gpsAddress === 'GA-183-8164', `got ${JSON.stringify(updated.gpsAddress)}`);
  return updated.gpsAddress;
});

await check('PUT /schools/:id normalises the undashed spelling', async () => {
  // Everything downstream should only ever see the canonical dashed form, so a
  // value pasted from a PDF does not create a second spelling in the database.
  const updated = await updateSchool(schoolId, { gpsAddress: 'ga1838164' });
  expect(updated.gpsAddress === 'GA-183-8164', `got ${JSON.stringify(updated.gpsAddress)}`);
  return 'ga1838164 -> GA-183-8164';
});

await check('PUT /schools/:id normalises a spaced-out paste', async () => {
  const updated = await updateSchool(schoolId, { gpsAddress: '  GA - 183 - 8164  ' });
  expect(updated.gpsAddress === 'GA-183-8164', `got ${JSON.stringify(updated.gpsAddress)}`);
  return '"GA - 183 - 8164" -> GA-183-8164';
});

await check('PUT /schools/:id rejects a malformed digital address', async () => {
  // A transposed digit in the last group still looks plausible, which is why the
  // format is enforced rather than merely suggested.
  await expectStatus(updateSchool(schoolId, { gpsAddress: 'GA-123-4567-8901' }), 422, 'PUT /schools');
});

await check('PUT /schools/:id rejects a wrong-length address group', async () => {
  await expectStatus(updateSchool(schoolId, { gpsAddress: 'GA-18-8164' }), 422, 'PUT /schools');
});

await check('PUT /schools/:id accepts an empty digital address', async () => {
  // Optional field. Rejecting "" would make it mandatory and break a school
  // clearing it.
  const updated = await updateSchool(schoolId, { gpsAddress: '' });
  expect(updated.gpsAddress === '', `got ${JSON.stringify(updated.gpsAddress)}`);
  return 'clearable';
});

await check('PUT /schools/:id persists map coordinates as a nested object', async () => {
  // Sent as flattened dotted keys because that is the only nested form Joi
  // accepts; reassembled into `school.location` rather than stored literally.
  const updated = await updateSchool(schoolId, {
    'location.latitude': 5.6037,
    'location.longitude': -0.187,
    'location.source': 'map_pin',
  });
  expect(updated.location?.latitude === 5.6037, `latitude ${JSON.stringify(updated.location)}`);
  expect(updated.location?.longitude === -0.187, `longitude ${JSON.stringify(updated.location)}`);
  expect(updated.location?.source === 'map_pin', `source ${JSON.stringify(updated.location)}`);
  expect(updated['location.latitude'] === undefined, 'the dotted key leaked onto the school');
  expect(updated['location.longitude'] === undefined, 'the dotted key leaked onto the school');
  expect(Boolean(updated.location?.updatedAt), 'no freshness stamp');
  return `5.603700, -0.187000 (${updated.location.source})`;
});

await check('PUT /schools/:id rejects a half coordinate pair', async () => {
  // One coordinate alone would place the pin in the Gulf of Guinea, which is
  // worse than no pin at all.
  await expectStatus(updateSchool(schoolId, { 'location.latitude': 5.6037 }), 422, 'PUT /schools');
});

await check('PUT /schools/:id rejects coordinates outside the globe', async () => {
  await expectStatus(
    updateSchool(schoolId, { 'location.latitude': 95, 'location.longitude': 0 }),
    422,
    'PUT /schools'
  );
});

await check('PUT /schools/:id rejects an unknown location source', async () => {
  await expectStatus(
    updateSchool(schoolId, {
      'location.latitude': 5.6,
      'location.longitude': -0.2,
      'location.source': 'guesswork',
    }),
    422,
    'PUT /schools'
  );
});

await check('the seeded school carries a coordinate pair the map can restore', async () => {
  // The "edit mode hydrates a stored pin" path. Without a fixture location the
  // map picker would only ever be exercised starting empty.
  resetDb('established');
  const user = await signIn('head.bursary@example.org');
  const school = await getSchool(user.schoolId);
  expect(Number.isFinite(school.location?.latitude), 'no seeded latitude');
  expect(Number.isFinite(school.location?.longitude), 'no seeded longitude');
  expect(school.gpsAddress && school.gpsAddress.includes('-'), 'no seeded digital address');
  return `${school.gpsAddress} @ ${school.location.latitude}, ${school.location.longitude}`;
});

await check('POST /schools/me accepts a digital address and coordinates', async () => {
  resetDb('no-school');
  setScenario('healthy');
  await signIn('unlinked@example.org');
  const result = await provisionMySchool({
    ...PROFILE,
    gpsAddress: 'ga1838164',
    'location.latitude': 5.6037,
    'location.longitude': -0.187,
    'location.source': 'device',
  });
  expect(result.school?.gpsAddress === 'GA-183-8164', `got ${JSON.stringify(result.school?.gpsAddress)}`);
  expect(result.school?.location?.latitude === 5.6037, 'no stored latitude');
  expect(result.school?.location?.source === 'device', 'no stored source');
  return `${result.school.gpsAddress}, ${result.school.location.latitude}`;
});

await check('POST /schools/me rejects a malformed digital address', async () => {
  resetDb('no-school');
  setScenario('healthy');
  await signIn('unlinked@example.org');
  await expectStatus(provisionMySchool({ ...PROFILE, gpsAddress: 'nonsense' }), 422, 'POST /schools/me');
});

// ?? Account creation: role and position ???????????????????????????????????
//
// Both fields were absent from the signup payload. `position` used to receive the
// school classification, so every account was saved with a job title of
// "senior_high", and `role` was hard-coded to `school_admin` server-side.

await check('signup persists the chosen position', async () => {
  resetDb('healthy');
  const user = await signUp({
    email: 'bursary@school.test',
    position: 'Deputy Headmaster',
    role: 'school_admin',
  });
  expect(user.position === 'Deputy Headmaster', `got ${JSON.stringify(user.position)}`);
  expect(user.position !== 'senior_high', 'the classification leaked into position again');
  return user.position;
});

await check('signup accepts a free-text position the list never anticipated', async () => {
  // The "Other" escape. A hard enum would force a wrong answer or a support
  // ticket to record a real job title.
  resetDb('healthy');
  const user = await signUp({ email: 'warden@school.test', position: 'Chief Cook', role: 'school_admin' });
  expect(user.position === 'Chief Cook', `got ${JSON.stringify(user.position)}`);
  return user.position;
});

await check('signup persists the chosen role', async () => {
  for (const role of ['school_admin', 'accountant', 'teacher', 'viewer']) {
    resetDb('healthy');
    const user = await signUp({ email: `${role}@school.test`, role });
    expect(user.role === role, `expected ${role}, got ${user.role}`);
  }
  return 'all four roles round-trip';
});

await check('signup refuses to grant super_admin', async () => {
  // The single most damaging field on the model. A signup form must not mint a
  // platform operator.
  resetDb('healthy');
  const user = await signUp({ email: 'eve@evil.test', role: 'super_admin' });
  expect(user.role !== 'super_admin', `self-granted super_admin: ${user.role}`);
  expect(user.role === 'school_admin', `expected the fallback, got ${user.role}`);
  return `fell back to ${user.role}`;
});

await check('signup falls back to school_admin for an unknown role', async () => {
  resetDb('healthy');
  const user = await signUp({ email: 'root@school.test', role: 'root' });
  expect(user.role === 'school_admin', `got ${user.role}`);
  return user.role;
});

await check('a non-admin signup is sent the join path, not a create form', async () => {
  // `POST /schools/me` rejects non-admins, and `POST /upload/school-logo` is
  // separately `authorize('super_admin','school_admin')` — so an accountant who
  // created a school would be refused their own logo afterwards.
  resetDb('healthy');
  const user = await signUp({ email: 'clerk@school.test', role: 'accountant' });
  try {
    await provisionMySchool(PROFILE);
    throw new Error('expected a rejection');
  } catch (error) {
    expect(error.code === 'ROLE_CANNOT_CREATE_SCHOOL', `expected ROLE_CANNOT_CREATE_SCHOOL, got ${error.code}`);
    expect(/school code/.test(error.message), 'the message does not point at the join path');
    expect(user.schoolId === null, 'the account was linked anyway');
    return error.code;
  }
});

await check('signup omits the school intent for a joining role', async () => {
  // The client omits `school` for non-admins, so there is nothing to prefill a
  // Step 1 they never reach.
  resetDb('healthy');
  const user = await signUp({ email: 'clerk2@school.test', role: 'accountant' });
  expect(!user.schoolIntent?.name, `intent should be empty, got ${user.schoolIntent?.name}`);
  return 'no intent recorded';
});

await check('a school_admin keeps its school intent for Step 1 prefill', async () => {
  resetDb('healthy');
  const user = await signUp({
    email: 'admin2@school.test',
    role: 'school_admin',
    school: { name: 'Prampram Basic & JHS', classification: 'senior_high', region: 'Greater Accra' },
  });
  expect(user.schoolIntent?.name === 'Prampram Basic & JHS', `got ${JSON.stringify(user.schoolIntent)}`);
  return user.schoolIntent.name;
});

await check('a school that skipped the import step has an empty roster', async () => {
  // The precondition behind Step 4's "Students not uploaded yet" path. Provisioning
  // a fresh school creates it with no students, which is exactly the state an
  // admin is in when they press "Skip for Now" on Step 3 and arrive at Step 4.
  //
  // Step 4 distinguishes this from "still loading" with its own `rosterEmpty`
  // flag, because `null` was previously doing both jobs — which is how an admin
  // could press "Send Reminder to All Owing" against nothing.
  await signInUnlinked();
  const { school } = await provisionMySchool(PROFILE);

  const { rows: students } = await listStudents({ perPage: 100 });
  expect(Array.isArray(students), `expected an array, got ${typeof students}`);
  expect(students.length === 0, `expected an empty roster, got ${students.length}`);
  return `${school.name}: 0 students -> Step 4 shows the empty-roster notice`;
});

console.log(`\n${pass} passed, ${fail} failed.`);
process.exit(fail === 0 ? 0 : 1);
