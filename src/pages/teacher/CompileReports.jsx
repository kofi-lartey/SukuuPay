import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, FileText, Loader2, Send } from 'lucide-react';
import { useCompileReportCards, usePublishReportCards } from '../../hooks/teacher/useGrades';
import { useMyClasses } from '../../hooks/teacher/useMyClasses';
import ClassPicker from '../../components/teacher/ClassPicker';
import { SkeletonRow } from '../../components/parent/shared/Skeleton';
import EmptyState from '../../components/parent/shared/EmptyState';
import useToast from '../../hooks/useToast';
import { TEACHER_ROUTES } from '../../utils/constants';

const TERMS = ['Term 1', 'Term 2', 'Term 3'];

/**
 * Compile, then publish, a class's terminal reports.
 *
 * ## Two steps, and the order is the point
 *
 * Compiling turns the term's scores into report cards. Publishing shows them to
 * parents. Between them is where a headteacher signs off, which is why publish
 * is a separate button and is disabled until a compile has succeeded in this
 * session — the alternative, one button that does both, puts a child's report
 * in a parent's hands before anyone has read it.
 *
 * The gate is on local state, not on a server round trip: the page holds the
 * compile result so it can disable publish, and a teacher who reloads mid-way
 * compiles again. That is deliberate — a gate that survived a reload would let
 * a teacher publish a report compiled an hour ago from scores that have since
 * changed, which is the exact mismatch the two-step flow exists to prevent.
 *
 * The publish payload carries only the class, term and year: the compiled
 * report cards are the server's, and re-sending scores here would be a second
 * chance for a stale column to overwrite a good one.
 */
const CompileReports = () => {
  const { className } = useParams();
  const navigate = useNavigate();
  const [term, setTerm] = useState('Term 2');
  const [academicYear, setAcademicYear] = useState(
    `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`
  );
  const compile = useCompileReportCards();
  const publish = usePublishReportCards();
  const toast = useToast();

  const { data: classes, isLoading: loadingClasses } = useMyClasses();
  const [compiled, setCompiled] = useState(null);

  const handleCompile = async () => {
    try {
      const result = await compile.mutateAsync({
        className,
        term,
        academicYear,
        // The marks are the server's: it reads the class's *approved* grades
        // and folds each subject's class score and exam score into the total,
        // the grade and the subject position. The browser says which class
        // and term, and nothing else.
      });
      setCompiled(result);
      toast.success(`Compiled ${result.compiled} report cards`);
    } catch (err) {
      toast.error(err.message || 'Could not compile report cards.');
    }
  };

  const handlePublish = async () => {
    try {
      const result = await publish.mutateAsync({ className, term, academicYear });
      toast.success(`Published ${result.published} report cards`);
    } catch (err) {
      toast.error(err.message || 'Could not publish report cards.');
    }
  };

  // Reached as /teacher/records with no class in the path.
  if (!className) {
    return (
      <div className="space-y-4">
        {loadingClasses ? (
          <div className="space-y-2">
            <SkeletonRow />
            <SkeletonRow />
          </div>
        ) : classes?.length ? (
          <div className="space-y-3">
            <ClassPicker
              classes={classes}
              value=""
              onChange={(next) => navigate(TEACHER_ROUTES.recordsFor(next))}
            />
            <EmptyState
              icon={FileText}
              title="Pick a class"
              description="Choose one of your classes above to compile its terminal reports."
            />
          </div>
        ) : (
          <EmptyState
            icon={FileText}
            title="No classes assigned yet"
            description="Your school administrator will assign your classes before you can compile reports."
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 shrink-0 text-sky-700" aria-hidden="true" />
          <p className="truncate text-[14px] font-extrabold text-ink">Terminal reports · {className}</p>
        </div>
        <p className="mt-1 text-[12.5px] text-slate-500">
          Compile grades, then publish when the headteacher has approved.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <select
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          aria-label="Term"
          className="min-h-[44px] rounded-xl border border-slate-200 px-3 py-2.5 text-[13px]"
        >
          {TERMS.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <input
          type="text"
          value={academicYear}
          onChange={(e) => setAcademicYear(e.target.value)}
          aria-label="Academic year"
          className="min-h-[44px] rounded-xl border border-slate-200 px-3 py-2.5 text-[13px]"
        />
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
        <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
          Step 1 · Compile
        </p>
        <button
          type="button"
          onClick={handleCompile}
          disabled={compile.isPending}
          className="mt-2 min-h-[44px] w-full rounded-xl bg-sky-600 text-[13.5px] font-extrabold text-white transition-colors hover:bg-sky-700 disabled:opacity-50"
        >
          {compile.isPending ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Compiling…
            </span>
          ) : (
            'Compile report cards'
          )}
        </button>

        {compiled ? (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-[12.5px] font-semibold text-emerald-800">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            {compiled.compiled} report cards compiled and ready for review.
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
        <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
          Step 2 · Publish
        </p>
        <p className="mt-1 text-[12.5px] text-slate-500">
          Publishing makes reports visible to parents immediately.
        </p>
        <button
          type="button"
          onClick={handlePublish}
          disabled={publish.isPending || !compiled}
          className="mt-2 min-h-[44px] w-full rounded-xl bg-[#0A5C36] text-[13.5px] font-extrabold text-white transition-colors hover:bg-[#084a2b] disabled:opacity-50"
        >
          {publish.isPending ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Publishing…
            </span>
          ) : (
            <span className="inline-flex items-center gap-2">
              <Send className="h-4 w-4" aria-hidden="true" />
              Publish to parents
            </span>
          )}
        </button>
        {/*
          Why the button is unavailable, said while it is disabled. A greyed-out
          control with no explanation reads as a broken one, and the teacher's
          next instinct is to reload the page and lose the compile.
        */}
        {!compiled && !publish.isPending ? (
          <p className="mt-2 text-[11.5px] font-semibold text-slate-400">
            Compile first — publishing needs this session&rsquo;s report cards.
          </p>
        ) : null}
      </div>
    </div>
  );
};

export default CompileReports;
