import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ClipboardList,
  FileSpreadsheet,
  Lock,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import { ROUTES } from '../utils/constants';

const USE_CASES = [
  {
    icon: FileSpreadsheet,
    title: 'Reopening day without queues',
    body: 'Import the whole roster before term starts and issue every student a payable code. Reopening no longer depends on a bursar and a cash box being in the same room.',
  },
  {
    icon: ClipboardList,
    title: 'End-of-term reconciliation',
    body: 'Every MoMo payment lands against a student ledger the moment it settles, so the term closes in minutes rather than being reconstructed from notebooks.',
  },
  {
    icon: TrendingUp,
    title: 'Chasing arrears without awkwardness',
    body: 'Automated SMS nudges go out on schedule from your registered sender ID. The bursar stops being the family’s reminder service.',
  },
  {
    icon: Lock,
    title: 'Cash off the premises',
    body: 'Mobile money and direct bank settlement remove physical cash from the collection process, which removes the largest single source of leakage.',
  },
];

const AUDIENCES = [
  {
    title: 'Basic & Junior High Schools',
    body: 'Fee structures built around a term, with parents frequently paying in small instalments across the term rather than in one sum.',
  },
  {
    title: 'Senior High Schools',
    body: 'Larger intakes and boarding fees, with a Bursar’s office that needs grade-level and per-stream reporting for the administration.',
  },
  {
    title: 'Private & International Schools',
    body: 'Multi-term invoices, custom fee categories and parents who expect receipts and remittance advice to reconcile against their own records.',
  },
];

const ForSchools = () => (
  <div className="bg-slate-50/60">
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
      {/* Header */}
      <div className="mx-auto mb-16 max-w-3xl text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand-200/60 bg-brand-50 px-3.5 py-1.5">
          <span className="h-2 w-2 rounded-full bg-brand-600" />
          <span className="text-xs font-bold uppercase tracking-wider text-brand-800">
            Built for Ghanaian Schools
          </span>
        </div>

        <h1 className="text-balance font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl lg:text-5xl">
          Built Specifically for Basic, JHS &amp; SHS Schools
        </h1>

        <p className="mt-4 text-base text-slate-600 sm:text-lg">
          Eliminate long queues on reopening day, eradicate cash theft risks, and give your bursars
          instant reconciliation with bank-grade security.
        </p>
      </div>

      {/* Use cases */}
      <div className="mb-20 grid grid-cols-1 gap-6 md:grid-cols-2">
        {USE_CASES.map(({ icon: Icon, title, body }) => (
          <div
            key={title}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft sm:p-8"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-800">
              <Icon size={24} />
            </div>
            <h2 className="font-display mb-2 text-xl font-bold text-ink">{title}</h2>
            <p className="text-sm leading-relaxed text-slate-600">{body}</p>
          </div>
        ))}
      </div>

      {/* Audiences */}
      <div className="mb-20 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {AUDIENCES.map(({ title, body }) => (
          <div
            key={title}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft sm:p-8"
          >
            <div className="mb-4 flex items-center gap-2.5">
              <Building2 size={20} className="shrink-0 text-brand-700" />
              <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
            </div>
            <p className="text-sm leading-relaxed text-slate-600">{body}</p>
          </div>
        ))}
      </div>

      {/* Compliance strip */}
      <div className="mb-16 grid grid-cols-1 gap-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-soft sm:p-8 md:grid-cols-3">
        {[
          { icon: ShieldCheck, label: 'Bank of Ghana / GhIPSS compliant settlement' },
          { icon: CheckCircle2, label: 'NCA-registered SMS sender ID' },
          { icon: Lock, label: 'Act 843 data protection compliant' },
        ].map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-center gap-3">
            <Icon size={20} className="shrink-0 text-brand-700" />
            <p className="text-sm font-semibold text-slate-700">{label}</p>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="flex flex-col items-center justify-between gap-6 rounded-2xl bg-brand-900 p-8 text-center text-white shadow-xl sm:p-10 lg:flex-row lg:text-left">
        <div className="space-y-2">
          <h2 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
            Request school onboarding
          </h2>
          <p className="text-sm text-brand-100 sm:text-base">
            Ten minutes to set up, free onboarding, and a bursar on hand in Prampram, Tema and
            Accra to help load your roster.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-center gap-3">
          <Link
            to={ROUTES.CONTACT}
            className="rounded-xl bg-white px-6 py-3 text-sm font-bold text-brand-900 shadow-sm transition-colors hover:bg-brand-50"
          >
            Talk to the team
          </Link>
          <Link
            to={ROUTES.SIGNUP}
            className="flex items-center gap-2 rounded-xl border border-brand-600 bg-brand-800 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
          >
            Create school account
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  </div>
);

export default ForSchools;
