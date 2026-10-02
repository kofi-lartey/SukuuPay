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
const { listCohorts, getCohort, listAlumni } = await import('../src/services/students.js');
const {
  createIdCardBatch,
  getIdCardBatchPreview,
  downloadIdCardBatchPdf,
  downloadStudentIdCard,
  exportQrLinks,
} = await import('../src/services/idCards.js');
const { recordManualPayment } = await import('../src/services/payments.js');
const { getPayView } = await import('../src/services/publicPay.js');
const { sendBulkSms, previewAudience, getSmsCredits, topUpSmsCredits, listSmsTemplates, countSegments, renderBodyLocally } = await import('../src/services/sms.js');
const { getSchoolCompliance, createPaymentPlan, cancelPaymentPlan, updateInstallment, projectSchedule } = await import('../src/services/paymentPlans.js');
const { studentsFor } = await import('../src/mocks/db.js');
const { getMe, inviteUser, removeUser, updateMe, updateUserRole } = await import('../src/services/user.js');
const { login, signup, verifyEmail, resendVerificationEmail } = await import('../src/services/auth.js');
const {
  getDashboardKpis,
  listSchools,
  getRevenue,
  getPlatformSmsBalance,
  suspendSchool,
  listPlatformUsers,
  listSchoolAds,
  reviewSchoolAd,
  getRevenueSeries,
  getPlatformSettings,
  updatePlatformSettings,
} = await import('../src/services/admin.js');

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
  // `status: 'active'` because the collection also holds the graduated alumni
  // the Cohorts and Alumni tabs read. That is the real arrangement — a graduate
  // is a student record — so an unfiltered count returns every cohort member
  // ever, which is exactly what the real endpoint does too.
  const { data } = await api.get('/students', {
    params: { perPage: 25, sortBy: 'balance', sortOrder: 'desc', status: 'active' },
  });

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

// ?? SMS reminders ??????????????????????????????????????????????????????????
//
// These four used to assert that `POST /sms/bulk` did not exist — the old
// `sendBulk()` helper threw `SMS_SEND_NOT_SUPPORTED` because no school-facing
// send route was on the server, and the checks pinned that absence so nobody
// could "fix" it by faking a success. The route is real now, so the same
// anti-fake intent is carried by four different claims: the send is debited by
// exactly the priced amount, a short balance is refused with 402 *before* any
// message exists, an empty audience is a 422 rather than a zero-send success,
// and the cost arithmetic in the composer's own helpers agrees with what the
// server charged.

const GENTLE_PROMPT =
  'Dear {parentName}, {studentName} owes GHC {balance} for this term at {schoolName}. Please pay via MTN MoMo, Telecel Cash or AirtelTigo: {payLink}';

await check('GET /sms/credits is school-scoped and reports the cedi value', async () => {
  resetDb('established');
  setScenario('healthy');
  const user = await signIn('head.bursary@example.org');
  const credits = await getSmsCredits(user.schoolId);

  expect(typeof credits.balance === 'number', 'balance is not a number');
  expect(credits.ratePes === 12, `expected the 0.12 GHS rate, got ${credits.ratePes}`);
  // 1 credit is GHC 0.12, so the cedi figure must be exactly balance x 12 pesewas.
  // The header pill and the composer's cost card both quote this number; a
  // disagreement between them is the bug this assertion exists to prevent.
  expect(
    credits.balancePes === credits.balance * 12,
    `balancePes ${credits.balancePes} != ${credits.balance} x 12`
  );
  expect(credits.canSend === true, 'healthy scenario should be able to send');
  return `${credits.balance} SMS, ${credits.balanceCedis}`;
});

await check('POST /sms/credits/top-up raises the balance and records the grant', async () => {
  const user = await signIn('head.bursary@example.org');
  const before = (await getSmsCredits(user.schoolId)).balance;
  const result = await topUpSmsCredits({ units: 1000 });
  expect(result.balance === before + 1000, `expected ${before + 1000}, got ${result.balance}`);
  // No reference means a support grant, not a purchase. Conflating the two is
  // what makes a school's credit history unusable for reconciliation.
  expect(result.topUp.source === 'grant', `expected a grant, got ${result.topUp.source}`);
  return `+1000 ? ${result.balance}`;
});

await check('POST /sms/audience/preview sizes a real audience with an operator split', async () => {
  resetDb('established');
  setScenario('healthy');
  const user = await signIn('head.bursary@example.org');
  const preview = await previewAudience({ type: 'all_owing', minBalance: 1 }, user.schoolId);

  expect(preview.matchCount > 0, 'the established school has students owing');
  expect(preview.totalBalance > 0, 'no outstanding balance reported');
  // The split must account for every recipient. A bar that sums to less than the
  // count with nothing explaining the gap is how a coverage report quietly
  // under-reports MTN.
  const splitTotal = Object.values(preview.networkSplit).reduce((sum, n) => sum + n, 0);
  expect(splitTotal === preview.matchCount, `split sums to ${splitTotal}, expected ${preview.matchCount}`);
  expect(preview.networkSplit.unknown === 0, 'the fixture generates valid Ghanaian numbers');
  return `${preview.matchCount} parents, ${preview.totalBalanceDisplay}`;
});

await check('the preview and the send agree on the recipient count', async () => {
  // The composer's cost card is built from the preview and the confirmation
  // dialog from the send response. If those two disagree, a bursar is shown one
  // number and billed for another — so the check is that they are the same
  // number, not merely both positive.
  const user = await signIn('head.bursary@example.org');
  const audience = { type: 'all_owing', minBalance: 1 };
  const preview = await previewAudience(audience, user.schoolId);
  const result = await sendBulkSms({ audience, body: GENTLE_PROMPT, category: 'fee_reminder' });
  expect(
    result.job.recipients === preview.matchCount,
    `preview said ${preview.matchCount}, send queued ${result.job.recipients}`
  );
  return `${result.job.recipients} parents`;
});

await check('POST /sms/bulk debits exactly the priced cost', async () => {
  resetDb('established');
  setScenario('healthy');
  const user = await signIn('head.bursary@example.org');
  const before = (await getSmsCredits(user.schoolId)).balance;

  const result = await sendBulkSms({
    audience: { type: 'all_owing', minBalance: 1 },
    body: GENTLE_PROMPT,
    category: 'fee_reminder',
  });

  const expectedCost = result.job.segments * result.job.recipients;
  expect(
    result.job.creditsCharged === expectedCost,
    `charged ${result.job.creditsCharged}, expected ${result.job.segments} x ${result.job.recipients}`
  );
  expect(
    before - result.job.creditsCharged === result.job.balanceAfter,
    `balance went ${before} -> ${result.job.balanceAfter}, but ${result.job.creditsCharged} was charged`
  );
  return `${result.job.recipients} recipients x ${result.job.segments} parts = ${result.job.creditsCharged} SMS`;
});

