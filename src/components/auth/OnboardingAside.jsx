import React from 'react';
import { Link } from 'react-router-dom';
import { useCallback, useState } from 'react';
import { SchoolAdCarousel } from './SchoolAdCarousel';
import {
  BadgeCheck,
  Building2,
  Fingerprint,
  KeyRound,
  Lock,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Star,
  Zap,
} from 'lucide-react';

const METRICS = [
  { value: 'GH₵ 42M+', label: 'Disbursed', tone: 'text-amber-300' },
  { value: '140+', label: 'Schools', tone: 'text-white' },
  { value: '99.8%', label: 'MoMo SLA', tone: 'text-emerald-300' },
];

const DotPattern = () => (
  <div
    aria-hidden="true"
    className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]"
  />
);

const Pill = ({ children }) => (
  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-900/50 px-3 py-1.5">
    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-300" />
    <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-100">
      {children}
    </span>
  </div>
);

/** One-line feature rows. Deliberately not cards: cards stacked taller than
 *  the form and set the page height, which is what pushed the CTA down. */
const FeatureList = ({ items, className = '' }) => (
  <ul className={`space-y-2.5 ${className}`}>
    {items.map(({ icon: Icon, label }) => (
      <li key={label} className="flex items-start gap-2.5 text-[13px] leading-snug text-emerald-50">
        <Icon className="mt-px h-4 w-4 shrink-0 text-amber-300" />
        {label}
      </li>
    ))}
  </ul>
);

/** Fallback row, rendered only while no ad is live. */
const Metrics = () => (
  <dl className="grid h-full grid-cols-3 items-center gap-3 border-t border-white/10 pt-5 text-center">
    {METRICS.map((metric) => (
      <div key={metric.label}>
        <dt className={`text-lg font-extrabold leading-none ${metric.tone}`}>{metric.value}</dt>
        <dd className="mt-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-200/80">
          {metric.label}
        </dd>
      </div>
    ))}
  </dl>
);

/**
 * Advertisement band with a metrics fallback.
 *
 * The slot is a fixed 200px box from first paint, so the aside does not change
 * height when the fetch resolves: metrics occupy it until live ads arrive, then
 * the carousel takes over the same box. The CTA position is stable either way.
 */
const SchoolAdSlot = ({ placement }) => {
  const [hasAds, setHasAds] = useState(false);
  const handleCount = useCallback((total) => setHasAds(total > 0), []);

  return (
    <div className="relative z-10 mt-6 h-[200px] border-t border-white/10 pt-5">
      {!hasAds && <Metrics />}
      {hasAds && <SchoolAdCarousel placement={placement} className="h-full" onCountChange={handleCount} />}
    </div>
  );
};

const AsideFrame = ({ pill, headline, description, features, children }) => (
  <aside className="relative flex flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-800 via-brand-700 to-brand-900 p-8 text-white lg:col-span-5">
    <DotPattern />

    <div className="relative z-10 space-y-5">
      {pill && <Pill>{pill}</Pill>}

      <div>
        <h2 className="text-[1.75rem] font-extrabold leading-[1.15] tracking-tight">
          {headline}
        </h2>
        <p className="mt-2 text-[13px] font-medium leading-relaxed text-emerald-100/90">
          {description}
        </p>
      </div>

      {features && <FeatureList items={features} />}

      {children}
    </div>

    {/* The advertisement occupies the metrics row's slot rather than adding a
     *  new band, so the aside does not grow and the form CTA stays put. The
     *  metrics are the fallback shown when no ad is live. */}
    <SchoolAdSlot placement="auth_aside" />

    <p className="relative z-10 mt-5 border-t border-white/10 pt-5 text-center text-[11px] font-medium text-emerald-200/80">
      © 2026 SukuuPay Ghana Ltd. Made with pride in Ghana 🇬🇭
    </p>
  </aside>
);

