/**
 * Realistic Ghanaian seed data for the mock environment.
 *
 * Everything here is generated from a seeded PRNG rather than `Math.random`, so
 * two runs of the mock produce byte-identical rosters. A tester who reports
 * "student 217 has balance 42,500" can be reproduced exactly, which is the
 * whole point of a fixture — a random fixture turns every bug report into an
 * argument about whether the numbers were real.
 */

/** mulberry32 — small, fast, deterministic. */
export const makeRng = (seed = 1337) => {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const pick = (rng, list) => list[Math.floor(rng() * list.length)];

export const intBetween = (rng, min, max) => Math.floor(rng() * (max - min + 1)) + min;

export const MALE_NAMES = [
  'Kwame', 'Kwabena', 'Kofi', 'Kwaku', 'Yaw', 'Emmanuel', 'Samuel', 'Daniel',
  'Michael', 'Isaac', 'Kwesi', 'Nana Kwame', 'Fiifi', 'Selorm', 'Elikem',
  'Kwadwo', 'Yaw Osei', 'Nii Okai', 'Kweku', 'Kojo', 'Nii Armah', 'Yaw Acheampong',
  'Abdul-Rahman', 'Ibrahim', 'Musa', 'Abdul Karim', 'Jonathan', 'Emmanuel Kwesi',
];

export const FEMALE_NAMES = [
  'Ama', 'Akosua', 'Adwoa', 'Abena', 'Yaa', 'Afua', 'Esi', 'Efua', 'Akua',
  'Maame Serwaa', 'Nana Ama', 'Maame Efua', 'Fatima', 'Zainab', 'Adjoa',
  'Naa Dedei', 'Naa Diki', 'Dzifa', 'Elikem', 'Selina', 'Mabel', 'Priscilla',
  'Vivian', 'Gladys', 'Comfort', 'Esther',
];

export const SURNAMES = [
  'Mensah', 'Owusu', 'Boateng', 'Asante', 'Osei', 'Kyei', 'Adjei', 'Tetteh',
  'Lartey', 'Quaye', 'Nartey', 'Ampofo', 'Danso', 'Sarpong', 'Opoku', 'Asamoah',
  'Appiah', 'Baidoo', 'Acheampong', 'Ansah', 'Gyasi', 'Addo', 'Amoah', 'Nyarko',
  'Ahadzi', 'Dogbe', 'Dzidonu', 'Essien', 'Koomson', 'Manso', 'Obeng', 'Sarpong',
];

/** Ghanaian school class naming, per level. */
export const CLASS_SETS = {
  basic: ['Basic 1', 'Basic 2', 'Basic 3', 'Basic 4', 'Basic 5', 'Basic 6'],
  jhs: ['JHS 1', 'JHS 2', 'JHS 3'],
  shs: ['SHS 1', 'SHS 2', 'SHS 3'],
  kg: ['KG 1', 'KG 2', 'Nursery 1', 'Nursery 2'],
};

/** Momo network prefixes — the second digit identifies the network in Ghana. */
const MOMO_PREFIX = { mtn: '024', telecel: '022', airteltigo: '027' };

/**
 * Generates a syntactically valid Ghanaian MSISDN for the given network.
 *
 * A Ghanaian mobile number is **ten** digits: `0`, then the two-digit operator
 * code, then seven subscriber digits. The range below is therefore 1,000,000 to
 * 9,999,999.
 *
 * It was previously eight digits, which produced eleven-digit numbers — and every
 * one of them was rejected by `GHANA_PHONE`, this mock's own MSISDN validator, so
 * the mock seeded a roster whose phone numbers its own validation refused. That
 * was invisible until the SMS module started checking the same field, at which
 * point an entire school of 500 students resolved to zero recipients and the
 * audience picker showed "nobody owes anything" against a roster that owes
 * thousands of cedis. A fixture the validator rejects is a fixture that lies.
 *
 * The `rng` draw count is unchanged, so every seeded balance, class and deadline
 * is byte-identical to before — only the digits in the phone numbers differ.
 */
export const ghanaPhone = (rng, network = 'mtn') =>
  `${MOMO_PREFIX[network] || '024'}${String(intBetween(rng, 1000000, 9999999))}`;

/**
 * A synthetic portrait, as an inline SVG data URI.
 *
 * Deliberately a data URI rather than a fake remote URL: a `res.cloudinary.com`
 * URL that does not resolve exercises `StudentAvatar`'s `onError` fallback and
 * nothing else, so every fixture student would render a monogram and the photo
 * branch would never run in development at all. An inline SVG always renders,
 * needs no network, and keeps the mock self-contained.
 *
 * Roughly 60% of students get one, so the roster shows a realistic mix — some
 * with a photo, some without — which is the only state in which both the photo
 * and the fallback path are visible at once.
 */
const AVATAR_TINTS = [
  ['#d1fae5', '#047857'],
  ['#dbeafe', '#1d4ed8'],
  ['#fee2e2', '#b91c1c'],
  ['#fef3c7', '#b45309'],
  ['#ede9fe', '#6d28d9'],
  ['#ccfbf1', '#0f766e'],
];

export const fixtureAvatar = (rng, gender = 'male') => {
  const [bg, ink] = AVATAR_TINTS[intBetween(rng, 0, AVATAR_TINTS.length - 1)];
  // Hair differs between the two silhouettes so the fixtures do not read as a
  // single repeated stamp.
  const hair =
    gender === 'female'
      ? '<path d="M22 30c0-11 6-18 14-18s14 7 14 18c0 3-1 6-2 8-1-9-5-14-12-14s-11 5-12 14c-1-2-2-5-2-8z" fill="' + ink + '" opacity="0.85"/>'
      : '<path d="M23 28c0-9 5-15 13-15s13 6 13 15v3H23z" fill="' + ink + '" opacity="0.85"/>';

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72">` +
    `<rect width="72" height="72" fill="${bg}"/>` +
    hair +
    `<circle cx="36" cy="32" r="12" fill="${ink}" opacity="0.9"/>` +
    `<path d="M12 72c0-13 11-22 24-22s24 9 24 22z" fill="${ink}" opacity="0.9"/>` +
    `</svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

export const CITY_BY_REGION = {
  'Greater Accra': ['Accra', 'Tema', 'Cantonments', 'Osu', 'Madina', 'Legon'],
  Ashanti: ['Kumasi', 'Asokwa', 'Ejisu'],
  Western: ['Takoradi', 'Tarkwa'],
  Central: ['Cape Coast', 'Winneba'],
  'Western North': ['Sefwi Wiawso', 'Bibiani'],
  'Eastern': ['Koforidua', 'Akuse'],
  Volta: ['Ho', 'Kpetoe', 'Hohoe'],
  'Bono': ['Sunyani', 'Berekum'],
  'Bono East': ['Techiman', 'Kintampo'],
  'Ahafo': ['Goaso', 'Asunafo'],
  'Northern': ['Tamale', 'Yendi'],
  'North East': ['Nalerigu', 'Gambaga'],
  Savannah: ['Damongo', 'Bole'],
  'Upper East': ['Bolgatanga', 'Bawku'],
  'Upper West': ['Wa', 'Tumu'],
  Oti: ['Nkwanta', 'Jasikan'],
};

export const SCHOOL_MOTTOS = [
  'Knowledge, Discipline, Service',
  'Hard Work and Excellence',
  'God and Country',
  'Learning Today, Leading Tomorrow',
  'Education for All',
  'Integrity and Scholarship',
  'The Home of Talents',
];

const ADJECTIVES = [
  'Morning Star', 'Cantonments', 'Greenfield', 'Royal', 'Sacred Heart', 'Modern',
  'Riverside', 'Mercy', 'Oasis', 'Pioneer', 'Unity', 'Heritage', 'Bright Star',
  'New Horizon', 'Victory', 'Crown', 'Golden', 'Silverbird', 'Providence',
];

const SCHOOL_SUFFIX = ['School', 'Preparatory School', 'Academy', 'College', 'Basic School', 'Senior High School'];

/** Deterministic school name, e.g. "Morning Star Preparatory School". */
export const schoolName = (rng) => `${pick(rng, ADJECTIVES)} ${pick(rng, SCHOOL_SUFFIX)}`;

const SLUG_SAFE = /[^a-z0-9]+/g;
export const slugify = (value) =>
  String(value)
    .toLowerCase()
    .replace(SLUG_SAFE, '-')
    .replace(/^-|-$/g, '');

/**
 * A 24-char hex id standing in for a Mongo ObjectId. Must match the backend's
 * `^[0-9a-fA-F]{24}$` param validation, or every mocked route would 422 in a
 * way the real API would not — which would quietly invalidate the whole
 * exercise.
 */
export const objectId = (n) => {
  let id = '';
  for (let i = 0; i < 24; i += 1) {
    id += '0123456789abcdef'[intBetween(makeRng(n * 31 + i * 7), 0, 15)];
  }
  return id;
};

/** Short alphanumeric token, e.g. a pay-link token or a verification code. */
export const token = (rng, length = 8) => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no look-alike chars
  return Array.from({ length }, () => pick(rng, alphabet.split(''))).join('');
};

/**
 * Builds `count` students for a school.
 *
 * Deliberately includes the shapes a real roster has, because these are the
 * cases that break import code:
 *   - ~12% fully paid (balance 0, so Step 4's "all owing" count excludes them)
 *   - ~8% with a second parent
 *   - a few with long names and non-ASCII characters
 *   - one student with no email on the parent record
 */
export const buildStudents = (schoolId, count, { seed = 7, classes, academicYear } = {}) => {
  const rng = makeRng(seed);
  const out = [];
  const classList = classes || CLASS_SETS.jhs;

  for (let i = 0; i < count; i += 1) {
    const gender = rng() > 0.5 ? 'male' : 'female';
    const firstName = pick(rng, gender === 'male' ? MALE_NAMES : FEMALE_NAMES);
    const lastName = pick(rng, SURNAMES);
    const totalOwed = intBetween(rng, 8000, 250000); // GHS 80.00 – 2,500.00
    const roll = rng();

    // Fully paid students exercise the "balance > 0" filter on Step 4.
    const totalPaid = roll < 0.12 ? totalOwed : roll < 0.45 ? intBetween(rng, 0, totalOwed) : 0;
    const network = pick(rng, ['mtn', 'telecel', 'airteltigo']);

    const parents = [
      {
        parentName: `${pick(rng, gender === 'male' ? MALE_NAMES : FEMALE_NAMES)} ${lastName}`,
        relationship: pick(rng, ['father', 'mother', 'guardian', 'uncle', 'aunt']),
        phone: ghanaPhone(rng, network),
        // ~5% of parents have no email on file — a null here must not crash
        // the roster list or the SMS preview.
        email: rng() < 0.05 ? null : `${slugify(firstName)}.${slugify(lastName)}@example.com`,
        isPrimary: true,
        isAlive: true,
      },
    ];

    if (rng() < 0.08) {
      parents.push({
        parentName: `${pick(rng, MALE_NAMES)} ${lastName}`,
        relationship: pick(rng, ['father', 'uncle']),
        phone: ghanaPhone(rng, network),
        email: null,
        isPrimary: false,
        isAlive: true,
      });
    }

    const id = objectId(seed * 1000 + i);
    out.push({
      _id: id,
      studentId: `SK-${String(1000 + i).padStart(4, '0')}`,
      studentName: `${firstName} ${lastName}`,
      studentClass: pick(rng, classList),
      gender,
      studentImage: rng() < 0.6 ? fixtureAvatar(rng, gender) : null,
      schoolId,
      status: 'active',
      totalOwed,
      totalPaid,
      balance: totalOwed - totalPaid,
      deadline: new Date(Date.now() + intBetween(rng, -10, 90) * 86400000).toISOString(),
      academicYear,
      parents,
      emergencyContacts: [],
      uniquePayLinkToken: token(rng, 7),
      payLink: `https://sukuupay.com/pay/${token(rng, 7)}`,
      term: pick(rng, ['Term 1', 'Term 2', 'Term 3']),
      isAlumni: false,
      createdAt: new Date().toISOString(),
    });
  }

  return out;
};

