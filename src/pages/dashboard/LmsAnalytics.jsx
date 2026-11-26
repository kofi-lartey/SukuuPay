import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getSchool } from '../../services/school';
import { getLmsAnalytics } from '../../services/lmsApi';
import PageHeader from '../../components/dashboard/PageHeader';
import Card from '../../components/dashboard/ui/Card';
import FeatureGate from '../../components/common/FeatureGate';
import { ChartBar } from 'lucide-react';

const LmsAnalytics = () => {
  const { user } = useAuth();
  const [className, setClassName] = useState('');
  const [subject, setSubject] = useState('');
  const [term, setTerm] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [school, setSchool] = useState(null);

  useEffect(() => {
    if (!user?.schoolId) return undefined;
    let active = true;
    getSchool(user.schoolId).then((r) => { if (active) setSchool(r); }).catch(() => { if (active) setSchool(null); });
    return () => { active = false; };
  }, [user?.schoolId]);

  useEffect(() => {
    if (!user?.schoolId) return undefined;
    let active = true;
    setLoading(true);
    setError(null);
    getLmsAnalytics({ className: className || undefined, subject: subject || undefined, term: term || undefined, academicYear: academicYear || undefined })
      .then((r) => { if (active) setData(r?.data ?? r); })
      .catch((e) => { if (active) setError(e?.message || 'Failed to load'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user?.schoolId, className, subject, term, academicYear]);

  const classes = school?.academic?.classes || school?.classes || [];
  const schoolName = user?.schoolName || school?.name || 'your school';
  const d = data || {};
  const dist = Array.isArray(d.scoreDistribution) ? d.scoreDistribution : [];
  const per = Array.isArray(d.perAssessment) ? d.perAssessment : [];
  const maxCount = Math.max(1, ...dist.map((b) => b.count || 0));

  return (
    <FeatureGate feature="lmsAnalytics">
      <PageHeader eyebrow="Overview / Analytics / LMS" title="LMS Analytics" description={`Completion, performance and score distribution across assessments for ${schoolName}.`} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select value={className} onChange={(e) => setClassName(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-600">
          <option value="">All classes</option>
          {classes.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-600" />
        <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Term" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-600" />
        <input value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} placeholder="Academic year" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-600" />
      </div>

      {loading && <p className="text-[12px] font-semibold text-slate-500">Loading…</p>}
      {error && <p className="text-[12px] font-semibold text-red-600">{error}</p>}

      {!loading && !error && d.assessmentsPublished === 0 && (
        <Card padding="p-8"><p className="text-center text-[13px] font-semibold text-slate-500">No assessments published yet.</p></Card>
      )}

      {!loading && !error && d.assessmentsPublished !== 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ['Completion Rate', d.completionRate != null ? `${Math.round(d.completionRate * 100)}%` : '—'],
              ['Class Average', d.classAverageScore != null ? `${d.classAverageScore}` : '—'],
              ['Pass Rate', d.passRate != null ? `${Math.round(d.passRate * 100)}%` : '—'],
              ['Assessments Published', d.assessmentsPublished ?? '—'],
              ['Graded Submissions', d.gradedSubmissions ?? '—'],
            ].map(([label, val]) => (
              <Card key={label} padding="p-4">
                <p className="text-[11px] font-semibold text-slate-500">{label}</p>
                <p className="mt-1 text-[18px] font-extrabold text-ink">{val}</p>
              </Card>
            ))}
          </div>

          <Card padding="p-4" className="mt-4">
            <p className="mb-2 text-[12px] font-extrabold text-ink">Score Distribution</p>
            <svg width="100%" height="160" viewBox="0 0 400 160" preserveAspectRatio="none">
              {dist.map((b, i) => {
                const w = 400 / Math.max(1, dist.length);
                const h = (b.count || 0) / maxCount * 120;
                return (
                  <g key={i}>
                    <rect x={i * w + 4} y={140 - h} width={w - 8} height={h} fill="#4f46e5" rx="4" />
                    <text x={i * w + w / 2} y={155} fontSize="9" textAnchor="middle" fill="#64748b">{b.band}</text>
                  </g>
                );
              })}
            </svg>
          </Card>

          <Card padding="p-4" className="mt-4">
            <p className="mb-2 text-[12px] font-extrabold text-ink">Per Assessment</p>
            <table className="w-full text-[12px]">
              <thead><tr className="text-left text-slate-500"><th>Title</th><th>Avg</th><th>Submitted</th><th>Graded</th></tr></thead>
              <tbody>
                {per.map((a) => (
                  <tr key={a.assessmentId} className="border-t border-slate-100">
                    <td className="py-1.5 font-semibold text-ink">{a.title}</td>
                    <td>{a.averageScore}</td>
                    <td>{a.submitted}</td>
                    <td>{a.graded}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </FeatureGate>
  );
};

export default LmsAnalytics;
