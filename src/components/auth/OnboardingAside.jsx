import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  BadgeCheck,
  Building2,
  ChevronLeft,
  ChevronRight,
  Fingerprint,
  KeyRound,
  Lock,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Zap, Mail, CheckCircle2, 
} from 'lucide-react';

/**
 * The band shown when no school advert is live.
 *
 * This was three fabricated platform metrics — "GH₵ 42M+ Disbursed", "140+
 * Schools", "99.8% MoMo SLA" — presented as a track record. None had a source:
 * there is no aggregate over the schools collection that produces any of them,
 * and the seeded ad band they backfilled rendered on top of it whenever the ad
 * fetch was empty, which is the normal case on a fresh deployment.
 *
 * It is now what is actually true and checkable: which networks are enabled,
 * where the money settles, and what a term looks like. `school.payment.networksEnabled`
 * and `gatewayMode` make the first two real configuration rather than marketing,
 * and the third is just a description of the domain. **No numbers.**
 */
const METRICS = [
  { value: 'MTN · Telecel · AT', label: 'Mobile money', tone: 'text-amber-300' },
  { value: 'Local', label: 'Settlement', tone: 'text-white' },
  { value: 'Termly', label: 'Billing cycle', tone: 'text-emerald-300' },
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

/** Real platform configuration — which networks, where money settles, what a term looks like. */
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

    {/* Fixed-height platform facts: which networks, where money settles,
     *  what a term looks like. The slot is 200px so the aside does not
     *  change height on first paint. */}
    <div className="relative z-10 mt-6 h-[200px] border-t border-white/10 pt-5">
      <Metrics />
    </div>

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
 * The `Testimonial` component is deliberately gone rather than refilled.
 *
 * It rendered a five-star endorsement attributed to "Mrs. Cynthia Osei-Tutu,
 * Head Bursar, Morning Star Preparatory, Cantonments", claiming a named school's
 * bursary team cut a 1,200-payment reconciliation from two weeks to fifteen
 * minutes. Neither the person nor the school nor the result existed, and it sat
 * on /signup as though they did. A real quote needs a real customer who has
 * agreed to be named — until there is one, the slot stays empty rather than
 * carrying an invention.
 */

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
  />
  );

/** Marketing panel for returning bursars signing in. */
export const LoginAside = () => (
  <AsideFrame
    pill="Bursar Workspace"
    headline="Every cedi collected. Every receipt issued."
    description="Reconcile mobile money payments, chase arrears and issue receipts without touching cash."
    features={[
      { icon: Fingerprint, label: 'Verified identity with rotating session tokens' },
      { icon: RefreshCw, label: 'Collections reconcile against student balances automatically' },
      { icon: MessageSquare, label: 'SMS and WhatsApp arrears nudges from the same dashboard' },
    ]}
  />
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
      SukuuPay staff will never ask for your password, reset link or verification code. End
      the conversation and email hello@sukuupay.com from the address on your account.
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

// Sliding Carousel Data for the Reset Password Aside panel
const resetPasswordSlideContent = [
  {
    badge: "PASSWORD RESET",
    title: "Reset your password.",
    description: "Create a new password for your SukuuPay account.",
    icon: Lock,
    highlight: "Choose something only you know.",
    stat: "Secure reset"
  },
  {
    badge: "ACCOUNT SECURITY",
    title: "Protect your account.",
    description: "Use a strong, unique password you haven't used before.",
    icon: ShieldCheck,
    highlight: "At least 8 characters with a letter and number.",
    stat: "Strong password"
  },
  {
    badge: "ALMOST DONE",
    title: "You're almost there.",
    description: "Save your new password to finish resetting.",
    icon: KeyRound,
    highlight: "You'll be signed in after saving.",
    stat: "One last step"
  }
];

/** Compact aside for the "set a new password" screen, reached by email link. */
export const ResetPasswordAside = () => {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % resetPasswordSlideContent.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % resetPasswordSlideContent.length);
  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + resetPasswordSlideContent.length) % resetPasswordSlideContent.length);

  const slide = resetPasswordSlideContent[currentSlide];
  const IconComponent = slide.icon;

  return (
    <div className="h-full flex flex-col justify-between bg-[#0A5C36] text-white p-6 sm:p-8 relative overflow-hidden">
      {/* Background Pattern Overlay */}
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:14px_14px] pointer-events-none"></div>

      {/* Top Brand Header inside Aside */}
      <div className="relative z-10 flex items-center justify-between">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-900/80 border border-emerald-700/50 backdrop-blur-md">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-200">
            {slide.badge}
          </span>
        </div>

        {/* Carousel Controls */}
        <div className="flex items-center gap-1 bg-emerald-900/60 p-1 rounded-lg border border-emerald-700/50">
          <button
            onClick={prevSlide}
            aria-label="Previous slide"
            className="p-1 rounded-md hover:bg-emerald-800 text-emerald-200 hover:text-white transition-colors"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={nextSlide}
            aria-label="Next slide"
            className="p-1 rounded-md hover:bg-emerald-800 text-emerald-200 hover:text-white transition-colors"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Dynamic Sliding Content */}
      <div className="relative z-10 my-auto py-6 transition-all duration-500 ease-in-out">
        <div className="w-10 h-10 rounded-xl bg-amber-400 text-gray-900 flex items-center justify-center mb-4 shadow-md shadow-amber-400/20">
          <IconComponent size={20} />
        </div>

        <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight leading-snug mb-2">
          {slide.title}
        </h2>
        <p className="text-emerald-100 text-xs sm:text-sm leading-relaxed mb-4">
          {slide.description}
        </p>

        <div className="bg-emerald-900/40 border border-emerald-700/40 rounded-lg p-3 backdrop-blur-sm">
          <p className="text-[11px] font-semibold text-amber-300 flex items-center gap-1.5">
            <span>✨</span> {slide.highlight}
          </p>
        </div>
      </div>

      {/* Footer Indicators & Stat */}
      <div className="relative z-10 pt-4 border-t border-emerald-800/80 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {resetPasswordSlideContent.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentSlide(idx)}
              aria-label={`Go to slide ${idx + 1}`}
              className={`h-1 rounded-full transition-all ${
                currentSlide === idx ? 'w-5 bg-amber-400' : 'w-1 bg-emerald-700 hover:bg-emerald-600'
              }`}
            />
          ))}
        </div>

        <div className="text-right">
          <span className="text-[11px] font-bold text-white uppercase tracking-wider">{slide.stat}</span>
        </div>
      </div>
    </div>
  );
};

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
