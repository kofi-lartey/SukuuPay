import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useStudentDashboard } from '../../hooks/useStudentDashboard';
import {
  BookOpen, CalendarCheck, CreditCard, GraduationCap,
  MessageSquare, Users, ArrowRight,
  AlertCircle, Clock, TrendingUp, Loader2, RefreshCw, User
} from 'lucide-react';
import { STUDENT_ROUTES } from '../../utils/constants';

const modules = [
  { to: STUDENT_ROUTES.lms, icon: BookOpen, label: 'Learning Materials', desc: 'Lessons, resources and quizzes.', color: 'bg-blue-50 text-blue-700' },
  { to: STUDENT_ROUTES.grades, icon: GraduationCap, label: 'My Grades', desc: 'View your terminal reports.', color: 'bg-purple-50 text-purple-700' },
  { to: STUDENT_ROUTES.attendance, icon: CalendarCheck, label: 'Attendance', desc: 'Check your daily record.', color: 'bg-emerald-50 text-emerald-700' },
  { to: STUDENT_ROUTES.messages, icon: MessageSquare, label: 'Messages', desc: 'Notices from the school.', color: 'bg-amber-50 text-amber-700' },
  { to: STUDENT_ROUTES.fees, icon: CreditCard, label: 'Fee Payments', desc: 'View balance and receipts.', color: 'bg-rose-50 text-rose-700' },
  { to: STUDENT_ROUTES.community, icon: Users, label: 'Community', desc: 'School events and clubs.', color: 'bg-teal-50 text-teal-700' },
  { to: STUDENT_ROUTES.settings, icon: User, label: 'Settings', desc: 'Manage your profile.', color: 'bg-slate-50 text-slate-700' },
];

