import { useMemo, useState } from 'react';
import { CalendarCheck, ChevronDown } from 'lucide-react';
import { useParentPay } from '../../layouts/ParentLayout';
import { useAttendance } from '../../hooks/parent/useAttendance';
import { formatDate } from '../../utils/parentFormat';
import StudentRow from '../../components/parent/shared/StudentRow';
import SectionLabel from '../../components/parent/shared/SectionLabel';
import StatusPill from '../../components/parent/shared/StatusPill';
import EmptyState from '../../components/parent/shared/EmptyState';
import ErrorBanner from '../../components/parent/shared/ErrorBanner';
import { SkeletonCard } from '../../components/parent/shared/Skeleton';

const TERM_OPTIONS = ['Term 1', 'Term 2', 'Term 3'];

const TermPills = ({ value, onChange }) => (
  <div className="flex gap-2 overflow-x-auto pb-1">
    {TERM_OPTIONS.map((term) => {
      const active = term === value;
      return (
        <button
          key={term}
          type="button"
          onClick={() => onChange(term)}
          className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12.5px] font-extrabold transition-colors ${
            active
              ? 'bg-[#0A5C36] text-white'
              : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300'
          }`}
        >
          {term}
        </button>
      );
    })}
  </div>
);

const SummaryCard = ({ summary }) => {
  const present = summary?.present ?? 0;
  const late = summary?.late ?? 0;
  const absent = summary?.absent ?? 0;
  const total = Math.max(present + late + absent, 1);

  const presentPct = (present / total) * 100;
  const latePct = (late / total) * 100;
  const absentPct = (absent / total) * 100;
  const rate = summary?.rate ?? Math.round((present / total) * 1000) / 10;

  return (
    <div className="rounded-2xl border border-emerald-200/60 bg-[#EAF7F0] p-5">
      <p className="text-[40px] font-extrabold leading-none tabular-nums text-[#0A5C36]">
        {rate}%
      </p>
      <p className="mt-1 text-[12px] font-bold uppercase tracking-wider text-emerald-800/70">
        Attendance rate
      </p>

      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white">
        <div className="flex h-full">
          <div className="h-full bg-[#059669]" style={{ width: `${presentPct}%` }} />
          <div className="h-full bg-[#D97706]" style={{ width: `${latePct}%` }} />
          <div className="h-full bg-[#DC2626]" style={{ width: `${absentPct}%` }} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <StatusPill tone="green">Present · {present} days</StatusPill>
        <StatusPill tone="amber">Late · {late} days</StatusPill>
        <StatusPill tone="red">Absent · {absent} days</StatusPill>
      </div>
    </div>
  );
};

const MonthGrid = ({ month, onToggle, expanded }) => {
  const dayNames = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3"
      >
        <div className="text-left">
          <p className="text-[14px] font-extrabold text-ink">{month.label}</p>
          <p className="text-[11.5px] text-slate-500">
            {month.present} present · {month.late} late · {month.absent} absent
          </p>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-slate-400 transition-transform ${
            expanded ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      {expanded ? (
        <div className="border-t border-slate-100 px-4 pb-4">
          <div className="mt-2 grid grid-cols-7 gap-1.5 text-center">
            {dayNames.map((d, i) => (
              <div
                key={`${d}-${i}`}
                className="text-[10.5px] font-extrabold uppercase text-slate-400"
              >
                {d}
              </div>
            ))}
            {month.days.map((day) => {
              const tone =
                day.status === 'present'
                  ? 'bg-[#D1FAE5] text-[#065F46]'
                  : day.status === 'late'
                    ? 'bg-[#FEF3C7] text-[#92400E]'
                    : day.status === 'absent'
                      ? 'bg-[#FEE2E2] text-[#991B1B]'
                      : day.status === 'future'
                        ? 'bg-white border border-slate-200 text-slate-400'
                        : 'bg-slate-100 text-slate-400';
              const isToday = day.isToday;

              return (
                <div
                  key={day.date}
                  className={`flex aspect-square items-center justify-center rounded-lg text-[12px] font-bold tabular-nums ${tone} ${
                    isToday ? 'ring-2 ring-[#F2B705]' : ''
                  }`}
                  title={`${formatDate(day.date)} — ${day.status}`}
                >
                  {day.day}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
};

const LogRow = ({ entry }) => {
  const tone =
    entry.status === 'present' ? 'green' : entry.status === 'late' ? 'amber' : 'red';

  return (
    <li className="border-b border-slate-100 py-3 last:border-b-0">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] font-bold text-ink">{formatDate(entry.date)}</p>
        <StatusPill tone={tone}>{entry.status}</StatusPill>
      </div>
      {entry.note ? <p className="mt-1 text-[12px] text-slate-500">{entry.note}</p> : null}
    </li>
  );
};

const Attendance = () => {
  const { token, student, school } = useParentPay();
  const [term, setTerm] = useState('Term 1');
  const [expandedMonth, setExpandedMonth] = useState(0);

  const { data, isLoading, error, refetch } = useAttendance(token, { term });

  const months = useMemo(() => data?.months || [], [data]);

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

      {isLoading ? (
        <SkeletonCard className="h-40" />
      ) : data ? (
        <SummaryCard summary={data.summary} />
      ) : null}

      <TermPills value={term} onChange={setTerm} />

      {isLoading ? (
        <>
          <SkeletonCard />
          <SkeletonCard />
        </>
      ) : !months.length ? (
        <EmptyState
          icon={CalendarCheck}
          title="No attendance recorded yet"
          description="Once school starts recording attendance for this term, you'll see the daily log here."
        />
      ) : (
        <section className="space-y-3">
          <SectionLabel className="px-1">Monthly breakdown</SectionLabel>
          {months.map((month, idx) => (
            <MonthGrid
              key={month.label}
              month={month}
              expanded={expandedMonth === idx}
              onToggle={() => setExpandedMonth(expandedMonth === idx ? -1 : idx)}
            />
          ))}
        </section>
      )}

      {!isLoading && data?.recent?.length ? (
        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <SectionLabel className="mb-2">Recent activity</SectionLabel>
          <ul>
            {data.recent.map((entry) => (
              <LogRow key={entry.date} entry={entry} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
};

export default Attendance;