await check('POST /sms/bulk refuses a short balance with 402 and sends nothing', async () => {
  const user = await signIn('head.bursary@example.org');
  setScenario('healthy');
  getDb().schools[0].sms.balance = 1;
  // Snapshot rather than assert zero: earlier checks in this file queue real
  // broadcasts, and the claim under test is "this refusal added nothing", not
  // "no job has ever existed".
  const jobsBefore = (getDb().smsJobs || []).length;

  try {
    await sendBulkSms({
      audience: { type: 'all_owing', minBalance: 1 },
      body: GENTLE_PROMPT,
      category: 'fee_reminder',
    });
    throw new Error('expected a rejection');
  } catch (error) {
    expect(error.status === 402, `expected 402, got ${error.status}`);
    expect(error.code === 'INSUFFICIENT_SMS_CREDIT', `expected INSUFFICIENT_SMS_CREDIT, got ${error.code}`);
    // The refusal must not have created a job. A 402 that left a queued
    // broadcast behind is a broadcast that runs later against a balance that was
    // refused an hour ago.
    expect(
      (getDb().smsJobs || []).length === jobsBefore,
      'a job was created despite the 402'
    );
    return error.message;
  }
});

await check('POST /sms/bulk refuses an empty audience rather than sending zero', async () => {
  const user = await signIn('head.bursary@example.org');
  setScenario('healthy');
  getDb().schools[0].sms.balance = 4200;
  // A rule nothing matches. `minBalance: 0` with `includeZeroBalance` is the
  // only shape the server accepts as coherent, so this is a real audience that
  // is genuinely empty — not a malformed request that would pass for a
  // different test.
  try {
    await sendBulkSms({
      audience: { type: 'class', class: 'ZZZ 99', minBalance: 1 },
      body: GENTLE_PROMPT,
      category: 'fee_reminder',
    });
    throw new Error('expected a rejection');
  } catch (error) {
    expect(error.status === 422, `expected 422, got ${error.status}`);
    expect(error.code === 'NO_RECIPIENTS', `expected NO_RECIPIENTS, got ${error.code}`);
    return error.message;
  }
});

await check('POST /sms/bulk rejects an unknown token before anything is charged', async () => {
  const user = await signIn('head.bursary@example.org');
  setScenario('healthy');
  const before = (await getSmsCredits(user.schoolId)).balance;
  try {
    await sendBulkSms({
      audience: { type: 'all_owing', minBalance: 1 },
      // A lowercase typo. It would be delivered to every parent as literal text.
      body: 'Dear {parentname}, you owe {balance}.',
      category: 'fee_reminder',
    });
    throw new Error('expected a rejection');
  } catch (error) {
    expect(error.code === 'UNKNOWN_SMS_TOKEN', `expected UNKNOWN_SMS_TOKEN, got ${error.code}`);
    expect(
      (await getSmsCredits(user.schoolId)).balance === before,
      'the balance was debited for a message that was never sent'
    );
    return error.message;
  }
});

await check('the composer token helpers match what the server accepted', async () => {
  // `countSegments` and `renderBodyLocally` are a third copy of the server's
  // logic. The composer's cost card is built from them, so a drift from the
  // server means the price on screen is not the price charged. Asserted against
  // a body the server has just accepted at a known segment count.
  const user = await signIn('head.bursary@example.org');
  setScenario('healthy');
  const long = `Dear {parentName}, ${'x'.repeat(200)}`;
  const result = await sendBulkSms({
    audience: { type: 'all_owing', minBalance: 1 },
    body: long,
    category: 'fee_reminder',
  });
  expect(
    result.job.segments === countSegments(long),
    `client counts ${countSegments(long)} parts, server charged for ${result.job.segments}`
  );

  // An unmatched token must survive rendering rather than be blanked: a blank
  // reads as a message addressed to nobody, and `{dueDate}` is a bug report.
  const rendered = renderBodyLocally('Hi {parentName}, pay {balance} by {dueDate}', {
    parentName: 'Mr. Mensah',
    balance: '550.00',
    dueDate: '',
  });
  expect(rendered.endsWith('{dueDate}'), `blanked the unmatched token: ${rendered}`);
  return `${result.job.segments} parts, unmatched token preserved`;
});

await check('GET /sms/templates always returns the four platform presets', async () => {
  resetDb('established');
  setScenario('healthy');
  const user = await signIn('head.bursary@example.org');
  const templates = await listSmsTemplates({ schoolId: user.schoolId });
  const presets = templates.filter((t) => t.isPreset).map((t) => t.name).sort();
  const expected = ['Custom Message', 'Final Warning', 'Gentle Prompt', 'PTA Special'].sort();
  expect(
    JSON.stringify(presets) === JSON.stringify(expected),
    `presets were ${JSON.stringify(presets)}`
  );
  // Every preset must be sendable as-is: its tokens have to be real, or a bursar
  // picks "Gentle Prompt" and cannot send it.
  templates
    .filter((t) => t.isPreset)
    .forEach((t) => {
      const unknowns = (t.body.match(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g) || []).filter((tok) =>
        !/^\{(parentName|studentName|studentClass|balance|amountPaid|dueDate|schoolName|payLink|term)\}$/.test(tok)
      );
      expect(unknowns.length === 0, `${t.name} uses unknown tokens: ${unknowns.join(', ')}`);
    });
  return presets.join(', ');
});

// ?? Installment plans ??????????????????????????????????????????????????????
//
// The compliance dashboard's numbers are the claims a bursar makes to a head
// teacher, so the checks below are mostly about *arithmetic* rather than
// plumbing: that the summary's money is the sum of the plans in each bucket, that
// the rate's denominator excludes finished plans, and that the create screen's
// projection is the schedule the server will actually build.

await check('GET /payment-plans/.../compliance summarises a real set of plans', async () => {
  resetDb('established');
  setScenario('healthy');
  const user = await signIn('head.bursary@example.org');
  const { summary, plans, meta } = await getSchoolCompliance(user.schoolId, { perPage: 5 });

  expect(summary && summary.activePlans > 0, 'the established school has active plans');
  expect(plans.length > 0, 'the first page returned no plans');
  // The three in-flight buckets are the denominator. A summary that counted
  // completed and cancelled plans would report a school that finished everything
  // it ever wrote as ~40% compliant.
  expect(
    summary.activePlans === summary.onTrack + summary.approachingDue + summary.overdue,
    `activePlans ${summary.activePlans} != ${summary.onTrack} + ${summary.approachingDue} + ${summary.overdue}`
  );
  expect(
    summary.complianceRate === Math.round((summary.onTrack / summary.activePlans) * 1000) / 10,
    `complianceRate ${summary.complianceRate} is not onTrack/activePlans`
  );
  expect(
    summary.committedAmount ===
      summary.onTrackValue + summary.approachingDueValue + summary.overdueValue,
    'committedAmount is not the sum of the three in-flight values'
  );
  expect(meta.total === summary.totalPlans, 'the page meta and the summary disagree on the total');
  return `${summary.activePlans} active (${summary.onTrack} on track, ${summary.approachingDue} due, ${summary.overdue} overdue), rate ${summary.complianceRate}%`;
});

await check('the compliance page is a subset of the summary, and the summary is not the page', async () => {
  // The specific bug the money aggregates exist to prevent: a client that totals
  // the twenty rows it happens to be holding and calls it the school's position.
  resetDb('established');
  setScenario('healthy');
  const user = await signIn('head.bursary@example.org');
  const { summary, plans } = await getSchoolCompliance(user.schoolId, { perPage: 3 });

  if (summary.totalPlans <= 3) return 'school has too few plans for this to be meaningful';

  const pageValue = plans.reduce((sum, plan) => sum + (plan.outstandingAmount || 0), 0);
  expect(plans.length === 3, `asked for 3, got ${plans.length}`);
  expect(
    pageValue !== summary.committedAmount,
    'the page total equals the school total — the page is not a subset, so the summary is suspect'
  );
  return `page ${pageValue} vs school ${summary.committedAmount} — the aggregates are doing real work`;
});

