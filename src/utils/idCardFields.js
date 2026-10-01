/**
 * The student ID card's data contract.
 *
 * A card is a printed artefact: once it is on a child's uniform, a field that
 * was wrong on the day of printing stays wrong on the card until every card is
 * reprinted. So the set of fields a card needs is not a UI preference — it is a
 * checklist that has to be answerable *before* the print run, per student.
 *
 * This module is that checklist as data, rather than prose in a document, for
 * three reasons:
 *
 * 1. **It is executable.** `cardReadiness(student, school)` returns which fields
 *    are satisfied and which are missing, so a print studio can refuse a card
 *    with a missing mandatory field instead of printing "Date of birth: " onto
 *    a child's ID. A prose spec cannot do that.
 * 2. **It cannot drift from the renderer.** Every entry names the exact path
 *    the value is read from, so the template, the readiness check and the field
 *    list are reading the same source of truth.
 * 3. **It records what is missing.** `available` is `false` for fields the data
 *    model does not have at all. Those are the gaps, and they are listed here
 *    rather than quietly omitted — an ID card design that implies a magnetic
 *    stripe and a card expiry date is making a promise the schema cannot keep.
 *
 * `source` distinguishes where a value comes from, because it decides who owns
 * fixing it: a `student` field is the bursar's, a `school` field is the
 * headmaster's, and a `derived` field is computed at print time.
 */

/** @typedef {'student'|'school'|'derived'} FieldSource */

export const CARD_SURFACES = {
  /** CR80 / ID-1, 85.60 × 53.98 mm, both faces. */
  STANDARD: 'CR80',
  /** 30 mil solid PVC, magnetic stripe and barcode. */
  PVC: 'PVC',
};

/** ISO/IEC 7810 ID-1 finished geometry, in millimetres. */
export const CARD_GEOMETRY = {
  widthMm: 85.6,
  heightMm: 53.98,
  cornerRadiusMm: 3.18,
  /** 30 mil ≈ 0.762 mm; the bleed allowance the print spec assumes. */
  bleedMm: 3.175,
  safeMarginMm: 3.0,
  printDpi: 300,
};

/**
 * Sections of the card, in physical reading order.
 *
 * `face: 'both'` is for content that spans the card — the magnetic stripe and
 * the chip sit across the reverse, and a printer laying out front-only artwork
 * against them produces an unreadable stripe.
 */
export const CARD_SECTIONS = [
  { key: 'header', label: 'Issuing institution', face: 'front' },
  { key: 'identity', label: 'Student identity', face: 'front' },
  { key: 'academic', label: 'Academic record', face: 'front' },
  { key: 'contact', label: 'Guardian & emergency contact', face: 'front' },
  { key: 'payment', label: 'Payment access', face: 'front' },
  { key: 'security', label: 'Security & machine-readable', face: 'both' },
  { key: 'terms', label: 'Terms, issuer & signature', face: 'back' },
];

/**
 * The fields themselves.
 *
 * `required` is `print` when a card is wrong without it (a card with no name on
 * it is not a card), `recommended` when it should block a batch but not a single
 * reprint, and `optional` when absence is legitimate. `available: false` marks
 * a field the data model cannot supply today — `path` is the path it *would*
 * have, so the gap is specific rather than vague.
 */