const StudentOverview = () => {
  const { user } = useAuth();
  const isDemo = typeof window !== 'undefined' && localStorage.getItem('auth_token') === 'student-demo-token';
  const { data: studentData, isLoading, isError, refetch, isFetching } = useStudentDashboard(!isDemo);

  const [tab, setTab] = useState('overview');
  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'grades', label: 'Grades' },
    { key: 'attendance', label: 'Attendance' },
    { key: 'fees', label: 'Fees' },
  ];

  const profile = studentData?.profile || {};
  const parents = Array.isArray(studentData?.parents) ? studentData.parents : [];
  const grades = Array.isArray(studentData?.grades) ? studentData.grades : [];
  const attendance = studentData?.attendance || {};
  const teachers = Array.isArray(studentData?.teachers) ? studentData.teachers : [];

  const firstName = profile?.name
    ? String(profile.name).split(' ')[0]
    : (user?.name ? String(user.name).split(' ')[0] : 'Student');
  const studentClass = profile?.studentClass || user?.className || user?.studentClass || '';
  const termInfo = profile?.term || 'Term 2, 2025/2026';
  const balance = typeof studentData?.balance === 'number' ? studentData.balance : 0;
  const attendanceRate = typeof attendance?.rate === 'number' ? attendance.rate : 0;
  const pendingTasks = Array.isArray(studentData?.pendingTasks) ? studentData.pendingTasks : [];
  const studentImage = profile?.image || null;

  if (isLoading && !isDemo) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-2 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-[13px] font-semibold">Loading your overview...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">

      {isDemo && (
        <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-4">
          <p className="text-[13px] font-semibold text-slate-600">
            Demo mode — showing your student portal. Real-time data will appear once connected to the backend.
          </p>
        </div>
      )}

      {!isDemo && isError && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            <p className="text-[13px] font-semibold text-amber-900">
              Could not reach the server. Showing cached/local data.
            </p>
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
      )}

      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="flex items-center gap-4">
          {studentImage ? (
            <img src={studentImage} alt={firstName} className="h-16 w-16 rounded-2xl object-cover border border-slate-200" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-100 text-brand-700 font-extrabold text-xl">
              {firstName.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-ink">
              Welcome back, {firstName}
            </h1>
            <p className="text-[13.5px] font-semibold text-slate-500 mt-1">
              {studentClass}{studentClass && termInfo ? ' · ' : ''}{termInfo}
            </p>
          </div>
        </div>
        <Link
          to={STUDENT_ROUTES.lms}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-[13px] font-extrabold text-white shadow-sm transition-colors hover:bg-brand-800"
        >
          Go to Class <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="flex gap-2 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-xl px-3 py-2 text-[12.5px] font-bold transition ${tab === t.key ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] font-extrabold uppercase tracking-wider text-rose-800">Outstanding Fees</p>
                  <p className="text-2xl font-extrabold text-rose-900 mt-1">
                    GH₵ {balance.toFixed(2)}
                  </p>
                </div>
                <div className="p-2 bg-rose-100 rounded-xl text-rose-600">
                  <AlertCircle className="h-5 w-5" />
                </div>
              </div>
              <Link to={STUDENT_ROUTES.fees} className="mt-4 flex items-center justify-center w-full rounded-xl bg-rose-600 py-2 text-[12.5px] font-extrabold text-white hover:bg-rose-700 transition-colors">
                Pay Now
              </Link>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Attendance Rate</p>
                  <p className="text-2xl font-extrabold text-ink mt-1">{attendanceRate}%</p>
                </div>
                <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
                  <TrendingUp className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-4">
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(Math.max(attendanceRate, 0), 100)}%` }} />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Due Soon</p>
                <Clock className="h-4 w-4 text-slate-400" />
              </div>
              <div className="space-y-2">
                {pendingTasks.length > 0 ? (
                  pendingTasks.map((task, idx) => (
                    <div key={task.id ?? idx} className="flex items-center justify-between bg-slate-50 rounded-lg p-2">
                      <span className="text-[12.5px] font-bold text-ink truncate pr-2">{task.title}</span>
                      <span className="text-[10.5px] font-extrabold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-md whitespace-nowrap">{task.due}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-[12px] text-slate-500 text-center py-2">No pending tasks</p>
                )}
              </div>
            </div>

          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-[15px] font-extrabold text-ink mb-3">Parent / Guardian</h2>
              {parents.length > 0 ? (
                <div className="space-y-2">
                  {parents.map((p, idx) => (
                    <div key={p.id ?? idx} className="flex items-center justify-between bg-slate-50 rounded-lg p-2">
                      <div>
                        <p className="text-[12.5px] font-bold text-ink">{p.name}</p>
                        <p className="text-[11px] text-slate-500">{p.relationship}{p.phone ? ` · ${p.phone}` : ''}</p>
                      </div>
                      {p.isPrimary && <span className="text-[10px] font-extrabold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-md">Primary</span>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[12px] text-slate-500 text-center py-2">No parent information</p>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-[15px] font-extrabold text-ink mb-3">Assigned Teachers</h2>
              {teachers.length > 0 ? (
                <div className="space-y-2">
                  {teachers.map((t, idx) => (
                    <div key={t.id ?? idx} className="flex items-center gap-3 bg-slate-50 rounded-lg p-2">
                      {t.avatar ? (
                        <img src={t.avatar} alt={t.name} className="h-8 w-8 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-xs font-bold">
                          {String(t.name || 'T').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="text-[12.5px] font-bold text-ink">{t.name}</p>
                        <p className="text-[11px] text-slate-500">{t.tag ? `${t.tag} · ` : ''}{t.subjects?.join(', ') || t.className}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[12px] text-slate-500 text-center py-2">No assigned teachers</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-[15px] font-extrabold text-ink mb-3">Grades</h2>
            {grades.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[12.5px]">
                  <thead>
                    <tr className="text-slate-400">
                      <th className="py-1 pr-3 font-extrabold">Subject</th>
                      <th className="py-1 pr-3 font-extrabold">Class</th>
                      <th className="py-1 pr-3 font-extrabold">Exam</th>
                      <th className="py-1 pr-3 font-extrabold">Total</th>
                      <th className="py-1 font-extrabold">Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grades.map((g, idx) => (
                      <tr key={g.subject ?? idx} className="border-t border-slate-100">
                        <td className="py-1.5 pr-3 font-bold text-ink">{g.subject}</td>
                        <td className="py-1.5 pr-3 text-slate-600">{g.classScore ?? '—'}</td>
                        <td className="py-1.5 pr-3 text-slate-600">{g.examScore ?? '—'}</td>
                        <td className="py-1.5 pr-3 text-slate-600">{g.total ?? '—'}</td>
                        <td className="py-1.5 font-extrabold text-brand-700">{g.grade || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-[12px] text-slate-500 text-center py-2">No grades available</p>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-[15px] font-extrabold text-ink mb-3">Attendance Records</h2>
            <p className="text-[12px] text-slate-500 mb-2">{attendance.present ?? 0} present · {attendance.absent ?? 0} absent · {attendance.late ?? 0} late</p>
            {Array.isArray(attendance.records) && attendance.records.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {attendance.records.slice(0, 20).map((r, idx) => (
                  <span key={idx} className={`text-[10.5px] font-extrabold px-2 py-0.5 rounded-md ${r.status === 'present' ? 'bg-emerald-100 text-emerald-700' : r.status === 'late' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                    {new Date(r.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[12px] text-slate-500 text-center py-2">No attendance records</p>
            )}
          </div>

          <div>
            <h2 className="text-[15px] font-extrabold text-ink mb-3">My Portal</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {modules.map((mod) => {
                const Icon = mod.icon;
                return (
                  <Link
                    key={mod.to}
                    to={mod.to}
                    className="group flex flex-col rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
                  >
                    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${mod.color} mb-4 transition-transform group-hover:scale-105`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="text-[15px] font-extrabold text-ink">{mod.label}</h3>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-slate-500">{mod.desc}</p>
                    <div className="mt-4 flex items-center text-[12px] font-extrabold text-brand-700 opacity-0 transition-opacity group-hover:opacity-100">
                      Open <ArrowRight className="ml-1 h-3.5 w-3.5" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      )}

      {tab === 'grades' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-[15px] font-extrabold text-ink mb-3">Grades</h2>
          {grades.length > 0 ? (
            <table className="w-full text-left text-[12.5px]">
              <thead><tr className="text-slate-400"><th className="py-1 pr-3">Subject</th><th className="py-1 pr-3">Class</th><th className="py-1 pr-3">Exam</th><th className="py-1 pr-3">Total</th><th className="py-1">Grade</th></tr></thead>
              <tbody>
                {grades.map((g, idx) => (
                  <tr key={idx} className="border-t border-slate-100">
                    <td className="py-1.5 pr-3 font-bold text-ink">{g.subject}</td>
                    <td className="py-1.5 pr-3 text-slate-600">{g.classScore ?? '—'}</td>
                    <td className="py-1.5 pr-3 text-slate-600">{g.examScore ?? '—'}</td>
                    <td className="py-1.5 pr-3 text-slate-600">{g.total ?? '—'}</td>
                    <td className="py-1.5 font-extrabold text-brand-700">{g.grade || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-[12px] text-slate-500 text-center py-2">No grades available</p>
          )}
        </div>
      )}

      {tab === 'attendance' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-[15px] font-extrabold text-ink mb-3">Attendance Records</h2>
          <p className="text-[12px] text-slate-500 mb-2">{attendance.present ?? 0} present · {attendance.absent ?? 0} absent · {attendance.late ?? 0} late</p>
          {Array.isArray(attendance.records) && attendance.records.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {attendance.records.map((r, idx) => (
                <span key={idx} className={`text-[10.5px] font-extrabold px-2 py-0.5 rounded-md ${r.status === 'present' ? 'bg-emerald-100 text-emerald-700' : r.status === 'late' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                  {new Date(r.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-slate-500 text-center py-2">No attendance records</p>
          )}
        </div>
      )}

      {tab === 'fees' && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 shadow-sm">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-rose-800">Outstanding Fees</p>
          <p className="text-2xl font-extrabold text-rose-900 mt-1">GH₵ {balance.toFixed(2)}</p>
          <Link to={STUDENT_ROUTES.fees} className="mt-4 flex items-center justify-center w-full rounded-xl bg-rose-600 py-2 text-[12.5px] font-extrabold text-white hover:bg-rose-700 transition-colors">
            View Payment History
          </Link>
        </div>
      )}

    </div>
  );
};

export default StudentOverview;
