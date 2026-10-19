import React, { useEffect, useState } from 'react';
import PageHeader from '../../../components/dashboard/PageHeader';
import Card from '../../../components/dashboard/ui/Card';
import { Users, ClipboardCheck, Clock, AlertTriangle } from 'lucide-react';
import { getTeacherAttendanceReport } from '../../../services/admin/academic';

const KPI = ({ icon: Icon, label, value, tone }) => (
  <Card className="p-4">
    <div className="flex items-center gap-3">
      <div className={`rounded-lg p-2 ${tone}`}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div>
        <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">{label}</p>
        <p className="text-[20px] font-extrabold text-ink">{value}</p>
      </div>
    </div>
  </Card>
);

const TeacherAttendanceReport = ({ className }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!className) return;
    setLoading(true);
    getTeacherAttendanceReport({ className })
      .then((res) => setData(res || {}))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [className]);

  const kpis = data?.kpis || {};
  const students = data?.students || [];
  const registerLog = data?.registerLog || [];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Academics"
        title="Teacher Attendance Performance Report"
        description="Administrative diligence and classroom management overview."
        actions={
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-bold text-white"
          >
            Print / Save PDF
          </button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KPI icon={ClipboardCheck} label="Overall Attendance Rate" value={`${kpis.overallRate ?? 0}%`} tone="bg-emerald-100 text-emerald-700" />
        <KPI icon={Users} label="Register Submission Rate" value={`${kpis.registerSubmissionRate ?? 0}%`} tone="bg-sky-100 text-sky-700" />
        <KPI icon={Clock} label="Late Submissions" value={kpis.lateSubmissions ?? 0} tone="bg-amber-100 text-amber-700" />
        <KPI icon={AlertTriangle} label="Chronic Absentees Flagged" value={kpis.chronicAbsentees ?? 0} tone="bg-rose-100 text-rose-700" />
      </div>

      <Card className="p-4">
        <h3 className="text-[14px] font-extrabold text-ink mb-3">Monthly Attendance Trend</h3>
        <div className="h-40 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 text-sm">
          Line chart placeholder
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="text-[14px] font-extrabold text-ink mb-3">Class-by-Class Breakdown</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Class</th>
                <th className="px-4 py-2.5">Students</th>
                <th className="px-4 py-2.5">Present</th>
                <th className="px-4 py-2.5">Late</th>
                <th className="px-4 py-2.5">Absent</th>
                <th className="px-4 py-2.5">Rate</th>
                <th className="px-4 py-2.5">Register Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {students.map((s, i) => (
                <tr key={i}>
                  <td className="px-4 py-2.5 font-extrabold text-ink">{s.name}</td>
                  <td className="px-4 py-2.5">{s.total}</td>
                  <td className="px-4 py-2.5">{s.present}</td>
                  <td className="px-4 py-2.5">{s.late}</td>
                  <td className="px-4 py-2.5">{s.absent}</td>
                  <td className="px-4 py-2.5 font-extrabold">{s.rate}%</td>
                  <td className="px-4 py-2.5 text-slate-500">—</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h3 className="text-[14px] font-extrabold text-ink mb-3">Students at Risk</h3>
          <ul className="space-y-2 text-sm">
            {students.filter((s) => s.rate < 75 && s.total > 0).slice(0, 5).map((s, i) => (
              <li key={i} className="flex justify-between">
                <span>{s.name}</span>
                <span className="text-rose-700 font-extrabold">{s.rate}% ({s.absent} missed)</span>
              </li>
            ))}
            {students.filter((s) => s.rate < 75 && s.total > 0).length === 0 && (
              <li className="text-slate-400">No at-risk students.</li>
            )}
          </ul>
        </Card>
        <Card className="p-4">
          <h3 className="text-[14px] font-extrabold text-ink mb-3">Recent Register Log</h3>
          <ul className="space-y-2 text-sm">
            {registerLog.slice(-5).reverse().map((d, i) => {
              const t = d.submittedAt ? new Date(d.submittedAt) : null;
              const late = t && (t.getHours() > 9 || (t.getHours() === 9 && t.getMinutes() > 0));
              return (
                <li key={i} className="flex justify-between">
                  <span>{new Date(d.date).toLocaleDateString()}</span>
                  <span className={late ? 'text-amber-700 font-extrabold' : 'text-emerald-700 font-extrabold'}>
                    {t ? `${t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ${late ? '(Late)' : '(On time)'}` : 'Missing'}
                  </span>
                </li>
              );
            })}
            {registerLog.length === 0 && <li className="text-slate-400">No register log.</li>}
          </ul>
        </Card>
      </div>
    </div>
  );
};

export default TeacherAttendanceReport;