/**
 * Graduating cohorts, for the Cohorts and Alumni tabs.
 *
 * `buildStudents` produces only active students, so without this the Cohorts tab
 * has nothing to show in `npm run dev:mock` and reads as a broken feature even
 * though it works against a seeded database. Mirrors the seeded shape: a cohort
 * is everyone with a `graduationYear`, and what became of them is split across
 * graduated / transferred_out / removed so the cohort detail's four counters are
 * all real numbers rather than three permanent zeroes.
 *
 * A leaver carries `graduationYear` without `isAlumni` — they were in the
 * graduating year but did not complete it. That is the same semantic the service
 * uses, and the alumni list (which requires `isAlumni`) correctly excludes them.
 */
export const buildAlumni = (
  schoolId,
  { seed = 31, classes, academicYear } = {}
) => {
  const rng = makeRng(seed);
  const classList = classes || CLASS_SETS.jhs;
  const year = Number(String(academicYear || '2025/2026').slice(0, 4));
  const out = [];

  // Most recent first, as the cohort list sorts.
  [0, 1, 2].forEach((back) => {
    const gradYear = year - back;
    const size = 26 - back * 4;

    for (let i = 0; i < size; i += 1) {
      const gender = rng() > 0.5 ? 'male' : 'female';
      const firstName = pick(rng, gender === 'male' ? MALE_NAMES : FEMALE_NAMES);
      const lastName = pick(rng, SURNAMES);
      const totalOwed = intBetween(rng, 8000, 120000);
      const roll = rng();
      const outcome = roll < 0.85 ? 'graduated' : roll < 0.95 ? 'transferred_out' : 'removed';

      const honorsRoll = rng();
      const honors =
        honorsRoll < 0.7 ? 'NONE' : honorsRoll < 0.85 ? 'HONORS' : honorsRoll < 0.95 ? 'HIGH_HONORS' : 'HIGHEST_HONORS';

      // Graduations happen in the last week of July, not "now".
      const graduationDate = new Date(gradYear, 6, 20 + Math.floor(rng() * 11)).toISOString();

      const record = {
        _id: objectId(seed * 1000 + back * 100 + i),
        studentId: `SK-${gradYear}-${String(1000 + i).padStart(4, '0')}`,
        studentName: `${firstName} ${lastName}`,
        studentClass: classList[classList.length - 1] || 'JHS 3',
        gender,
        studentImage: null,
        schoolId,
        status: outcome,
        totalOwed,
        // Most graduates settled in full; a few left a balance, which is what
        // makes the alumni table's "outstanding at exit" column worth reading.
        totalPaid: rng() < 0.8 ? totalOwed : intBetween(rng, 0, totalOwed),
        balance: 0, // set below, once totalPaid is known
        deadline: new Date(gradYear, 2, 31).toISOString(),
        academicYear: `${gradYear - 1}/${gradYear}`,
        parents: [
          {
            parentName: `${pick(rng, FEMALE_NAMES)} ${lastName}`,
            relationship: 'mother',
            phone: ghanaPhone(rng),
            email: `${slugify(firstName)}.${slugify(lastName)}@example.com`,
            isPrimary: true,
            isAlive: true,
          },
        ],
        emergencyContacts: [],
        uniquePayLinkToken: token(rng, 7),
        payLink: `https://sukuupay.com/pay/${token(rng, 7)}`,
        term: 'Term 3',
        isAlumni: outcome === 'graduated',
        graduationYear: String(gradYear),
        graduationDate: outcome === 'graduated' ? graduationDate : null,
        graduationType: 'STANDARD',
        certificateNumber:
          outcome === 'graduated' ? `CERT-${gradYear}-${String(1000 + i).padStart(6, '0')}` : null,
        honors: outcome === 'graduated' ? honors : 'NONE',
        transferOutDate: outcome === 'transferred_out' ? graduationDate : null,
        transferOutReason: outcome === 'transferred_out' ? 'Relocation' : null,
        createdAt: new Date(gradYear - 5, 8, 5).toISOString(),
      };

      record.balance = record.totalOwed - record.totalPaid;
      out.push(record);
    }
  });

  return out;
};

