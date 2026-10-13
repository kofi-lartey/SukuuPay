import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CalendarCheck, ClipboardList, FileText, Users } from 'lucide-react';
import { useClassSummary } from '../../hooks/teacher/useClassSummary';
import { useClassRoster } from '../../hooks/teacher/useAttendance';
import { TEACHER_ROUTES } from '../../utils/constants';
import GradePill from '../../components/teacher/GradePill';
import ErrorBanner from '../../components/parent/shared/ErrorBanner';

const TERMS = ['Term 1', 'Term 2', 'Term 3'];

const ACTIONS = (className) => [
  {
    key: 'attendance',
    label: 'Take attendance',
    to: TEACHER_ROUTES.attendanceFor(className),
    icon: CalendarCheck,
  },
  {
    key: 'grades',
    label: 'Enter grades',
    to: TEACHER_ROUTES.gradesFor(className),
    icon: ClipboardList,
  },
  {
    key: 'records',
    label: 'Terminal reports',
    to: TEACHER_ROUTES.recordsFor(className),
    icon: FileText,
  },
];

/**
 * One class, at a glance.
 *
 * Three numbers — average, attendance rate, class rank — because those are the
 * three a class teacher is asked for by a parent at the gate, and they are the
 * three that change by term. The term selector therefore sits directly under
 * them rather than at the top of the page, where it would be a filter for
 * something the reader has not seen yet.
 *
 * The three actions below are the same destinations as the dashboard's quick
 * actions, scoped to this class. Repeating them is deliberate: the dashboard
 * asks "what do you want to do?" and this page asks "what do you want to do
 * *to JHS 2A*?", and those are different questions at different moments.
 */
const ClassDetail = () => {
  const { className } = useParams();
  const [term, setTerm] = useState('Term 2');
  const { data: summary, isLoading: loadingSummary, error: summaryError, refetch: refetchSummary } =
    useClassSummary(className, { term });
  const { data: roster, isLoading: loadingRoster } = useClassRoster(className);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
            <Users className="h-6 w-6" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[17px] font-extrabold tracking-tight text-ink">{className}</p>
            <p className="text-[12.5px] text-slate-500">
              {loadingRoster ? 'Loading…' : `${roster?.length || 0} students`}
            </p>
          </div>
        </div>

        {summaryError ? (
          <div className="mt-4">
            <ErrorBanner
              message={summaryError.message || 'The class summary could not be loaded.'}
              onRetry={refetchSummary}
            />
          </div>
        ) : loadingSummary ? (
          <div className="mt-4 h-16 animate-pulse rounded-xl bg-slate-100" />
        ) : summary ? (
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <p className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-400">
                Average
              </p>
              <p className="mt-1 text-[16px] font-extrabold tabular-nums text-ink">
                {summary.average}%
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <p className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-400">
                Attendance
              </p>
              <p className="mt-1 text-[16px] font-extrabold tabular-nums text-ink">
                {summary.attendanceRate}%
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <p className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-400">
                Rank
              </p>
              <p className="mt-1 text-[16px] font-extrabold tabular-nums text-ink">
                #{summary.rankOfClasses}
              </p>
            </div>
          </div>
        ) : null}
      </div>

      {/* Actions */}
      <div className="grid grid-cols-3 gap-2">
        {ACTIONS(className).map((action) => (
          <Link
            key={action.key}
            to={action.to}
            className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200/80 bg-white p-3 text-center transition-colors hover:border-sky-200 hover:bg-sky-50"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
              <action.icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="text-[11px] font-extrabold leading-tight text-slate-700">
              {action.label}
            </span>
          </Link>
        ))}
      </div>

      {/* Term filter — the numbers above are the thing it filters. */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {TERMS.map((t) => {
          const active = t === term;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTerm(t)}
              className={`min-h-[44px] shrink-0 rounded-full px-3.5 py-1.5 text-[12.5px] font-extrabold transition-colors ${
                active
                  ? 'bg-sky-600 text-white'
                  : 'border border-slate-200 bg-white text-slate-600'
              }`}
            >
              {t}
            </button>
          );
        })}
      </div>

      {/* Top 5 students */}
      {summary?.topStudents?.length ? (
        <section className="rounded-2xl border border-slate-200/80 bg-white p-4">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
            Top performers
          </p>
          <ul className="mt-3 space-y-2">
            {summary.topStudents.slice(0, 5).map((s, i) => (
              <li key={s.studentId} className="flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[11px] font-extrabold text-amber-800">
                  {i + 1}
                </span>
                <p className="min-w-0 flex-1 truncate text-[13px] font-extrabold text-ink">
                  {s.studentName}
                </p>
                <GradePill grade={s.grade} />
                <span className="w-10 shrink-0 text-right text-[12.5px] font-extrabold tabular-nums text-slate-600">
                  {s.average}%
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
};

export default ClassDetail;