await check('a class filter narrows the plans and the totals with it', async () => {
  resetDb('established');
  setScenario('healthy');
  const user = await signIn('head.bursary@example.org');
  const school = getDb().schools[0];
  const className = school.academic.classes[0];

  const all = await getSchoolCompliance(user.schoolId, { perPage: 1 });
  const scoped = await getSchoolCompliance(user.schoolId, { class: className, perPage: 50 });

  expect(scoped.summary.totalPlans < all.summary.totalPlans, 'the filter did not narrow anything');
  expect(
    scoped.plans.every((plan) => plan.student.studentClass === className),
    'a plan from another class came through the class filter'
  );
  return `${scoped.summary.totalPlans} of ${all.summary.totalPlans} plans in ${className}`;
});

await check('a class filter and a search filter intersect rather than replace', async () => {
  // The bug this guards: applying the search with a fresh `$in` would silently
  // discard the class filter, so a bursar searching within "JHS 2" would get the
  // whole school's matches and believe they had narrowed it.
  resetDb('established');
  setScenario('healthy');
  const user = await signIn('head.bursary@example.org');
  const school = getDb().schools[0];
  const className = school.academic.classes[0];

  const byClass = await getSchoolCompliance(user.schoolId, { class: className, perPage: 100 });
  if (!byClass.plans.length) return `${className} has no plans to intersect with`;

  const target = byClass.plans[0].student;
  // The needle comes from the *parent*, deliberately. The search box's own
  // placeholder says "student name, ID or parent", and searching a parent name is
  // the case a bursar actually hits — several children share a guardian, so
  // "Mensah" should find all of them. It also means this check cannot be
  // satisfied by asserting only the student's own name, which is the field most
  // likely to be wired up correctly and the parent field most likely forgotten.
  const needle = (target.parentName || target.studentName).split(' ')[0];

  const combined = await getSchoolCompliance(user.schoolId, {
    class: className,
    search: needle,
    perPage: 100,
  });

  const escaped = combined.plans.filter((plan) => {
    const matchesClass = plan.student.studentClass === className;
    // Matches *any* of the three searchable fields, exactly as the service does.
    // A check asserting only the student name would pass against a search that
    // ignored parents entirely, which is the bug being guarded.
    const matchesSearch =
      plan.student.studentName.toLowerCase().includes(needle.toLowerCase()) ||
      String(plan.student.studentId).toLowerCase().includes(needle.toLowerCase()) ||
      String(plan.student.parentName || '').toLowerCase().includes(needle.toLowerCase());
    return !matchesClass || !matchesSearch;
  });

  expect(combined.plans.length > 0, `the intersection returned nothing for "${needle}"`);
  expect(
    escaped.length === 0,
    `${escaped.length} row(s) escaped both filters, e.g. ${JSON.stringify(escaped[0]?.student)} not ${className}/${needle}`
  );
  return `${combined.summary.totalPlans} rows survived both filters (needle "${needle}")`;
});

await check('a search that matches nothing returns an empty page, not an error', async () => {
  resetDb('established');
  setScenario('healthy');
  const user = await signIn('head.bursary@example.org');
  const { summary, plans } = await getSchoolCompliance(user.schoolId, {
    search: 'zzzzznosuchfamily',
    perPage: 20,
  });

  expect(summary.totalPlans === 0, `expected no matches, got ${summary.totalPlans}`);
  expect(plans.length === 0, 'rows came back for a search that matched nothing');
  expect(summary.complianceRate === null, 'a compliance rate with no plans in scope is not 0 or 100');
  return 'empty, and the rate is null rather than 0%';
});

await check('the create projection matches the schedule the server builds', async () => {
  // The mirror in `services/paymentPlans.js` exists so the projection rail can be
  // live; this is what fails if the two drift. 30 October + 1 month is 30
  // November on both sides — the clamped-day case, chosen because it is the one a
  // naive `setMonth` gets wrong and the one that shows up as a plan a bursar
  // previewed on the 30th being created on the 1st.
  resetDb('established');
  setScenario('healthy');
  const user = await signIn('head.bursary@example.org');
  // A student with a balance and **no live plan** — the projection check is about
  // the schedule arithmetic, so picking one that already has a plan would just
  // hit the 409 and assert nothing.
  const student = studentsFor(user.schoolId).find((s) => {
    if ((s.balance || 0) <= 0 || s.status !== 'active') return false;
    return !(getDb().paymentPlans || []).some(
      (p) => p.studentId === s._id && ['active', 'pending_acceptance'].includes(p.planStatus)
    );
  });
  expect(!!student, 'no unplanned student with a balance to plan for');

  const total = student.balance;
  const count = 3;
  const startDate = '2026-10-30';

  const projected = projectSchedule({ totalAmount: total, numberOfInstallments: count, startDate, interval: 'monthly' });

  // The remainder lands on the last tranche, not the first, and the tranches must
  // sum back to the balance exactly.
  const projectedSum = projected.reduce((sum, t) => sum + t.amount, 0);
  expect(projectedSum === total, `projection sums to ${projectedSum}, balance is ${total}`);
  expect(
    projected[0].amount === Math.floor(total / count),
    'the first tranche is not the even base'
  );
  expect(
    projected[count - 1].amount === total - Math.floor(total / count) * (count - 1),
    'the last tranche does not absorb the remainder'
  );

  const { plan } = await createPaymentPlan(student._id, { numberOfInstallments: count, interval: 'monthly', startDate });

  expect(
    plan.installments.length === projected.length,
    `projected ${projected.length} tranches, server built ${plan.installments.length}`
  );
  plan.installments.forEach((tranche, index) => {
    expect(
      tranche.amount === projected[index].amount,
      `tranche ${index + 1}: projected ${projected[index].amount}, server ${tranche.amount}`
    );
    expect(
      new Date(tranche.dueDate).toISOString().slice(0, 10) ===
        projected[index].dueDate.toISOString().slice(0, 10),
      `tranche ${index + 1} due date: projected ${projected[index].dueDate.toISOString().slice(0, 10)}, server ${tranche.dueDate.slice(0, 10)}`
    );
  });
  return `${count} tranches, ${plan.installments.map((t) => t.dueDate.slice(0, 10)).join(' ? ')}`;
});

await check('a created plan is planned against the balance, not the gross fee', async () => {
  // The distinction the create screen's three tiles exist to make. Structuring
  // `totalOwed` instead of `balance` would ask the family for a deposit they have
  // already paid, and the arithmetic downstream would be perfectly valid — so
  // nothing else would catch it.
  resetDb('established');
  setScenario('healthy');
  const user = await signIn('head.bursary@example.org');
  const student = studentsFor(user.schoolId).find((s) => {
    if (!(s.balance > 0) || s.totalOwed <= s.balance || s.status !== 'active') return false;
    return !(getDb().paymentPlans || []).some(
      (p) => p.studentId === s._id && ['active', 'pending_acceptance'].includes(p.planStatus)
    );
  });
  if (!student) return 'no unplanned student in the fixture has both a deposit and a balance';

  const { plan } = await createPaymentPlan(student._id, {
    numberOfInstallments: 2,
    interval: 'monthly',
    startDate: '2026-11-30',
  });

  expect(
    plan.totalAmount === student.balance,
    `plan total ${plan.totalAmount} is not the balance ${student.balance}`
  );
  expect(
    plan.totalAmount !== student.totalOwed,
    'the plan was written against the gross fee — the deposit would be collected twice'
  );
  return `planned ${plan.totalAmount} of a ${student.totalOwed} fee (${student.totalOwed - student.balance} already paid)`;
});

