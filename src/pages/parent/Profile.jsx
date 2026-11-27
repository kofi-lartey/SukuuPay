import { Link } from 'react-router-dom';
import {
  Bell,
  ChevronRight,
  FileText,
  HelpCircle,
  History,
  LogOut,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Shield,
  Sparkles,
  Calendar,
  Wallet,
} from 'lucide-react';
import { useParentPay } from '../../layouts/ParentLayout';
import StudentRow from '../../components/parent/shared/StudentRow';
import SectionLabel from '../../components/parent/shared/SectionLabel';

const Row = ({ to, icon: Icon, label, trailing, badge, external }) => {
  const content = (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
        <Icon className="h-[17px] w-[17px]" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1 truncate text-[14px] font-bold text-slate-800">
        {label}
      </span>
      {badge ? (
        <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-100 px-1.5 text-[10.5px] font-extrabold tabular-nums text-amber-900">
          {badge}
        </span>
      ) : null}
      {trailing ? <span className="text-[12px] text-slate-500">{trailing}</span> : null}
      {!external ? (
        <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
      ) : null}
    </>
  );

  const className =
    'flex min-h-[52px] items-center gap-3 rounded-xl px-3 transition-colors hover:bg-slate-50';

  return external ? (
    <a href={to} className={className}>
      {content}
    </a>
  ) : (
    <Link to={to} className={className}>
      {content}
    </Link>
  );
};

const Profile = () => {
  const { token, student, school, unreadCount, logout } = useParentPay();

  return (
    <div className="space-y-6">
      <StudentRow
        student={student}
        school={school}
        trailing={
          <Link
            to={PARENT_ROUTES.portal(token)}
            className="text-[12px] font-extrabold text-[#0A5C36] hover:underline"
          >
            Switch
          </Link>
        }
      />

      {/* Portal sections */}
      <section>
        <SectionLabel className="mb-2 px-1">My child</SectionLabel>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-1 shadow-sm">
          <Row to={PARENT_ROUTES.fees(token)} icon={Wallet} label="Fees & Payments" />
          <Row
            to={PARENT_ROUTES.attendance(token)}
            icon={Calendar}
            label="Attendance"
          />
          <Row
            to={PARENT_ROUTES.records(token)}
            icon={FileText}
            label="Terminal Records"
          />
          <Row
            to={PARENT_ROUTES.timetable(token)}
            icon={Calendar}
            label="Timetable"
          />
        </div>
      </section>

      {/* Communication */}
      <section>
        <SectionLabel className="mb-2 px-1">Communication</SectionLabel>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-1 shadow-sm">
          <Row
            to={PARENT_ROUTES.messages(token)}
            icon={MessageCircle}
            label="Messages"
            badge={unreadCount > 0 ? unreadCount : undefined}
          />
          <Row
            to={PARENT_ROUTES.notifications(token)}
            icon={Bell}
            label="Notifications"
          />
          <Row
            to={PARENT_ROUTES.support(token)}
            icon={Mail}
            label="Message the school"
          />
        </div>
      </section>

      {/* Billing */}
      <section>
        <SectionLabel className="mb-2 px-1">Billing</SectionLabel>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-1 shadow-sm">
          <Row
            to={PARENT_ROUTES.history(token)}
            icon={History}
            label="Payment history"
          />
          <Row
            to={PARENT_ROUTES.plan(token)}
            icon={Sparkles}
            label="Payment plan"
          />
        </div>
      </section>

      {/* School contact */}
      <section>
        <SectionLabel className="mb-2 px-1">School</SectionLabel>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <p className="text-[14px] font-extrabold text-slate-900">
            {school?.name || 'School'}
          </p>
          {school?.address ? (
            <p className="mt-1 flex items-start gap-1.5 text-[12.5px] text-slate-500">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {school.address}
              {school.city ? `, ${school.city}` : ''}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {school?.phone ? (
              <a
                href={`tel:${school.phone}`}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[12.5px] font-extrabold text-slate-700 transition-colors hover:border-emerald-200 hover:bg-emerald-50 hover:text-[#0A5C36]"
              >
                <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                Call school
              </a>
            ) : null}
            {school?.email ? (
              <a
                href={`mailto:${school.email}`}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[12.5px] font-extrabold text-slate-700 transition-colors hover:border-emerald-200 hover:bg-emerald-50 hover:text-[#0A5C36]"
              >
                <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                Email school
              </a>
            ) : null}
          </div>
        </div>
      </section>

      {/* Legal + support */}
      <section>
        <SectionLabel className="mb-2 px-1">Support</SectionLabel>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-1 shadow-sm">
          <Row to="https://sukuupay.com/help" icon={HelpCircle} label="Help & FAQ" external />
          <Row
            to="https://sukuupay.com/privacy"
            icon={Shield}
            label="Privacy policy"
            external
          />
          <Row
            to="https://sukuupay.com/terms"
            icon={FileText}
            label="Terms of service"
            external
          />
        </div>
      </section>

      {/* Account */}
      <section>
        <SectionLabel className="mb-2 px-1">Account</SectionLabel>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={logout}
            className="flex w-full min-h-[52px] items-center gap-3 rounded-xl px-3 transition-colors hover:bg-red-50 text-red-600 font-bold text-[14px]"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
              <LogOut className="h-[17px] w-[17px]" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1 truncate">Log out</span>
            <span className="text-[12px] text-slate-500">End session</span>
          </button>
        </div>
      </section>

      <p className="pt-2 text-center text-[11px] font-semibold text-slate-400">
        SukuuPay v1.0 · Sukuu Sika Mu Nti
      </p>
    </div>
  );
};

export default Profile;
