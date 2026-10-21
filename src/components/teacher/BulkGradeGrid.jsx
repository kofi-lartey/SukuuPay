import { useMemo, useRef } from 'react';
import GradePill from './GradePill';
import {
  calculateTotalScore,
  hasBothScores,
  rankByTotal,
  CLASS_SCORE_MAX,
  EXAM_SCORE_MAX,
} from '../../utils/gradeBands';

/**
 * The whole class's marks, in the shape a Ghanaian terminal report prints them.
 *
 * ## Two marks per student, not one
 *
 * A subject on a Ghanaian report card is a **Class Score (out of 50)** and an
 * **Exam Score (out of 100)**, and the Total, the Grade and the Subject
 * Position are all derived from the pair. So the grid has two inputs per
 * student, and the total and the letter are shown live as the teacher types —
 * the teacher sees the same number the report card will carry, before anything
 * has been saved or approved, and before they have to ask the headteacher what
 * the total came out as.
 *
 * ## The values live in the parent page
 *
 * Values live in a `{ studentId: { classScore, examScore } }` map owned by the
 * parent page, so this component is a controlled view of them: it never holds
 * grade state itself, and a save, a reset or a re-hydration from the server is
 * one object assignment rather than thirty. That is also what makes "Save
 * sends the entire class in one call" trivially true — the payload is the map,
 * flattened.
 *
 * ## Enter moves down the column
 *
 * Enter moves to the next student's *same* field rather than the next student
 * outright, because the workflow is column-at-a-time: a teacher marks the
 * whole class's continuous assessment, then the whole class's exam. Tab
 * crosses to the other column; Enter is what a teacher's right hand does
 * anyway, and the numeric keypad on a phone puts it where the thumb already
 * is.
 *
 * ## Nothing is shown before it is known
 *
 * An empty cell shows a dash, not a zero, and the total and grade appear only
 * once **both** halves are in. A total computed from one half reads as a
 * result and is not one — the same rule the report-card compiler follows.
 */
const BulkGradeGrid = ({
  students,
  values,
  onChange,
  maxClassScore = CLASS_SCORE_MAX,
  maxExamScore = EXAM_SCORE_MAX,
}) => {
  const inputRefs = useRef({});

  /**
   * Where each student currently stands in this subject.
   *
   * Ranked from the values the teacher is typing, with the same competition
   * ranking the report card uses, so the position in the grid is the position
   * the card will print. A student whose pair is not finished is left out of
   * the ranking entirely: a half-marked subject has no total to place on, and
   * an unranked student in the middle of a table reads as a fail.
   */
  const positions = useMemo(() => {
    const entries = students
      .map((student) => {
        const row = values[student._id] || {};
        if (!hasBothScores(row.classScore, row.examScore)) return null;
        const { totalScore } = calculateTotalScore(
          row.classScore,
          maxClassScore,
          row.examScore,
          maxExamScore
        );
        return { id: student._id, totalScore };
      })
      .filter(Boolean);
    return rankByTotal(entries);
  }, [students, values, maxClassScore, maxExamScore]);

  const handleKeyDown = (event, studentId, field) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const ids = students.map((s) => s._id);
    const index = ids.indexOf(studentId);
    const nextId = ids[index + 1];
    if (nextId && inputRefs.current[`${nextId}:${field}`]) {
      inputRefs.current[`${nextId}:${field}`].focus();
    }
  };

  const scoreCell = (student, field, value, maxScore, label) => {
    const numeric = Number(value);
    const invalid =
      value !== '' &&
      value !== null &&
      value !== undefined &&
      (!Number.isFinite(numeric) || numeric < 0 || numeric > maxScore);

    return (
      <div className="flex items-center gap-1.5">
        <label
          htmlFor={`grade-${student._id}-${field}`}
          className="w-[64px] shrink-0 text-[9.5px] font-extrabold uppercase tracking-tight text-slate-400 sm:hidden"
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
          className={`h-11 w-[68px] rounded-xl border bg-white text-center text-[14px] font-extrabold tabular-nums text-ink focus:outline-none focus:ring-1 ${
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
      {/* The column heads, on the widths where there is room for them. */}
      <div className="mb-1 hidden items-center justify-end gap-2 sm:flex">
        <div className="flex items-center gap-1.5">
          {/*
            The heads name the maximum as well as the mark. A column headed
            "Class" is a word; a column headed "Class (50)" says what the
            number in it is out of, which is the thing a teacher checks their
            own marking against.
          */}
          <span className="w-[68px] text-center text-[9.5px] font-extrabold uppercase tracking-tight text-slate-500">
            Class (50)
          </span>
          <span className="w-[68px] text-center text-[9.5px] font-extrabold uppercase tracking-tight text-slate-500">
            Exam (100)
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
      </div>

      <ul className="divide-y divide-slate-100">
        {students.map((student) => {
          const row = values[student._id] || {};
          const classScore = row.classScore ?? '';
          const examScore = row.examScore ?? '';

          // The live preview of the report card's own arithmetic.
          const complete = hasBothScores(classScore, examScore);
          const { totalScore, grade } = calculateTotalScore(
            classScore,
            maxClassScore,
            examScore,
            maxExamScore
          );

          return (
            <li
              key={student._id}
              className="flex flex-wrap items-center gap-x-2 gap-y-2 py-2.5"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-extrabold text-slate-600">
                {student.initials || student.studentName?.slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-[140px] flex-1">
                <p className="truncate text-[13px] font-extrabold text-ink">
                  {student.studentName}
                </p>
                <p className="truncate text-[11px] text-slate-500">{student.studentId}</p>
              </div>

              <div className="ml-auto flex items-center gap-2">
                {scoreCell(student, 'classScore', classScore, maxClassScore, 'Class (50)')}
                {scoreCell(student, 'examScore', examScore, maxExamScore, 'Exam (100)')}

                <div className="w-8 text-center">
                  <span className="text-[15px] font-extrabold tabular-nums text-ink">
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
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default BulkGradeGrid;