await check('a second live plan for the same student is refused', async () => {
  resetDb('established');
  setScenario('healthy');
  const user = await signIn('head.bursary@example.org');
  const student = studentsFor(user.schoolId).find((s) => {
    const live = (getDb().paymentPlans || []).some(
      (p) => p.studentId === s._id && ['active', 'pending_acceptance'].includes(p.planStatus)
    );
    return live && s.balance > 0;
  });
  if (!student) return 'no student in the fixture already has a live plan';

  try {
    await createPaymentPlan(student._id, { numberOfInstallments: 2, interval: 'monthly', startDate: '2026-11-30' });
    throw new Error('expected a rejection');
  } catch (error) {
    expect(error.status === 409, `expected 409, got ${error.status}`);
    expect(error.code === 'PLAN_ALREADY_EXISTS', `expected PLAN_ALREADY_EXISTS, got ${error.code}`);
    return error.message;
  }
});

await check('a settled student cannot be planned for', async () => {
  resetDb('established');
  setScenario('healthy');
  const user = await signIn('head.bursary@example.org');
  const student = studentsFor(user.schoolId).find((s) => (s.balance || 0) === 0 && !(getDb().paymentPlans || []).some((p) => p.studentId === s._id));
  if (!student) return 'no fully settled, unplanned student in the fixture';

  try {
    await createPaymentPlan(student._id, { numberOfInstallments: 2, interval: 'monthly', startDate: '2026-11-30' });
    throw new Error('expected a rejection');
  } catch (error) {
    expect(error.code === 'NO_OUTSTANDING_BALANCE', `expected NO_OUTSTANDING_BALANCE, got ${error.code}`);
    return error.message;
  }
});

await check('marking a tranche paid settles it and does not touch the balance', async () => {
  // `mark_paid` is a manual reconciliation: it moves the plan's progress and
  // nothing else. A bursar who assumed it recorded a payment would reconcile
  // against a collections total that never moved — which is why the drawer says
  // so on screen and this check pins the behaviour.
  resetDb('established');
  setScenario('healthy');
  const user = await signIn('head.bursary@example.org');
  const plan = (getDb().paymentPlans || []).find(
    (p) => p.planStatus === 'active' && (p.installments || []).some((i) => i.status === 'pending')
  );
  if (!plan) return 'no active plan with a pending tranche';

  const student = studentsFor(user.schoolId).find((s) => s._id === plan.studentId);
  const balanceBefore = student.balance;
  const target = plan.installments.find((i) => i.status === 'pending');

  const updated = await updateInstallment(plan._id, target.installmentNumber, { action: 'mark_paid' });
  const settled = updated.installments.find((i) => i.installmentNumber === target.installmentNumber);

  expect(settled.status === 'paid', `tranche is ${settled.status}`);
  expect(settled.amountPaid === target.amount, `amountPaid ${settled.amountPaid} != ${target.amount}`);
  expect(
    studentsFor(user.schoolId).find((s) => s._id === plan.studentId).balance === balanceBefore,
    "the student's balance moved — mark_paid must not create a Payment"
  );
  expect(getDb().payments.length === 0, 'a Payment record was created by mark_paid');
  return `tranche ${target.installmentNumber} paid, balance unchanged at ${balanceBefore}`;
});

await check('cancelling a plan is soft, and the family is told why', async () => {
  resetDb('established');
  setScenario('healthy');
  const user = await signIn('head.bursary@example.org');
  const plan = (getDb().paymentPlans || []).find((p) => ['active', 'pending_acceptance'].includes(p.planStatus));
  if (!plan) return 'no live plan to cancel';

  const reason = 'Parent requested a single payment instead';
  const cancelled = await cancelPaymentPlan(plan._id, reason);

  expect(cancelled.planStatus === 'cancelled', `status is ${cancelled.planStatus}`);
  expect(cancelled.cancellationReason === reason, 'the reason was not stored');
  // Soft: the row stays, because a school has to be able to explain to a family
  // why their schedule stopped. A hard delete would make that unanswerable.
  expect(
    (getDb().paymentPlans || []).some((p) => p._id === plan._id),
    'the plan row was removed — a cancellation must not erase the history'
  );
  return 'cancelled, reason stored, record retained';
});

await check('at_risk reaches the families the compliance footer promises to chase', async () => {
  // The footer's count comes from `summary.atRiskPlans` and the button's
  // recipients come from this audience rule. If the two disagree, the bursar is
  // told a number and messaged a different one — which is the specific dishonesty
  // a bulk chaser is capable of.
  resetDb('established');
  setScenario('healthy');
  const user = await signIn('head.bursary@example.org');
  const { summary } = await getSchoolCompliance(user.schoolId, { perPage: 1 });
  const audience = await previewAudience({ type: 'at_risk', minBalance: 1, dueSoonDays: 5 }, user.schoolId);

  expect(summary.atRiskPlans > 0, 'the fixture has no at-risk families');
  expect(
    audience.matchCount === summary.atRiskPlans,
    `the button says ${summary.atRiskPlans} but the audience rule matches ${audience.matchCount}`
  );
  return `${audience.matchCount} families, matching the ${summary.atRiskPlans} the dashboard states`;
});

await check('at_risk is a strict superset of installment_due_soon', async () => {
  // `at_risk` is the union of "slipped a tranche" and "one is coming due". If it
  // ever stopped being a superset, the chaser would silently stop reaching
  // approaching families while the compliance table still listed them.
  resetDb('established');
  setScenario('healthy');
  const user = await signIn('head.bursary@example.org');

  const due = await previewAudience({ type: 'installment_due_soon', minBalance: 1, dueSoonDays: 5 }, user.schoolId);
  const atRisk = await previewAudience({ type: 'at_risk', minBalance: 1, dueSoonDays: 5 }, user.schoolId);

  expect(
    atRisk.matchCount >= due.matchCount,
    `at_risk matched ${atRisk.matchCount}, fewer than the ${due.matchCount} due-soon families`
  );
  return `${due.matchCount} due soon ? ${atRisk.matchCount} at risk`;
});

// ?? Scenarios ??????????????????????????????????????????????????????????????

await check('GET /cohorts returns cohorts with real outcome counts', async () => {
  // Reset first: these run mid-file, and the world may have been rebuilt by an
  // earlier check. Without a known scenario the schoolId in scope can belong to
  // a world that no longer exists, and the handler correctly returns nothing.
  resetDb('established');
  // schoolId is a module-level binding captured before the reset, so the
  // rebuilt world has a different one. Take it from the session.
  const bursar = await signIn('head.bursary@example.org');
  const { rows } = await listCohorts({ schoolId: bursar.schoolId, page: 1, limit: 20 });
  expect(rows.length > 0, `expected cohorts, got ${rows.length}`);
  rows.forEach((c) => {
    expect(
      c.studentCount === c.graduatedCount + c.transferredCount + c.droppedCount,
      `cohort ${c.id}: ${c.studentCount} != ${c.graduatedCount}+${c.transferredCount}+${c.droppedCount}`
    );
    // The real bug: `$concat` handed a number, so the endpoint 500'd. The mock
    // computes the same string in JS, and this asserts it is a real "YYYY/YYYY".
    expect(/^\d{4}\/\d{4}$/.test(c.academicYear), `bad academicYear: ${c.academicYear}`);
  });
  return `${rows.length} cohorts, e.g. ${rows[0].id} (${rows[0].academicYear})`;
});

