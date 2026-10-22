import { useEffect, useRef, useState } from 'react';
import { Download, FileText, Share2 } from 'lucide-react';
import { useParentPay } from '../../layouts/ParentLayout';
import { useRecords } from '../../hooks/parent/useRecords';
import { downloadReportCardPdf } from '../../services/parent/records';
import { defaultTermForSchool } from '../../utils/attendanceDefaults';
import StudentRow from '../../components/parent/shared/StudentRow';
import SectionLabel from '../../components/parent/shared/SectionLabel';
import StatusPill from '../../components/parent/shared/StatusPill';
import EmptyState from '../../components/parent/shared/EmptyState';
import ErrorBanner from '../../components/parent/shared/ErrorBanner';
import { SkeletonCard } from '../../components/parent/shared/Skeleton';
import useToast from '../../hooks/useToast';

const TERM_OPTIONS = ['Term 1', 'Term 2', 'Term 3'];

const gradeTone = (grade) => {
  if (!grade) return 'slate';
  if (grade.startsWith('A')) return 'green';
  if (grade.startsWith('B')) return 'green';
  if (grade.startsWith('C')) return 'amber';
  return 'red';
};

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

const PerformanceCard = ({ summary }) => (
  <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
    <div className="h-1 w-16 rounded-full bg-[#F2B705]" aria-hidden="true" />
    <p className="mt-3 text-[40px] font-extrabold leading-none tabular-nums text-[#0A5C36]">
      {summary.average}%
    </p>
    <p className="mt-1 text-[12px] font-bold uppercase tracking-wider text-slate-400">
      Overall average
    </p>

    <div className="mt-4 flex flex-wrap gap-3 text-[12.5px]">
      <div className="flex-1 rounded-xl bg-slate-50 px-3 py-2">
        <p className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-400">
          Position
        </p>
        <p className="mt-0.5 text-[14px] font-extrabold text-ink">
          {summary.position} of {summary.classSize}
        </p>
      </div>
      <div className="flex-1 rounded-xl bg-slate-50 px-3 py-2">
        <p className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-400">
          Grade
        </p>
        <p className="mt-0.5 text-[14px] font-extrabold text-ink">{summary.grade}</p>
      </div>
    </div>
  </div>
);

