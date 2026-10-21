/**
 * The Ghanaian grading bands, mirrored from the server.
 *
 * This is a *copy* of `Backend/src/utils/gradeBands.js`, and it is a copy on
 * purpose: the teacher's grid shows the total and the grade **as they type**,
 * before anything has been saved or approved. A teacher who sees 66 and a "B"
 * in the grid and then reads 66 and a "B+" on the report card has found a
 * disagreement, and the usual cause of exactly that disagreement is two
 * implementations of the same arithmetic.
 *
 * The server remains the authority — the grade on a report card is the one the
 * server computed. This copy exists so the *preview* cannot disagree with it.
 * The two are pinned to each other by the same test cases on both sides.
 */

/** The class score is marked out of 50 and the exam out of 100. */
export const CLASS_SCORE_MAX = 50;
export const EXAM_SCORE_MAX = 100;

/** The band table, in descending order — the first match wins. */
export const GRADE_BANDS = [
  { min: 80, grade: 'A', meaning: 'Advance' },
  { min: 75, grade: 'A-', meaning: 'Proficient' },
  { min: 70, grade: 'B+', meaning: 'Approaching Proficiency' },
  { min: 65, grade: 'B', meaning: 'Developing' },
  { min: 0, grade: 'F', meaning: 'Beginning' },
];

/**
 * A number, or zero.
 *
 * `Number('')` is 0 and `Number(undefined)` is `NaN`, and a `NaN` that reaches
 * `Math.round` comes back as `NaN` — which renders as a blank cell. Every score
 * that reaches this module is therefore funnelled through here first.
 */
const toScore = (value) => {
  if (value === '' || value === null || value === undefined) return 0;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

/**
 * The letter a percentage earns.
 *
 * `maxScore` is respected rather than assumed to be 100, so a school marking
 * out of 50 gets the same letter for the same proportion instead of everyone
 * failing.
 */
export const gradeForScore = (score, maxScore = 100) => {
  const max = Number(maxScore);
  const pct = max > 0 ? (toScore(score) / max) * 100 : 0;
  const band = GRADE_BANDS.find((b) => pct >= b.min);
  return band?.grade || 'F';
};

/** The meaning that prints beside a letter — 'Developing', 'Advance', … */
export const meaningForGrade = (grade) => {
  const band = GRADE_BANDS.find((b) => b.grade === grade);
  return band?.meaning || '—';
};

/**
 * Normalise a class score and an exam score into a total out of 100.
 *
 * Each half is scaled onto 50 points, so the two carry equal weight whatever
 * maximum they were marked against, and the total is the sum of the two — the
 * number the physical report prints under "Total".
 */
export const calculateTotalScore = (
  classScore,
  classMax = CLASS_SCORE_MAX,
  examScore,
  examMax = EXAM_SCORE_MAX
) => {
  const classMaxScore = Number(classMax) > 0 ? Number(classMax) : CLASS_SCORE_MAX;
  const examMaxScore = Number(examMax) > 0 ? Number(examMax) : EXAM_SCORE_MAX;

  // Normalise class to 50%.
  const normalizedClass = (toScore(classScore) / classMaxScore) * 50;

  // Normalise exam to 50%.
  const normalizedExam = (toScore(examScore) / examMaxScore) * 50;

  const totalScore = Math.round(normalizedClass + normalizedExam);
  const grade = gradeForScore(totalScore);
  const meaning = meaningForGrade(grade);

  return { totalScore, grade, meaning };
};

/**
 * Whether a pair of marks is finished.
 *
 * The grid shows a dash rather than a total until both halves are in, because
 * a total computed from one half reads as a result and is not one.
 */
export const hasBothScores = (classScore, examScore) =>
  classScore !== '' &&
  classScore !== null &&
  classScore !== undefined &&
  examScore !== '' &&
  examScore !== null &&
  examScore !== undefined;

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
 * "1st" and the next is "3rd". Assigning `index + 1` instead would tell the
 * second one they beat someone they did not, which is the single most
 * complained-about number on a Ghanaian report card.
 *
 * `entries` are `{ id, totalScore }` pairs. A student with no total — one
 * half of the pair missing — is not ranked at all: there is nothing to place
 * them on, and an unranked student in the middle of a table reads as a fail
 * rather than as "not marked yet".
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
  hasBothScores,
  positionLabel,
  rankByTotal,
  GRADE_BANDS,
  CLASS_SCORE_MAX,
  EXAM_SCORE_MAX,
};
