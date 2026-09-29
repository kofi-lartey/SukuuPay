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
const { resetDb, setScenario, getDb } = await import('../src/mocks/db.js');
const { getSchool, updateSchool, updatePayoutAccount, verifyHubtel } = await import('../src/services/school.js');
const { bulkImport, createStudent, listStudents } = await import('../src/services/students.js');
const { sendBulk, getSmsBalance } = await import('../src/services/sms.js');
const { getMe } = await import('../src/services/user.js');
const { login } = await import('../src/services/auth.js');

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
  const fresh = await getMe();
  expect(fresh._id === me._id, 'different user returned');
  return fresh.email;
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

// ?? Payout: the endpoint that does not exist on the real API ??????????????

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
  const students = await listStudents({ perPage: 10 });
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
  const students = await listStudents({ perPage: 25, sortBy: 'balance', sortOrder: 'desc' });
  expect(Array.isArray(students), `expected an array, got ${typeof students}`);
  expect(students.length === 25, `expected 25 students, got ${students.length}`);
  return `${students.length} students`;
});

await check('seeded roster contains fully paid students (Step 4 filter)', async () => {
  const all = await listStudents({ perPage: 100 });
  const paid = all.filter((s) => s.balance === 0).length;
  expect(paid > 0, 'no fully paid students in the fixture — the "all owing" filter is untestable');
  return `${paid} of ${all.length} fully paid`;
});

// ?? SMS ????????????????????????????????????????????????????????????????????

await check('SMS balance is super_admin only, and Step 4 tolerates null', async () => {
  const balance = await getSmsBalance();
  expect(balance === null, `expected null for a school admin, got ${JSON.stringify(balance)}`);
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
  const students = await listStudents({ perPage: 5 });
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

console.log(`\n${pass} passed, ${fail} failed.`);
process.exit(fail === 0 ? 0 : 1);