/*
  The subject table, laid out the way the physical terminal report is.

  A Ghanaian report card does not print one number per subject. It prints the
  class score, the exam score, the total the two make, the grade, and where the
  student came in that subject — and a parent who has the paper in their hand
  expects to find the same thing on their phone.

  A subject with only one half recorded shows a dash for the rest and no
  total, because a total computed from one half is not a result.
*/
const SubjectTable = ({ subjects }) => (
  <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
    <div className="border-b border-slate-100 px-4 py-2.5">
      <SectionLabel>Subject grades</SectionLabel>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-left">
        <thead>
          <tr className="border-b border-slate-100 text-[10.5px] font-extrabold uppercase tracking-wider text-slate-400">
            <th className="px-4 py-2">Subject</th>
            <th className="px-2 py-2 text-right">Class (30)</th>
            <th className="px-2 py-2 text-right">Exam (100)</th>
            <th className="px-2 py-2 text-right">Total</th>
            <th className="px-2 py-2 text-right">Pos</th>
            <th className="px-4 py-2 text-right">Grade</th>
          </tr>
        </thead>
        <tbody>
          {subjects.map((s) => (
            <tr key={s.subject} className="border-b border-slate-100 last:border-b-0">
              <td className="px-4 py-3 text-[13.5px] font-semibold text-slate-700">
                {s.subject}
              </td>
              <td className="px-2 py-3 text-right text-[13.5px] tabular-nums text-slate-600">
                {s.classScore ?? '—'}
              </td>
              <td className="px-2 py-3 text-right text-[13.5px] tabular-nums text-slate-600">
                {s.examScore ?? '—'}
              </td>
              <td className="px-2 py-3 text-right text-[13.5px] font-extrabold tabular-nums text-ink">
                {s.totalScore ?? '—'}
              </td>
              <td className="px-2 py-3 text-right text-[13px] font-semibold tabular-nums text-slate-500">
                {s.subjectPosition || '—'}
              </td>
              <td className="px-4 py-3 text-right">
                {s.grade ? (
                  <StatusPill tone={gradeTone(s.grade)}>{s.grade}</StatusPill>
                ) : (
                  <span className="text-[13px] text-slate-400">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </section>
);

const RemarkCard = ({ label, quote, author }) => (
  <section className="rounded-2xl border border-slate-200/80 bg-[#F7F9F8] p-4">
    <SectionLabel>{label}</SectionLabel>
    {quote ? (
      <p className="mt-2 text-[13.5px] italic leading-relaxed text-slate-700">
        &ldquo;{quote}&rdquo;
      </p>
    ) : (
      <p className="mt-2 text-[13px] italic text-slate-400">
        Not yet written for this term.
      </p>
    )}
    {author ? (
      <p className="mt-2 text-[12px] font-semibold text-slate-500">— {author}</p>
    ) : null}
  </section>
);

const Records = () => {
  const { token, student, school } = useParentPay();
  /*
    The term this page opens on is the school's current term — the one its
    Settings screen writes and the one the server resolves every report-card
    read against. It was hard-coded to "Term 1", which is right for one term in
    three: a school in Term 2 was shown the previous term's card (or none at
    all) on the page a parent opens to ask how their child is doing this term.
  */
  const schoolTerm = defaultTermForSchool(school);
  const [term, setTerm] = useState(schoolTerm);
  const toast = useToast();
  const { data, isLoading, error, refetch } = useRecords(token, { term });

  // A term the parent picked is theirs; a school that moves term while the
  // portal is open must not leave them on the old one.
  const chosen = useRef(false);
  useEffect(() => {
    if (!chosen.current) setTerm(schoolTerm);
  }, [schoolTerm]);

  const handleTermChange = (next) => {
    chosen.current = true;
    setTerm(next);
  };

  const handleDownload = async () => {
    try {
      const response = await downloadReportCardPdf(token, { term });
      const url = URL.createObjectURL(response);
      const link = document.createElement('a');
      link.href = url;
      link.download = `report-${student?.studentId || 'student'}-${term.replace(/\s/g, '')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('Report card downloaded');
    } catch (err) {
      toast.error(err.message || 'Could not download the report card.');
    }
  };

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
      <TermPills value={term} onChange={handleTermChange} />

      {isLoading ? (
        <>
          <SkeletonCard />
          <SkeletonCard />
        </>
      ) : !data || !data.summary ? (
        <EmptyState
          icon={FileText}
          title="Report not published yet"
          description="Your school has not published the report card for this term yet. Check back later."
        />
      ) : (
        <>
          <PerformanceCard summary={data.summary} />

          {data.subjects?.length ? <SubjectTable subjects={data.subjects} /> : null}

          <RemarkCard
            label="Class teacher's remark"
            quote={data.teacherRemark?.text}
            author={data.teacherRemark?.author}
          />

          <RemarkCard
            label="Headteacher's remark"
            quote={data.headRemark?.text}
            author={data.headRemark?.author}
          />

          <section className="grid grid-cols-2 gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <div>
              <SectionLabel>Conduct</SectionLabel>
              <p className="mt-1 text-[13.5px] font-extrabold text-ink">
                {data.conduct || '—'}
              </p>
            </div>
            <div>
              <SectionLabel>Attendance</SectionLabel>
              <p className="mt-1 text-[13.5px] font-extrabold text-ink">
                {data.attendance?.present || 0} / {data.attendance?.total || 0} days
              </p>
            </div>
          </section>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#0A5C36] text-[13.5px] font-extrabold text-white transition-colors hover:bg-[#084a2b]"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Download report card
            </button>
            <button
              type="button"
              onClick={async () => {
                try {
                  if (navigator.share) {
                    await navigator.share({
                      title: `Report card — ${student?.studentName}`,
                      text: `Terminal report for ${student?.studentName}, ${term}.`,
                    });
                  }
                } catch {
                  /* user cancelled */
                }
              }}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-[13.5px] font-extrabold text-slate-700 transition-colors hover:bg-slate-50"
            >
              <Share2 className="h-4 w-4" aria-hidden="true" />
              Share
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default Records;
