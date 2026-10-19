import { BookOpen } from 'lucide-react';
import { useMySchedule } from '../../hooks/teacher/useDashboard';
import { SkeletonCard } from '../../components/parent/shared/Skeleton';
import EmptyState from '../../components/parent/shared/EmptyState';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

/**
 * The week's timetable.
 *
 * Grouped by day rather than a flat list of periods, because the question a
 * teacher asks it is "what do I have on Wednesday" — and a flat list sorted by
 * time answers "what is next" instead, which the dashboard already does.
 *
 * Every day is rendered even when it is empty. A missing Thursday reads as a
 * rendering failure or as a day off that was never decided; "No classes" under
 * the Thursday heading is an answer.
 *
 * The colour bar comes from the timetable's own `subjectColor`, falling back
 * to the sky accent. A teacher scanning for their Mathematics block reads the
 * colour before the words.
 */
const statusTone = (status) => {
  if (status === 'marked') return 'bg-emerald-100 text-emerald-800';
  if (status === 'missed') return 'bg-rose-100 text-rose-800';
  if (status === 'pending') return 'bg-amber-100 text-amber-800';
  return 'bg-slate-100 text-slate-700';
};

const TeacherSchedule = () => {
  const { data: schedule, isLoading } = useMySchedule();

  const byDay = DAYS.reduce((acc, day) => {
    acc[day] = (schedule || []).filter((p) => p.day === day);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      {isLoading ? (
        <>
          <SkeletonCard />
          <SkeletonCard />
        </>
      ) : !schedule?.length ? (
        <EmptyState
          icon={BookOpen}
          title="No schedule yet"
          description="Your class schedule will appear here once published by the school."
        />
      ) : (
        DAYS.map((day) => (
          <section key={day}>
            <h3 className="mb-2 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              {day}
            </h3>
            {byDay[day].length === 0 ? (
              <p className="text-[12.5px] italic text-slate-400">No classes</p>
            ) : (
              <ul className="space-y-2">
                {byDay[day].map((period) => {
                  const timeUp = period.status === 'marked' || period.status === 'missed';
                  return (
                  <li
                    key={`${period.className}-${period.subject}-${period.startTime}`}
                    className={`flex items-center gap-3 rounded-xl border p-3 ${
                      timeUp
                        ? 'border-emerald-200 bg-emerald-50'
                        : 'border-slate-200/80 bg-white'
                    }`}
                  >
                    <span
                      className="h-9 w-1 shrink-0 rounded-full"
                      style={{ backgroundColor: timeUp ? '#059669' : (period.subjectColor || '#0284C7') }}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-extrabold text-ink">
                        {period.className} · {period.subject}
                      </p>
                      <p className="mt-0.5 text-[11.5px] text-slate-500">
                        {period.startTime} – {period.endTime}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-lg px-2 py-0.5 text-[11px] font-extrabold ${statusTone(period.status)}`}>
                      {period.status}
                    </span>
                    <span className="shrink-0 rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-extrabold text-slate-600">
                      {period.room || '—'}
                    </span>
                  </li>
                  );
                })}
              </ul>
            )}
          </section>
        ))
      )}
    </div>
  );
};

export default TeacherSchedule;
