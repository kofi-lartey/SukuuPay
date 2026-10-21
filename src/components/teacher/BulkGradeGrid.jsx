import { useMemo, useRef } from 'react';
import GradePill from './GradePill';
import {
  calculateTotalScore,
  calculateClassScore,
  rankByTotal,
  CLASS_SCORE_MAX,
  EXAM_SCORE_MAX,
  CLASS_WEIGHT,
  EXAM_WEIGHT,
  DEFAULT_CLASS_COMPONENTS,
} from '../../utils/gradeBands';

/**
 * The teacher's grade-entry grid for one class and one subject.
 *
 * ## What is on the row
 *
 * A Ghanaian terminal report is a **30/70 split**: the class assessment is
 * worth 30% of the total and the end-of-term exam 70%. The class assessment
 * is not one mark — it is gathered across the term from the parts the school
 * runs, and the common split is class test 30%, group work 30%, homework 20%
 * and class work 20%, which out of the 30 points is 9, 9, 6 and 6.
 *
 * So a row is: one box per part of the class assessment, the class score they
 * add up to, the exam, and then the total, the grade and the position. The
 * parts are the school's, so the columns are the school's too — the server
 * sends the policy with the grade book and this renders it.
 *
 * ## Why the numbers appear while the teacher types
 *
 * The total, the grade and the position are computed here as well as on the
 * server, so a teacher sees the number the report card will carry before
 * anything is approved rather than after. The arithmetic is the server's; this
 * is the same arithmetic, pinned to the same cases in `utils/gradeBands.test.js`.
 */