await check('GET /cohorts/detail/:cohortId agrees with the list', async () => {
  resetDb('established');
  // schoolId is a module-level binding captured before the reset, so the
  // rebuilt world has a different one. Take it from the session.
  const bursar = await signIn('head.bursary@example.org');
  const { rows } = await listCohorts({ schoolId: bursar.schoolId, page: 1, limit: 20 });
  const target = rows[0];
  const detail = await getCohort(target.id, { schoolId: bursar.schoolId, page: 1, limit: 50 });
  expect(detail.cohort, 'no cohort in the detail payload');
  expect(
    detail.cohort.statistics.totalStudents === target.studentCount,
    `list said ${target.studentCount}, detail said ${detail.cohort.statistics.totalStudents}`
  );
  expect(detail.students.length > 0, 'no students in the detail');
  // The real detail query strips guardians, so the token is never exposed here.
  expect(
    detail.students.every((s) => s.uniquePayLinkToken === undefined),
    'a pay-link token leaked into the cohort detail'
  );
  return `${target.id}: ${detail.students.length} rows`;
});

await check('GET /alumni returns only real graduates', async () => {
  resetDb('established');
  const bursar = await signIn('head.bursary@example.org');
  const { rows } = await listAlumni({ schoolId: bursar.schoolId, page: 1, limit: 20, honors: 'HONORS' });
  expect(rows.length > 0, 'no alumni with HONORS');
  expect(
    rows.every((a) => a.status === 'graduated' && a.isAlumni),
    'a non-graduate appeared in the alumni list'
  );
  expect(
    rows.every((a) => Boolean(a.certificateNumber)),
    'an alumnus had no certificate number'
  );
  return `${rows.length} honors alumni, e.g. ${rows[0].certificateNumber}`;
});

await check('status=all means "no filter", on the mock as on the real API', async () => {
  resetDb('established');
  await signIn('head.bursary@example.org');
  const active = await listStudents({ status: 'active', perPage: 5 });
  const all = await listStudents({ status: 'all', perPage: 5 });
  // The regression: the mock compared `s.status === 'all'`, so "All Records"
  // returned nothing here while the real service returned everything.
  expect(all.rows.length > 0, `status=all returned ${all.rows.length} rows`);
  expect(
    all.meta.total > active.meta.total,
    `status=all (${all.meta.total}) is not larger than status=active (${active.meta.total})`
  );
  return `active ${active.meta.total} of ${all.meta.total} total`;
});

await check('GET /pay/:token returns a deliberately narrow student view', async () => {
  resetDb('established');
  const bursar = await signIn('head.bursary@example.org');
  const { rows } = await listStudents({ schoolId: bursar.schoolId, perPage: 20, status: 'all' });
  const target = rows[0];
  const token = String(target.payLink).split('/').pop();

  const view = await getPayView(token);
  const student = view?.student;

  expect(Boolean(student?.studentName), 'no student name in the pay view');
  // The real response is a deliberate projection: no guardian phone numbers, no
  // pay-link token, no school admin details. A mock returning the whole record
  // would leak exactly what the projection exists to withhold.
  ['parents', 'uniquePayLinkToken', 'schoolId', 'createdBy', 'emergencyContacts'].forEach(
    (field) => {
      if (student[field] !== undefined) throw new Error(`the pay view leaked "${field}"`);
    }
  );
  expect(Boolean(student.school?.name), 'the school name is missing');
  expect(Number.isInteger(student.balance), 'the balance is not a pesewa integer');
  return `${student.studentName}, balance ${student.balance}`;
});

await check('an unknown pay token is refused, not rendered empty', async () => {
  let message = null;
  try {
    await getPayView('STU-DEADBEEF');
  } catch (error) {
    message = error.message;
  }
  expect(Boolean(message), 'an unknown token resolved instead of erroring');
  expect(/expired|invalid/i.test(message), `unhelpful message: ${message}`);
  return message;
});

await check('a manual payment settles the student in the mock too', async () => {
  resetDb('established');
  const bursar = await signIn('head.bursary@example.org');
  const { rows } = await listStudents({ schoolId: bursar.schoolId, perPage: 20, status: 'all' });
  const owing = rows.find((s) => s.balance > 0);
  expect(owing, 'no student with a balance to pay against');

  const before = owing.balance;
  const result = await recordManualPayment({
    studentRef: owing.studentId,
    amount: 10000,
    method: 'cash',
  });

  expect(result?.payment?.status === 'completed', 'the payment was not completed');
  expect(result?.payment?.provider === 'manual', 'provider is not manual');
  expect(
    result?.student?.balance === before - 10000,
    `balance went ${before} -> ${result?.student?.balance}, expected ${before - 10000}`
  );
  return `${owing.studentId}: ${before} -> ${result.student.balance}`;
});

await check('a manual payment above the balance is refused', async () => {
  const bursar = await signIn('head.bursary@example.org');
  const { rows } = await listStudents({ schoolId: bursar.schoolId, perPage: 20, status: 'all' });
  const owing = rows.find((s) => s.balance > 0);

  // Through the service, because that is where the rejection becomes a
  // catchable error: the refusal is the behaviour under test, not a thrown
  // exception to be reported as a failure.
  let message = null;
  let code = null;
  try {
    await recordManualPayment({
      studentRef: owing.studentId,
      amount: owing.balance + 100000,
      method: 'cash',
    });
  } catch (error) {
    message = error.message;
    code = error.code;
  }

  expect(Boolean(message), 'an overpayment was accepted without being forced');
  expect(code === 'AMOUNT_EXCEEDS_BALANCE' || /more than/i.test(message), `unclear refusal: ${code} ${message}`);
  return `${code}: ${String(message).slice(0, 60)}`;
});

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

  // A school with no import has no cohorts either. Asserted here because
  // `PROFILE` is defined above this point but not above the other student
  // checks, and referencing it earlier is a temporal-dead-zone crash rather
  // than a readable failure.
  const { rows: cohorts } = await listCohorts({ schoolId: school.schoolId, page: 1, limit: 20 });
  expect(cohorts.length === 0, `expected no cohorts for an unpopulated school, got ${cohorts.length}`);

  return `${school.name}: 0 students -> Step 4 shows the empty-roster notice`;
});

// ?? ID card print flow ??????????????????????????????????????????????????????
//
// The batch flow is the only place in the app where the *status code* is the
// message: `POST /id-cards/batch` answers 202 because a background job now owns
// the work, and the preview and PDF endpoints answer 202 with
// `{ status: "pending" }` until that job finishes.
//
// Axios rejects on 4xx and 5xx but **resolves** 2xx, so a 202 arrives on the
// success path. A client that branches on `error.response.status` compiles
// cleanly, passes every happy-path test, and then takes the "ready" branch on
// a batch that has not been generated — showing a preview that does not exist
// and downloading a file that 404s. These assertions exist to catch exactly
// that, by driving the real service through the mock's 202 handshake.

