import { useRef } from 'react';
import GradePill from './GradePill';

/**
 * The whole class's scores, one column.
 *
 * Values live in a `{ studentId: score }` map owned by the parent page, so this
 * component is a controlled view of them: it never holds grade state itself, and
 * a save, a reset or a re-hydration from the server is one object assignment
 * rather than thirty. That is also what makes "Save sends the entire class in
 * one call" trivially true — the payload is the map, filtered.
 *
 * Enter moves to the next student rather than submitting, because the flow is
 * *type, Enter, type, Enter* down a register. Tab works too, but Enter is what
 * a teacher's right hand does anyway, and the numeric keypad on a phone puts
 * it where the thumb already is.
 */
const BulkGradeGrid = ({ students, values, onChange, maxScore = 100 }) => {
  const inputRefs = useRef({});

  const handleKeyDown = (event, studentId) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const ids = students.map((s) => s._id);
    const index = ids.indexOf(studentId);
    const nextId = ids[index + 1];
    if (nextId && inputRefs.current[nextId]) {
      inputRefs.current[nextId].focus();
    }
  };

  /**
   * Score → grade letter, in the school's bands.
   *
   * Same bands as `GradePill`'s tone map and for the same reason: they must
   * agree, or a score of 79 shows an A+ pill next to a B+ letter. `maxScore` is
   * respected rather than assumed to be 100, so a school marking out of 50 gets
   * the same grades instead of everyone failing.
   *
   * A non-numeric or empty cell returns `null` — an em dash — rather than
   * coercing to 0 and showing an F for a student who simply has not been
   * marked yet.
   */
  const gradeFor = (score) => {
    if (score === '' || score === null || score === undefined) return null;
    const numeric = Number(score);
    if (!Number.isFinite(numeric) || !maxScore || maxScore <= 0) return null;
    const pct = (numeric / maxScore) * 100;
    if (pct >= 80) return 'A+';
    if (pct >= 75) return 'A';
    if (pct >= 70) return 'A-';
    if (pct >= 65) return 'B+';
    if (pct >= 60) return 'B';
    if (pct >= 55) return 'B-';
    if (pct >= 50) return 'C+';
    if (pct >= 45) return 'C';
    if (pct >= 40) return 'D';
    if (pct >= 35) return 'E';
    return 'F';
  };

  return (
    <ul className="divide-y divide-slate-100">
      {students.map((student) => {
        const value = values[student._id] ?? '';
        const grade = gradeFor(value);
        const numeric = Number(value);
        const invalid =
          value !== '' && (!Number.isFinite(numeric) || numeric < 0 || numeric > maxScore);
        return (
          <li key={student._id} className="flex items-center gap-2 py-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-extrabold text-slate-600">
              {student.initials || student.studentName?.slice(0, 2).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-extrabold text-ink">{student.studentName}</p>
              <p className="truncate text-[11px] text-slate-500">{student.studentId}</p>
            </div>
            <input
              ref={(el) => {
                inputRefs.current[student._id] = el;
              }}
              type="number"
              inputMode="numeric"
              min={0}
              max={maxScore}
              value={value}
              onChange={(e) => onChange(student._id, e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, student._id)}
              aria-label={`Score for ${student.studentName}`}
              className={`h-11 w-16 rounded-xl border bg-white text-center text-[14px] font-extrabold tabular-nums text-ink focus:outline-none focus:ring-1 ${
                invalid
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                  : 'border-slate-200 focus:border-sky-500 focus:ring-sky-500'
              }`}
              placeholder="—"
            />
            <GradePill grade={grade} />
          </li>
        );
      })}
    </ul>
  );
};

export default BulkGradeGrid;
