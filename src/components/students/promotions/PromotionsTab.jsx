import React, { useCallback, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CircleAlert, Sparkles } from 'lucide-react';
import ClassMappingStep, { PromotionSummary } from './ClassMappingStep';
import PromotionReviewStep from './PromotionReviewStep';
import GraduationStep from './GraduationStep';
import useToast from '../../../hooks/useToast';
import usePromotionData from '../../../hooks/usePromotionData';
import {
  bulkGraduate,
  clearRepeating,
  markRepeating,
  promoteStudent,
} from '../../../services/students';
import { formatCount } from '../../../utils/format';

const STEPS = [
  { key: 'mapping', label: 'Class mapping' },
  { key: 'review', label: 'Review students' },
  { key: 'graduate', label: 'Graduate cohort' },
];

/**
 * The end-of-year wizard: map, review, graduate.
 *
 * **Nothing is written until the review is confirmed.** The mapping and review
 * steps are pure reads, so a bursar can back out of a wrong plan at any point
 * with no cleanup. The only commit is the button on step two, and it commits
 * per-student rather than per-class — a student flagged "repeat" must not be
 * swept into the class-level promotion that their neighbours get, and there is
 * no bulk endpoint that can express "everyone except these four".
 *
 * The commits are sequential and *partially tolerant*: a student who fails is
 * collected and reported, and the rest still go through. A bulk call that is all
 * or nothing would mean one student's stale record costing the other 120 their
 * promotion, and the user would be left with no idea which.
 *
 * Order matters: repeats are committed **before** promotions, because
 * `promoteStudent` refuses a student flagged as repeating. Promoting first would
 * leave exactly the students who need the most care unpromoted, with an error
 * that reads as a bug.
 */