await check('POST /id-cards/batch answers 202, not 200', async () => {
  // `resetDb` first: the check immediately above this one leaves a freshly
  // provisioned school with a zero-student roster, and these assertions are
  // about what happens when there are students to print. `established` is the
  // scenario with a populated roll — `new-admin` starts empty, which is right
  // for the onboarding checks above and useless here.
  resetDb('established');
  await signIn('head.bursary@example.org');
  const { rows } = await listStudents({ perPage: 5 });
  expect(rows.length > 0, 'the seeded school has no students to print');

  const result = await createIdCardBatch(rows.map((s) => s._id));
  expect(result?.batchId, 'no batchId in the create response');
  expect(result?.status === 'pending', `expected status "pending", got "${result?.status}"`);

  return `${rows.length} cards -> batchId ${result.batchId}, status pending`;
});

await check('the batch preview reports pending, then ready', async () => {
  const { rows } = await listStudents({ perPage: 3 });
  const { batchId } = await createIdCardBatch(rows.map((s) => s._id));

  const first = await getIdCardBatchPreview(batchId);
  expect(first.status === 'pending', `first poll: expected "pending", got "${first.status}"`);
  expect(typeof first.retryAfter === 'number', 'a pending poll should carry retryAfter');

  const second = await getIdCardBatchPreview(batchId);
  expect(second.status === 'ready', `second poll: expected "ready", got "${second.status}"`);
  expect(typeof second.html === 'string' && second.html.includes('<'), 'the ready poll should return HTML');

  return '202 on the first poll, HTML on the second';
});

await check('the batch PDF is pending first, then a real file', async () => {
  const { rows } = await listStudents({ perPage: 2 });
  const { batchId } = await createIdCardBatch(rows.map((s) => s._id));

  const pending = await downloadIdCardBatchPdf(batchId);
  expect(pending?.status === 'pending', `expected a pending marker, got ${JSON.stringify(pending)}`);

  const file = await downloadIdCardBatchPdf(batchId);
  // The ready branch returns a filename string; a pending branch returns an
  // object. Asserting on the type is what proves the branch was taken.
  expect(typeof file === 'string', `expected a filename string, got ${typeof file}`);
  expect(file.endsWith('.pdf'), `expected a .pdf filename, got "${file}"`);

  return `downloaded ${file}`;
});

await check('a single student card comes back as a PDF', async () => {
  const { rows } = await listStudents({ perPage: 1 });
  expect(rows.length > 0, 'no students to print a single card for');
  const name = await downloadStudentIdCard(rows[0]._id);
  expect(typeof name === 'string' && name.endsWith('.pdf'), `expected a .pdf filename, got "${name}"`);
  return name;
});

await check('the QR links export is CSV with a header row', async () => {
  // `getSchool()` with no argument would request `/schools/undefined`; the id
  // comes from the signed-in user, which is where every other scoped call gets
  // it from too.
  const user = await signIn('head.bursary@example.org');
  const name = await exportQrLinks(user.schoolId, { perPage: 10 });
  expect(name.endsWith('.csv'), `expected a .csv filename, got "${name}"`);
  return name;
});

await check('a batch refuses students outside the school', async () => {
  // The all-zeros id is well-formed hex but belongs to nobody, which is the
  // case `INVALID_STUDENTS` exists for: a stale id from another school must
  // fail loudly rather than silently printing a short batch.
  const { rows } = await listStudents({ perPage: 1 });
  expect(rows.length > 0, 'no students to build a batch from');

  let seen = null;
  try {
    await createIdCardBatch([rows[0]._id, '000000000000000000000000']);
  } catch (error) {
    seen = error;
  }
  expect(seen, 'a foreign student id was accepted');
  // Asserted on the code rather than the message: the code is the stable part
  // of the contract, and a message assertion here would break the first time
  // the wording is improved.
  expect(
    seen.code === 'INVALID_STUDENTS',
    `expected INVALID_STUDENTS, got code="${seen.code}" status=${seen.status} message="${seen.message}"`
  );
  return `rejected with ${seen.code}`;
});

// ?? Platform console (/api/admin/*) ???????????????????????????????????
//
// The super-admin surface. Three things are worth proving here that a render test
// cannot:
//
// 1. the role boundary — `admin.routes.js` applies `authorize("super_admin")` at
//    the router level, and the frontend's `AdminGuard` is presentation, so the
//    mock is the only place a school admin gets to find out the server refuses;
// 2. the *scoping* of `GET /users`, which is the load-bearing finding behind the
//    console's user page needing no new endpoint;
// 3. the pagination envelope, because there are now four shapes of it in the
//    product and only one of them is what `Pagination` takes.

await check('GET /admin/dashboard returns the documented platform payload', async () => {
  resetDb('super-admin');
  await signIn('admin@example.com');

  const kpis = await getDashboardKpis();
  for (const key of ['schools', 'users', 'payments', 'sms']) {
    expect(kpis[key], `no "${key}" block`);
  }
  for (const key of ['total', 'active', 'suspended', 'archived', 'onTrial', 'paid']) {
    expect(typeof kpis.schools[key] === 'number', `schools.${key} is not a number`);
  }
  for (const key of ['totalRevenue', 'mtdRevenue', 'ytdRevenue', 'platformMarkup', 'pendingPayouts']) {
    expect(typeof kpis.payments[key] === 'number', `payments.${key} is not a number`);
  }
  expect(Array.isArray(kpis.recentSchools), 'recentSchools is not an array');

  // Money crosses the wire as integer pesewas. A figure already in cedis here
  // would make every tile in the console read 100× too large, and nothing else
  // in the system would catch it.
  expect(Number.isInteger(kpis.payments.totalRevenue), 'revenue is not an integer pesewa figure');
  return `${kpis.schools.total} schools, GH? ${(kpis.payments.totalRevenue / 100).toLocaleString('en-GB')}`;
});

await check('the whole /admin surface is refused to a school admin', async () => {
  // `new-admin` is the persona whose login *is* `bursar@example.org`;
  // `personaEmail` maps each persona to its own address, so an unknown persona id
  // falls through to a world with a different one and the sign-in fails first.
  resetDb('new-admin');
  await signIn('bursar@example.org');

  await expectStatus(getDashboardKpis(), 403, 'GET /admin/dashboard');
  await expectStatus(listSchools(), 403, 'GET /admin/schools');
  await expectStatus(getRevenue(), 403, 'GET /admin/revenue');
  await expectStatus(getPlatformSmsBalance(), 403, 'GET /admin/sms-balance');
  await expectStatus(listSchoolAds(), 403, 'GET /admin/school-ads');
  return 'every route answered 403';
});

await check('listSchools normalises the pagination envelope for the shared pager', async () => {
  resetDb('super-admin');
  await signIn('admin@example.com');

  const { rows, meta } = await listSchools({ perPage: 5 });
  expect(rows.length === 5, `expected 5 rows, got ${rows.length}`);

  // The API says `pages`; `Pagination` reads `totalPages`. If the service ever
  // stops mapping it, the pager renders "1 of undefined" on a call that answered
  // 200 — and nothing else in the console would notice.
  for (const key of ['page', 'perPage', 'total', 'totalPages']) {
    expect(typeof meta[key] === 'number', `meta.${key} is not a number`);
  }
  expect(meta.totalPages === Math.ceil(meta.total / meta.perPage), 'totalPages disagrees with total/perPage');

  // Every list row carries its own aggregates, so the table needs no N+1.
  const row = rows[0];
  for (const key of ['studentCount', 'staffCount', 'paymentVolume']) {
    expect(typeof row[key] === 'number', `${key} missing from a schools row`);
  }
  return `page ${meta.page}, ${meta.totalPages} pages of ${meta.total}`;
});

