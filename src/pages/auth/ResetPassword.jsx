import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  ArrowLeft, 
  Mail, 
  MailCheck, 
  Send, 
  ChevronLeft, 
  ChevronRight,
  ShieldCheck,
  Lock,
  RefreshCw,
  HelpCircle
} from 'lucide-react';
import { requestPasswordReset } from '../../services/auth';
import AuthShell from '../../components/auth/AuthShell';
import {
  AsideLink,
  AuthLinks,
  SubmitButton,
} from '../../components/auth/OnboardingAside';
import { Field, FormAlert } from '../../components/common/FormField';

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

// Sliding Carousel Data for the Recovery Aside panel
const recoverySlideContent = [
  {
    badge: "SECURE ACCOUNT RECOVERY",
    title: "Never Lose Access to Your Bursary.",
    description: "Instant, encrypted token generation sent straight to your verified administrative email address.",
    icon: Lock,
    highlight: "Tokens expire strictly after 30 minutes for maximum security.",
    stat: "Bank-Grade Encryption"
  },
  {
    badge: "INSTANT SUPPORT",
    title: "Stuck? Our Local Team is Ready.",
    description: "Get real-time assistance from our technical support desk stationed right here in Ghana.",
    icon: HelpCircle,
    highlight: "Average response time under 4 minutes during working hours.",
    stat: "24/7 Monitoring"
  },
  {
    badge: "SEAMLESS TRANSITION",
    title: "Back to Fee Collections in Seconds.",
    description: "Quickly recover your credentials and resume tracking student term payments and MoMo reconciliations.",
    icon: RefreshCw,
    highlight: "Compatible with all registered school admin profiles.",
    stat: "100% Secure"
  }
];

const RecoveryAsideCarousel = () => {
  const [currentSlide, setCurrentSlide] = useState(0);

  // Auto-advance slides every 5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % recoverySlideContent.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % recoverySlideContent.length);
  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + recoverySlideContent.length) % recoverySlideContent.length);

  const slide = recoverySlideContent[currentSlide];
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
          {recoverySlideContent.map((_, idx) => (
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

const ResetPassword = () => {
  const [params] = useSearchParams();
  const [email, setEmail] = useState(params.get('email') || '');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    const normalized = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(normalized)) {
      setError('Enter the email address registered to your school.');
      return;
    }

    setLoading(true);
    try {
      await requestPasswordReset(normalized);
      setSent(true);
    } catch (err) {
      setError(err.message || 'Failed to send the reset link. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const target = email.trim().toLowerCase();

  return (
    <AuthShell
      aside={<RecoveryAsideCarousel />}
      eyebrow="Password recovery"
      title={sent ? 'Check your inbox' : 'Reset your password'}
      description={
        sent
          ? 'If that address belongs to a SukuuPay account, a reset link is on its way.'
          : "Enter your school's work email and we'll send a secure reset link."
      }
    >
      {sent ? (
        <div className="space-y-4">
          <div className="flex flex-col items-center rounded-xl border border-brand-200 bg-brand-50 px-5 py-6 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-700 text-white shadow-md">
              <MailCheck className="h-6 w-6" />
            </span>
            <h2 className="mt-3 text-base font-extrabold text-ink">Link sent</h2>
            <p className="mt-1.5 max-w-sm text-[12px] sm:text-[13px] leading-relaxed text-slate-600">
              We emailed a reset link to <span className="font-bold text-ink">{target}</span>. It
              expires in 30 minutes and can only be used once.
            </p>
          </div>

          <AuthLinks>
            <span className="text-slate-600 text-xs">
              Nothing arrived?{' '}
              <button
                type="button"
                onClick={() => setSent(false)}
                className="font-bold text-brand-700 hover:underline"
              >
                Try another email
              </button>
            </span>
            <AsideLink to="/login">
              <span className="inline-flex items-center gap-1.5 text-xs">
                <ArrowLeft className="h-3 w-3" />
                Back to sign in
              </span>
            </AsideLink>
          </AuthLinks>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="space-y-3.5">
          {error && <FormAlert>{error}</FormAlert>}

          <Field
            label="School work email"
            icon={Mail}
            type="email"
            autoComplete="email"
            placeholder="admin@school.edu.gh"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setError('');
            }}
            required
          />

          <div className="pt-1">
            <SubmitButton pending={loading} pendingLabel="Sending link…" icon={Send}>
              Send reset link
            </SubmitButton>
          </div>

          <AuthLinks>
            <span className="text-slate-600 text-xs">Remembered it?</span>
            <AsideLink to="/login">
              <span className="inline-flex items-center gap-1.5 text-xs">
                <ArrowLeft className="h-3 w-3" />
                Back to sign in
              </span>
            </AsideLink>
          </AuthLinks>
        </form>
      )}
    </AuthShell>
  );
};

export default ResetPassword;