/**
 * Installment plans, derived from the students they belong to.
 *
 * **Derived, not authored, and that is the whole point.** A plan's money is its
 * student's `balance`, its class filter is the student's class, and its
 * search-by-parent is the student's parent. If the mock authored plans as their
 * own list, the compliance dashboard would show "Total Active Plans 176 ·
 * GH₵ 148,200 committed" beside a roster of 500 students whose balances sum to
 * something else entirely — and every figure on the screen would be a
 * coincidence. Generating from the roster makes the two agree by construction, so
 * a tester can check the dashboard's arithmetic against the Students tab.
 *
 * The status mix is chosen to exercise every branch of the service's classifier:
 * most families current, a tranche due within the 3-day "approaching" window, a
 * tranche already slipped, a couple still awaiting the parent's ACCEPT, and one
 * completed plan. A fixture with only on-track plans renders a bar that is all
 * one colour and tests nothing.
 *
 * `createdAt` is spread backwards through the term so the compliance list's
 * default `sortBy: endDate` has something to order.
 */
export const buildPaymentPlans = (
  schoolId,
  students,
  { seed = 17, term = 'Term 2', academicYear } = {}
) => {
  const rng = makeRng(seed);
  const out = [];

  const owing = students.filter((s) => (s.balance || 0) > 0 && s.status === 'active');
  const now = Date.now();

  owing.forEach((student, index) => {
    // Roughly half the families who owe have agreed to a schedule. Every one
    // would, in a real school, so the remainder stands in for the families a
    // bursar has not got to — and it means the dashboard's "active plans" count
    // is genuinely a subset of the owing list rather than a copy of it.
    if (rng() > 0.55) return;

    const count = pick(rng, [2, 3, 3, 4, 6]);
    const total = student.balance;

    // `base` with the remainder on the last tranche: a byte-for-byte mirror of
    // `splitAmount` in `Backend/src/utils/planHelpers.js`, and the create screen's
    // projection must agree with it to the pesewa.
    const base = Math.floor(total / count);
    const amounts = Array.from({ length: count }, () => base);
    amounts[count - 1] = total - base * (count - 1);

    const roll = rng();
    const shape =
      roll < 0.81 ? 'on_track' : roll < 0.94 ? 'approaching' : roll < 0.98 ? 'overdue' : 'awaiting';

    // Where the first tranche falls decides the shape. `on_track` starts far
    // enough out that nothing is near due; `approaching` starts inside the
    // 3-day window; `overdue` starts far enough back that the first tranche has
    // already slipped.
    const firstDueOffsetDays =
      shape === 'on_track'
        ? intBetween(rng, 20, 75)
        : shape === 'approaching'
          ? intBetween(rng, 0, 2)
          : shape === 'overdue'
            ? -intBetween(rng, 3, 40)
            : intBetween(rng, 10, 40);

    const stepDays = pick(rng, [7, 14, 30, 30]);
    const planStatus = shape === 'awaiting' ? 'pending_acceptance' : 'active';

    // How many leading tranches have been paid. Zero for overdue (a family in
    // default has not paid the one that slipped) and 1+ otherwise, so the
    // progress bar has a spread to render.
    const paidCount =
      shape === 'on_track' ? intBetween(rng, 0, Math.max(0, count - 1)) : shape === 'overdue' ? 0 : 0;

    let cumulative = 0;
    const installments = amounts.map((amount, trancheIndex) => {
      cumulative += amount;
      const due = new Date(now + (firstDueOffsetDays + trancheIndex * stepDays) * 86400000);
      const isPaid = trancheIndex < paidCount;
      const hasSlipped = !isPaid && due.getTime() < now;

      return {
        installmentNumber: trancheIndex + 1,
        amount,
        dueDate: due.toISOString(),
        status: isPaid ? 'paid' : hasSlipped ? 'overdue' : 'pending',
        amountPaid: isPaid ? amount : 0,
        paidAt: isPaid ? due.toISOString() : null,
        paymentIds: [],
        reminderSentAt: null,
        overdueNotifiedAt: hasSlipped ? due.toISOString() : null,
        notes: '',
      };
    });

    const installmentsPaid = installments.filter((i) => i.status === 'paid').length;
    const totalPaid = installments.reduce((sum, i) => sum + i.amountPaid, 0);

    out.push({
      _id: objectId(seed * 1000 + index),
      studentId: student._id,
      schoolId,
      planName: `${count}-Month Plan`,
      totalAmount: total,
      numberOfInstallments: count,
      interval: stepDays === 7 ? 'weekly' : stepDays === 14 ? 'biweekly' : 'monthly',
      installments,
      planStatus,
      acceptanceToken: 'ACCEPT',
      startDate: installments[0].dueDate,
      endDate: installments[installments.length - 1].dueDate,
      adminNotes: '',
      term,
      academicYear: academicYear || '',
      installmentsPaid,
      installmentsRemaining: installments.length - installmentsPaid,
      amountPaid: totalPaid,
      totalRemaining: total - totalPaid,
      progressPercent: Math.round((installmentsPaid / count) * 100),
      lastOverdueCheckAt: new Date().toISOString(),
      acceptedAt: planStatus === 'active' ? new Date(now - 30 * 86400000).toISOString() : null,
      acceptedVia: planStatus === 'active' ? 'sms' : null,
      cancelledAt: null,
      cancelledBy: null,
      cancellationReason: '',
      deletedAt: null,
      createdAt: new Date(now - intBetween(rng, 5, 70) * 86400000).toISOString(),
      updatedAt: new Date(now - intBetween(rng, 0, 5) * 86400000).toISOString(),
    });
  });

  return out;
};

