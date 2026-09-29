import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  AlertCircle, 
  Eye, 
  EyeOff, 
  Lock, 
  LogIn, 
  Mail, 
  ShieldAlert, 
  ChevronLeft, 
  ChevronRight,
  Smartphone,
  Gift,
  Headphones
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import AuthShell from '../../components/auth/AuthShell';
import {
  AsideLink,
  AuthLinks,
  GoogleMark,
  OrDivider,
  SubmitButton,
} from '../../components/auth/OnboardingAside';
import { Field } from '../../components/common/FormField';

// Sliding Carousel Data for the Login Aside panel
const slideContent = [
  {
    badge: "TERM 1 & 2 ADMISSIONS LIVE",
    title: "Start Collecting Fees the Smart Way.",
    description: "Eliminate cash leakage, automate MoMo reconciliation, and offer flexible installment plans parents love.",
    icon: Gift,
    highlight: "Zero onboarding & maintenance fees for pilot schools.",
    stat: "GH₵ 42M+ Disbursed"
  },
  {
    badge: "INSTITUTIONAL AUTOMATION",
    title: "Instant Push-USSD to Parent Handsets.",
    description: "Accept payments straight via MTN MoMo, Telecel Cash & AT Money with real-time bursary dashboard updates.",
    icon: Smartphone,
    highlight: "99.8% MoMo SLA uptime guarantee across all networks.",
    stat: "140+ Partner Schools"
  },
  {
    badge: "DEDICATED SUPPORT",
    title: "Local Onboarding & Roster Uploads.",
    description: "Hands-on local account representatives to help your bursary team transition smoothly.",
    icon: Headphones,
    highlight: "Reconcile 1,200+ student payments in just 15 minutes.",
    stat: "5.0 Verified Rating"
  }
];

const LoginAsideCarousel = () => {
  const [currentSlide, setCurrentSlide] = useState(0);

  // Auto-advance slides every 5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slideContent.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % slideContent.length);
  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + slideContent.length) % slideContent.length);

  const slide = slideContent[currentSlide];
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
          {slideContent.map((_, idx) => (
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

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();

  const redirectTo = params.get('next') || location.state?.from?.pathname || '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [needsVerification, setNeedsVerification] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setNeedsVerification(false);
    setLoading(true);

    try {
      await login(email.trim().toLowerCase(), password);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      if (err.code === 'EMAIL_NOT_VERIFIED') {
        setNeedsVerification(true);
        setError('Your email address is not verified yet. Enter your code to finish setting up.');
      } else {
        setError(err.message || 'Failed to log in. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      aside={<LoginAsideCarousel />}
      eyebrow="Bursar sign in"
      title="Welcome back"
      description="Sign in with the work email your school registered with."
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-3.5">
        {error && (
          <div
            className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-[12px] font-semibold ${
              needsVerification
                ? 'border-amber-200 bg-amber-50 text-amber-800'
                : 'border-red-200 bg-red-50 text-red-700'
            }`}
          >
            {needsVerification ? (
              <ShieldAlert className="mt-px h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="mt-px h-4 w-4 shrink-0" />
            )}
            <span>
              {error}
              {needsVerification && (
                <>
                  {' '}
                  <Link
                    to={`/verify-email?email=${encodeURIComponent(email.trim().toLowerCase())}`}
                    className="underline font-bold"
                  >
                    Verify now
                  </Link>
                  .
                </>
              )}
            </span>
          </div>
        )}

        <Field
          label="Work email"
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

        <Field
          label="Password"
          icon={Lock}
          type={showPassword ? 'text' : 'password'}
          autoComplete="current-password"
          placeholder="Enter your password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setError('');
          }}
          required
          trailing={
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="transition-colors hover:text-slate-700 text-slate-400"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          }
        />

        <div className="flex items-center justify-between pt-0.5">
          <label className="flex cursor-pointer items-center gap-2 text-[12px] text-slate-600 font-medium">
            <input
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-2 focus:ring-brand-700/40 accent-emerald-800"
            />
            Keep me signed in
          </label>
          <Link
            to={`/reset-password${
              email ? `?email=${encodeURIComponent(email.trim().toLowerCase())}` : ''
            }`}
            className="text-[12px] font-bold text-emerald-800 hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        <div className="pt-1">
          <SubmitButton pending={loading} pendingLabel="Signing in…" icon={LogIn}>
            Sign in
          </SubmitButton>
        </div>

        <OrDivider />

        <button
          type="button"
          onClick={() =>
            setError('Google Workspace sign-in is not enabled yet — use your email and password.')
          }
          className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[12px] font-bold text-slate-700 transition-colors hover:bg-slate-50 shadow-sm"
        >
          <GoogleMark />
          Continue with Google Workspace
        </button>

        <AuthLinks>
          <span className="text-slate-600 text-xs">New to SukuuPay?</span>
          <AsideLink to="/signup">Create a school account</AsideLink>
        </AuthLinks>
      </form>
    </AuthShell>
  );
};

export default Login;