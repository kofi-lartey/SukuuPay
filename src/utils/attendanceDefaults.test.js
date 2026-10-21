import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  defaultTermForSchool,
  monthKeyOf,
  currentMonthKey,
  resolveExpandedMonth,
  toggleExpandedMonth,
} from './attendanceDefaults.js';

/**
 * What the attendance screens open on.
 *
 * The bug this pins: the parent portal's attendance page asked for "Term 1" in
 * the query string whatever term the school was in, so for a school in Term 2
 * every mark the teachers had made fell outside the window the page read — the
 * calendar rendered, the rate read 0%, the recent-activity list was empty, and
 * nothing anywhere said the data was missing. The page was looking for the
 * marks in the wrong term.
 *
 * The second half of the same bug: the page opened the *newest* month of the
 * term, which is the far end of it — a month of days that have not happened
 * yet — with the month that actually holds the marks collapsed underneath.
 */

/** The source with its comments stripped, so a comment cannot satisfy an assertion. */
const codeOnly = (source) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/(^|[^:])\/\/.*$/, '$1'))
    .join('\n');

const readSource = async (relative) =>
  codeOnly(await readFile(new URL(relative, import.meta.url), 'utf8'));

describe('defaultTermForSchool — the page opens on the school’s term', () => {
  it('uses the school’s active term', () => {
    assert.equal(defaultTermForSchool({ academic: { currentTerm: 'Term 2' } }), 'Term 2');
    assert.equal(defaultTermForSchool({ academic: { currentTerm: 'Term 3' } }), 'Term 3');
    assert.equal(defaultTermForSchool({ academic: { currentTerm: 'Term 1' } }), 'Term 1');
  });

  it('falls back to Term 1 for a school that has not set one', () => {
    // The same fallback the server applies (`resolveTerm`), so the client and
    // the server never resolve a different term.
    assert.equal(defaultTermForSchool(null), 'Term 1');
    assert.equal(defaultTermForSchool(undefined), 'Term 1');
    assert.equal(defaultTermForSchool({}), 'Term 1');
    assert.equal(defaultTermForSchool({ academic: {} }), 'Term 1');
    assert.equal(defaultTermForSchool({ academic: { currentTerm: '' } }), 'Term 1');
  });

  it('rejects a term the platform does not know', () => {
    // A school with a stale or renamed term must not put an unknown value into
    // the query string — the endpoint validates it and would 422.
    assert.equal(defaultTermForSchool({ academic: { currentTerm: 'Term 4' } }), 'Term 1');
    assert.equal(defaultTermForSchool({ academic: { currentTerm: 'term 2' } }), 'Term 1');
  });
});

describe('monthKeyOf — a month’s identity', () => {
  it('reads the key the server sent', () => {
    assert.equal(monthKeyOf({ key: '2026-10' }), '2026-10');
  });

  it('falls back to the first day of the month', () => {
    // A payload that predates the key still identifies its months.
    assert.equal(monthKeyOf({ days: [{ date: '2026-10-01' }] }), '2026-10');
  });

  it('is empty for a month with neither', () => {
    assert.equal(monthKeyOf({}), '');
    assert.equal(monthKeyOf(null), '');
  });
});

describe('currentMonthKey — where today falls', () => {
  it('takes the month off the current day', () => {
    assert.equal(currentMonthKey('2026-10-21'), '2026-10');
  });

  it('is null when there is no current day to place', () => {
    assert.equal(currentMonthKey(null), null);
    assert.equal(currentMonthKey(''), null);
    assert.equal(currentMonthKey('not a date'), null);
  });
});

