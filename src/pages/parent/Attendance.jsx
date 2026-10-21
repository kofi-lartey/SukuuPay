import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarCheck, ChevronDown } from 'lucide-react';
import { useParentPay } from '../../layouts/ParentLayout';
import { useAttendance } from '../../hooks/parent/useAttendance';
import { formatDate } from '../../utils/parentFormat';
import {
  defaultTermForSchool,
  monthKeyOf,
  resolveExpandedMonth,
  toggleExpandedMonth,
} from '../../utils/attendanceDefaults';
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

const SummaryCard = ({ summary, today }) => {
  const present = summary?.present ?? 0;
  const late = summary?.late ?? 0;
  const absent = summary?.absent ?? 0;
  const excused = summary?.excused ?? 0;
  const total = Math.max(present + late + absent, 1);

  const presentPct = (present / total) * 100;
  const latePct = (late / total) * 100;
  const absentPct = (absent / total) * 100;
  // The same rule the server applies: a late mark is an attendance, and an
  // excused day is not scored. The fallback here exists only for a payload
  // that arrived without a summary, and it must not quote a different number
  // from the one the server would.
  const rate =
    summary?.rate ?? Math.round(((present + late) / total) * 1000) / 10;

  return (
    <div className="rounded-2xl border border-emerald-200/60 bg-[#EAF7F0] p-5">
      <p className="text-[40px] font-extrabold leading-none tabular-nums text-[#0A5C36]">
        {rate}%
      </p>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="text-[12px] font-bold uppercase tracking-wider text-emerald-800/70">
          Attendance rate
        </p>
        {/*
          The school's current date, as the server saw it. A parent opening this
          page is asking "how has my child been this month", and the answer
          only means something if they know which day "this month" ends on.
        */}
        {today ? (
          <p className="text-[12px] font-semibold text-emerald-800/70">
            Today · {formatDate(today)}
          </p>
        ) : null}
      </div>

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
        {excused > 0 ? <StatusPill tone="sky">Excused · {excused} days</StatusPill> : null}
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
            {month.excused ? ` · ${month.excused} excused` : ''}
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
                      : day.status === 'excused'
                        ? 'bg-[#DBEAFE] text-[#1E40AF]'
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
    entry.status === 'present'
      ? 'green'
      : entry.status === 'late'
        ? 'amber'
        : entry.status === 'excused'
          ? 'sky'
          : 'red';

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

  /*
    The term this page opens on is the school's current term — the one its
    Settings screen writes, and the one the server resolves every attendance
    read against.

    It used to be hard-coded to "Term 1", which is a constant that is right for
    one term in three. For a school in Term 2, every request the page made
    asked for the previous term's date window, so the marks the teachers had
    actually made fell outside it: the calendar rendered, the rate read 0%, and
    the "recent activity" list was empty. Nothing on the page said the data was
    missing, because the page was not looking for it.
  */
  const schoolTerm = defaultTermForSchool(school);
  const [term, setTerm] = useState(schoolTerm);

  /*
    A term the parent picked themselves is never overridden by the school's
    setting changing under them — but a school that moves to Term 2 while the
    portal is open must not leave the page pinned to Term 1. `chosen` records
    that the parent has taken over.
  */
  const chosen = useRef(false);
  useEffect(() => {
    if (!chosen.current) setTerm(schoolTerm);
  }, [schoolTerm]);

  const handleTermChange = (next) => {
    chosen.current = true;
    setTerm(next);
  };

  /*
    Which month is open. `null` means "follow the current month" — the state the
    page opens in, because the month a parent opens this page for is the one
    they are living in. A term lists its months newest-first, so the first one
    is the *far* end of the term: the old default opened a month of days that
    have not happened yet, with the month that actually holds the marks
    collapsed underneath it.
  */
  const [expandedMonth, setExpandedMonth] = useState(null);

  const { data, isLoading, error, refetch } = useAttendance(token, { term });

  const months = useMemo(() => data?.months || [], [data]);
  const today = data?.today || null;

  const activeMonthKey = useMemo(
    () => resolveExpandedMonth(expandedMonth, months, today),
    [expandedMonth, months, today]
  );

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
        <SummaryCard summary={data.summary} today={today} />
      ) : null}

      <TermPills value={term} onChange={handleTermChange} />

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
          {months.map((month) => {
            const key = monthKeyOf(month);
            return (
              <MonthGrid
                key={key || month.label}
                month={month}
                expanded={key === activeMonthKey}
                onToggle={() =>
                  setExpandedMonth(toggleExpandedMonth(expandedMonth, key, months, today))
                }
              />
            );
          })}
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
