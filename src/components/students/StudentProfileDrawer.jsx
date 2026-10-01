import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarClock,
  CircleAlert,
  History,
  Receipt,
  ShieldCheck,
  Star,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import Card from '../dashboard/ui/Card';
import Badge from '../dashboard/ui/Badge';
import ProgressBar from '../dashboard/charts/ProgressBar';
import { FeeStatusBadge, PlanStatusBadge, StatusBadge } from './StudentBadges';
import StudentAvatar from './StudentAvatar';
import { getStudentProfile } from '../../services/students';
import { formatCedi, formatCediShort, formatPercent } from '../../utils/format';
import { formatGhanaPhone } from '../../utils/ghanaPhone';

const TABS = [
  { key: 'overview', label: 'Overview', icon: Wallet },
  { key: 'payments', label: 'Payments', icon: Receipt },
  { key: 'plan', label: 'Plan', icon: CalendarClock },
  { key: 'guardians', label: 'Guardians', icon: Users },
  { key: 'history', label: 'History', icon: History },
];

/**
 * The student profile preview.
 *
 * **One request, not five.** The drawer shows the student, their guardians, the
 * plan, their payments and their history at once. Assembled client-side those
 * arrive at different times, and the screen renders a half-populated student for
 * as long as the slowest one is loading — most visibly a balance reading
 * GH₵ 0.00 next to payments that do not add up to it. `GET /students/:id/profile`
 * returns the whole aggregate, and the loading state is an explicit skeleton
 * rather than a partially filled form.
 *
 * **Phone numbers are shown in full here.** The roster masks them, because a
 * roster is a browsing surface. This is a school admin looking at one named
 * student in order to call them about money, and a masked number makes the screen
 * useless for the one thing it is opened for.
 */
