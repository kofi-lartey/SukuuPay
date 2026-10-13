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
import { TEACHER_ROUTES } from '../../utils/constants';

const TERMS = ['Term 1', 'Term 2', 'Term 3'];

/**
 * Enter a whole class's scores for one subject.
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
 * ## Save all, once
 *
 * The grid is a controlled view of a `{ studentId: score }` map, so "Save all
 * grades" sends the map in one call. A teacher entering thirty scores on a
 * phone should not have to save thirty times, and the server can reject the
 * batch before any of it lands.
 */
const EnterGrades = () => {
  const { className } = useParams();
  const navigate = useNavigate();
  const [term, setTerm] = useState('Term 2');
  const [subject, setSubject] = useState('');
  const [maxScore, setMaxScore] = useState(100);
  const [values, setValues] = useState({});
  const toast = useToast();

  const { data: classes, isLoading: loadingClasses } = useMyClasses();
  const { data: roster, isLoading: loadingRoster } = useClassRoster(className);
  const { data: existing, isLoading: loadingGrades } = useClassGrades(className, { term, subject });
  const save = useSaveGradesBulk();

  /*
    Re-open the grid with the scores already saved for this term and subject, so
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
  */
  const [draftedFrom, setDraftedFrom] = useState(null);
  const draftKey = existing?.students
    ? `${existing.maxScore ?? ''}:${existing.students.map((s) => `${s._id}:${s.score ?? ''}`).join('|')}`
    : null;

  if (draftedFrom !== draftKey) {
    setDraftedFrom(draftKey);
    if (existing?.students) {
      const next = {};
      for (const s of existing.students) {
        if (s.score !== undefined && s.score !== null) next[s._id] = String(s.score);
      }
      setValues(next);
      // Safe to adopt: `maxScore` is not part of the query key, and a school
      // marking out of 50 must not have every score read as a mark out of 100.
      if (existing.maxScore) setMaxScore(existing.maxScore);
    }
  }

  const stats = useMemo(() => {
    const list = Object.values(values).filter((v) => v !== '' && v !== null);
    if (!list.length) return { count: 0, average: 0 };
    const sum = list.reduce((s, v) => s + Number(v || 0), 0);
    return { count: list.length, average: Math.round((sum / list.length) * 10) / 10 };
  }, [values]);

  const handleSave = async () => {
    if (!subject.trim()) {
      toast.error('Pick a subject first.');
      return;
    }
    const payload = {
      className,
      term,
      subject: subject.trim(),
      maxScore,
      grades: Object.entries(values)
        .filter(([, v]) => v !== '' && v !== null && v !== undefined)
        .map(([studentId, score]) => ({ studentId, score: Number(score) })),
    };
    if (!payload.grades.length) {
      toast.error('No grades entered.');
      return;
    }
    try {
      await save.mutateAsync(payload);
      toast.success(`Saved ${payload.grades.length} grades`);
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
          Enter subject scores for the whole class. Grades compute automatically.
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
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject (e.g. Mathematics)"
          aria-label="Subject"
          className="min-h-[44px] rounded-xl border border-slate-200 px-3 py-2.5 text-[13px]"
        />
        <input
          type="number"
          min={1}
          max={200}
          value={maxScore}
          onChange={(e) => setMaxScore(Number(e.target.value) || 100)}
          aria-label="Maximum score"
          className="min-h-[44px] rounded-xl border border-slate-200 px-3 py-2.5 text-[13px]"
          placeholder="Max score"
        />
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
            onChange={(studentId, value) =>
              setValues((current) => ({ ...current, [studentId]: value }))
            }
            maxScore={maxScore}
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
