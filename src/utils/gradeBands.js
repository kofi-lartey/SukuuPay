/**
 * The Ghanaian terminal-report grading: the bands, and the 30/70 arithmetic.
 *
 * This is the browser's copy of `Backend/src/utils/gradeBands.js`. It exists
 * so the teacher's grid can show the total, the grade and the position *as
 * the marks are typed* rather than after a save and a refetch. The server
 * remains the authority: every number here is recomputed server-side when the
 * class is compiled, and the two are pinned to the same cases in
 * `gradeBands.test.js` so they cannot drift apart.
 *
 * ## The weighting
 *
 * A Ghanaian terminal report is a **30/70 split**:
 *
 *     Class Assessment (SBA)  30%
 *     End-of-Term Examination  70%
 *     Total                    100%
 *
 * The class score is out of 30 and the exam's contribution is out of 70:
 *
 *     class score 24/30  → 24 points
 *     exam 60/100        → 42 points
 *     Total              → 66  →  grade B
 *
 * The exam is scaled, not copied. Adding the raw marks instead (24 + 60 = 84)
 * would report a student who scored 48% in the exam at 84% overall, which is
 * not a number the report could print.
 *
 * ## The class score is itself a breakdown
 *
 * The 30% class assessment is gathered across the term, and the split most
 * Ghanaian schools use is class test 30%, group work 30%, homework 20% and
 * class work 20% — which, out of the 30 points, is 9, 9, 6 and 6. Each part is
 * marked on its own maximum and contributes its **proportion** of its share.
 */

/** The band table, in descending order — the first match wins. */
export const GRADE_BANDS = [
  { min: 80, grade: 'A', meaning: 'Advance' },
  { min: 75, grade: 'A-', meaning: 'Proficient' },
  { min: 70, grade: 'B+', meaning: 'Approaching Proficiency' },
  { min: 65, grade: 'B', meaning: 'Developing' },
  { min: 0, grade: 'F', meaning: 'Beginning' },
];

/** The class score is out of 30; the exam paper is out of 100. */
export const CLASS_SCORE_MAX = 30;
export const EXAM_SCORE_MAX = 100;

/** How much of the total each half carries: 30/70. */
export const CLASS_WEIGHT = 30;
export const EXAM_WEIGHT = 70;

/**
 * The default class-score breakdown, in the order the grid renders it.
 *
 * `weight` is the part's share of the class score — points out of 30 — and
 * `maxScore` is the maximum it is marked against by default. The school may
 * change both; the server sends the school's own policy with the grade book,
 * and these are only the fallback for a page that has not loaded it yet.
 */
export const DEFAULT_CLASS_COMPONENTS = [
  { key: 'class_test', label: 'Class Test', weight: 9, maxScore: 30 },
  { key: 'group_work', label: 'Group Work', weight: 9, maxScore: 30 },
  { key: 'homework', label: 'Homework', weight: 6, maxScore: 20 },
  { key: 'class_work', label: 'Class Work', weight: 6, maxScore: 20 },
];

/** The letter a percentage earns. */
export const gradeForScore = (score, maxScore = EXAM_SCORE_MAX) => {
  const numeric = Number(score);
  const max = Number(maxScore);
  if (!Number.isFinite(numeric) || !Number.isFinite(max) || max <= 0) return 'F';
  const pct = (numeric / max) * 100;
  return GRADE_BANDS.find((band) => pct >= band.min)?.grade || 'F';
};

/** The meaning that prints beside a letter — "Developing", "Advance", … */
export const meaningForGrade = (grade) =>
  GRADE_BANDS.find((band) => band.grade === grade)?.meaning || '—';

/**
 * Whether a pair of marks is finished.
 *
 * The grid shows a dash rather than a total until the class assessment and
 * the exam are both in, because a total computed from one half reads as a
 * result and is not one.
 */
export const hasBothScores = (classScore, examScore) =>
  classScore !== '' &&
  classScore !== null &&
  classScore !== undefined &&
  examScore !== '' &&
  examScore !== null &&
  examScore !== undefined;

/**
 * The points one part of the class assessment contributes.
 *
 * A part marked out of its own maximum contributes its **proportion** of its
 * share of the class score. 80/100 and 16/20 are the same mark and must
 * contribute the same.
 */