const Callout = ({ tone = 'emerald', title, children }) => {
  const tones = {
    emerald: 'border-white/10 bg-white/5',
    amber: 'border-amber-300/30 bg-amber-300/10',
  };
  return (
    <div className={`rounded-xl border p-4 ${tones[tone]}`}>
      {title && (
        <p className="text-[11px] font-extrabold uppercase tracking-wider text-amber-300">
          {title}
        </p>
      )}
      <p className={`text-[12px] leading-relaxed text-emerald-50 ${title ? 'mt-1.5' : ''}`}>
        {children}
      </p>
    </div>
  );
};

const Steps = ({ items }) => (
  <ol className="rounded-xl border border-white/10 bg-white/5 p-4">
    <p className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-200/80">
      What happens next
    </p>
    {items.map((step, index) => (
      <li key={step} className="mt-2.5 flex items-start gap-2.5 text-[13px] text-emerald-50">
        <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-amber-300 text-[11px] font-extrabold leading-none text-brand-900">
          {index + 1}
        </span>
        {step}
      </li>
    ))}
  </ol>
);

/**
 * Bursar endorsement. Kept compact and outside `SchoolAdSlot`: the ad/metrics
 * band is a fixed 200px box, so this sits above it without shifting the aside
 * height when the ad fetch resolves.
 */
const Testimonial = ({ quote, name, role, initials }) => (
  <figure className="rounded-xl border border-white/10 bg-white/5 p-4">
    <div className="flex items-center gap-1" aria-label="Rated 5 out of 5">
      {Array.from({ length: 5 }).map((_, index) => (
        <Star key={index} className="h-3 w-3 fill-amber-300 text-amber-300" aria-hidden="true" />
      ))}
    </div>
    <blockquote className="mt-2 text-[12px] italic leading-relaxed text-emerald-50">
      {quote}
    </blockquote>
    <figcaption className="mt-2.5 flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-amber-300/40 bg-amber-300/15 text-[11px] font-extrabold text-amber-200"
      >
        {initials}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[12px] font-extrabold text-white">{name}</span>
        <span className="block truncate text-[11px] text-emerald-300">{role}</span>
      </span>
    </figcaption>
  </figure>
);

/** Marketing panel for school onboarding. */
export const OnboardingAside = () => (
  <AsideFrame
    pill="Pilot Batch Open"
    headline="Start collecting fees the smart way."
    description="Eliminate cash leakage, automate MoMo reconciliation, and offer installment plans parents actually use."
    features={[
      { icon: Zap, label: 'Free setup for pilot schools — no onboarding or maintenance fees' },
      { icon: Smartphone, label: 'MTN MoMo, Telecel Cash & AT Money with instant push-to-pay prompts' },
      { icon: Building2, label: 'Onboarding bursar on hand in Prampram, Tema & Accra' },
    ]}
  >
    <Testimonial
      initials="CO"
      name="Mrs. Cynthia Osei-Tutu"
      role="Head Bursar, Morning Star Preparatory, Cantonments"
      quote="Reconciling 1,200 student term payments used to take our bursary team two weeks. With SukuuPay it takes 15 minutes, with same-day settlement."
    />
  </AsideFrame>
);

/** Marketing panel for returning bursars signing in. */
export const LoginAside = () => (
  <AsideFrame
    pill="Bursar Workspace"
    headline="Every cedi collected. Every receipt issued."
    description="Reconcile mobile money payments, chase arrears and issue receipts without touching cash."
    features={[
      { icon: Fingerprint, label: 'Verified identity with rotating session tokens' },
      { icon: RefreshCw, label: 'Settlements sweep to your GhIPSS account as they clear' },
      { icon: MessageSquare, label: 'SMS and WhatsApp arrears nudges from the same dashboard' },
    ]}
  >
    <Callout title="This week across SukuuPay">
      12,480 MoMo prompts settled · GH₵ 1.9M swept to partner schools · zero failed webhook
      deliveries.
    </Callout>
  </AsideFrame>
);

