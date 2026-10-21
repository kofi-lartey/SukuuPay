import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ClipboardList, Save } from 'lucide-react';
import { useClassGrades, useSaveGradesBulk } from '../../hooks/teacher/useGrades';
import { useClassRoster } from '../../hooks/teacher/useAttendance';
import { useMyClasses } from '../../hooks/teacher/useMyClasses';
import BulkGradeGrid from '../../components/teacher/BulkGradeGrid';
import ClassPicker from '../../components/teacher/ClassPicker';
import { SkeletonRow } from '../../components/parent/shared/Skeleton';
import EmptyState from '../../components/parent/shared/EmptyState';
import useToast from '../../hooks/useToast';
import { TEACHER_ROUTES, SUBJECTS, OTHER_SUBJECT, CUSTOM_SUBJECTS_KEY } from '../../utils/constants';
import { calculateTotalScore, hasBothScores, CLASS_SCORE_MAX, EXAM_SCORE_MAX } from '../../utils/gradeBands';

const TERMS = ['Term 1', 'Term 2', 'Term 3'];

/**
 * Enter a whole class's marks for one subject.
 *
 * ## One grade column per subject
 *
 * A class has Mathematics, English, Science and the rest, and they are separate
 * columns, so `subject` is a filter on the query rather than a label. That is
 * why `useClassGrades` keys on it — see the note there — and why switching
 * subject replaces the grid instead of merging into it. Two subjects' scores
 * sitting in one column is the single most damaging mistake this page can
 * make, and it is the one a naive implementation invites.
 *
 * ## Two marks per student
 *
 * A Ghanaian terminal report breaks a subject into a **Class Score (out of
 * 50)** and an **Exam Score (out of 100)**, and the Total, the Grade and the
 * Subject Position come out of that pair. The grid therefore holds two values
 * per student, and the page sends both in one call — the payload is a flat
 * list of rows, each carrying the `assessmentType` it belongs to, so the
 * server knows which half of the report it is writing.
 *
 * ## Save all, once
 *
 * The grid is a controlled view of a `{ studentId: { classScore, examScore } }`
 * map, so "Save all grades" sends the map in one call. A teacher entering
 * thirty students' marks on a phone should not have to save sixty times, and
 * the server can reject the batch before any of it lands.
 */
