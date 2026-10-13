/**
 * Fixtures for the parent portal's new surfaces.
 *
 * ## Why fixtures exist here and not only in `mocks/`
 *
 * `mocks/` fakes the *existing* API for the school-facing app. The parent portal's
 * new surfaces — attendance, report cards, timetable, message threads, the
 * notification centre — have **no endpoints yet**, so there is nothing for an
 * adapter to intercept. These modules are the data those pages read today, shaped
 * exactly like the responses `services/parentPortal.js` will fetch when the
 * backend catches up: same field names, same envelopes, same pesewas.
 *
 * ## The anchor date
 *
 * Everything is anchored to `DEMO_TODAY` — the date the approved design mock was
 * drawn around — rather than to `new Date()`. Two reasons: a relative label like
 * "2d ago" must stay true to the fixture it belongs to (computed against the real
 * clock it drifts within a day), and the calendar mock colors days the Gregorian
 * calendar would not. When the roll-call service lands, all of this becomes the
 * server's truth and the anchor disappears.
 */

export const DEMO_TODAY = new Date('2026-10-07T08:15:00Z');

/** The ward the whole demo is about, matching the design mock. */
export const DEMO_STUDENT = {
  studentId: 'STU-8F3K9D2L',
  studentName: 'Kwame Mensah',
  studentClass: 'JHS 2A',
  academicYear: '2026/2027',
};

export const DEMO_SCHOOL = {
  name: 'Achimota Basic School',
  shortName: 'Achimota Basic',
  phone: '0302 402 1234',
  address: 'Achimota, Accra',
};

/** The term the mock is drawn in. Terms mirror the academic year below. */
export const DEMO_TERMS = [
  { id: 't1', label: 'Term 1', hasResults: true },
  { id: 't2', label: 'Term 2', hasResults: true, current: true },
  { id: 't3', label: 'Term 3', hasResults: false },
];

export const DEMO_CURRENT_TERM_ID = 't2';