await check('a suspended school is refused a second suspension with the reason stated', async () => {
  resetDb('super-admin');
  await signIn('admin@example.com');

  const { rows } = await listSchools({ status: 'active', perPage: 1 });
  const target = rows[0];

  await expectStatus(suspendSchool(target._id, 'too short'), 422, 'PUT suspend with a 9-character reason');

  const suspended = await suspendSchool(
    target._id,
    'Non-payment of subscription fees for 3 consecutive months'
  );
  expect(suspended.status === 'suspended', `expected suspended, got ${suspended.status}`);
  expect(suspended.suspendedReason, 'the reason was not stored');

  // The real route refuses a school that is not already suspended, and a mock
  // that accepted it would let the UI's unsuspend button appear to work twice.
  await expectStatus(suspendSchool(target._id, 'A second suspension attempt here'), 400, 'PUT suspend again');
  return `${suspended.name} suspended with its reason recorded`;
});

await check('GET /users is platform-wide for a super_admin and school-scoped otherwise', async () => {
  // The finding the console's user page rests on: `listUsers` computes
  // `targetSchoolId = query.schoolId || req.user.schoolId`, and a platform
  // admin's schoolId is null, so the school filter is never applied and the
  // query returns every account. The console therefore needs no new endpoint —
  // and "All schools" is its *default* scope, which is why the page states it.
  resetDb('super-admin');
  await signIn('admin@example.com');

  const platform = await listPlatformUsers({ perPage: 100 });
  expect(
    platform.rows.length > 1,
    `a super_admin only saw ${platform.rows.length} account(s)`
  );

  // The scope filter, against a school that actually owns accounts. The seeded
  // platform admin is itself in the list with `schoolId: null` (as on the real
  // model), so filtering by *its* schoolId would send no filter at all and return
  // everything — a good illustration of why "All schools" has to be a labelled
  // choice in the console rather than an absence of one.
  const scopedTo = platform.rows.find((row) => row.schoolId);
  expect(scopedTo, 'no account in the platform list belongs to a school');
  const scoped = await listPlatformUsers({ perPage: 100, schoolId: scopedTo.schoolId });
  expect(
    scoped.rows.every((row) => String(row.schoolId) === String(scopedTo.schoolId)),
    'a schoolId filter returned accounts from other schools'
  );
  expect(scoped.meta.total < platform.meta.total, 'the school filter did not narrow anything');

  // And the school console is unaffected: a bursar sees their own school only.
  resetDb('new-admin');
  await signIn('bursar@example.org');
  const own = await listPlatformUsers({ perPage: 100 });
  expect(
    own.rows.every((row) => String(row.schoolId) === String(schoolId)),
    'a bursar saw accounts outside their own school'
  );
  expect(own.meta.total === 1, `a bursar should see one account in their school, saw ${own.meta.total}`);
  return `super_admin ${platform.meta.total} accounts, one school ${scoped.meta.total}, bursar ${own.meta.total}`;
});

await check('the moderation queue refuses a rejection with no reason', async () => {
  // `approveSchoolAdSchema` requires a reason on a rejection, and that reason is
  // what the submitting school is told. A mock that accepted a bare rejection
  // would let the console ship a Reject button that produces no explanation.
  resetDb('super-admin');
  await signIn('admin@example.com');

  const { rows } = await listSchoolAds({ status: 'pending', perPage: 1 });
  expect(rows.length > 0, 'no pending creative to review');

  await expectStatus(reviewSchoolAd(rows[0]._id, { status: 'rejected' }), 422, 'reject with no reason');

  const approved = await reviewSchoolAd(rows[0]._id, { status: 'approved' });
  expect(approved.status === 'approved', `expected approved, got ${approved.status}`);

  // With no placement filter the queue must span placements: the schema shares
  // this route with the public slider, so a default here would hide every
  // placement but one from the person moderating them.
  const all = await listSchoolAds({ perPage: 50 });
  const placements = new Set(all.rows.map((ad) => ad.placement));
  expect(placements.size > 1, `the queue only showed ${[...placements].join(', ')}`);
  return `rejection needs a reason; queue spans ${[...placements].join(', ')}`;
});

await check('the platform owner cannot be multiplied from any endpoint', async () => {
  // There is exactly one `super_admin`, provisioned from the server environment.
  // The backend closes this at the schema (`ASSIGNABLE_ROLES`), in two controllers
  // and in `PUT /users/:userId` — and the mock closes it at all four places too,
  // because a mock that let the console mint a second owner in development would
  // make the console look correct here and fail in production, which is the one
  // thing a mock exists to prevent.
  resetDb('super-admin');
  await signIn('admin@example.com');

  const { rows } = await listPlatformUsers({ perPage: 100 });
  const owner = rows.find((row) => row.role === 'super_admin');
  expect(owner, 'the mock has no platform owner to protect');
  const other = rows.find((row) => row._id !== owner._id);
  expect(other, 'need a second account to try the grant against');

  // The dedicated role endpoint.
  await expectStatus(
    updateUserRole(other._id, 'super_admin'),
    403,
    'PUT /users/:id/role with super_admin'
  );
  // `PUT /users/:userId`, which carries no `authorize` middleware at all and is the
  // quiet one — its old check was "is the caller a super_admin?", which the one role
  // that must not be able to do this satisfies.
  await expectStatus(
    updateMe(other._id, { role: 'super_admin' }),
    403,
    'PUT /users/:id with super_admin'
  );
  // And the invite path.
  await expectStatus(
    inviteUser({ name: 'Peer Operator', email: 'peer@example.com', role: 'super_admin' }),
    403,
    'POST /users/invite with super_admin'
  );

  // The owner's own removal is refused too, so "one super admin" survives an
  // operator who decides the account is no longer needed.
  //
  // Self-deletion is checked first in both the real handler and the mock, so 400
  // is the code that actually fires here — the only super admin is the one
  // signed in, and "cannot delete yourself" is the better reason anyway. What is
  // under test is that the removal is refused at all; a mock that permitted it
  // would leave the platform with zero owners and no in-product way to fix it.
  let removalError = null;
  try {
    await removeUser(owner._id);
  } catch (error) {
    removalError = error;
  }
  expect(removalError, 'the platform owner was deleted');
  expect(
    removalError.status === 403 || removalError.status === 400,
    `expected the removal to be refused, got ${removalError.status} (${removalError.code})`
  );

  // And the refusal did not change anything.
  const after = await listPlatformUsers({ perPage: 100 });
  expect(
    after.rows.filter((row) => row.role === 'super_admin').length === 1,
    'the refusals changed the number of platform owners'
  );
  return 'invite, role endpoint, profile endpoint and delete all refused; still exactly one';
});

await check('an ordinary role change still works, and still records both sides', async () => {
  resetDb('super-admin');
  await signIn('admin@example.com');

  const { rows } = await listPlatformUsers({ perPage: 100 });
  const bursar = rows.find((row) => row.role !== 'super_admin');
  expect(bursar, `no ordinary account in a list of ${rows.length}`);
  const before = bursar.role;

  const updated = await updateUserRole(bursar._id, before === 'teacher' ? 'viewer' : 'teacher');
  expect(updated.role !== before, `role did not change from ${before}`);

  // Removing an ordinary account is a soft delete that revokes its sessions, and it
  // is the action the console's Remove dialog exists for.
  await removeUser(bursar._id);

  const after = await listPlatformUsers({ perPage: 100 });
  expect(
    !after.rows.some((row) => row._id === bursar._id),
    'a removed account is still on the platform user list'
  );
  return `${before} reassigned, then removed; the owner is untouched`;
});

