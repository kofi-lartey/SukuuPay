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

/** Generates a syntactically valid Ghanaian MSISDN for the given network. */
export const ghanaPhone = (rng, network = 'mtn') =>
  `${MOMO_PREFIX[network] || '024'}${String(intBetween(rng, 10000000, 99999999))}`;

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
      studentImage: null,
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