export const CARD_FIELDS = [
  // ── Issuing institution ────────────────────────────────────────────────
  { section: 'header', key: 'schoolName', label: 'School name', path: 'school.name', source: 'school', required: 'print' },
  { section: 'header', key: 'schoolLogo', label: 'School logo', path: 'school.logo', source: 'school', required: 'recommended' },
  { section: 'header', key: 'schoolMotto', label: 'School motto', path: 'school.motto', source: 'school', required: 'optional' },
  { section: 'header', key: 'schoolAddress', label: 'School address', path: 'school.address', source: 'school', required: 'optional' },
  { section: 'header', key: 'schoolCode', label: 'GES / school code', path: 'school.schoolCode', source: 'school', required: 'print' },
  { section: 'header', key: 'cardSerial', label: 'Card serial number', path: 'derived: studentId + issue sequence', source: 'derived', required: 'print', available: false },

  // ── Student identity ───────────────────────────────────────────────────
  { section: 'identity', key: 'studentImage', label: 'Student photograph', path: 'student.studentImage', source: 'student', required: 'print' },
  { section: 'identity', key: 'studentName', label: 'Full student name', path: 'student.studentName', source: 'student', required: 'print' },
  { section: 'identity', key: 'studentId', label: 'Student ID', path: 'student.studentId', source: 'student', required: 'print' },
  { section: 'identity', key: 'emisId', label: 'EMIS identification number', path: 'student.emisId', source: 'student', required: 'recommended', available: false },
  { section: 'identity', key: 'dateOfBirth', label: 'Date of birth', path: 'student.dateOfBirth', source: 'student', required: 'recommended' },
  { section: 'identity', key: 'gender', label: 'Gender', path: 'student.gender', source: 'student', required: 'optional' },
  { section: 'identity', key: 'nationality', label: 'Nationality', path: 'student.nationality', source: 'student', required: 'optional', available: false },

  // ── Academic record ────────────────────────────────────────────────────
  { section: 'academic', key: 'studentClass', label: 'Class / stream', path: 'student.studentClass', source: 'student', required: 'print' },
  { section: 'academic', key: 'academicYear', label: 'Academic cycle', path: 'student.academicYear', source: 'student', required: 'recommended' },
  { section: 'academic', key: 'house', label: 'House', path: 'student.house', source: 'student', required: 'optional', available: false },
  { section: 'academic', key: 'admissionDate', label: 'Date of admission', path: 'student.admissionDate', source: 'student', required: 'optional', available: false },
  { section: 'academic', key: 'bloodGroup', label: 'Blood group', path: 'student.bloodGroup', source: 'student', required: 'optional', available: false },

  // ── Guardian & emergency contact ───────────────────────────────────────
  { section: 'contact', key: 'guardianName', label: 'Primary guardian', path: 'student.parents[isPrimary].parentName', source: 'student', required: 'print' },
  { section: 'contact', key: 'guardianPhone', label: 'Guardian telephone', path: 'student.parents[isPrimary].phone', source: 'student', required: 'print' },
  { section: 'contact', key: 'emergencyContact', label: 'Emergency contact', path: 'student.emergencyContacts[0]', source: 'student', required: 'recommended' },
  { section: 'contact', key: 'guardianEmail', label: 'Guardian email', path: 'student.parents[isPrimary].email', source: 'student', required: 'optional' },

  // ── Payment access ─────────────────────────────────────────────────────
  { section: 'payment', key: 'payLink', label: 'Fee payment link', path: 'student.payLink', source: 'student', required: 'recommended' },
  { section: 'payment', key: 'qrCode', label: 'MoMo / card pay QR', path: 'derived: QR of student.payLink', source: 'derived', required: 'recommended' },
  { section: 'payment', key: 'feeBalance', label: 'Fee balance', path: 'student.balance', source: 'student', required: 'optional' },

  // ── Security & machine-readable ────────────────────────────────────────
  { section: 'security', key: 'magneticTrack', label: 'ISO/IEC 7810 Track 1/2', path: 'derived: SukuuPay card token', source: 'derived', required: 'optional', available: false },
  { section: 'security', key: 'barcode', label: 'Barcode of student ID', path: 'derived: Code 128 of student.studentId', source: 'derived', required: 'recommended' },
  { section: 'security', key: 'hologram', label: 'Holographic DOVID', path: 'derived: printer-side security mark', source: 'derived', required: 'optional', available: false },
  { section: 'security', key: 'signature', label: 'Bearer signature strip', path: 'derived: guardian signature', source: 'derived', required: 'optional', available: false },
  { section: 'security', key: 'validFrom', label: 'Valid from', path: 'derived: issue date', source: 'derived', required: 'recommended', available: false },
  { section: 'security', key: 'validUntil', label: 'Expires', path: 'derived: issue date + academic cycle', source: 'derived', required: 'print', available: false },

  // ── Terms, issuer & signature ──────────────────────────────────────────
  { section: 'terms', key: 'issuerSignature', label: 'Authorised signature', path: 'school.stamp', source: 'school', required: 'optional' },
  { section: 'terms', key: 'termsText', label: 'Institutional terms', path: 'derived: school-owned copy', source: 'derived', required: 'print' },
];

