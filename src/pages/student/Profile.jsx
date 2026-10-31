import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useStudentDashboard } from '../../hooks/useStudentDashboard';
import { Link } from 'react-router-dom';
import { STUDENT_ROUTES } from '../../utils/constants';
import { User, Loader2, AlertCircle, RefreshCw, Lock } from 'lucide-react';

const StudentProfile = () => {
  const { user } = useAuth();
  const isDemo = typeof window !== 'undefined' && localStorage.getItem('auth_token') === 'student-demo-token';
  const { data, isLoading, isError, refetch, isFetching } = useStudentDashboard(!isDemo);

  const profile = data?.profile || {};
  const name = profile?.name || user?.name || 'Student';
  const studentClass = profile?.studentClass || user?.className || user?.studentClass || '—';
  const studentId = profile?.studentId || user?.studentId || '—';
  const academicYear = profile?.academicYear || '—';
  const term = profile?.term || '—';
  const image = profile?.image || null;

  if (isLoading && !isDemo) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
          <User className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">Profile</h1>
          <p className="text-[13px] font-semibold text-slate-500">Your student information</p>
        </div>
      </div>

      {!isDemo && isError && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            <p className="text-[13px] font-semibold text-amber-900">Could not reach the server.</p>
          </div>
          <button onClick={() => refetch()} disabled={isFetching} className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-3 py-1.5 text-[12px] font-extrabold text-white hover:bg-amber-700 disabled:opacity-60">
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} /> Retry
          </button>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4">
          {image ? (
            <img src={image} alt={name} className="h-20 w-20 rounded-2xl object-cover border border-slate-200" />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-brand-100 text-brand-700 font-extrabold text-2xl">
              {String(name).charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h2 className="text-[18px] font-extrabold text-ink">{name}</h2>
            <p className="text-[12.5px] text-slate-500">{studentClass} · {term}</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-400">Student ID</p>
            <p className="text-[13px] font-bold text-ink mt-1">{studentId}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-400">Class</p>
            <p className="text-[13px] font-bold text-ink mt-1">{studentClass}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-400">Academic Year</p>
            <p className="text-[13px] font-bold text-ink mt-1">{academicYear}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-400">Term</p>
            <p className="text-[13px] font-bold text-ink mt-1">{term}</p>
          </div>
        </div>

        <div className="mt-6">
          <Link to={STUDENT_ROUTES.settings} className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-[13px] font-extrabold text-white shadow-sm transition-colors hover:bg-brand-800">
            <Lock className="h-4 w-4" /> Change password & settings
          </Link>
        </div>
      </div>
    </div>
  );
};

export default StudentProfile;