export const calculateComponentPoints = (score, maxScore, weight) => {
  const numeric = Number(score);
  const max = Number(maxScore);
  const share = Number(weight);
  if (!Number.isFinite(numeric) || !Number.isFinite(max) || max <= 0) return 0;
  if (!Number.isFinite(share) || share <= 0) return 0;
  return (numeric / max) * share;
};

/**
 * The class score, out of 30, from the parts that make it up.
 *
 * A part that is missing is **not** a zero: the breakdown is incomplete, so
 * the subject has no class score and therefore no total, no grade and no
 * position. Inventing the missing part's mark would be a worse lie than
 * printing nothing.
 */
export const calculateClassScore = (parts = []) => {
  const present = parts.filter(
    (part) => part && part.score !== null && part.score !== undefined && part.score !== ''
  );
  if (!present.length) {
    return { classScore: null, complete: false, missing: parts.length };
  }

  const points = present.reduce(
    (sum, part) => sum + calculateComponentPoints(part.score, part.maxScore, part.weight),
    0
  );
  const missing = parts.length - present.length;

  return {
    classScore: Math.round(points),
    complete: missing === 0,
    missing,
  };
};

/**
 * Normalise a class score and an exam mark into a total out of 100.
 *
 * Each half is scaled onto the points it carries in the total and the two are
 * added:
 *
 *     class 24/30 × 30 = 24 points
 *     exam  60/100 × 70 = 42 points
 *     total = 66
 *
 * `weights` is the school's 30/70 split. The defaults are the Ghanaian ones.
 */
export const calculateTotalScore = (
  classScore,
  classMax = CLASS_SCORE_MAX,
  examScore,
  examMax = EXAM_SCORE_MAX,
  weights = { classWeight: CLASS_WEIGHT, examWeight: EXAM_WEIGHT }
) => {
  const classMaxScore = Number(classMax) > 0 ? Number(classMax) : CLASS_SCORE_MAX;
  const examMaxScore = Number(examMax) > 0 ? Number(examMax) : EXAM_SCORE_MAX;
  const classWeight = Number(weights?.classWeight) > 0 ? Number(weights.classWeight) : CLASS_WEIGHT;
  const examWeight = Number(weights?.examWeight) > 0 ? Number(weights.examWeight) : EXAM_WEIGHT;

  const classPoints = (Number(classScore) / classMaxScore) * classWeight;
  const examPoints = (Number(examScore) / examMaxScore) * examWeight;

  const totalScore = Math.round(classPoints + examPoints);
  const grade = gradeForScore(totalScore);

  return {
    totalScore,
    grade,
    meaning: meaningForGrade(grade),
    classPoints: Math.round(classPoints),
    examPoints: Math.round(examPoints),
  };
};

/**
 * "1st", "2nd", "3rd" — the ordinal a report card prints.
 *
 * Mirrors `Backend/src/utils/subjectResults.js:positionLabel`. The 11th case
 * is the one a naive `index % 10` gets wrong: 11 is "11th", not "11st".
 */
export const positionLabel = (rank) => {
  const numeric = Number(rank);
  if (!Number.isFinite(numeric) || numeric < 1) return '—';
  const n = Math.floor(numeric);
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  const suffix = { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th';
  return `${n}${suffix}`;
};

/**
 * Rank a set of totals within one subject, the way the report card ranks them.
 *
 * Mirrors `Backend/src/utils/subjectResults.js:assignSubjectPositions`:
 * **competition ranking** ("1224") — tied students share the lower position
 * and the next position is skipped, so two students joint first are both
 * "1st" and the next is "3rd".
 *
 * `entries` are `{ id, totalScore }` pairs. A student with no total — a
 * subject that is not finished — is not ranked at all: there is nothing to
 * place them on, and an unranked student in the middle of a table reads as a
 * fail rather than as "not marked yet".
 *
 * @returns {Map<string, string>} id → position label
 */
export const rankByTotal = (entries = []) => {
  const ranked = entries.filter(
    (entry) => entry && entry.totalScore !== null && entry.totalScore !== undefined
  );

  const sorted = [...ranked].sort((a, b) => b.totalScore - a.totalScore);

  const positions = new Map();
  let position = 0;
  let previous = null;
  for (const [index, entry] of sorted.entries()) {
    if (previous === null || entry.totalScore < previous) {
      position = index + 1;
      previous = entry.totalScore;
    }
    positions.set(String(entry.id), positionLabel(position));
  }
  return positions;
};

export default {
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
};
