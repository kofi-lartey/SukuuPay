import React, { useMemo, useState } from 'react';
import { CircleAlert, GraduationCap, ShieldCheck, Sparkles } from 'lucide-react';
import Card from '../../dashboard/ui/Card';
import Badge from '../../dashboard/ui/Badge';
import EmptyState from '../../dashboard/EmptyState';
import { SelectField } from '../../common/FormField';
import StudentAvatar from '../StudentAvatar';
import { formatCedi, formatCount } from '../../../utils/format';
import { GRADUATION_TYPES } from '../../../utils/constants';

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Step 3: the graduating cohort.
 *
 * **Outstanding balances are shown, not blocked.** A graduate who owes money is
 * the normal case at a Ghanaian basic-and-JHS school, and the ledger is the
 * reason the archive keeps the record in the first place — a graduate with a
 * live balance is *more* valuable to the alumni register than one without.
 * Refusing them would push the school toward the two behaviours that actually
 * lose money: hold certificates hostage, or graduate them and quietly write the
 * balance off. So the step says what is owed, by how many, and lets the bursar
 * proceed.
 *
 * The dry run is not decoration. `bulkGraduate` assigns certificate numbers
 * from a shared counter, so a real run consumes numbers permanently; the
 * preview shows the same summary the real call will return, with no writes.
 */