/** Fields the model cannot supply. Surfaced rather than hidden. */
export const UNAVAILABLE_FIELDS = CARD_FIELDS.filter((f) => f.available === false);

/** Read a dotted path off an object. */
const read = (source, path) =>
  path.split('.').reduce((value, key) => (value == null ? undefined : value[key]), source);

/**
 * The path relative to its own source object.
 *
 * `field.path` is written fully qualified (`school.name`) because that is the
 * useful thing to read when you are looking at a field and asking where on the
 * record it comes from. But `resolveCardFields` already knows which of the two
 * objects a field belongs to, so the leading segment has to come off before the
 * lookup or every field resolves to `undefined` and every card prints blank.
 */
const relativePath = (field) => field.path.replace(/^(school|student)\./, '');

/**
 * The primary guardian, which is an array search rather than a path.
 *
 * Separated because `parents` is excluded from the roster projection — a card
 * built from a roster row would silently print an empty guardian block, so the
 * print path must use a record that actually carries `parents`.
 */
const primaryGuardian = (student) =>
  (student?.parents || []).find((parent) => parent.isPrimary) ||
  (student?.parents || [])[0] ||
  null;

/**
 * Every field's value for one student, or `null` where it is absent.
 *
 * `derived` paths are resolved by the caller and passed through, because a QR
 * code and a barcode are produced at print time rather than stored.
 */
export const resolveCardFields = (student = {}, school = {}, derived = {}) => {
  const guardian = primaryGuardian(student);
  const resolved = {};

  CARD_FIELDS.forEach((field) => {
    if (field.source === 'derived') {
      resolved[field.key] = derived[field.key] ?? null;
      return;
    }

    if (field.key === 'guardianName') return void (resolved[field.key] = guardian?.parentName || null);
    if (field.key === 'guardianPhone') return void (resolved[field.key] = guardian?.phone || null);
    if (field.key === 'guardianEmail') return void (resolved[field.key] = guardian?.email || null);
    if (field.key === 'emergencyContact') {
      const contact = (student.emergencyContacts || [])[0];
      return void (resolved[field.key] = contact
        ? `${contact.contactName} (${contact.phone})`
        : null);
    }

    resolved[field.key] =
      read(field.source === 'school' ? school : student, relativePath(field)) ?? null;
  });

  return resolved;
};

/**
 * Which fields are ready, which are missing, and whether this student can be
 * printed at all.
 *
 * `blocking` is the set that makes the card *wrong* rather than incomplete —
 * name, ID, class, guardian and expiry. `canPrint` is false only on those, so
 * a student missing a logo still gets a card; that is a design decision for
 * whoever commissions them, and refusing would strand every student in a school
 * that never uploaded a logo.
 */
export const cardReadiness = (student = {}, school = {}, derived = {}) => {
  const values = resolveCardFields(student, school, derived);

  const missing = CARD_FIELDS.filter(
    (field) => field.available !== false && isBlank(values[field.key])
  ).map((field) => field);

  const unavailable = UNAVAILABLE_FIELDS.map((field) => field);

  const blocking = missing.filter((field) => field.required === 'print');
  const recommended = missing.filter((field) => field.required === 'recommended');

  return {
    values,
    missing,
    unavailable,
    blocking,
    recommended,
    canPrint: blocking.length === 0,
    /** 0–1 over the fields the model can actually supply. */
    completeness:
      CARD_FIELDS.length === 0
        ? 0
        : (CARD_FIELDS.length - unavailable.length - missing.length) /
          (CARD_FIELDS.length - unavailable.length),
  };
};

/**
 * A field is missing when it has no value at all.
 *
 * `0` is a real value and deliberately not blank: a zero fee balance means the
 * student has paid in full, which is the opposite of missing, and treating it
 * as absent would put every settled student on the "incomplete" list.
 */
const isBlank = (value) => value === null || value === undefined || value === '';

/** The fields for one section, for rendering a card face section by section. */
export const fieldsForSection = (sectionKey) =>
  CARD_FIELDS.filter((field) => field.section === sectionKey);
