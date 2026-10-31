import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getStudentGrades } from '../../services/student';
import { GraduationCap, Loader2, AlertCircle, RefreshCw } from 'lucide-react';

const Grades = () => {
  const [term, setTerm] = useState('');
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['student-grades', term],
    queryFn: () => getStudentGrades(term ? { term } : {}),
    staleTime: 60 * 1000,
    select: (response) => response?.data?.data || response?.data || [],
  });

  const grades = Array.isArray(data) ? data : [];

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
          <p className="text-[13px] font-semibold text-amber-900">Could not load grades.</p>
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

  const completed = grades.filter((g) => g.complete);
  const average = completed.length
    ? Math.round((completed.reduce((s, g) => s + (g.total || 0), 0) / completed.length) * 10) / 10
    : 0;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-700">
          <GraduationCap className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">My Grades</h1>
          <p className="text-[13px] font-semibold text-slate-500">Term results and subject scores</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Subjects</p>
          <p className="text-2xl font-extrabold text-ink mt-1">{grades.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Completed</p>
          <p className="text-2xl font-extrabold text-ink mt-1">{completed.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Average</p>
          <p className="text-2xl font-extrabold text-ink mt-1">{average}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <select
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12.5px] font-semibold text-ink"
        >
          <option value="">Current term</option>
          <option value="Term 1">Term 1</option>
          <option value="Term 2">Term 2</option>
          <option value="Term 3">Term 3</option>
        </select>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {grades.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12.5px]">
              <thead>
                <tr className="text-slate-400">
                  <th className="py-2 pr-3 font-extrabold">Subject</th>
                  <th className="py-2 pr-3 font-extrabold">Class</th>
                  <th className="py-2 pr-3 font-extrabold">Exam</th>
                  <th className="py-2 pr-3 font-extrabold">Total</th>
                  <th className="py-2 font-extrabold">Grade</th>
                </tr>
              </thead>
              <tbody>
                {grades.map((g, idx) => (
                  <tr key={g.subject ?? idx} className="border-t border-slate-100">
                    <td className="py-2 pr-3 font-bold text-ink">{g.subject}</td>
                    <td className="py-2 pr-3 text-slate-600">{g.classScore ?? '—'}</td>
                    <td className="py-2 pr-3 text-slate-600">{g.examScore ?? '—'}</td>
                    <td className="py-2 pr-3 text-slate-600">{g.total ?? '—'}</td>
                    <td className="py-2 font-extrabold text-brand-700">{g.grade || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-[12px] text-slate-500 text-center py-6">No grades available</p>
        )}
      </div>
    </div>
  );
};

export default Grades;
