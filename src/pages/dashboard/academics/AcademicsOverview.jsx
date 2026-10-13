import React from 'react';
import { Users, School, ClipboardCheck, FileText, Award, TrendingUp } from 'lucide-react';
import PageHeader from '../../../components/dashboard/PageHeader';
import Card from '../../../components/dashboard/ui/Card';
import Tile from '../../../components/dashboard/ui/Tile';
import Badge from '../../../components/dashboard/ui/Badge';
import { SkeletonBlock, SkeletonCard } from '../../../components/parent/shared/Skeleton';
import EmptyState from '../../../components/parent/shared/EmptyState';
import { useAcademicOverview } from '../../../hooks/admin/useAcademicOverview';
import { ACADEMIC_TERMS } from '../../../utils/constants';
import { formatCount, formatPercent } from '../../../utils/format';

const TERM_OPTIONS = [{ value: '', label: 'All terms' }, ...ACADEMIC_TERMS.map((t) => ({ value: t, label: t }))];

const SectionTitle = ({ children }) => (
  <h2 className="mb-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
    {children}
  </h2>
);

const OverviewKpiRow = ({ summary }) => {
  const { totals, pendingApprovals, publishReady, gradeApprovalCounts, reportCardCounts } = summary;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Tile
        label="Students"
        icon={Users}
        value={formatCount(totals.students)}
        footer={<p className="text-[11px] font-semibold text-slate-500">{formatCount(totals.classes)} classes</p>}
      />
      <Tile
        label="Attendance"
        icon={School}
        value={formatPercent(totals.attendanceRate)}
        footer={<p className="text-[11px] font-semibold text-slate-500">{formatPercent(totals.attendanceRate)} this period</p>}
      />
      <Tile
        label="Marks pending"
        icon={ClipboardCheck}
        value={formatCount(pendingApprovals)}
        accent={pendingApprovals > 0}
        footer={
           <p className="text-[11px] font-semibold text-slate-500">
             {formatCount(gradeApprovalCounts.approved)} approved, {formatCount(gradeApprovalCounts.rejected)} rejected
           </p>
        }
      />
      <Tile
        label="Reports ready"
        icon={FileText}
        value={formatCount(publishReady)}
        accent={publishReady > 0}
        footer={
          <p className="text-[11px] font-semibold text-slate-500">
             {formatCount(reportCardCounts.published?.count ?? 0)} published this period
          </p>
        }
      />
    </div>
  );
};

const GradeStatusRow = ({ label, count, tone }) => (
  <div className="flex items-center justify-between py-2">
    <span className="text-[13px] font-semibold text-slate-600">{label}</span>
    <Badge tone={tone}>{formatCount(count)} blocks</Badge>
  </div>
);

const ReportStatusRow = ({ label, entry, tone }) => (
  <div className="flex items-center justify-between py-2">
    <span className="text-[13px] font-semibold text-slate-600">{label}</span>
    <Badge tone={tone}>{formatCount(entry?.count ?? 0)}</Badge>
  </div>
);

const ClassAverages = ({ items }) => {
  if (!items?.length) {
    return (
      <EmptyState
        icon={Award}
        title="No published report cards"
        description="Once reports are published for a class, its average appears here."
      />
    );
  }
  return (
    <ul className="divide-y divide-slate-100">
      {items.map((c) => (
        <li key={c.className} className="flex items-center justify-between py-2.5">
          <span className="text-[13px] font-semibold text-ink">{c.className}</span>
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-extrabold text-ink">{c.average.toFixed(1)}%</span>
            <span className="text-[11px] font-semibold text-slate-500">({formatCount(c.count)} cards)</span>
          </div>
        </li>
      ))}
    </ul>
  );
};

const TopStudents = ({ items }) => {
  if (!items?.length) {
    return (
      <EmptyState
        icon={TrendingUp}
        title="No published report cards yet"
        description="Top pupils appear once a class's reports have been published."
      />
    );
  }
  return (
    <ul className="divide-y divide-slate-100">
      {items.map((s) => (
        <li key={`${s.className}:${s.studentId}`} className="flex items-center justify-between py-2">
          <div>
            <p className="text-[13px] font-extrabold text-ink">{s.studentName}</p>
            <p className="text-[11px] font-semibold text-slate-500">{s.className} · {s.studentId}</p>
          </div>
          <Badge tone="brand">{s.average.toFixed(1)}% · {s.grade || '—'}</Badge>
        </li>
      ))}
    </ul>
  );
};

const ScopeControls = ({ scope, setScope }) => {
  const { term, academicYear } = scope;
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
        Term
        <select
          value={term ?? ''}
          onChange={(e) => setScope({ term: e.target.value || null })}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-ink"
        >
          {TERM_OPTIONS.map((opt) => (
            <option key={String(opt.value)} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
        Year
        <input
          type="text"
          placeholder="2025/2026"
          value={academicYear ?? ''}
          onChange={(e) => setScope({ academicYear: e.target.value || null })}
          className="w-36 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-ink"
        />
      </label>
      <p className="text-[11px] font-semibold text-slate-500">
        {scope.term ? `Term ${scope.term} · ${scope.academicYear || 'all years'}` : 'Across all terms'}
      </p>
    </div>
  );
};

const AcademicsOverview = () => {
  const { summary, scope, setScope, loading, error } = useAcademicOverview();

  if (error && !summary) {
    return (
      <EmptyState
        icon={Award}
        title="Could not load the academic overview"
        description={error.message}
      />
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Academics"
        title="Academic overview"
        description="School-wide standing across marks, report cards and class averages."
        meta={<ScopeControls scope={scope} setScope={setScope} />}
      />

      {loading && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonBlock key={i} className="h-28 w-full" />
            ))}
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <SkeletonCard className="h-52" />
            <SkeletonCard className="h-52" />
          </div>
        </>
      )}

      {!loading && (
        <>
          <OverviewKpiRow summary={summary} />

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Card padding="p-5" className="shadow-none">
              <SectionTitle>Grade approval state</SectionTitle>
              <GradeStatusRow label="Draft" count={gradeApprovalCounts.draft} tone="slate" />
              <GradeStatusRow label="Submitted" count={gradeApprovalCounts.submitted} tone="amber" />
              <GradeStatusRow label="Approved" count={gradeApprovalCounts.approved} tone="green" />
              <GradeStatusRow label="Rejected" count={gradeApprovalCounts.rejected} tone="red" />
            </Card>

            <Card padding="p-5" className="shadow-none">
              <SectionTitle>Report card state</SectionTitle>
              <ReportStatusRow label="Draft" entry={reportCardCounts.draft} tone="slate" />
              <ReportStatusRow label="In review" entry={reportCardCounts.review} tone="amber" />
              <ReportStatusRow label="Published" entry={reportCardCounts.published} tone="green" />
              <ReportStatusRow label="Archived" entry={reportCardCounts.archived} tone="slate" />
            </Card>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <Card padding="p-5" className="shadow-none">
              <SectionTitle>Class averages</SectionTitle>
              <ClassAverages items={summary.classAverages} />
            </Card>

            <Card padding="p-5" className="shadow-none">
              <SectionTitle>Top pupils</SectionTitle>
              <TopStudents items={summary.topStudents} />
            </Card>
          </div>
        </>
      )}
    </>
  );
};

export default AcademicsOverview;