const EnterGrades = () => {
  const { className } = useParams();
  const navigate = useNavigate();
  const [term, setTerm] = useState('Term 2');
  const [subject, setSubject] = useState('');
  const [values, setValues] = useState({});
  const [customSubjects, setCustomSubjects] = useState(() => {
    try {
      const raw = localStorage.getItem(CUSTOM_SUBJECTS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const toast = useToast();

  const allSubjectOptions = useMemo(() => {
    const base = SUBJECTS.filter((s) => s.value !== OTHER_SUBJECT).concat(
      customSubjects.map((name) => ({ value: name, label: name }))
    );
    if (subject && !base.some((o) => o.value === subject)) {
      base.push({ value: subject, label: subject });
    }
    return base;
  }, [customSubjects, subject]);

  const handleSubjectChange = (value) => {
    if (value === OTHER_SUBJECT) {
      const name = window.prompt('New subject name');
      const trimmed = name?.trim();
      if (!trimmed) return;
      if (!customSubjects.includes(trimmed)) {
        const next = [...customSubjects, trimmed];
        setCustomSubjects(next);
        try {
          localStorage.setItem(CUSTOM_SUBJECTS_KEY, JSON.stringify(next));
        } catch {}
      }
      setSubject(trimmed);
    } else {
      setSubject(value);
    }
  };

  const { data: classes, isLoading: loadingClasses } = useMyClasses();
  const { data: roster, isLoading: loadingRoster } = useClassRoster(className);
  const { data: existing, isLoading: loadingGrades } = useClassGrades(className, { term, subject });
  const save = useSaveGradesBulk();

  /*
    Re-open the grid with the marks already saved for this term and subject, so
    a teacher who is interrupted mid-way returns to their work rather than to an
    empty column they might re-enter and overwrite.

    Derived during render for the same reason `TakeAttendance` does it: an effect
    fires after paint, so the grid would appear empty and then fill, and a
    teacher who saved an hour ago reads that flicker as "my grades are gone".

    The identity is a value string rather than the `existing` object reference.
    React Query re-runs `select` on every render because the function is inline,
    so a reference comparison is not reliable across re-renders that nothing to
    do with the grades has caused.

    **`subject` is deliberately not adopted from the response.** It is the query
    key, so setting it from the data that key fetched re-issues the query with a
    different subject, which returns a different `subject`, which re-issues it
    again — the page oscillates between two columns and never settles. The
    teacher owns that field; the server's copy is what they typed.

    Both halves of a subject are rehydrated: the class score and the exam
    score are two rows in the grade book, and restoring only one of them would
    leave the grid showing a total the server cannot reproduce.
  */
  const [draftedFrom, setDraftedFrom] = useState(null);
  const draftKey = existing?.students
    ? existing.students
        .map((s) => `${s._id}:${s.classScore ?? ''}:${s.examScore ?? ''}`)
        .join('|')
    : null;

  if (draftedFrom !== draftKey) {
    setDraftedFrom(draftKey);
    if (existing?.students) {
      const next = {};
      for (const s of existing.students) {
        const classScore = s.classScore ?? '';
        const examScore = s.examScore ?? '';
        if (classScore === '' && examScore === '') continue;
        next[s._id] = { classScore: String(classScore), examScore: String(examScore) };
      }
      setValues(next);
    }
  }

  /*
    The progress line: how many of the class have both halves, and the average
    of the totals so far.

    The average is over *complete* subjects only. A student with a class score
    but no exam score has no total yet, and averaging a half into the class
    average would report a number the report card will never carry.
  */
  const stats = useMemo(() => {
    const rows = Object.values(values);
    const withAny = rows.filter((r) => r.classScore !== '' || r.examScore !== '');
    const totals = rows
      .filter((r) => hasBothScores(r.classScore, r.examScore))
      .map((r) => calculateTotalScore(r.classScore, CLASS_SCORE_MAX, r.examScore, EXAM_SCORE_MAX).totalScore);
    const average = totals.length
      ? Math.round((totals.reduce((sum, t) => sum + t, 0) / totals.length) * 10) / 10
      : 0;
    return { count: withAny.length, complete: totals.length, average };
  }, [values]);

  const handleChange = (studentId, field, value) => {
    setValues((current) => ({
      ...current,
      [studentId]: { ...current[studentId], [field]: value },
    }));
  };

  const handleSave = async () => {
    if (!subject.trim()) {
      toast.error('Pick a subject first.');
      return;
    }

    // The payload is a flat list of rows, each one half of a subject, and each
    // carrying the assessment type it belongs to. The server's upsert key
    // includes that type, so a class score can never land on an exam score.
    const rows = [];
    for (const [studentId, row] of Object.entries(values)) {
      const classScore = row?.classScore;
      const examScore = row?.examScore;
      if (classScore !== '' && classScore !== null && classScore !== undefined) {
        rows.push({
          studentId,
          assessmentType: 'class_score',
          score: Number(classScore),
          maxScore: CLASS_SCORE_MAX,
        });
      }
      if (examScore !== '' && examScore !== null && examScore !== undefined) {
        rows.push({
          studentId,
          assessmentType: 'exam_score',
          score: Number(examScore),
          maxScore: EXAM_SCORE_MAX,
        });
      }
    }

    if (!rows.length) {
      toast.error('No grades entered.');
      return;
    }

    try {
      await save.mutateAsync({
        className,
        term,
        academicYear: existing?.academicYear,
        subject: subject.trim(),
        grades: rows,
      });
      toast.success(`Saved ${rows.length} grade ${rows.length === 1 ? 'entry' : 'entries'}`);
    } catch (err) {
      toast.error(err.message || 'Could not save grades.');
    }
  };

  // Reached as /teacher/grades with no class in the path: pick one first.
  if (!className) {
    return (
      <div className="space-y-4">
        {loadingClasses ? (
          <div className="space-y-2">
            <SkeletonRow />
            <SkeletonRow />
          </div>
        ) : classes?.length ? (
          <div className="space-y-3">
            <ClassPicker
              classes={classes}
              value=""
              onChange={(next) => navigate(TEACHER_ROUTES.gradesFor(next))}
            />
            <EmptyState
              icon={ClipboardList}
              title="Pick a class"
              description="Choose one of your classes above to enter grades."
            />
          </div>
        ) : (
          <EmptyState
            icon={ClipboardList}
            title="No classes assigned yet"
            description="Your school administrator will assign your classes before you can enter grades."
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
        <p className="text-[15px] font-extrabold text-ink">{className}</p>
        <p className="mt-0.5 text-[12.5px] text-slate-500">
          Enter the class score (50) and the exam score (100) for the whole class. Totals and
          grades compute automatically.
        </p>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-2 gap-2">
        <select
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          aria-label="Term"
          className="min-h-[44px] rounded-xl border border-slate-200 px-3 py-2.5 text-[13px]"
        >
          {TERMS.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <select
          value={subject}
          onChange={(e) => handleSubjectChange(e.target.value)}
          aria-label="Subject"
          className="min-h-[44px] rounded-xl border border-slate-200 px-3 py-2.5 text-[13px]"
        >
          <option value="">Select subject…</option>
          {allSubjectOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
          <option value={OTHER_SUBJECT}>Other…</option>
        </select>
      </div>

      {/* Stats */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-3">
        <div className="flex items-center justify-between">
          <p className="text-[12.5px] font-extrabold text-ink">
            {stats.count} of {roster?.length || 0} entered
          </p>
          <p className="text-[11.5px] font-semibold tabular-nums text-slate-500">
            Avg {stats.average}
          </p>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-sky-600 transition-all"
            style={{ width: `${roster?.length ? (stats.count / roster.length) * 100 : 0}%` }}
          />
        </div>
        {stats.count > stats.complete ? (
          <p className="mt-2 text-[11.5px] font-semibold text-slate-500">
            {stats.count - stats.complete} still waiting on an exam score — no total yet.
          </p>
        ) : null}
      </div>

      {/* Grid */}
      {loadingRoster || loadingGrades ? (
        <div className="space-y-2">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : !roster?.length ? (
        <EmptyState
          icon={ClipboardList}
          title="No students in this class"
          description="Check with your school administrator."
        />
      ) : (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
          <BulkGradeGrid
            students={roster}
            values={values}
            onChange={handleChange}
            maxClassScore={CLASS_SCORE_MAX}
            maxExamScore={EXAM_SCORE_MAX}
          />
        </div>
      )}

      {/* Save bar */}
      <div className="sticky bottom-20 z-20 -mx-4 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 lg:bottom-4 lg:mx-0 lg:rounded-2xl lg:border">
        <div className="flex items-center justify-between gap-3">
          <Link
            to={TEACHER_ROUTES.recordsFor(className)}
            className="flex min-h-[44px] items-center px-1 text-[12px] font-extrabold text-sky-700 hover:underline"
          >
            Compile reports
          </Link>
          <button
            type="button"
            onClick={handleSave}
            disabled={save.isPending || !subject.trim()}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-sky-600 px-4 text-[13.5px] font-extrabold text-white transition-colors hover:bg-sky-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            {save.isPending ? 'Saving…' : 'Save all grades'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EnterGrades;