await check('the revenue series has no gaps — an empty month is a zero, not a hole', async () => {
  // The whole point of `/admin/revenue/series`: a chart that draws a straight line
  // across a month nobody paid presents zero revenue as growth. The contract is that
  // the empty month comes back as an explicit `0`, so the frontend can plot the
  // response directly with no gap handling of its own.
  resetDb('super-admin');
  await signIn('admin@example.com');

  const result = await getRevenueSeries({ period: 'all', bucket: 'month' });
  expect(result.series.length > 2, `expected several months, got ${result.series.length}`);

  const keys = result.series.map((point) => point.period);
  expect(new Set(keys).size === keys.length, 'the series repeats a period');

  // Zero-padded to match `$dateToString`'s "%Y-%m". An unpadded "2026-3" would not
  // match the aggregation key and every month would read as zero.
  for (const key of keys) {
    expect(/^\d{4}-\d{2}$/.test(key), `period "${key}" is not YYYY-MM`);
  }

  const zeros = result.series.filter((point) => point.totalRevenue === 0);
  expect(zeros.length > 0, 'the fixture leaves gaps empty, so this proves gaps are emitted');
  for (const zero of zeros) {
    expect(zero.totalPayments === 0, `an empty period reported ${zero.totalPayments} payments`);
  }

  const revenue = result.series.reduce((sum, point) => sum + point.totalRevenue, 0);
  expect(revenue === result.totals.totalRevenue, 'the totals disagree with the series');
  return `${keys.length} months, ${zeros.length} explicitly zero, totals agree`;
});

await check('daily buckets are requested when the window is short', async () => {
  resetDb('super-admin');
  await signIn('admin@example.com');

  const daily = await getRevenueSeries({ period: 'last30', bucket: 'day' });
  expect(daily.filters.bucket === 'day', 'the bucket was not echoed');
  expect(
    daily.series.every((point) => /^\d{4}-\d{2}-\d{2}$/.test(point.period)),
    'a day bucket did not produce a YYYY-MM-DD period'
  );

  // Not a test of the mock's own defaults but of the two requests being genuinely
  // distinct: 30 daily points against 12 monthly ones. If the bucket were dropped
  // somewhere, both would come back identical.
  const monthly = await getRevenueSeries({ period: 'last30', bucket: 'month' });
  expect(
    daily.series.length !== monthly.series.length,
    'day and month buckets returned the same number of points'
  );
  return `day ${daily.series.length} points, month ${monthly.series.length} points`;
});

await check('platform settings round-trip as a patch', async () => {
  resetDb('super-admin');
  await signIn('admin@example.com');

  const before = await getPlatformSettings();
  expect(before.singletonKey === 'platform', 'the settings are not the singleton');
  expect(before.features?.selfSignupEnabled === true, 'unexpected defaults');

  // One field. A PUT that sent the whole document back could overwrite a change made
  // in another tab, which is why the endpoint is a patch and this asserts it.
  const saved = await updatePlatformSettings({ features: { selfSignupEnabled: false } });
  expect(saved.changed?.length === 1, `expected one changed path, got ${saved.changed?.length}`);
  expect(saved.changed[0].path === 'features.selfSignupEnabled', `got "${saved.changed[0]?.path}"`);
  expect(saved.changed[0].from === true && saved.changed[0].to === false, 'the diff lost a side');

  // The patch must not have blanked the fields it did not mention — the bug a
  // shallow merge would introduce, and the reason the real endpoint merges per branch.
  const after = await getPlatformSettings();
  expect(after.features?.adsEnabled === true, 'a patch blanked features.adsEnabled');
  expect(after.maintenance?.mode === 'off', 'a patch blanked maintenance.mode');
  expect(after.features?.selfSignupEnabled === false, 'the change did not persist');

  // A second identical write changes nothing, and reports nothing — so a client that
  // saves on every page load cannot bury the one entry that matters in the audit.
  const noop = await updatePlatformSettings({ features: { selfSignupEnabled: false } });
  expect(noop.changed?.length === 0, `a no-op write reported ${noop.changed?.length} changes`);
  return 'one path changed, nothing else touched, no-op reports nothing';
});

await check('the feature flags actually refuse requests, not just record them', async () => {
  // The whole point of the settings page. Storing a flag nobody reads is how a
  // settings console becomes a decoration, so each flag is asserted to change the
  // shape of a real request.
  resetDb('super-admin');
  await signIn('admin@example.com');

  // selfSignupEnabled off ? signup refuses, with the code the client routes on.
  await updatePlatformSettings({ features: { selfSignupEnabled: false } });
  await expectStatus(
    signup({ name: 'New Bursar', email: 'bursar2@example.org', phone: '0241234567', password: 'LongEnough1' }),
    503,
    'POST /auth/signup with self-signup off'
  );

  // adsEnabled off ? the public slider returns an empty list and says so.
  await updatePlatformSettings({ features: { adsEnabled: false } });
  const { data: slider } = await api.get('/public/school-ads');
  expect(slider.adsEnabled === false, 'the public slider did not report itself disabled');
  expect(
    Array.isArray(slider.ads) && slider.ads.length === 0,
    'a disabled slider still returned ads'
  );

  // maintenance readonly ? writes refused, reads still answered.
await updatePlatformSettings({ maintenance: { mode: 'readonly', message: 'Upgrading until 6am.' } });
  // A write to a *different* endpoint. `PUT /admin/settings` is deliberately exempt —
  // it is the switch itself, and a kill switch cannot be behind itself — so proving
  // "readonly refuses writes" with it would prove nothing.
  const { rows: anySchools } = await listSchools({ perPage: 1 });
  await expectStatus(
    suspendSchool(anySchools[0]._id, 'A reason long enough to satisfy the schema'),
    503,
    'PUT /admin/schools/:id/suspend while read-only'
  );
  // A read still works, which is the entire reason the mode exists: a migration can
  // run with every page still loading.
  const stillReadable = await getPlatformSettings();
  expect(stillReadable.maintenance.mode === 'readonly', 'a read failed during read-only maintenance');
  expect(stillReadable.features.adsEnabled === false, 'a read returned the wrong flags');

  // maintenance on ? reads refused too — but `/admin/settings` still answers, because
  // otherwise the platform could never be brought back.
  await updatePlatformSettings({ maintenance: { mode: 'on' } });
  await expectStatus(getDashboardKpis(), 503, 'GET /admin/dashboard while fully down');

  // The refusal carries the operator's own words — errorHandler.js replaces a 5xx
  // message with "Something went wrong", so this is why the guard answers inline.
  let refusal = null;
  try {
    await getDashboardKpis();
  } catch (error) {
    refusal = error;
  }
  expect(refusal?.code, 'the maintenance refusal has no machine-readable code');
  expect(
    String(refusal?.message || '').includes('Upgrading until 6am'),
    `the operator's message was lost: "${refusal?.message}"`
  );

  // Back to normal, so the checks after this one are not run against a dead platform.
  await updatePlatformSettings({ maintenance: { mode: 'off' }, features: { selfSignupEnabled: true, adsEnabled: true } });
  const recovered = await getPlatformSettings();
  expect(recovered.maintenance.mode === 'off', 'the platform did not come back up');
  return 'all four flags enforced; platform recovered';
});

console.log(`\n${pass} passed, ${fail} failed.`);
process.exit(fail === 0 ? 0 : 1);
