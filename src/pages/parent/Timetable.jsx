import { useMemo, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { useParentPay } from '../../layouts/ParentLayout';
import { useTimetable } from '../../hooks/parent/useTimetable';
import StudentRow from '../../components/parent/shared/StudentRow';
import EmptyState from '../../components/parent/shared/EmptyState';
import ErrorBanner from '../../components/parent/shared/ErrorBanner';
import { SkeletonRow } from '../../components/parent/shared/Skeleton';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const dayIndexToName = (index) => DAYS[index] || DAYS[0];

const startOfWeek = (date) => {
  const d = new Date(date);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - (day - 1));
  d.setHours(0, 0, 0, 0);
  return d;
};

const PeriodCard = ({ period }) => {
  const color = period.subjectColor || '#0A5C36';
  const ongoing = period.ongoing;

  return (
    <div className="relative flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white p-3.5">
      <span
        className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      <div className="ml-2 min-w-0 flex-1">
        <p className="text-[11.5px] font-bold uppercase tracking-wider text-slate-400">
          {period.startTime} – {period.endTime}
        </p>
        <p className="mt-0.5 truncate text-[14px] font-extrabold text-ink">
          {period.subject}
        </p>
        <p className="mt-0.5 truncate text-[12px] text-slate-500">
          {period.teacher || '—'}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-extrabold text-slate-600">
          {period.room || '—'}
        </span>
        {ongoing ? (
          <span className="inline-flex items-center gap-1 text-[10.5px] font-extrabold text-emerald-700">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            Now
          </span>
        ) : null}
      </div>
    </div>
  );
};

const Timetable = () => {
  const { token, student, school } = useParentPay();
  const [weekOf, setWeekOf] = useState(() => startOfWeek(new Date()));
  const [selectedDay, setSelectedDay] = useState(() => {
    const d = new Date().getDay();
    return d >= 1 && d <= 5 ? dayIndexToName(d - 1) : DAYS[0];
  });

  const { data, isLoading, error, refetch } = useTimetable(token, {
    weekOf: weekOf.toISOString().slice(0, 10),
  });

  const periods = useMemo(() => {
    if (!data?.days) return [];
    return data.days[selectedDay] || [];
  }, [data, selectedDay]);

  const shiftWeek = (direction) => {
    const next = new Date(weekOf);
    next.setDate(next.getDate() + direction * 7);
    setWeekOf(startOfWeek(next));
  };

  if (error) {
    return (
      <div className="space-y-4">
        <StudentRow student={student} school={school} />
        <ErrorBanner message={error.message} onRetry={refetch} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <StudentRow student={student} school={school} />

      {/* Week selector */}
      <div className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white px-3 py-2 shadow-sm">
        <button
          type="button"
          onClick={() => shiftWeek(-1)}
          aria-label="Previous week"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <p className="text-[13px] font-extrabold text-ink">
          Week of{' '}
          {weekOf.toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </p>
        <button
          type="button"
          onClick={() => shiftWeek(1)}
          aria-label="Next week"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {/* Day tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {DAYS.map((day) => {
          const active = day === selectedDay;
          return (
            <button
              key={day}
              type="button"
              onClick={() => setSelectedDay(day)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12.5px] font-extrabold transition-colors ${
                active
                  ? 'bg-[#0A5C36] text-white'
                  : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              {day.slice(0, 3)}
            </button>
          );
        })}
      </div>

      {/* Periods */}
      {isLoading ? (
        <div className="space-y-2">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : periods.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No classes on this day"
          description="Enjoy the day off, or check another day of the week."
        />
      ) : (
        <div className="space-y-2">
          {periods.map((period, i) => (
            <PeriodCard key={`${period.subject}-${i}`} period={period} />
          ))}
        </div>
      )}
    </div>
  );
};

export default Timetable;
