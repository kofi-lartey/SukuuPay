/**
 * Academic fixtures — the data behind the Records page (approved design mock).
 *
 * ## The term card is computed, not stored
 *
 * Position, aggregate and trend are the three numbers a parent will quote, so
 * each is derived from the subject scores by the helpers below rather than held
 * as constants. A fixture with 8 subjects whose average disagrees with its own
 * headline is the kind of thing that survives a design mock and then ships.
 *
 * Grades follow the standard GES scale; the school's configured scale is what
 * the endpoint will return and what will replace `GRADE_BANDS` here.
 */

const SUBJECTS = [
  { name: 'Career Technology', icon: 'wrench', score: 88 },
  { name: 'English Language', icon: 'book', score: 76 },
  { name: 'French', icon: 'languages', score: 71 },
  { name: 'Integrated Science', icon: 'flask', score: 82 },
  { name: 'ICT', icon: 'monitor', score: 85 },
  { name: 'Mathematics', icon: 'sigma', score: 79 },
  { name: 'R.M.E.', icon: 'heart', score: 74 },
  { name: 'Social Studies', icon: 'globe', score: 72 },
];

/** GES grade bands, highest first. `cutoff` is the lowest score that earns it. */
const GRADE_BANDS = [
  { grade: 'A', cutoff: 80, tone: 'green' },
  { grade: 'B+', cutoff: 75, tone: 'green' },
  { grade: 'B', cutoff: 70, tone: 'blue' },
  { grade: 'C+', cutoff: 65, tone: 'amber' },
  { grade: 'C', cutoff: 60, tone: 'amber' },
  { grade: 'D', cutoff: 50, tone: 'red' },
  { grade: 'E', cutoff: 40, tone: 'red' },
  { grade: 'F', cutoff: 0, tone: 'red' },
];

export const gradeFor = (score) =>
  GRADE_BANDS.find((band) => score >= band.cutoff) || GRADE_BANDS[GRADE_BANDS.length - 1];

/** Aggregate grade from the mean, so "B+ (Merit)" can never contradict 78.4%. */
export const aggregateFor = (average) => gradeFor(Math.round(average)).grade;

/** The mean of the subject scores, one decimal. */
const averageOf = (scores) => {
  if (!scores.length) return 0;
  const total = scores.reduce((sum, score) => sum + score, 0);
  return Math.round((total / scores.length) * 10) / 10;
};

/**
 * Term 1 as the comparison term — the source of the +4.2% trend.
 *
 * Deliberately a full card rather than a bare average: the trend arrow on Term 2
 * links to Term 1's tab, and that tab has to open on a real report, not an
 * empty state.
 */
const term1 = {
  termId: 't1',
  termLabel: 'Term 1',
  subjects: [
    { name: 'Career Technology', icon: 'wrench', score: 81 },
    { name: 'English Language', icon: 'book', score: 72 },
    { name: 'French', icon: 'languages', score: 68 },
    { name: 'Integrated Science', icon: 'flask', score: 75 },
    { name: 'ICT', icon: 'monitor', score: 80 },
    { name: 'Mathematics', icon: 'sigma', score: 66 },
    { name: 'R.M.E.', icon: 'heart', score: 71 },
    { name: 'Social Studies', icon: 'globe', score: 69 },
  ],
  classPosition: 18,
  classSize: 45,
  aggregate: 'B',
};

export const reportCards = {
  t1: {
    ...term1,
    subjects: term1.subjects.map((subject) => ({
      ...subject,
      grade: gradeFor(subject.score).grade,
      tone: gradeFor(subject.score).tone,
    })),
    overallAverage: averageOf(term1.subjects.map((s) => s.score)),
    classRemark: {
      body:
        'A steady first term. Kwame listens well in class; the next step is showing his working in Mathematics exercises.',
      author: 'Mrs. Adjei',
      role: 'JHS 2A Class Teacher',
    },
    headRemark: {
      body: 'A good start to the year. Keep it up.',
      author: 'Mr. Owusu',
      role: 'Headteacher (Achimota Basic School)',
    },
    conduct: { rating: 'Very Good', notes: 'No disciplinary notes' },
  },

  t2: {
    termId: 't2',
    termLabel: 'Term 2',
    isNew: true,
    subjects: SUBJECTS.map((subject) => ({
      ...subject,
      grade: gradeFor(subject.score).grade,
      tone: gradeFor(subject.score).tone,
    })),
    overallAverage: averageOf(SUBJECTS.map((s) => s.score)),
    previousAverage: averageOf(term1.subjects.map((s) => s.score)),
    classPosition: 12,
    classSize: 45,
    aggregate: aggregateFor(averageOf(SUBJECTS.map((s) => s.score))),
    aggregateNote: 'Merit',
    classRemark: {
      body:
        'Kwame has shown strong improvement in Mathematics this term. He should work on participating more in class discussions.',
      author: 'Mrs. Adjei',
      role: 'JHS 2A Class Teacher',
    },
    headRemark: {
      body: 'A commendable performance. Keep up the good work.',
      author: 'Mr. Owusu',
      role: 'Headteacher (Achimota Basic School)',
    },
    conduct: { rating: 'Excellent', notes: 'No disciplinary notes' },
    attendance: { rate: 94.0, daysRecorded: 50, daysPresent: 47, absentNote: '3 excused absences' },
  },
};

/** Term tabs in display order; `dot` marks a term with fresh results. */
export const termTabs = [
  { id: 't1', label: 'Term 1', hasResults: true },
  { id: 't2', label: 'Term 2', hasResults: true, current: true, isNew: true },
  { id: 't3', label: 'Term 3', hasResults: false },
];

/**
 * Per-subject trend for the detail sheet: each subject's Term 1 score beside its
 * Term 2 score, so a tap on "Mathematics 79" can show the jump rather than
 * asserting it.
 */
export const subjectTrends = {
  Mathematics: 79 - 66,
};
