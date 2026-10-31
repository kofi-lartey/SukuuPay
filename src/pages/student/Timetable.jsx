import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getStudentTimetable } from '../../services/student';
import { Calendar, Loader2, AlertCircle, RefreshCw } from 'lucide-react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const Timetable = () => {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['student-timetable'],
    queryFn: () => getStudentTimetable(),
    staleTime: 60 * 1000,
    select: (response) => response?.data?.data || response?.data || {},
  });

  const timetable = data || {};
  const days = timetable.days || {};

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-amber-600" />
          <p className="text-[13px] font-semibold text-amber-900">Could not load timetable.</p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-3 py-1.5 text-[12px] font-extrabold text-white hover:bg-amber-700 disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
          <Calendar className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">Timetable</h1>
          <p className="text-[13px] font-semibold text-slate-500">
            {timetable.className ? `${timetable.className} · ${timetable.term}` : 'Your class schedule'}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm overflow-x-auto">
        <div className="min-w-[640px] grid grid-cols-6 gap-2">
          <div />
          {DAYS.map((day) => (
            <div key={day} className="text-[12px] font-extrabold text-slate-500 text-center">
              {day.slice(0, 3)}
            </div>
          ))}
          {(() => {
            const maxPeriods = Math.max(...DAYS.map((d) => (days[d] || []).length), 0);
            const rows = [];
            for (let i = 0; i < maxPeriods; i += 1) {
              rows.push(
                <React.Fragment key={i}>
                  <div className="text-[11px] font-bold text-slate-400 flex items-center">
                    {days[DAYS[0]]?.[i]?.startTime || `P${i + 1}`}
                  </div>
                  {DAYS.map((day) => {
                    const period = (days[day] || [])[i];
                    return (
                      <div
                        key={`${day}-${i}`}
                        className="rounded-xl border border-slate-100 bg-slate-50 p-2 min-h-[60px]"
                      >
                        {period ? (
                          <>
                            <p className="text-[11.5px] font-bold text-ink leading-tight">{period.subject}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">{period.teacher || ''}</p>
                            <p className="text-[10px] text-slate-400">{period.startTime}–{period.endTime}</p>
                          </>
                        ) : (
                          <p className="text-[10px] text-slate-300">—</p>
                        )}
                      </div>
                    );
                  })}
                </React.Fragment>
              );
            }
            return rows;
          })()}
        </div>
      </div>

      {DAYS.every((d) => !(days[d] || []).length) && (
        <p className="text-[12px] text-slate-500 text-center py-6">No timetable published yet</p>
      )}
    </div>
  );
};

export default Timetable;
