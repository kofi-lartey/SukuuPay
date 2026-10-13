import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Search, Users } from 'lucide-react';
import { useParams } from 'react-router-dom';
import {
  useClassRoster,
  useAttendanceForDate,
  useMarkAttendanceBulk,
} from '../../hooks/teacher/useAttendance';
import { useMyClasses } from '../../hooks/teacher/useMyClasses';
import ClassPicker from '../../components/teacher/ClassPicker';
import StudentAttendanceRow from '../../components/teacher/StudentAttendanceRow';
import { SkeletonRow } from '../../components/parent/shared/Skeleton';
import EmptyState from '../../components/parent/shared/EmptyState';
import useToast from '../../hooks/useToast';

/** Local date, not UTC. Ghana is on GMT so the two agree, but the register is a local artefact. */
const todayISO = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

/**
 * The register: mark a class present, late or absent for one date.
 *
 * ## Local state, sent once
 *
 * Marks live in a `{ studentId: mark }` map held locally and written to the
 * server in a single call. That is what makes the toggles feel instant — a
 * teacher down a register of thirty taps each one and does not wait for a
 * round trip between students — and it is why "Submit attendance (n)" is the
 * only save: the register is drafted here and committed at the end.
 *
 * ## Hydration
 *
 * On arrival the map is replaced by whatever the server already holds for this
 * class and date, so reopening today's register shows the teacher's earlier
 * work rather than an empty sheet they might overwrite. It is keyed on
 * `className`/`date`/settling, not on the query result object: React Query's
 * `select` runs on every render (see `#selectFn` in `queryObserver.js`), so
 * `existing` is a fresh array each render and an effect depending on it would
 * loop forever.
 *
 * Only marked students are submitted. A student the teacher skipped is not an
 * absent they failed to tap — it is an unknown, and inventing a status for it
 * would put a wrong mark in a permanent record.
 */