const GraduationStep = ({ classes, students, schoolId, onConfirm, busy, result }) => {
  const [graduationDate, setGraduationDate] = useState(today);
  const [graduationType, setGraduationType] = useState('STANDARD');
  const [autoAssign, setAutoAssign] = useState(true);
  const [prefix, setPrefix] = useState('CERT');

  const unsettled = useMemo(() => students.filter((s) => (s.balance || 0) > 0), [students]);
  const settledTotal = useMemo(
    () => students.reduce((sum, s) => sum + (s.totalPaid || 0), 0),
    [students]
  );
  const outstandingTotal = useMemo(
    () => unsettled.reduce((sum, s) => sum + (s.balance || 0), 0),
    [unsettled]
  );
  const collected = settledTotal + outstandingTotal;

  if (!classes.length) {
    return (
      <EmptyState
        icon={GraduationCap}
        title="No final-year class"
        description="None of your classes sit at the end of the class list, so there is no cohort to graduate. Check the class mapping in step 1."
      />
    );
  }

  if (!students.length) {
    return (
      <EmptyState
        icon={GraduationCap}
        title="No students in the final-year class"
        description={`${classes.join(', ')} ${classes.length === 1 ? 'has' : 'have'} no active students. Nobody will be graduated until someone is enrolled.`}
      />
    );
  }

  return (
    <div className="space-y-4">
      {result && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3">
          <ShieldCheck className="h-5 w-5 shrink-0 text-brand-700" aria-hidden="true" />
          <p className="flex-1 text-[13px] font-semibold text-brand-900">
            <span className="font-extrabold">
              {formatCount(result.summary?.graduated || 0)} graduated
            </span>
            {result.summary?.ineligible
              ? `, ${formatCount(result.summary.ineligible)} ineligible and not touched`
              : ''}
            . Their records are in the Alumni register with their certificates.
          </p>
        </div>
      )}

      {unsettled.length > 0 && (
        /* Amber, not red. Nothing here is wrong — a balance is a fact about a
           ledger, not an error, and red would read as "this is broken" when the
           correct action is to carry it into the alumni archive. */
        <div className="flex flex-wrap items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
          <p className="flex-1 text-[13px] font-semibold text-amber-900">
            <span className="font-extrabold">
              {formatCount(unsettled.length)} graduating{' '}
              {unsettled.length === 1 ? 'student has' : 'students have'} an outstanding balance
            </span>{' '}
            totalling {formatCedi(outstandingTotal)}. You can still graduate{' '}
            {unsettled.length === 1 ? 'them' : 'them'} — the balance is preserved in the
            alumni ledger and their guardian keeps the ability to pay.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card padding="p-0" className="overflow-hidden">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-base font-extrabold tracking-tight text-ink">
                  Graduating cohort
                </h2>
                <p className="text-[12px] font-semibold text-slate-500">
                  {classes.join(' · ')}
                </p>
              </div>
              <Badge tone="amber" icon={GraduationCap}>
                {formatCount(students.length)} students
              </Badge>
            </header>

            <ul className="max-h-[22rem] divide-y divide-slate-100 overflow-y-auto">
              {students.map((student) => {
                const guardian = (student.parents || []).find((p) => p.isPrimary);
                const owed = (student.balance || 0) > 0;
                return (
                  <li key={student._id || student.id} className="flex items-center gap-3 px-5 py-3">
                    <StudentAvatar student={student} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-extrabold text-ink">
                        {student.studentName}
                      </span>
                      <span className="block font-mono text-[11px] font-bold text-slate-500">
                        {student.studentId}
                        {guardian?.parentName ? ` · ${guardian.parentName}` : ''}
                      </span>
                    </span>
                    <span className="whitespace-nowrap text-[12px] font-semibold text-slate-500">
                      Paid {formatCedi(student.totalPaid || 0)}
                    </span>
                    {owed ? (
                      <Badge tone="amber">{formatCedi(student.balance)} due</Badge>
                    ) : (
                      <Badge tone="green">Cleared</Badge>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>

        <div className="space-y-4">
          <Card padding="p-5">
            <h3 className="mb-3 text-sm font-extrabold text-ink">Graduation details</h3>
            <div className="space-y-3">
              {/* `max` is today+30d because the server's `notInFutureDate`
                  validator rejects anything beyond it with a 422 — so the
                  constraint is on the input rather than discovered on submit. */}
              <label className="block">
                <span className="mb-0.5 block text-[11px] font-semibold text-slate-700">
                  Graduation date
                </span>
                <input
                  type="date"
                  value={graduationDate}
                  max={new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)}
                  onChange={(event) => setGraduationDate(event.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] font-semibold text-ink focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/30"
                />
              </label>

              <SelectField
                label="Graduation type"
                value={graduationType}
                onChange={(event) => setGraduationType(event.target.value)}
              >
                {GRADUATION_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectField>

              <label className="flex items-start gap-2.5 rounded-lg border border-slate-200 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={autoAssign}
                  onChange={(event) => setAutoAssign(event.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-brand-700 focus:ring-brand-700"
                />
                <span className="min-w-0">
                  <span className="block text-[12px] font-extrabold text-ink">
                    Assign certificate numbers
                  </span>
                  <span className="block text-[11px] font-semibold text-slate-500">
                    Sequenced per school from a shared counter, so no two
                    graduates collide.
                  </span>
                </span>
              </label>

              {autoAssign && (
                <label className="block">
                  <span className="mb-0.5 block text-[11px] font-semibold text-slate-700">
                    Certificate prefix
                  </span>
                  <input
                    type="text"
                    value={prefix}
                    onChange={(event) => setPrefix(event.target.value.toUpperCase())}
                    placeholder="CERT"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-[13px] font-bold text-ink focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/30"
                  />
                </label>
              )}
            </div>
          </Card>

          <Card padding="p-5">
            <h3 className="mb-3 text-sm font-extrabold text-ink">Collection summary</h3>
            <dl className="space-y-2 text-[13px]">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="font-semibold text-slate-500">Total collected</dt>
                <dd className="font-extrabold tabular-nums text-ink">{formatCedi(settledTotal)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="font-semibold text-slate-500">Outstanding</dt>
                <dd
                  className={`font-extrabold tabular-nums ${
                    outstandingTotal > 0 ? 'text-amber-700' : 'text-emerald-600'
                  }`}
                >
                  {formatCedi(outstandingTotal)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3 border-t border-slate-100 pt-2">
                <dt className="font-semibold text-slate-500">Collection rate</dt>
                <dd className="font-extrabold tabular-nums text-ink">
                  {collected > 0
                    ? `${((settledTotal / collected) * 100).toFixed(1)}%`
                    : '—'}
                </dd>
              </div>
            </dl>
          </Card>

          <button
            type="button"
            onClick={() =>
              onConfirm({
                classNames: classes,
                graduationDate,
                graduationType,
                autoAssignCertificates: autoAssign,
                certificatePrefix: autoAssign ? prefix : undefined,
              })
            }
            disabled={busy || !graduationDate}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 py-3 text-[13px] font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            {busy
              ? 'Graduating…'
              : `Graduate ${formatCount(students.length)} ${
                  students.length === 1 ? 'student' : 'students'
                }`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GraduationStep;