const BulkGradeGrid = ({
  students = [],
  values = {},
  onChange,
  grading,
}) => {
  const inputRefs = useRef({});

  // The school's policy, with the defaults for a page that has not loaded one
  // yet. A school that runs no parts at all gets a single class-score box.
  const policy = useMemo(
    () => ({
      classMax: grading?.classMax || CLASS_SCORE_MAX,
      examMax: grading?.examMax || EXAM_SCORE_MAX,
      classWeight: grading?.classWeight || CLASS_WEIGHT,
      examWeight: grading?.examWeight || EXAM_WEIGHT,
      components: Array.isArray(grading?.components)
        ? grading.components
        : DEFAULT_CLASS_COMPONENTS,
    }),
    [grading]
  );

  const { components, classMax, examMax, classWeight, examWeight } = policy;

  /**
   * One student's numbers, as the row shows them.
   *
   * The class score is folded from the parts when the school runs them, and
   * taken from a single class score when it does not. A subject whose parts
   * are not all in has no class score and therefore no total: a half-marked
   * subject is not a result.
   */
  const rowFor = (student) => {
    const row = values[student._id] || {};

    const parts = components.map((part) => ({
      key: part.key,
      label: part.label,
      weight: part.weight,
      maxScore: part.maxScore,
      score: row[part.key] ?? '',
    }));
    const partsEntered = parts.filter(
      (part) => part.score !== '' && part.score !== null && part.score !== undefined
    );

    // The class score the row shows: folded from the parts when the school runs
    // a breakdown, or — when it does not — the single class-score box the teacher
    // is editing. Entering any part (or, in a breakdown school, a direct class
    // score left over from before the breakdown) takes over from the other, so
    // the live figure the grid previews is always the one the grid is built
    // from.
    let classScore;
    let classComplete;
    if (components.length) {
      if (partsEntered.length) {
        const folded = calculateClassScore(parts);
        classScore = folded.classScore;
        classComplete = folded.complete;
      } else if (student.classScore != null && student.classScore !== '') {
        classScore = Number(student.classScore);
        classComplete = true;
      } else {
        classScore = null;
        classComplete = false;
      }
    } else {
      const direct = row.class_score ?? '';
      classScore = direct === '' ? null : Number(direct);
      classComplete = classScore !== null;
    }
    const examScore = row.exam_score ?? '';
    const examEntered = examScore !== '' && examScore !== null && examScore !== undefined;

    const complete = Boolean(classComplete && classScore !== null && examEntered);

    const { totalScore, grade } = complete
      ? calculateTotalScore(
          classScore,
          classMax,
          examScore,
          examMax,
          { classWeight, examWeight }
        )
      : { totalScore: null, grade: null };

    return { row, parts, classScore, examScore, complete, totalScore, grade };
  };

  /**
   * Where each student currently stands in this subject.
   *
   * Ranked from the values the teacher is typing, with the same competition
   * ranking the report card uses, so the position in the grid is the position
   * the card will print. A student whose subject is not finished is left out
   * of the ranking entirely: there is nothing to place them on.
   */
  const positions = useMemo(() => {
    const entries = students
      .map((student) => {
        const { complete, totalScore } = rowFor(student);
        if (!complete) return null;
        return { id: student._id, totalScore };
      })
      .filter(Boolean);
    return rankByTotal(entries);
    // `values` is the only thing that changes the ranking; `students` and the
    // policy are read through `rowFor` and are covered by it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students, values, components, classMax, examMax, classWeight, examWeight]);

  const handleKeyDown = (e, studentId, field) => {
    if (e.key !== 'Enter' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    const index = students.findIndex((s) => s._id === studentId);
    const next = students[index + 1];
    if (!next) return;
    const target = inputRefs.current[`${next._id}:${field}`];
    if (target) target.focus();
  };

  const scoreCell = (student, field, value, maxScore, label) => {
    const numeric = Number(value);
    const invalid =
      value !== '' &&
      (!Number.isFinite(numeric) || numeric < 0 || numeric > maxScore);

    return (
      <div className="flex w-[62px] flex-col items-center gap-1 sm:flex-row sm:items-center sm:justify-center sm:gap-1.5">
        <label
          htmlFor={`grade-${student._id}-${field}`}
          className="text-center text-[9.5px] font-extrabold uppercase tracking-tight text-slate-400 sm:hidden"
        >
          {label}
        </label>
        <input
          id={`grade-${student._id}-${field}`}
          ref={(el) => {
            inputRefs.current[`${student._id}:${field}`] = el;
          }}
          type="number"
          inputMode="numeric"
          min={0}
          max={maxScore}
          value={value ?? ''}
          onChange={(e) => onChange(student._id, field, e.target.value)}
          onKeyDown={(e) => handleKeyDown(e, student._id, field)}
          aria-label={`${label} for ${student.studentName}`}
          className={`h-11 w-[62px] rounded-xl border bg-white text-center text-[14px] font-extrabold tabular-nums text-ink focus:outline-none focus:ring-1 ${
            invalid
              ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
              : 'border-slate-200 focus:border-sky-500 focus:ring-sky-500'
          }`}
          placeholder="—"
        />
      </div>
    );
  };

  return (
    <div>
      {/*
        The column heads. They name the maximum as well as the mark: a column
         headed "Class Test" is a word, a column headed "Class Test (30)" says
        what the number in it is out of.
      */}
      <div className="mb-1 hidden items-center gap-x-3 overflow-x-auto sm:flex">
        {/*
          Mirror the row beneath it: a leading flex-1 spacer stands in for the
          student-name slot, and the same gap-x-3 as the inputs, so each head
          sits directly over its box instead of drifting under justify-end.
        */}
        <div className="flex min-w-0 flex-1 items-center" />
        {components.map((part) => (
          <span
            key={part.key}
            className="w-[62px] text-center text-[9px] font-extrabold uppercase tracking-tight text-slate-500 leading-tight"
          >
            {part.label} ({part.maxScore})
          </span>
        ))}
        <span
          className={`${
            components.length ? 'w-11' : 'w-[62px]'
          } text-center text-[9px] font-extrabold uppercase tracking-tight text-slate-500 leading-tight`}
        >
          Class ({classMax})
        </span>
        <span className="w-[62px] text-center text-[9px] font-extrabold uppercase tracking-tight text-slate-500 leading-tight">
          Exam ({examMax})
        </span>
        <span className="w-8 text-center text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
          Total
        </span>
        <span className="w-10 text-center text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
          Grade
        </span>
        <span className="w-9 text-center text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
          Pos
        </span>
      </div>

      <ul className="divide-y divide-slate-100">
        {students.map((student) => {
          const { row, parts, classScore, examScore, complete, totalScore, grade } =
            rowFor(student);

          return (
            <li
              key={student._id}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5"
            >
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-extrabold text-slate-600">
                  {student.initials || (student.studentName || '?').slice(0, 2).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13.5px] font-extrabold text-ink">
                  {student.studentName}
                </span>
              </div>

              {parts.map((part) =>
                scoreCell(
                  student,
                  part.key,
                  row[part.key] ?? '',
                  part.maxScore,
                  `${part.label} (${part.maxScore})`
                )
              )}

              {components.length ? (
                <div className="w-11 flex justify-center">
                  <span className="text-[14px] font-extrabold tabular-nums text-ink">
                    {classScore ?? '—'}
                  </span>
                </div>
              ) : (
                scoreCell(
                  student,
                  'class_score',
                  row.class_score ?? '',
                  classMax,
                  `Class (${classMax})`
                )
              )}

              {scoreCell(student, 'exam_score', examScore, examMax, `Exam (${examMax})`)}

              <div className="w-8 text-center">
                <span className="text-[14px] font-extrabold tabular-nums text-ink">
                  {complete ? totalScore : '—'}
                </span>
              </div>

              <div className="w-10 text-center">
                <GradePill grade={complete ? grade : null} />
              </div>

              <div className="w-9 text-center">
                <span className="text-[13px] font-extrabold tabular-nums text-slate-600">
                  {positions.get(String(student._id)) || '—'}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default BulkGradeGrid;