const TakeAttendance = () => {
  const { className: routeClassName } = useParams();
  const [className, setClassName] = useState(routeClassName || '');
  const [date, setDate] = useState(todayISO());
  const [marks, setMarks] = useState({});
  const [search, setSearch] = useState('');
  const toast = useToast();

  const { data: classes, isLoading: loadingClasses } = useMyClasses();
  const { data: roster, isLoading: loadingRoster } = useClassRoster(className);
  const { data: existing, isLoading: settlingExisting } = useAttendanceForDate(className, date);
  const save = useMarkAttendanceBulk();

  // The dashboard links straight to a class, so the route wins on arrival.
  useEffect(() => {
    if (routeClassName) setClassName(routeClassName);
  }, [routeClassName]);

  /*
    Hydrate the local draft from whatever the server already holds for this
    class and date, so reopening today's register shows the teacher's earlier
    work rather than an empty sheet they might overwrite.

    This runs **during render**, not in an effect, and that is the whole point:
    an effect fires after paint, so the register would first appear completely
    unmarked and then fill in — a teacher who saved an hour ago reads that as
    "my marks are gone". Deriving the draft in the render pass means the roster
    and its marks arrive in the same frame.

    The identity is compared by *value*, not by reference. React Query re-runs
    `select` on every render (its function is inline, so its identity changes),
    and while structural sharing usually hands back the same object, a payload
    with no `marks` key yields a fresh `[]` each time — an identity compared by
    reference would re-draft forever.
  */
  const [draftedFrom, setDraftedFrom] = useState(null);
  const draftKey =
    existing && !settlingExisting
      ? existing
          .map((m) => `${m.studentId ?? m._id}:${m.status ?? ''}:${m.arrivalTime ?? ''}`)
          .join('|')
      : null;

  if (draftedFrom !== draftKey) {
    setDraftedFrom(draftKey);
    const next = {};
    for (const mark of existing || []) {
      const id = mark.studentId ?? mark._id;
      if (id) next[id] = mark;
    }
    setMarks(next);
  }

  const filtered = useMemo(() => {
    if (!roster) return [];
    const q = search.trim().toLowerCase();
    if (!q) return roster;
    return roster.filter(
      (s) => s.studentName?.toLowerCase().includes(q) || s.studentId?.toLowerCase().includes(q)
    );
  }, [roster, search]);

  const stats = useMemo(() => {
    const total = roster?.length || 0;
    const marked = Object.values(marks).filter((m) => m.status).length;
    return { total, marked, remaining: total - marked };
  }, [roster, marks]);

  const setStudentStatus = (studentId, status) => {
    setMarks((current) => ({
      ...current,
      [studentId]: {
        ...(current[studentId] || {}),
        // A hand-set status is never "auto-marked", whatever the row said before.
        autoMarked: false,
        studentId,
        status,
        arrivalTime: status === 'present' || status === 'late' ? new Date().toISOString() : null,
      },
    }));
  };

  const markAllPresent = () => {
    const next = { ...marks };
    for (const s of roster || []) {
      next[s._id] = {
        studentId: s._id,
        status: 'present',
        arrivalTime: new Date().toISOString(),
      };
    }
    setMarks(next);
  };

  const handleSubmit = async () => {
    const payload = {
      date,
      className,
      marks: Object.values(marks)
        .filter((m) => m.status)
        .map((m) => ({
          studentId: m.studentId ?? m._id,
          status: m.status,
          arrivalTime: m.arrivalTime,
        })),
    };
    if (!payload.marks.length) {
      toast.error('No students marked. Tap present/late/absent for each student.');
      return;
    }
    try {
      await save.mutateAsync(payload);
      toast.success(`Saved attendance for ${payload.marks.length} students`);
    } catch (err) {
      toast.error(err.message || 'Could not save attendance.');
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="space-y-2">
        <ClassPicker
          classes={classes || []}
          value={className}
          onChange={setClassName}
        />
        {/*
          Only offered to a teacher whose classes have not been assigned in the
          API yet. With classes present the picker above is the whole control,
          and a second way to type a class name is one of them too many.
        */}
        {!loadingClasses && !classes?.length ? (
          <input
            type="text"
            aria-label="Class name"
            placeholder="e.g. JHS 2A"
            value={className}
            onChange={(e) => setClassName(e.target.value)}
            className="min-h-[44px] w-full rounded-xl border border-slate-200 px-3 py-2.5 text-[14px]"
          />
        ) : null}
        <input
          type="date"
          aria-label="Attendance date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="min-h-[44px] w-full rounded-xl border border-slate-200 px-3 py-2.5 text-[14px]"
        />
      </div>

      {/* Progress + bulk actions */}
      {className && roster?.length ? (
        <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-white p-3">
          <div className="flex items-center justify-between">
            <p className="text-[12.5px] font-extrabold text-ink">
              {stats.marked} of {stats.total} marked
            </p>
            <p className="text-[11.5px] font-semibold text-slate-500">
              {stats.remaining} remaining
            </p>
          </div>
          {/*
            The bar is the teacher's place in the register. Without it, "am I
            done?" is answered by scrolling to the bottom and counting names.
          */}
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-sky-600 transition-all"
              style={{ width: `${stats.total > 0 ? (stats.marked / stats.total) * 100 : 0}%` }}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={markAllPresent}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-[12px] font-extrabold text-white transition-colors hover:bg-emerald-700"
            >
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              Mark all present
            </button>
            <button
              type="button"
              onClick={() => setMarks({})}
              className="inline-flex min-h-[44px] items-center rounded-xl border border-slate-200 px-3 text-[12px] font-extrabold text-slate-700 transition-colors hover:bg-slate-50"
            >
              Reset
            </button>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              type="search"
              aria-label="Search students"
              placeholder="Search students…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-[13px]"
            />
          </div>
        </div>
      ) : null}

      {/* Roster */}
      {!className ? (
        <EmptyState
          icon={Users}
          title="Pick a class to begin"
          description="Choose a class above to take attendance."
        />
      ) : loadingRoster || settlingExisting ? (
        <div className="space-y-2">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : !roster?.length ? (
        <EmptyState
          icon={Users}
          title="No students in this class"
          description="Check the class name, or ask your school administrator to assign students."
        />
      ) : !filtered.length ? (
        <EmptyState
          icon={Users}
          title="No students found"
          description="Check the class name or clear the search."
        />
      ) : (
        <ul className="rounded-2xl border border-slate-200/80 bg-white px-4">
          {filtered.map((student) => (
            <StudentAttendanceRow
              key={student._id}
              student={student}
              mark={marks[student._id]}
              onChange={(status) => setStudentStatus(student._id, status)}
              disabled={save.isPending}
            />
          ))}
        </ul>
      )}

      {/* Save bar. Anchored above the bottom nav on mobile, inside the flow on desktop. */}
      {className && roster?.length ? (
        <div className="sticky bottom-20 z-20 -mx-4 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 lg:bottom-4 lg:mx-0 lg:rounded-2xl lg:border">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={save.isPending || stats.marked === 0}
            className="min-h-[44px] w-full rounded-xl bg-sky-600 text-[14px] font-extrabold text-white transition-colors hover:bg-sky-700 disabled:opacity-50"
          >
            {save.isPending ? 'Saving…' : `Submit attendance (${stats.marked})`}
          </button>
        </div>
      ) : null}
    </div>
  );
};

export default TakeAttendance;
