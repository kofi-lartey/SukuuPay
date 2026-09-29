import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Check, Zap } from 'lucide-react';

const PLANS = [
  {
    name: 'Starter',
    capacity: 'Up to 300 students',
    blurb: 'Ideal for small private basic schools, kindergartens, and nurseries.',
    termly: 150,
    monthly: 165,
    termNote: 'Billed GHS 450 per term (1 term = 3 months)',
    features: [
      'Bulk student upload (CSV/Excel)',
      'All MoMo networks (MTN, Telecel, AT)',
      'Automated SMS fee reminders',
      'Instant downloadable PDF receipts',
      'Basic bursar collections dashboard',
      'Email and WhatsApp support',
    ],
    cta: { label: 'Get Started', to: '/signup' },
  },
  {
    name: 'Growth',
    capacity: '301–1,000 students',
    blurb: 'Established Basic, JHS, and growing preparatory academies.',
    termly: 250,
    monthly: 275,
    termNote: 'Billed GHS 750 per term (save 10% vs monthly)',
    highlight: true,
    highlightNote: {
      label: 'Direct Bank Sweep',
      value: 'Daily T+0',
    },
    features: [
      'Structured installment plans (2–6 tranches)',
      'Installment compliance & arrears dashboard',
      'Cash flow forecasting & velocity analytics',
      'Automated GhIPSS daily bank sweeps to GCB/Ecobank',
      'Priority Bursar WhatsApp support',
    ],
    cta: { label: 'Get Started with Growth', to: '/signup' },
  },
  {
    name: 'Campus',
    capacity: '1,000+ students',
    blurb: 'Large schools, multi-campus groups, and Senior High Schools.',
    termly: 400,
    monthly: 440,
    termNote: 'Billed GHS 1,200 per term (dedicated infrastructure)',
    features: [
      'Multi-campus & multi-signatory financial controls',
      'Custom audit reports & MoE compliance exports',
      'Dedicated school success account manager',
      'SIS & School ERP API integration',
      'Custom SMS Sender ID branding (e.g. ACHIMOTA-SCH)',
    ],
    cta: { label: 'Contact Campus Sales', to: '/contact' },
  },
];

const GHS = (amount) => amount.toLocaleString('en-GH');

