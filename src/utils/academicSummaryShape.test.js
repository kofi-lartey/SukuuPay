import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * The Academic Overview's summary shape, and what it costs to get it wrong.
 *
 * The user-facing bug was one line — `gradeApprovalCounts is not defined` — and
 * it was four bugs deep. The component read a key it had never destructured, a
 * sibling read the same key with no default, and two others read `summary.x`
 * straight off a `summary` that can be null. Each of those is a white screen in
 * the one console a headteacher opens first, and none of them is caught by a
 * build: the bundled code is syntactically fine and only fails at render.
 *
 * These tests pin the *shape* rather than the components, because the shape is
 * what changed under them: the page must survive a full summary, a partial one,
 * and none at all.
 */
const shape = (summary) => {
  // The normalisation the page performs. Every nested key with a default, so an
  // absent key is a zero rather than a TypeError.
  const {
    gradeApprovalCounts = {},
    reportCardCounts = {},
    classAverages = [],
    topStudents = [],
  } = summary || {};
  return { gradeApprovalCounts, reportCardCounts, classAverages, topStudents };
};

describe('the summary shape the Overview must survive', () => {
  it('reads every key through a default rather than a bare destructure', () => {
    // The original bug, precisely: the parent destructured `gradeApprovalCounts`
    // only inside its KPI row, then referenced it in its own JSX.
    const partial = shape({ totals: { students: 4 } });
    assert.deepEqual(partial.gradeApprovalCounts, {}, 'an absent key must default, not throw');
    assert.deepEqual(partial.reportCardCounts, {});
    assert.deepEqual(partial.classAverages, []);
    assert.deepEqual(partial.topStudents, []);
  });

  it('survives a null summary', () => {
    // Destructuring `null` throws, which is the second crash class.
    assert.doesNotThrow(() => shape(null));
    assert.doesNotThrow(() => shape(undefined));
    assert.deepEqual(shape(null).classAverages, []);
  });

  it('keeps the values it was given', () => {
    const full = shape({
      gradeApprovalCounts: { draft: 1, submitted: 2, approved: 3, rejected: 4 },
      reportCardCounts: { draft: { count: 6 } },
      classAverages: [{ className: 'JHS 2' }],
      topStudents: [{ name: 'Ama Mensah' }],
    });
    assert.deepEqual(full.gradeApprovalCounts, { draft: 1, submitted: 2, approved: 3, rejected: 4 });
    assert.equal(full.reportCardCounts.draft.count, 6);
    assert.equal(full.classAverages.length, 1);
    assert.equal(full.topStudents[0].name, 'Ama Mensah');
  });

  it('renders a nested read as zero rather than throwing', () => {
    // `gradeApprovalCounts.approved` is the exact expression that threw. The
    // default `{}` makes it `undefined`, and `formatCount` renders 0 — the
    // honest answer for "no data yet".
    const { gradeApprovalCounts } = shape({});
    const count = gradeApprovalCounts.approved ?? 0;
    assert.equal(count, 0);
  });

  it('does not default the report-card entries to {}, because their reads are optional-chained', () => {
    // `ReportStatusRow` reads `entry?.count ?? 0`, so an absent *entry* is fine.
    // What must never happen is an absent *parent* — hence the two defaults
    // above and this one left alone.
    const { reportCardCounts } = shape({ reportCardCounts: {} });
    assert.equal((reportCardCounts.draft?.count ?? 0), 0);
  });
});