describe('resolveExpandedMonth — the month the page opens on', () => {
  // Newest first, as the endpoint returns them.
  const months = [
    { key: '2026-12', days: [{ date: '2026-12-01' }] },
    { key: '2026-11', days: [{ date: '2026-11-01' }] },
    { key: '2026-10', days: [{ date: '2026-10-01' }] },
    { key: '2026-09', days: [{ date: '2026-09-01' }] },
  ];

  it('opens the month the current day is in', () => {
    assert.equal(resolveExpandedMonth(null, months, '2026-10-21'), '2026-10');
  });

  it('does not open the far end of the term', () => {
    // The old default was the first month in the list, which for a term is the
    // *future* end: a month of days that have not happened yet.
    assert.notEqual(resolveExpandedMonth(null, months, '2026-10-21'), '2026-12');
  });

  it('opens the newest month when today is outside the term', () => {
    // A term being read during the break, or a school whose current term does
    // not cover today. The newest month is the one most likely to hold marks.
    assert.equal(resolveExpandedMonth(null, months, '2026-07-15'), '2026-12');
    assert.equal(resolveExpandedMonth(null, months, null), '2026-12');
  });

  it('keeps a month the parent opened by hand', () => {
    assert.equal(resolveExpandedMonth('2026-09', months, '2026-10-21'), '2026-09');
  });

  it('keeps a month the parent collapsed', () => {
    assert.equal(resolveExpandedMonth('', months, '2026-10-21'), '');
  });

  it('falls back to the current month when the open one is not in this term', () => {
    // Switching term with October open must not leave the page with nothing
    // expanded and no sign of why.
    assert.equal(resolveExpandedMonth('2026-10', months.slice(0, 2), '2026-11-03'), '2026-11');
  });

  it('is empty when there are no months at all', () => {
    assert.equal(resolveExpandedMonth(null, [], '2026-10-21'), '');
  });
});

describe('toggleExpandedMonth — opening and closing', () => {
  const months = [
    { key: '2026-11' },
    { key: '2026-10' },
  ];

  it('opens a month that is closed', () => {
    assert.equal(toggleExpandedMonth(null, '2026-11', months, '2026-10-21'), '2026-11');
  });

  it('closes the month that is open', () => {
    assert.equal(toggleExpandedMonth('2026-10', '2026-10', months, '2026-10-21'), '');
  });

  it('closes the auto-opened month too', () => {
    // The auto-opened month is the current one, so tapping it closes it rather
    // than leaving it stuck open.
    assert.equal(toggleExpandedMonth(null, '2026-10', months, '2026-10-21'), '');
  });

  it('moves to another month', () => {
    assert.equal(toggleExpandedMonth('2026-10', '2026-11', months, '2026-10-21'), '2026-11');
  });
});

describe('the attendance pages open on the school’s term, date and month', () => {
  it('the parent page asks for the school’s term, not a constant', async () => {
    const page = await readSource('../pages/parent/Attendance.jsx');

    assert.ok(
      page.includes('defaultTermForSchool(school)'),
      'the parent attendance page does not read the school’s current term'
    );
    assert.ok(
      !/useState\(\s*'Term 1'\s*\)/.test(page),
      'the parent attendance page still hard-codes Term 1 — a school in Term 2 or Term 3 sees an empty register'
    );
  });

  it('the parent page opens the month the current day is in', async () => {
    const page = await readSource('../pages/parent/Attendance.jsx');

    assert.ok(
      page.includes('resolveExpandedMonth'),
      'the parent attendance page does not resolve which month to open'
    );
    assert.ok(
      !/useState\(0\)/.test(page),
      'the parent attendance page still opens on the first month in the list — the far end of the term'
    );
  });

  it('the teacher register opens on the school’s day', async () => {
    const page = await readSource('../pages/teacher/TakeAttendance.jsx');

    assert.ok(
      page.includes('new Date().toISOString().slice(0, 10)'),
      'the register no longer defaults to the school’s day (the UTC day)'
    );
    assert.ok(
      !page.includes('getTimezoneOffset'),
      'the register defaults to the handset’s own calendar day, which is not the school’s day'
    );
  });

  it('the report-card page asks for the school’s term too', async () => {
    // The same defect, one tab over: a school in Term 2 was shown the previous
    // term’s card — or none — on the page a parent opens to ask how their
    // child is doing this term.
    const page = await readSource('../pages/parent/Records.jsx');

    assert.ok(
      page.includes('defaultTermForSchool(school)'),
      'the parent report-card page does not read the school’s current term'
    );
    assert.ok(
      !/useState\(\s*'Term 1'\s*\)/.test(page),
      'the parent report-card page still hard-codes Term 1'
    );
  });
});