const StudentProfileDrawer = ({ open, studentId, onClose, onArchived }) => {
  const [tab, setTab] = useState('overview');
  const [state, setState] = useState({ data: null, loading: false, error: null });

  useEffect(() => {
    if (!open || !studentId) return undefined;
    let active = true;

    setState({ data: null, loading: true, error: null });
    setTab('overview');

    getStudentProfile(studentId)
      .then((data) => {
        if (active) setState({ data, loading: false, error: null });
      })
      .catch((error) => {
        if (active) setState({ data: null, loading: false, error });
      });

    return () => {
      active = false;
    };
  }, [open, studentId]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    // The page behind must not scroll while the drawer does.
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  const { data, loading, error } = state;
  const student = data?.student;
  const primaryGuardian = (data?.guardians || []).find((g) => g.isPrimary) || data?.guardians?.[0];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close the student profile"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-ink/40 backdrop-blur-[2px]"
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={student ? `${student.studentName}'s profile` : 'Student profile'}
        className="relative flex h-full w-full max-w-2xl flex-col overflow-y-auto bg-slate-50 shadow-2xl"
      >
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              {/* The drawer is the detail view for one student, so it is the
                  last place a photo should be missing. `xl` rather than a
                  larger bespoke size: `StudentAvatar` owns its sizes so the
                  roster, drawer and wizard stay consistent. */}
              <span className="mt-0.5">
                <StudentAvatar student={student} size="xl" />
              </span>
              <div className="min-w-0">
              {loading && <div className="h-6 w-48 animate-pulse rounded bg-slate-200" />}
              {student && (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-lg font-extrabold tracking-tight text-ink">
                      {student.studentName}
                    </h2>
                    <StatusBadge status={student.status} />
                    {student.isRepeating && <Badge tone="amber">Repeating</Badge>}
                  </div>
                  <p className="mt-0.5 text-[12px] font-semibold text-slate-500">
                    {student.studentId} · {student.studentClass}
                    {student.academicYear ? ` · ${student.academicYear}` : ''}
                  </p>
                </>
              )}
              {error && (
                <p className="flex items-center gap-2 text-sm font-bold text-red-600">
                  <CircleAlert className="h-4 w-4" aria-hidden="true" />
                  {error.message}
                </p>
              )}
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-ink"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {student && (
            <nav aria-label="Profile sections" className="mt-4 -mb-4 flex gap-5 overflow-x-auto">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  aria-current={tab === t.key ? 'page' : undefined}
                  className={`whitespace-nowrap border-b-2 pb-3 pt-1 text-[13px] font-extrabold transition-colors ${
                    tab === t.key
                      ? 'border-brand-700 text-brand-800'
                      : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-ink'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </nav>
          )}
        </header>

        <div className="flex-1 space-y-4 p-5">
          {loading && (
            <div className="space-y-3">
              <div className="h-24 animate-pulse rounded-2xl bg-slate-200/60" />
              <div className="h-40 animate-pulse rounded-2xl bg-slate-200/60" />
            </div>
          )}

          {student && tab === 'overview' && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Figure label="Total owed" value={formatCediShort(student.totalOwed)} />
                <Figure label="Paid" value={formatCediShort(student.totalPaid)} tone="text-brand-700" />
                <Figure
                  label="Balance"
                  value={formatCediShort(student.balance)}
                  tone={student.balance > 0 ? 'text-red-600' : 'text-emerald-600'}
                />
                <Figure label="Fee status" value={<FeeStatusBadge student={student} />} />
              </div>

              <Card padding="p-5">
                <h3 className="mb-3 text-sm font-extrabold text-ink">Details</h3>
                <dl className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
                  {[
                    { label: 'Gender', value: student.gender },
                    {
                      label: 'Date of birth',
                      value: student.dateOfBirth
                        ? new Date(student.dateOfBirth).toLocaleDateString('en-GB')
                        : 'Not recorded',
                    },
                    { label: 'Class', value: student.studentClass },
                    {
                      label: 'Deadline',
                      value: student.deadline
                        ? new Date(student.deadline).toLocaleDateString('en-GB')
                        : '—',
                    },
                    {
                      label: 'Primary guardian',
                      value: primaryGuardian
                        ? `${primaryGuardian.parentName}${
                            primaryGuardian.phone
                              ? ` · ${formatGhanaPhone(primaryGuardian.phone)}`
                              : ''
                          }`
                        : '—',
                    },
                    { label: 'Pay link', value: student.payLink || 'Not generated' },
                  ].map((row) => (
                    <div key={row.label} className="min-w-0">
                      <dt className="text-[11px] font-extrabold uppercase tracking-wide text-slate-400">
                        {row.label}
                      </dt>
                      <dd className="truncate text-[13px] font-bold text-ink">{row.value}</dd>
                    </div>
                  ))}
                </dl>
              </Card>

              {(student.certificateNumber || student.honors !== 'NONE') && (
                <Card padding="p-5">
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-ink">
                    <Star className="h-4 w-4 text-amber-500" aria-hidden="true" />
                    Graduation
                  </h3>
                  <dl className="grid grid-cols-2 gap-3">
                    <div>
                      <dt className="text-[11px] font-extrabold uppercase tracking-wide text-slate-400">
                        Certificate
                      </dt>
                      <dd className="text-[13px] font-bold text-ink">
                        {student.certificateNumber || '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-extrabold uppercase tracking-wide text-slate-400">
                        Honors
                      </dt>
                      <dd className="text-[13px] font-bold text-ink">
                        {student.honors === 'NONE' ? '—' : student.honors.replace(/_/g, ' ')}
                      </dd>
                    </div>
                  </dl>
                </Card>
              )}

              {student.transferOutRecord?.destinationInstitution && (
                <Card padding="p-5" className="border-blue-200 bg-blue-50/40">
                  <h3 className="mb-2 text-sm font-extrabold text-ink">Transferred to</h3>
                  <p className="text-[13px] font-bold text-slate-700">
                    {student.transferOutRecord.destinationInstitution}
                  </p>
                  <p className="mt-0.5 text-[12px] font-semibold text-slate-500">
                    {student.transferOutDate
                      ? new Date(student.transferOutDate).toLocaleDateString('en-GB')
                      : ''}
                    {student.transferOutRecord.recordsTransferred
                      ? ' · records transferred'
                      : ' · records not transferred'}
                  </p>
                </Card>
              )}
            </>
          )}

          {student && tab === 'payments' && (
            <Card padding="p-0">
              <div className="border-b border-slate-100 px-5 py-4">
                <h3 className="text-sm font-extrabold text-ink">Payment history</h3>
                <p className="text-[12px] font-semibold text-slate-500">
                  The 20 most recent settlements.
                </p>
              </div>
              {data.recentPayments?.length ? (
                <ul className="divide-y divide-slate-100">
                  {data.recentPayments.map((payment) => (
                    <li key={payment._id} className="flex items-center justify-between gap-3 px-5 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-extrabold text-ink">
                          {formatCedi(payment.amount)}
                        </p>
                        <p className="text-[11px] font-semibold text-slate-500">
                          {payment.paymentMethod?.toUpperCase()} ·{' '}
                          {new Date(payment.createdAt).toLocaleDateString('en-GB')}
                        </p>
                      </div>
                      <Badge
                        tone={payment.status === 'completed' ? 'green' : payment.status === 'failed' ? 'red' : 'slate'}
                      >
                        {payment.status}
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-5 py-8 text-center text-[13px] font-semibold text-slate-400">
                  No payments recorded against this student.
                </p>
              )}
            </Card>
          )}

          {student && tab === 'plan' && (
            <Card padding="p-5">
              {data.installmentProgress ? (
                <>
                  <div className="mb-3 flex items-baseline justify-between gap-3">
                    <h3 className="text-sm font-extrabold text-ink">Installment progress</h3>
                    <p className="text-[13px] font-extrabold tabular-nums text-brand-700">
                      {formatPercent(data.installmentProgress.percent)}
                    </p>
                  </div>
                  <ProgressBar
                    value={data.installmentProgress.percent}
                    label="Installments paid"
                    barClassName="bg-brand-600"
                  />
                  <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
                    <div>
                      <dt className="text-[11px] font-extrabold uppercase text-slate-400">Paid</dt>
                      <dd className="text-[13px] font-extrabold text-ink">
                        {data.installmentProgress.paid}/{data.installmentProgress.total}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-extrabold uppercase text-slate-400">Paid</dt>
                      <dd className="text-[13px] font-extrabold text-brand-700">
                        {formatCediShort(data.installmentProgress.paidAmount)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-extrabold uppercase text-slate-400">Next due</dt>
                      <dd className="text-[13px] font-extrabold text-ink">
                        {data.installmentProgress.nextDueDate
                          ? new Date(data.installmentProgress.nextDueDate).toLocaleDateString('en-GB')
                          : '—'}
                      </dd>
                    </div>
                  </dl>
                </>
              ) : (
                <div className="text-center">
                  <p className="text-sm font-bold text-ink">No installment plan</p>
                  <p className="mt-1 text-[13px] font-semibold text-slate-500">
                    This student is billed as a single amount due by{' '}
                    {student.deadline ? new Date(student.deadline).toLocaleDateString('en-GB') : 'no deadline'}.
                  </p>
                  <Link
                    to={`/dashboard/installment-plans?student=${encodeURIComponent(student.studentId)}`}
                    className="mt-3 inline-block text-[13px] font-extrabold text-brand-700 hover:text-brand-800"
                  >
                    Create a plan →
                  </Link>
                </div>
              )}
            </Card>
          )}

          {student && tab === 'guardians' && (
            <>
              {data.guardians?.length ? (
                <ul className="space-y-3">
                  {data.guardians.map((guardian) => (
                    <Card key={guardian._id} padding="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-extrabold text-ink">
                            {guardian.parentName}
                          </p>
                          <p className="text-[12px] font-semibold capitalize text-slate-500">
                            {guardian.relationship}
                            {guardian.phone ? ` · ${formatGhanaPhone(guardian.phone)}` : ''}
                          </p>
                          {guardian.email && (
                            <p className="truncate text-[12px] font-semibold text-slate-500">
                              {guardian.email}
                            </p>
                          )}
                        </div>
                        {guardian.isPrimary ? (
                          <Badge tone="green" icon={ShieldCheck}>
                            Primary
                          </Badge>
                        ) : (
                          <Badge tone="slate">Secondary</Badge>
                        )}
                      </div>
                    </Card>
                  ))}
                </ul>
              ) : (
                <Card padding="p-6">
                  <p className="text-center text-[13px] font-semibold text-slate-500">
                    No guardians recorded. At least one is required.
                  </p>
                </Card>
              )}

              {data.emergencyContacts?.length > 0 && (
                <Card padding="p-5">
                  <h3 className="mb-3 text-sm font-extrabold text-ink">Emergency contacts</h3>
                  <ul className="space-y-2">
                    {data.emergencyContacts.map((contact, index) => (
                      <li key={index} className="text-[13px] font-semibold text-slate-600">
                        {contact.contactName} · {contact.relationship} ·{' '}
                        {formatGhanaPhone(contact.phone)}
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </>
          )}

          {student && tab === 'history' && (
            <>
              <Card padding="p-5">
                <h3 className="mb-3 text-sm font-extrabold text-ink">Class history</h3>
                {data.classHistory?.length ? (
                  <ol className="space-y-2.5">
                    {data.classHistory
                      .slice()
                      .reverse()
                      .map((entry, index) => (
                        <li key={index} className="flex items-start gap-3 text-[13px]">
                          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600" aria-hidden="true" />
                          <span>
                            <span className="font-extrabold text-ink">
                              {entry.from} → {entry.to}
                            </span>
                            <span className="block text-[11px] font-semibold text-slate-500">
                              {new Date(entry.date).toLocaleDateString('en-GB')}
                              {entry.reason ? ` · ${entry.reason}` : ''}
                            </span>
                          </span>
                        </li>
                      ))}
                  </ol>
                ) : (
                  <p className="text-[13px] font-semibold text-slate-400">
                    No class changes recorded.
                  </p>
                )}
              </Card>

              <Card padding="p-5">
                <h3 className="mb-3 text-sm font-extrabold text-ink">Recent activity</h3>
                {data.auditTrail?.length ? (
                  <ul className="space-y-2">
                    {data.auditTrail.map((entry) => (
                      <li key={entry._id} className="flex items-center justify-between gap-3 text-[12px]">
                        <span className="font-extrabold text-ink">{entry.action}</span>
                        <span className="shrink-0 text-slate-400">
                          {new Date(entry.createdAt).toLocaleString('en-GB', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[13px] font-semibold text-slate-400">
                    No activity recorded yet.
                  </p>
                )}
              </Card>
            </>
          )}
        </div>
      </aside>
    </div>
  );
};

const Figure = ({ label, value, tone = 'text-ink' }) => (
  <div className="rounded-xl bg-white p-4 shadow-soft">
    <p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-400">{label}</p>
    <p className={`mt-1 text-lg font-extrabold tabular-nums ${tone}`}>{value}</p>
  </div>
);

export default StudentProfileDrawer;
