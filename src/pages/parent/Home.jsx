import { Link } from 'react-router-dom';
import {
  CalendarCheck,
  CheckCircle2,
  Clock,
  FileText,
  History,
  Mail,
  MessageCircle,
  Phone,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { useParentPay } from '../../layouts/ParentLayout';
import { PARENT_ROUTES } from '../../utils/constants';
import { deadlinePhrase, formatCedi, formatDate, paidPercent } from '../../utils/parentFormat';
import StudentRow from '../../components/parent/shared/StudentRow';
import SectionLabel from '../../components/parent/shared/SectionLabel';

const BalanceHero = ({ student, token }) => {
  const owed = Number(student?.totalOwed) || 0;
  const paid = Number(student?.totalPaid) || 0;
  const balance = Number(student?.balance) || Math.max(owed - paid, 0);
  const pct = paidPercent(paid, owed);
  const due = deadlinePhrase(student?.deadline);
  const isOverdue = Boolean(student?.isOverdue) || due?.startsWith('Overdue');

  return (
    <div className="overflow-hidden rounded-2xl bg-[#0A5C36] p-5 text-white shadow-sm">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-emerald-200">
        Term fee balance
      </p>
      <p className="mt-2 text-[34px] font-extrabold leading-none tabular-nums">
        {formatCedi(balance)}
      </p>

      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/20">
        <div className="h-full rounded-full bg-white" style={{ width: `${pct}%` }} />
      </div>

      <div className="mt-3 flex items-center justify-between text-[12px] font-semibold text-emerald-100">
        <span>Paid {formatCedi(paid)}</span>
        <span>Owed {formatCedi(owed)}</span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {due ? (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${
              isOverdue ? 'bg-red-100 text-red-800' : 'bg-[#F2B705] text-[#0A5C36]'
            }`}
          >
            <Clock className="h-3 w-3" aria-hidden="true" />
            {due}
          </span>
        ) : null}
      </div>

      <Link
        to={PARENT_ROUTES.fees(token)}
        className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white text-[14px] font-extrabold text-[#0A5C36] transition-colors hover:bg-emerald-50"
      >
        <Wallet className="h-4 w-4" aria-hidden="true" />
        {balance > 0 ? 'Pay Now' : 'View fees'}
      </Link>
    </div>
  );
};

const QUICK_LINKS = [
  { key: 'attendance', label: 'Attendance', icon: CalendarCheck, to: (t) => PARENT_ROUTES.attendance(t) },
  { key: 'records', label: 'Records', icon: FileText, to: (t) => PARENT_ROUTES.records(t) },
  { key: 'timetable', label: 'Timetable', icon: CalendarCheck, to: (t) => PARENT_ROUTES.timetable(t) },
  { key: 'messages', label: 'Messages', icon: MessageCircle, to: (t) => PARENT_ROUTES.messages(t) },
  { key: 'history', label: 'Payments', icon: History, to: (t) => PARENT_ROUTES.history(t) },
  { key: 'plan', label: 'Plan', icon: Sparkles, to: (t) => PARENT_ROUTES.plan(t) },
];

const QuickLinks = ({ token }) => (
  <div className="grid grid-cols-3 gap-2">
    {QUICK_LINKS.map(({ key, label, icon: Icon, to }) => (
      <Link
        key={key}
        to={to(token)}
        className="flex min-h-[84px] flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200/80 bg-white p-3 text-center shadow-sm transition-colors hover:border-emerald-200 hover:bg-emerald-50"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-[#0A5C36]">
          <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
        <span className="text-[11.5px] font-extrabold text-slate-700">{label}</span>
      </Link>
    ))}
  </div>
);

const RecentPayments = ({ payments }) => {
  if (!payments?.length) return null;

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <SectionLabel className="mb-3">Recent payments</SectionLabel>
      <ul className="divide-y divide-slate-100">
        {payments.slice(0, 3).map((p) => (
          <li key={p.paymentId} className="flex items-center gap-3 py-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 className="h-4 w-4 text-emerald-700" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold tabular-nums text-ink">
                {formatCedi(p.amount)}
              </p>
              <p className="truncate text-[11px] text-slate-500">
                {formatDate(p.completedAt || p.createdAt)}
                {p.receiptNumber ? ` · ${p.receiptNumber}` : ''}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
};

const Home = () => {
  const { token, student, school, recentPayments } = useParentPay();

  return (
    <div className="space-y-5">
      <StudentRow
        student={student}
        school={school}
        trailing={
          <Link
            to={PARENT_ROUTES.profile(token)}
            className="text-[12px] font-extrabold text-[#0A5C36] hover:underline"
          >
            Switch
          </Link>
        }
      />

      <BalanceHero student={student} token={token} />

      <section>
        <SectionLabel className="mb-2 px-1">Jump to</SectionLabel>
        <QuickLinks token={token} />
      </section>

      <RecentPayments payments={recentPayments} />

      {school?.phone || school?.email ? (
        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <SectionLabel className="mb-3">School</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {school?.phone ? (
              <a
                href={`tel:${school.phone}`}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-slate-200 px-3 text-[12.5px] font-extrabold text-slate-700 transition-colors hover:border-emerald-200 hover:bg-emerald-50 hover:text-[#0A5C36]"
              >
                <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                Call school
              </a>
            ) : null}
            {school?.email ? (
              <a
                href={`mailto:${school.email}`}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-slate-200 px-3 text-[12.5px] font-extrabold text-slate-700 transition-colors hover:border-emerald-200 hover:bg-emerald-50 hover:text-[#0A5C36]"
              >
                <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                Email school
              </a>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
};

export default Home;