/** Marketing panel for the recovery request screen. */
export const RecoveryAside = () => (
  <AsideFrame
    pill="Account Recovery"
    headline="Locked out? Your bursar is on it."
    description="Resetting is self-service and takes under a minute. If the account was deactivated, our Accra desk can restore it."
    features={[
      { icon: KeyRound, label: 'Single-use reset links, hashed and cleared on use' },
      { icon: ShieldCheck, label: 'Changing your password signs out every device' },
      { icon: Lock, label: 'We never confirm whether an address is registered' },
    ]}
  >
    <Callout tone="amber" title="Never share your code">
      SukuuPay staff will never ask for your password, reset link or verification code. End the
      conversation and call the helpdesk.
    </Callout>
  </AsideFrame>
);

/** Marketing panel for email verification. */
export const VerifyAside = () => (
  <AsideFrame
    pill="Email Verification"
    headline="One step from your bursar seat."
    description="Verification confirms the bursary inbox can receive receipts, payment alerts and arrears reminders."
    features={[
      { icon: MessageSquare, label: 'Every automated receipt is sent to this address' },
      { icon: RefreshCw, label: 'Codes expire in 15 minutes; requesting a new one voids the old' },
      { icon: BadgeCheck, label: 'One-way door — the verified address is permanent' },
    ]}
  >
    <Steps
      items={[
        'Enter the 6-digit code from your email',
        'Your bursary inbox is confirmed',
        'Log in and upload your student roster',
      ]}
    />
  </AsideFrame>
);

/** Compact aside for the "set a new password" screen, reached by email link. */
export const ResetPasswordAside = () => (
  <AsideFrame
    pill="Password Reset"
    headline="Choose a password only you know."
    description="Something you have not used on SukuuPay before. Minimum eight characters, with at least one letter and one number."
    features={[
      { icon: KeyRound, label: 'Never reuse your school password here' },
      { icon: ShieldCheck, label: 'Saving revokes all active sessions, including this one' },
      { icon: BadgeCheck, label: 'We email a confirmation so any change is visible' },
    ]}
  />
);

export const GoogleMark = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.13 0-5.78-2.11-6.73-4.96H1.18v3.15C3.17 21.36 7.23 24 12 24z"
    />
    <path
      fill="#FBBC05"
      d="M5.27 14.24c-.25-.72-.38-1.49-.38-2.24s.13-1.52.38-2.24V6.61H1.18C.43 8.12 0 9.81 0 12s.43 3.88 1.18 5.39l4.09-3.15z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.23 0 3.17 2.64 1.18 6.61l4.09 3.15c.95-2.85 3.6-4.96 6.73-4.96z"
    />
  </svg>
);

export const OrDivider = ({ label = 'or' }) => (
  <div className="flex items-center gap-3">
    <span className="h-px flex-grow bg-slate-200" />
    <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
      {label}
    </span>
    <span className="h-px flex-grow bg-slate-200" />
  </div>
);

/** Shared secondary-action block used under primary auth forms. */
export const AuthLinks = ({ children }) => (
  <div className="flex flex-col items-center justify-between gap-2 text-[13px] sm:flex-row">
    {children}
  </div>
);

export const AsideLink = ({ to, children }) => (
  <Link to={to} className="font-bold text-brand-700 hover:underline">
    {children}
  </Link>
);

/**
 * Primary submit button. Sticks to the bottom of the viewport below `sm` so
 * the main action is never lost on short screens.
 */
export const SubmitButton = ({ children, pending, pendingLabel, icon: Icon, ...props }) => (
  <div className="sticky bottom-0 -mx-8 -mb-8 z-20 mt-1 border-t border-slate-100 bg-white/95 px-8 py-3 backdrop-blur-sm sm:static sm:mx-0 sm:mb-0 sm:mt-2 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
    <button
      type="submit"
      disabled={pending}
      className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-700 px-4 py-3 text-[15px] font-extrabold text-white shadow-lift transition-all hover:bg-brand-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
      {...props}
    >
      {pending ? pendingLabel : children}
      {!pending && Icon && <Icon className="h-4 w-4" />}
    </button>
  </div>
);

export default OnboardingAside;
