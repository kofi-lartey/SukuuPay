// The grade arithmetic the teacher's grid previews.
//
// These cases are the same ones the server is pinned to
// (`Backend/tests/gradeBands.test.js`), because the one thing this module must
// never do is disagree with the server about what a student's total is. A
// teacher who sees "66 · B" in the grid and "66 · B" on the report card has
// found a bug, and this file is where the bug is caught.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  gradeForScore,
  meaningForGrade,
  calculateTotalScore,
  calculateClassScore,
  calculateComponentPoints,
  hasBothScores,
  positionLabel,
  rankByTotal,
  GRADE_BANDS,
  CLASS_SCORE_MAX,
  EXAM_SCORE_MAX,
  CLASS_WEIGHT,
  EXAM_WEIGHT,
  DEFAULT_CLASS_COMPONENTS,
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
    assert.equal(gradeForScore(45, 50), 'A');
    assert.equal(gradeForScore(90, 100), 'A');
    assert.equal(gradeForScore(33, 50), 'B');
  });

  it('never returns an empty band for a nonsense input', () => {
    assert.equal(gradeForScore(''), 'F');
    assert.equal(gradeForScore(null), 'F');
    assert.equal(gradeForScore(undefined), 'F');
    assert.equal(gradeForScore('nonsense'), 'F');
    assert.equal(gradeForScore(50, 0), 'F');
  });

  it('the band table is the five the terminal report prints', () => {
    assert.deepEqual(
      GRADE_BANDS.map((b) => b.grade),
      ['A', 'A-', 'B+', 'B', 'F']
    );
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
});

describe('the 30/70 split', () => {
  it('the report’s own maxima are 30 and 100', () => {
    assert.equal(CLASS_SCORE_MAX, 30);
    assert.equal(EXAM_SCORE_MAX, 100);
  });

  it('the weights are 30/70', () => {
    assert.equal(CLASS_WEIGHT, 30);
    assert.equal(EXAM_WEIGHT, 70);
  });

  it('the default breakdown sums to the class weight', () => {
    const total = DEFAULT_CLASS_COMPONENTS.reduce((sum, part) => sum + part.weight, 0);
    assert.equal(total, CLASS_SCORE_MAX);
  });
});

describe('calculateTotalScore — class score + exam score', () => {
  it('24/30 + 60/100 is 66 and a grade of B', () => {
    const result = calculateTotalScore(24, 30, 60, 100);
    assert.equal(result.totalScore, 66);
    assert.equal(result.grade, 'B');
    assert.equal(result.meaning, 'Developing');
    assert.equal(result.classPoints, 24);
    assert.equal(result.examPoints, 42);
  });

  it('is not a plain sum of the two raw marks', () => {
    const result = calculateTotalScore(24, 30, 60, 100);
    assert.notEqual(result.totalScore, 84);
  });

  it('gives a perfect paper a hundred and a blank pair a zero', () => {
    assert.equal(calculateTotalScore(30, 30, 100, 100).totalScore, 100);
    assert.equal(calculateTotalScore(30, 30, 100, 100).grade, 'A');
    assert.equal(calculateTotalScore(0, 30, 0, 100).totalScore, 0);
    assert.equal(calculateTotalScore(0, 30, 0, 100).grade, 'F');
  });

  it('treats a missing half as zero rather than as NaN', () => {
    const result = calculateTotalScore('', 30, 48, 100);
    assert.equal(result.totalScore, 34);
    assert.ok(Number.isFinite(result.totalScore));
  });

  it('honours a school that runs a 40/60 split', () => {
    const result = calculateTotalScore(24, 30, 60, 100, { classWeight: 40, examWeight: 60 });
    assert.equal(result.totalScore, 68);
    assert.equal(result.grade, 'B');
  });

  it('defaults to the report’s own maxima when none are passed', () => {
    const withDefaults = calculateTotalScore(24, undefined, 60, undefined);
    const withExplicit = calculateTotalScore(24, 30, 60, 100);
    assert.deepEqual(withDefaults, withExplicit);
  });
});

describe('calculateComponentPoints — a part is its proportion of its share', () => {
  it('scales marks marked out of different maxima the same', () => {
    assert.ok(Math.abs(calculateComponentPoints(80, 100, 9) - 7.2) < 1e-9);
    assert.ok(Math.abs(calculateComponentPoints(16, 20, 6) - 4.8) < 1e-9);
  });

  it('returns zero when the part is not in', () => {
    assert.equal(calculateComponentPoints('', 100, 9), 0);
    assert.equal(calculateComponentPoints(null, 100, 9), 0);
  });
});

describe('calculateClassScore — the parts fold into one mark', () => {
  const parts = [
    { key: 'class_test', score: 80, maxScore: 100, weight: 9 },
    { key: 'group_work', score: 80, maxScore: 100, weight: 9 },
    { key: 'homework', score: 16, maxScore: 20, weight: 6 },
    { key: 'class_work', score: 16, maxScore: 20, weight: 6 },
  ];

  it('adds the parts to a class score out of 30', () => {
    assert.equal(calculateClassScore(parts).classScore, 24);
    assert.equal(calculateClassScore(parts).complete, true);
  });

  it('a part marked out of its own maximum is the same proportion', () => {
    // 80/100 and 40/50 are the same 80%, so the class score the breakdown
    // produces is identical either way.
    const swapped = [
      { key: 'class_test', score: 40, maxScore: 50, weight: 9 },
      ...parts.slice(1),
    ];
    assert.equal(calculateClassScore(swapped).classScore, 24);
  });

  it('still reports a progress total while the breakdown is incomplete', () => {
    // All four parts configured, but class_work is not in yet: the breakdown is
    // incomplete, so the class score is not a result — yet the grid still shows
    // the three parts' progress as a working total.
    const incomplete = [
      { key: 'class_test', score: 80, maxScore: 100, weight: 9 },
      { key: 'group_work', score: 80, maxScore: 100, weight: 9 },
      { key: 'homework', score: 16, maxScore: 20, weight: 6 },
      { key: 'class_work', score: null, maxScore: 20, weight: 6 },
    ];
    const folded = calculateClassScore(incomplete);
    assert.equal(folded.classScore, 19);
    assert.equal(folded.complete, false);
    assert.equal(folded.missing, 1);
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
    const positions = rankByTotal([
      { id: 's1', totalScore: 90 },
      { id: 's2', totalScore: null },
    ]);
    assert.equal(positions.get('s1'), '1st');
    assert.equal(positions.has('s2'), false);
  });
});