const PromotionsTab = ({ schoolId, classes, onRosterChanged }) => {
  const { success, warning, error: errorToast } = useToast();
  const [step, setStep] = useState(0);
  const [decisions, setDecisions] = useState({});
  const [committing, setCommitting] = useState(false);
  const [graduating, setGraduating] = useState(false);
  const [graduationResult, setGraduationResult] = useState(null);

  const { matrix, totals, rows, loading, error, setTarget, resetTargets, hasOverrides, refresh } =
    usePromotionData({ schoolId, classes });

  const finalClasses = useMemo(
    () => matrix.filter((row) => row.isFinalYear).map((row) => row.className),
    [matrix]
  );

  // Only the students who are actually moving into a next class belong on the
  // review step. A final-year student is graduated in step three, and offering
  // them a "promote" toggle here would promise a move the server would refuse
  // (there is no class after the last one).
  const reviewStudents = useMemo(
    () => matrix.filter((row) => !row.isFinalYear).flatMap((row) => row.students),
    [matrix]
  );

  const finalStudents = useMemo(
    () => matrix.filter((row) => row.isFinalYear).flatMap((row) => row.students),
    [matrix]
  );

  const decide = useCallback((id, decision) => {
    setDecisions((current) => ({ ...current, [id]: decision }));
  }, []);

  /**
   * Clearing an existing repeat.
   *
   * Separate from `decide` because it is a real write with a required written
   * reason, not a UI toggle: the server records who cleared a repeat and why,
   * and `promoteStudent` refuses anyone still flagged. So it prompts rather than
   * silently reverting, and a cancel leaves the decision untouched.
   */
  const onClearRepeat = async (student) => {
    const reason = window.prompt(
      `Clear the repeat flag for ${student.studentName}?\n\nA reason is required and is recorded in the audit trail.`
    );
    if (!reason || reason.trim().length < 3) {
      // Left as-is rather than cleared: a refusal to give a reason is a decision
      // to keep the flag, and silently clearing it anyway would be the opposite.
      return;
    }
    try {
      await clearRepeating(student._id || student.id, reason.trim());
      decide(String(student._id || student.id), 'promote');
      success(`${student.studentName} is no longer marked as repeating`);
      refresh();
    } catch (err) {
      errorToast(err.message);
    }
  };

  const commit = async () => {
    setCommitting(true);

    const toRepeat = Object.entries(decisions)
      .filter(([, decision]) => decision === 'repeat')
      .map(([id]) => id);
    const toPromote = reviewStudents.filter(
      (s) => decisions[String(s._id || s.id)] !== 'repeat'
    );

    const failed = [];

    try {
      // Repeats first — see the ordering note on this component.
      for (const id of toRepeat) {
        const student = reviewStudents.find((s) => String(s._id || s.id) === id);
        // Already flagged server-side: `markRepeating` increments `repeatCount`
        // and refuses a second call, so re-sending it would turn an
        // already-correct flag into a reported failure. Skipped, not counted.
        if (student?.isRepeating) continue;
        try {
          await markRepeating(id, { repeatReason: 'ACADEMIC' });
        } catch (err) {
          failed.push({ name: student?.studentName || id, action: 'mark as repeating', error: err });
        }
      }

      for (const student of toPromote) {
        const id = student._id || student.id;
        try {
          await promoteStudent(id, {});
        } catch (err) {
          failed.push({ name: student.studentName || id, action: 'promote', error: err });
        }
      }

      if (failed.length) {
        warning(
          `${formatCount(failed.length)} of ${formatCount(
            reviewStudents.length
          )} students could not be processed. ${failed
            .slice(0, 3)
            .map((f) => f.name)
            .join(', ')}${failed.length > 3 ? ' and others' : ''} — open each student to check.`
        );
      } else {
        success(
          `${formatCount(toPromote.length)} promoted, ${formatCount(toRepeat.length)} marked as repeating`
        );
      }

      // A fresh wizard afterwards: the students have moved, so the old decisions
      // describe a state that no longer exists and would re-apply to whoever now
      // sits in those classes.
      setDecisions({});
      refresh();
      onRosterChanged?.();
      setStep(2);
    } finally {
      setCommitting(false);
    }
  };

  const onGraduate = async (payload) => {
    setGraduating(true);
    try {
      const result = await bulkGraduate(schoolId, payload);
      setGraduationResult(result);
      const graduated = result?.summary?.graduated || 0;
      const ineligible = result?.summary?.ineligible || 0;

      if (graduated) {
        success(`${formatCount(graduated)} students graduated and moved to Alumni`);
      }
      if (ineligible) {
        // Said out loud rather than left in the result object: "ineligible" here
        // means they were in a class the server does not treat as final, and
        // silently skipping them is how a class goes missing from a cohort.
        warning(
          `${formatCount(ineligible)} ${
            ineligible === 1 ? 'student was' : 'students were'
          } skipped — not in a final-year class.`
        );
      }
      refresh();
      onRosterChanged?.();
    } catch (err) {
      errorToast(err.message);
      throw err;
    } finally {
      setGraduating(false);
    }
  };

  if (!classes.length) {
    return (
      <div className="flex flex-wrap items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
        <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
        <p className="flex-1 text-[13px] font-semibold text-amber-900">
          <span className="font-extrabold">This school has no classes yet.</span>{' '}
          Promotions map one class onto the next, so there is nothing to promote
          until your class list is set up.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ol className="flex flex-wrap items-center gap-2" aria-label="Promotion progress">
        {STEPS.map((item, index) => {
          const active = index === step;
          const done = index < step;
          return (
            <li key={item.key} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStep(index)}
                aria-current={active ? 'step' : undefined}
                className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[12px] font-extrabold transition-colors ${
                  active
                    ? 'bg-brand-700 text-white'
                    : done
                      ? 'bg-brand-50 text-brand-800 hover:bg-brand-100'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                    active ? 'bg-white/20' : done ? 'bg-brand-700 text-white' : 'bg-white/60'
                  }`}
                >
                  {done ? <Check className="h-3 w-3" aria-hidden="true" /> : index + 1}
                </span>
                {item.label}
              </button>
              {index < STEPS.length - 1 && (
                <ArrowRight className="h-3.5 w-3.5 text-slate-300" aria-hidden="true" />
              )}
            </li>
          );
        })}
      </ol>

      {error && (
        <div className="flex flex-wrap items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
          <p className="flex-1 text-[13px] font-semibold text-red-900">
            <span className="font-extrabold">The promotion preview could not be loaded.</span>{' '}
            {error.message}
          </p>
        </div>
      )}

      {step === 0 && (
        <>
          <ClassMappingStep
            matrix={matrix}
            classes={classes}
            onTargetChange={setTarget}
            onReset={resetTargets}
            hasOverrides={hasOverrides}
            loading={loading}
            error={error}
          />

          <PromotionSummary totals={totals} />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex-1 text-[12px] font-semibold text-slate-500">
              Nothing is written on this step. The next step shows every student
              individually so you can hold anyone back.
            </p>
            <button
              type="button"
              onClick={() => setStep(1)}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-[13px] font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 disabled:opacity-50"
            >
              Review {formatCount(totals.promoting)} students
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </>
      )}

      {step === 1 && (
        <>
          <PromotionReviewStep
            students={reviewStudents}
            decisions={decisions}
            onDecide={decide}
            onClearRepeat={onClearRepeat}
            classes={classes}
            loading={loading}
            error={error}
            busy={committing}
          />

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4">
            <button
              type="button"
              onClick={() => setStep(0)}
              disabled={committing}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-extrabold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to mapping
            </button>

            <div className="flex items-center gap-4">
              <p className="text-[12px] font-semibold text-slate-500">
                <span className="font-extrabold text-ink">
                  {formatCount(totals.promoting - totals.repeating)} promoting
                </span>
                {totals.repeating > 0 && (
                  <>
                    {' · '}
                    <span className="font-extrabold text-amber-700">
                      {formatCount(totals.repeating)} repeating
                    </span>
                  </>
                )}
              </p>
              <button
                type="button"
                onClick={commit}
                disabled={committing || !reviewStudents.length}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-[13px] font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                {committing ? 'Committing…' : 'Confirm all promotions'}
              </button>
            </div>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <GraduationStep
            classes={finalClasses}
            students={finalStudents}
            schoolId={schoolId}
            onConfirm={onGraduate}
            busy={graduating}
            result={graduationResult}
          />

          <div className="flex justify-start">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-extrabold text-slate-600 transition-colors hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to student review
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default PromotionsTab;