const Pricing = () => {
  const [isTermly, setIsTermly] = useState(true);

  return (
    <div className="bg-slate-50/60">
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        {/* Section Header */}
        <div className="mx-auto mb-10 max-w-3xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand-200/60 bg-brand-50 px-3.5 py-1.5">
            <span className="h-2 w-2 rounded-full bg-brand-600" />
            <span className="text-xs font-bold uppercase tracking-wider text-brand-800">
              Transparent &amp; Affordable
            </span>
          </div>

          <h1 className="text-balance font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl lg:text-5xl">
            Simple Pricing for Every School Size
          </h1>

          <p className="mt-4 text-base text-slate-600 sm:text-lg">
            Setup fee is completely waived for the first 5 pilot schools in Greater Accra and
            Eastern regions. No hidden transaction deduction on standard fees.
          </p>
        </div>

        {/* Billing Toggle */}
        <div className="mb-16 flex flex-col items-center">
          <div
            role="radiogroup"
            aria-label="Billing cycle"
            className="mb-3 flex items-center gap-1 rounded-full bg-slate-200/80 p-1.5 shadow-inner"
          >
            <button
              type="button"
              role="radio"
              aria-checked={isTermly}
              onClick={() => setIsTermly(true)}
              className={`flex items-center gap-2 rounded-full px-6 py-2.5 text-xs font-bold transition-all ${
                isTermly
                  ? 'bg-brand-800 text-white shadow-md'
                  : 'text-slate-600 hover:text-ink'
              }`}
            >
              <span>Termly Billing</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] ${
                  isTermly ? 'bg-amber-400 text-ink' : 'bg-brand-700 text-white'
                }`}
              >
                Best Value
              </span>
            </button>

            <button
              type="button"
              role="radio"
              aria-checked={!isTermly}
              onClick={() => setIsTermly(false)}
              className={`rounded-full px-6 py-2.5 text-xs font-bold transition-all ${
                !isTermly
                  ? 'bg-brand-800 text-white shadow-md'
                  : 'text-slate-600 hover:text-ink'
              }`}
            >
              Monthly Billing
            </button>
          </div>

          <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <span aria-hidden="true">📅</span>
            Ghana Academic Calendar: 3 terms per standard school year (Jan – Dec)
          </p>
        </div>

        {/* Plan Cards */}
        <div className="mb-16 grid grid-cols-1 items-stretch gap-8 lg:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col justify-between rounded-3xl bg-white p-8 ${
                plan.highlight
                  ? 'border-2 border-brand-700 shadow-xl'
                  : 'border border-slate-200 shadow-soft'
              }`}
            >
              {plan.highlight && (
                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-amber-400 px-4 py-1 text-[11px] font-bold uppercase tracking-wider text-ink shadow-sm">
                  👑 Most Popular
                </span>
              )}

              <div>
                <div
                  className={`mb-4 flex items-center justify-between gap-3 ${
                    plan.highlight ? 'mt-2' : ''
                  }`}
                >
                  <h2 className="font-display text-2xl font-extrabold text-ink">{plan.name}</h2>
                  <span
                    className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${
                      plan.highlight
                        ? 'bg-brand-50 text-brand-800'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {plan.capacity}
                  </span>
                </div>

                <p className="mb-6 text-sm text-slate-600">{plan.blurb}</p>

                <div className="mb-6 border-b border-slate-100 pb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-xs font-bold text-slate-500">GHS</span>
                    <span className="font-display text-4xl font-extrabold text-ink">
                      {GHS(isTermly ? plan.termly : plan.monthly)}
                    </span>
                    <span className="text-xs text-slate-500">/ month</span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {isTermly ? plan.termNote : 'Billed monthly, cancel anytime'}
                  </p>
                </div>

                {plan.highlight && plan.highlightNote && (
                  <div className="mb-6 flex items-center justify-between rounded-xl border border-brand-100 bg-brand-50/70 p-2.5 text-xs font-medium text-brand-900">
                    <span className="flex items-center gap-1.5">
                      <Zap size={14} className="text-brand-700" />
                      {plan.highlightNote.label}
                    </span>
                    <span className="rounded bg-brand-700 px-2 py-0.5 text-[10px] font-bold text-white">
                      {plan.highlightNote.value}
                    </span>
                  </div>
                )}

                <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  {plan.name === 'Starter'
                    ? 'Everything included:'
                    : `Everything in ${PLANS[PLANS.indexOf(plan) - 1].name}, plus:`}
                </p>

                <ul className="mb-8 space-y-3 text-sm text-slate-700">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5">
                      <Check size={16} className="mt-0.5 shrink-0 text-brand-600" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>

              <Link
                to={plan.cta.to}
                className={`w-full rounded-xl py-3.5 text-center text-sm font-bold transition-colors ${
                  plan.highlight
                    ? 'bg-brand-800 text-white shadow-md hover:bg-brand-900'
                    : 'bg-slate-100 text-ink hover:bg-slate-200'
                }`}
              >
                {plan.cta.label}
              </Link>
            </div>
          ))}
        </div>

        {/* Social Proof Strip */}
        <div className="flex flex-col items-center justify-between gap-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-soft sm:p-8 md:flex-row">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-800">
              <Building2 size={24} />
            </div>
            <div>
              <p className="text-sm font-bold text-ink sm:text-base">
                Trusted by over 180 Ghanaian private institutions
              </p>
              <p className="text-xs text-slate-500">
                From pre-schools in East Legon to high schools in Tema &amp; Kumasi
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-8 text-center">
            <div>
              <p className="font-display text-2xl font-extrabold text-ink">GH₵ 34.2M</p>
              <p className="text-[11px] uppercase text-slate-500">Fees collected in 2024</p>
            </div>
            <div className="border-l border-slate-200 pl-8">
              <p className="font-display text-2xl font-extrabold text-ink">99.8%</p>
              <p className="text-[11px] uppercase text-slate-500">MoMo success rate</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Pricing;