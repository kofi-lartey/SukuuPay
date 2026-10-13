import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { academicSummary, normalizeGradeQueue } from './academicSummary.js';

const FULL = {
  term: 'Term 1',
  academicYear: '2025/2026',
  totals: { students: 120, classes: 6, attendanceRate: 87.5 },
  grades: { draft: 0, submitted: 14, approved: 112, rejected: 2 },
  reportCards: {
    draft: { count: 0, average: 0 },
    review: { count: 9, average: 63.24 },
    published: { count: 88, average: 71.1 },
    archived: { count: 12, average: 0 },
  },
  classAverages: [
    { className: 'JHS 3A', average: 82.4, count: 22 },
    { className: 'JHS 2B', average: 70.1, count: 24 },
  ],
  topStudents: [
    { studentName: 'Ama Serwaa', studentId: 'PBS-2026-0001', className: 'JHS 3A', average: 91.5, grade: 'A' },
    { studentName: 'Kofi Mensah', studentId: 'PBS-2026-0012', className: 'JHS 2B', average: 89.0, grade: 'B1' },
  ],
};

describe('academicSummary — the questions the overview card is built around', () => {
  const s = academicSummary(FULL);

  it('counts grade blocks awaiting the headmaster stamp', () => {
    // `submitted` is "handed to the desk"; draft/approved/rejected are not pending.
    assert.equal(s.pendingApprovals, 14);
    assert.equal(s.gradeApprovalCounts.approved, 112);
    assert.equal(s.gradeApprovalCounts.rejected, 2);
  });

  it('counts report cards ready for the publish stamp', () => {
    // `review` cards have been compiled and await publish; `published`/`archived` do not.
    assert.equal(s.publishReady, 9);
    assert.equal(s.reportCardCounts.published.count, 88);
    assert.equal(s.reportCardCounts.archived.count, 12);
  });

  it('passes the school-wide totals through unchanged', () => {
    assert.equal(s.totals.students, 120);
    assert.equal(s.totals.classes, 6);
    assert.equal(s.totals.attendanceRate, 87.5);
  });

  it('preserves class averages in the server order (already sorted)', () => {
    assert.equal(s.classAverages.length, 2);
    assert.equal(s.classAverages[0].className, 'JHS 3A');
    assert.equal(s.classAverages[0].average, 82.4);
    assert.equal(s.classAverages[1].className, 'JHS 2B');
    assert.equal(s.classAverages[1].average, 70.1);
    assert.equal(s.classAverages[1].count, 24);
  });

  it('keeps only the display fields from top students', () => {
    assert.equal(s.topStudents[0].studentName, 'Ama Serwaa');
    assert.equal(s.topStudents[0].grade, 'A');
    assert.equal(s.topStudents[1].className, 'JHS 2B');
  });

  it('carries the requested scope through', () => {
    assert.equal(s.term, 'Term 1');
    assert.equal(s.academicYear, '2025/2026');
  });

  it('is not empty when there is something to show', () => {
    assert.equal(s.isEmpty, false);
  });
});

describe('academicSummary — defensive to a payload that is not the full one', () => {
  it('does not throw on nullish input and zeroes everything', () => {
    const s = academicSummary(undefined);
    assert.equal(s.pendingApprovals, 0);
    assert.equal(s.publishReady, 0);
    assert.equal(s.totals.students, 0);
    assert.equal(s.totals.classes, 0);
    assert.equal(s.isEmpty, true);
    assert.deepEqual(s.gradeApprovalCounts, { draft: 0, submitted: 0, approved: 0, rejected: 0 });
    assert.deepEqual(s.reportCardCounts, { draft: 0, review: 0, published: 0, archived: 0 });
  });

  it('does not throw on `{}` and zeroes everything', () => {
    const s = academicSummary({});
    assert.equal(s.pendingApprovals, 0);
    assert.equal(s.isEmpty, true);
  });

  it('fills missing grade statuses with zero rather than undefined', () => {
    const s = academicSummary({ grades: { submitted: 3 } });
    assert.equal(s.pendingApprovals, 3);
    assert.equal(s.gradeApprovalCounts.approved, 0);
    assert.equal(s.gradeApprovalCounts.rejected, 0);
  });

  it('reads review as a bare number as well as as { count }', () => {
    // The envelope could regress either way; both must yield the same count.
    assert.equal(academicSummary({ reportCards: { review: 5 } }).publishReady, 5);
    assert.equal(academicSummary({ reportCards: { review: { count: 5 } } }).publishReady, 5);
  });

  it('tolerates a half-built classAverages / topStudents', () => {
    const s = academicSummary({
      classAverages: [{ average: 72 }, { className: 'JHS 1A' }],
      topStudents: [{ studentName: 'X', average: '91' }],
    });
    assert.equal(s.classAverages[0].className, '—');
    assert.equal(s.classAverages[0].average, 72);
    assert.equal(s.classAverages[1].average, 0);
    assert.equal(s.topStudents[0].average, 91);
  });

  it('treats a NaN average as zero instead of propagating NaN', () => {
    const s = academicSummary({ classAverages: [{ className: 'JHS 3A', average: '—' }] });
    assert.equal(s.classAverages[0].average, 0);
  });
});

describe("normalizeGradeQueue — the queue page's row source", () => {
  it('returns the queue array from the real envelope', () => {
    const raw = {
      queue: [
        { className: 'JHS 2A', subject: 'Mathematics', count: 30, submittedByName: 'Ama Serwaa' },
        { className: 'JHS 2A', subject: null, count: 5, submittedByName: 'Kofi Mensah' },
      ],
      meta: { total: 2 },
    };
    const rows = normalizeGradeQueue(raw);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].className, 'JHS 2A');
    assert.equal(rows[1].subject, null);
  });

  it('degrades to an empty array when the envelope is absent', () => {
    // The queue page renders an empty state when there is nothing — never a crash
    // trying to `.map` on `undefined`.
    assert.deepEqual(normalizeGradeQueue(undefined), []);
    assert.deepEqual(normalizeGradeQueue({}), []);
    assert.deepEqual(normalizeGradeQueue({ queue: null }), []);
    assert.deepEqual(normalizeGradeQueue({ queue: 'not-an-array' }), []);
  });

  it('preserves the server-shipped fields the table renders', () => {
    // Each row exposes what the GradeApproval table columns call for, including a
    // possibly-null `subject` (a whole-class submission).
    const rows = normalizeGradeQueue({
      queue: [
        { className: 'JHS 1B', subject: null, count: 12, submittedByName: 'Teacher One', submittedAt: '2026-01-02T03:04:05.000Z' },
      ],
    });
    assert.equal(rows[0].submittedAt, '2026-01-02T03:04:05.000Z');
    assert.equal(rows[0].count, 12);
  });
});
