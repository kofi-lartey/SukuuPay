import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getStudentAttendance } from '../../services/student';
import { CalendarCheck, Loader2, AlertCircle, RefreshCw } from 'lucide-react';

const Attendance = () => {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['student-attendance', page],
    queryFn: () => getStudentAttendance({ page, perPage: 30 }),
    staleTime: 60 * 1000,
    select: (response) => response?.data?.data || response?.data || {},
  });

  const attendance = data || {};
  const records = Array.isArray(attendance.records) ? attendance.records : [];

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
          <p className="text-[13px] font-semibold text-amber-900">Could not load attendance.</p>
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

  const rate = typeof attendance.rate === 'number' ? attendance.rate : 0;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
          <CalendarCheck className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">Attendance</h1>
          <p className="text-[13px] font-semibold text-slate-500">Your daily attendance record</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Rate</p>
          <p className="text-2xl font-extrabold text-ink mt-1">{rate}%</p>
          <div className="mt-3 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(Math.max(rate, 0), 100)}%` }} />
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Present</p>
          <p className="text-2xl font-extrabold text-ink mt-1">{attendance.present ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Absent</p>
          <p className="text-2xl font-extrabold text-ink mt-1">{attendance.absent ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Late</p>
          <p className="text-2xl font-extrabold text-ink mt-1">{attendance.late ?? 0}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-[15px] font-extrabold text-ink mb-3">Recent Records</h2>
        {records.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {records.slice(0, 40).map((r, idx) => (
              <span
                key={idx}
                className={`text-[10.5px] font-extrabold px-2 py-0.5 rounded-md ${
                  r.status === 'present'
                    ? 'bg-emerald-100 text-emerald-700'
                    : r.status === 'late'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-rose-100 text-rose-700'
                }`}
              >
                {new Date(r.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-[12px] text-slate-500 text-center py-6">No attendance records</p>
        )}
        {attendance.meta?.totalPages > page && (
          <div className="mt-3 text-center">
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              className="rounded-xl bg-slate-100 px-3 py-1.5 text-[12px] font-bold text-slate-700 hover:bg-slate-200"
            >
              Load more
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Attendance;