/** The header row the backend's bulk importer expects. */
export const IMPORT_HEADERS = [
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

const csvEscape = (value) => {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const toCsv = (rows, headers = IMPORT_HEADERS) =>
  [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(',')),
  ].join('\n');

/**
 * Roster fixtures the control panel can download.
 *
 * `rows: null` means "generate this many clean rows"; a number means "generate
 * this many rows but corrupt every Nth one", which is how the partial-failure
 * path on Step 3 gets exercised without hand-editing a spreadsheet.
 */
export const IMPORT_FIXTURES = [
  {
    id: 'clean-3',
    label: 'Clean — 3 students',
    description: 'Everything valid. Use this to confirm the happy path imports 3/3.',
    build: () =>
      toCsv([
        {
          'Student Name': 'Ama Serwaa Mensah', 'Student Class': 'JHS 2', Gender: 'female',
          'Date Of Birth': '2013-04-17', 'Parent Name': 'Mr. Kojo Mensah', 'Parent Phone': '0241234567',
          'Parent Email': 'mensah@example.com', 'Parent Relationship': 'father', 'Total Owed': '1200',
          Deadline: '2026-12-15',
        },
        {
          'Student Name': 'Kwabena Nyarko', 'Student Class': 'JHS 1', Gender: 'male',
          'Date Of Birth': '2015-09-02', 'Parent Name': 'Mrs. Efua Nyarko', 'Parent Phone': '0551234567',
          'Parent Email': 'nyarko@example.com', 'Parent Relationship': 'mother', 'Total Owed': '950.50',
          Deadline: '2026-12-15',
        },
        {
          'Student Name': 'Adwoa Frimpong', 'Student Class': 'JHS 3', Gender: 'female',
          'Date Of Birth': '2011-01-30', 'Parent Name': 'Dr. Kofi Frimpong', 'Parent Phone': '0201234567',
          'Parent Email': '', 'Parent Relationship': 'guardian', 'Total Owed': '1450',
          Deadline: '2026-12-15',
        },
      ]),
  },
  {
    id: 'suffixed-class',
    label: 'Realistic but unconfigured class — 5 rows',
    description:
      'Well-formed rows labelled "JHS 2A". Ghanaian schools really do use suffixed class names, but the API matches the class against school.academic.classes exactly, so every row is rejected until the school configures "JHS 2A". This is a genuine product trap.',
    build: () =>
      toCsv(
        Array.from({ length: 5 }, (_, i) => ({
          'Student Name': `Kwame Agyeman ${i + 1}`,
          'Student Class': 'JHS 2A',
          Gender: 'male',
          'Parent Name': 'Akosua Agyeman',
          'Parent Phone': '0241234567',
          'Total Owed': '1000',
          Deadline: '2026-12-15',
        }))
      ),
  },
  {
    id: 'partial-50',
    label: 'Partial failure — 50 rows, every 5th broken',
    description: '40 should import, 10 should be rejected. Verifies the error list and counts.',
    build: () => toCsv(buildImportRows(50, 5, 202)),
  },
  {
    id: 'mixed-header-case',
    label: 'Messy headers + spacing',
    description: 'Lower-case headers, extra whitespace, and quoted fields containing commas. Verifies header normalisation.',
    build: () =>
      toCsv(
        [
          {
            studentname: '  Kofi  Osei  ', studentclass: 'JHS 2', gender: 'MALE',
            parentname: 'Akosua, Ama', parentphone: ' 024 555 0101 ', totalowed: '1100',
            deadline: '2026-12-15',
          },
          {
            studentname: 'Nii Okai Lartey', studentclass: 'JHS 2', gender: 'male',
            parentname: 'Nii Tei Lartey', parentphone: '0223334444', totalowed: '890',
            deadline: '2026-12-15',
          },
        ],
        ['studentname', 'studentclass', 'gender', 'parentname', 'parentphone', 'totalowed', 'deadline']
      ),
  },
  {
    id: 'bad-phones',
    label: 'Invalid Ghana numbers — 10 rows',
    description: 'US and UK numbers. Should every row be rejected by both the client preview and the server.',
    build: () =>
      toCsv(
        Array.from({ length: 10 }, (_, i) => ({
          'Student Name': `Test Student ${i + 1}`,
          'Student Class': 'JHS 1',
          Gender: i % 2 ? 'male' : 'female',
          'Parent Name': `Parent ${i + 1}`,
          'Parent Phone': i % 2 ? '+1 415 555 0100' : '07700 900123',
          'Total Owed': '500',
          Deadline: '2026-12-15',
        }))
      ),
  },
  {
    id: 'unknown-class',
    label: 'Class not on the school — 5 rows',
    description: 'Perfectly well-formed rows whose class is not configured on the school. The server rejects these specifically.',
    build: () =>
      toCsv(
        Array.from({ length: 5 }, (_, i) => ({
          'Student Name': `Kwame Agyeman ${i + 1}`,
          'Student Class': 'Form 4B',
          Gender: 'male',
          'Parent Name': 'Akosua Agyeman',
          'Parent Phone': '0241234567',
          'Total Owed': '1000',
          Deadline: '2026-12-15',
        }))
      ),
  },
  {
    id: 'large-500',
    label: 'Large roster — 500 rows',
    description: 'The upper realistic case. Check preview performance and the import result summary.',
    build: () => toCsv(buildImportRows(500, 23, 909)),
  },
  {
    id: 'over-limit-5200',
    label: 'Over the limit — 5,200 rows',
    description: 'Exceeds the 5,000 ceiling. Should warn, then import at most 5,000.',
    build: () => toCsv(buildImportRows(5200, 0, 313)),
  },
  {
    id: 'empty',
    label: 'Headers only (0 rows)',
    description: 'A file the bursar saved before entering data. Must fail gracefully, not crash.',
    build: () => `${IMPORT_HEADERS.join(',')}\n`,
  },
  {
    id: 'not-a-csv',
    label: 'Wrong file type (.txt)',
    description: 'Rejected on file selection. Verifies the accept/type guard before any parsing.',
    build: () => 'This is a plain text file, not a roster.\nIt should never be parsed.\n',
  },
];

function buildImportRows(count, corruptEvery, seed) {
  const rng = makeRng(seed);
  const deadline = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
  return Array.from({ length: count }, (_, i) => {
    const gender = rng() > 0.5 ? 'male' : 'female';
    const first = pick(rng, gender === 'male' ? MALE_NAMES : FEMALE_NAMES);
    const last = pick(rng, SURNAMES);
    const row = {
      'Student Name': `${first} ${last}`,
      'Student Class': pick(rng, CLASS_SETS.jhs),
      Gender: gender,
      'Date Of Birth': `${intBetween(rng, 2008, 2016)}-${String(intBetween(rng, 1, 12)).padStart(2, '0')}-${String(intBetween(rng, 1, 28)).padStart(2, '0')}`,
      'Parent Name': `${pick(rng, MALE_NAMES)} ${last}`,
      'Parent Phone': ghanaPhone(rng),
      'Parent Email': `${slugify(first)}.${slugify(last)}@example.com`,
      'Parent Relationship': pick(rng, ['father', 'mother', 'guardian']),
      'Total Owed': (intBetween(rng, 10000, 200000) / 100).toFixed(2),
      Deadline: deadline,
    };

    // Corrupt a spread of rows, one failure mode at a time, so the rejected
    // list shows a variety of reasons rather than the same one repeated.
    if (corruptEvery && i % corruptEvery === 0) {
      const mode = (i / corruptEvery) % 5;
      if (mode === 0) row['Parent Name'] = '';
      if (mode === 1) row['Parent Phone'] = '+44 20 7946 0958';
      if (mode === 2) row['Student Name'] = '';
      if (mode === 3) row['Student Class'] = 'Form 9Z';
      if (mode === 4) row.Gender = 'unknown';
    }
    return row;
  });
}
