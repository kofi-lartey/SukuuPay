// The grade arithmetic the teacher's grid previews.
//
// These cases are the same ones the server is pinned to
// (`Backend/tests/gradeBands.test.js`), because the one thing this module must
// never do is disagree with the server about what a student's total is. A
// teacher who sees "66 · B" in the grid and "66 · B+" on the report card has
// found a bug, and this file is where the bug is caught.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  gradeForScore,
  meaningForGrade,
  calculateTotalScore,
  hasBothScores,
  positionLabel,
  rankByTotal,
  GRADE_BANDS,
  CLASS_SCORE_MAX,
  EXAM_SCORE_MAX,
} from './gradeBands.js';

describe('gradeForScore — the five-band scale', () => {
  it('bands a percentage into its letter', () => {
    assert.equal(gradeForScore(85), 'A');
    assert.equal(gradeForScore(80), 'A');
    assert.equal(gradeForScore(76), 'A-');
    assert.equal(gradeForScore(72), 'B+');
    assert.equal(gradeForScore(66), 'B');
    assert.equal(gradeForScore(50), 'F');
    assert.equal(gradeForScore(0), 'F');
  });

  it('respects the maximum a subject was marked against', () => {
    // 45 out of 50 is 90% — the same band as 90 out of 100.
    assert.equal(gradeForScore(45, 50), 'A');
    assert.equal(gradeForScore(90, 100), 'A');
    // 33 out of 50 is 66% — a B, not a fail.
    assert.equal(gradeForScore(33, 50), 'B');
  });

  it('never returns an empty band for a nonsense input', () => {
    assert.equal(gradeForScore(''), 'F');
    assert.equal(gradeForScore(null), 'F');
    assert.equal(gradeForScore(undefined), 'F');
    assert.equal(gradeForScore('nonsense'), 'F');
    assert.equal(gradeForScore(50, 0), 'F');
  });
});

describe('meaningForGrade', () => {
  it('names the band the way the report prints it', () => {
    assert.equal(meaningForGrade('A'), 'Advance');
    assert.equal(meaningForGrade('A-'), 'Proficient');
    assert.equal(meaningForGrade('B+'), 'Approaching Proficiency');
    assert.equal(meaningForGrade('B'), 'Developing');
    assert.equal(meaningForGrade('F'), 'Beginning');
  });

  it('has a dash for a letter that is not on the scale', () => {
    assert.equal(meaningForGrade('Z'), '—');
    assert.equal(meaningForGrade(''), '—');
  });

  it('covers every letter the bands can produce', () => {
    for (const band of GRADE_BANDS) {
      assert.equal(meaningForGrade(band.grade), band.meaning);
    }
  });
});

describe('calculateTotalScore — class score + exam score', () => {
  it('normalises the two halves onto 50 each', () => {
    // 42/50 → 42 points, 48/100 → 24 points, total 66, grade B.
    const result = calculateTotalScore(42, 50, 48, 100);
    assert.equal(result.totalScore, 66);
    assert.equal(result.grade, 'B');
    assert.equal(result.meaning, 'Developing');
  });

  it('is not a plain sum of the two raw marks', () => {
    // The bug this pins: adding 42 + 48 gives 90, which would put a student
    // who scored 84% in class and 48% in the exam at 90% overall — a number
    // the report could print and that means nothing.
    const result = calculateTotalScore(42, 50, 48, 100);
    assert.notEqual(result.totalScore, 90);
  });

  it('gives a perfect paper a hundred', () => {
    const result = calculateTotalScore(50, 50, 100, 100);
    assert.equal(result.totalScore, 100);
    assert.equal(result.grade, 'A');
  });

  it('gives a blank paper a zero', () => {
    const result = calculateTotalScore(0, 50, 0, 100);
    assert.equal(result.totalScore, 0);
    assert.equal(result.grade, 'F');
  });

  it('treats a missing half as zero rather than as NaN', () => {
    const result = calculateTotalScore('', 50, 48, 100);
    assert.equal(result.totalScore, 24);
    assert.ok(Number.isFinite(result.totalScore));
  });

  it('defaults to the report’s own maxima', () => {
    assert.equal(CLASS_SCORE_MAX, 50);
    assert.equal(EXAM_SCORE_MAX, 100);
    const withDefaults = calculateTotalScore(42, undefined, 48, undefined);
    const withExplicit = calculateTotalScore(42, 50, 48, 100);
    assert.deepEqual(withDefaults, withExplicit);
  });

  it('honours a school that marks its continuous assessment out of 60', () => {
    // 45/60 and 48/100 → 37.5 + 24 = 61.5 → 62.
    const result = calculateTotalScore(45, 60, 48, 100);
    assert.equal(result.totalScore, 62);
  });
});

describe('hasBothScores', () => {
  it('is false until both halves are in', () => {
    assert.equal(hasBothScores('', ''), false);
    assert.equal(hasBothScores('42', ''), false);
    assert.equal(hasBothScores('', '48'), false);
    assert.equal(hasBothScores(null, undefined), false);
  });

  it('is true once both halves are in', () => {
    assert.equal(hasBothScores('42', '48'), true);
    assert.equal(hasBothScores(0, 0), true);
  });
});

// The position the grid shows live and the report card prints. The cases are
// the server's (`Backend/tests/gradeBands.test.js`), because the grid's number
// and the card's number have to be the same number.

describe('positionLabel', () => {
  it('writes the ordinal the report prints', () => {
    assert.equal(positionLabel(1), '1st');
    assert.equal(positionLabel(2), '2nd');
    assert.equal(positionLabel(3), '3rd');
    assert.equal(positionLabel(4), '4th');
    assert.equal(positionLabel(11), '11th');
    assert.equal(positionLabel(12), '12th');
    assert.equal(positionLabel(13), '13th');
    assert.equal(positionLabel(21), '21st');
    assert.equal(positionLabel(22), '22nd');
    assert.equal(positionLabel(23), '23rd');
  });

  it('is a dash for a rank that is not there', () => {
    assert.equal(positionLabel(0), '—');
    assert.equal(positionLabel(null), '—');
    assert.equal(positionLabel(undefined), '—');
  });
});

describe('rankByTotal — ranking within a subject', () => {
  it('ranks the class within the subject', () => {
    const positions = rankByTotal([
      { id: 's1', totalScore: 90 },
      { id: 's2', totalScore: 70 },
      { id: 's3', totalScore: 50 },
    ]);
    assert.equal(positions.get('s1'), '1st');
    assert.equal(positions.get('s2'), '2nd');
    assert.equal(positions.get('s3'), '3rd');
  });

  it('ties share the lower position and the next is skipped', () => {
    // Competition ranking ("1224"): two joint first are both 1st and the next
    // is 3rd. Giving them "1" and "2" tells the second one they beat someone
    // they did not.
    const positions = rankByTotal([
      { id: 's1', totalScore: 90 },
      { id: 's2', totalScore: 90 },
      { id: 's3', totalScore: 70 },
    ]);
    assert.equal(positions.get('s1'), '1st');
    assert.equal(positions.get('s2'), '1st');
    assert.equal(positions.get('s3'), '3rd');
  });

  it('does not rank a student with no total', () => {
    // A half-marked subject has no total to place on, and an unranked student
    // in the middle of a table reads as a fail rather than as "not marked yet".
    const positions = rankByTotal([
      { id: 's1', totalScore: 90 },
      { id: 's2', totalScore: null },
    ]);
    assert.equal(positions.get('s1'), '1st');
    assert.equal(positions.has('s2'), false);
  });
});
