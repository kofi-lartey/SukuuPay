import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  MapPin,
  ShieldCheck,
  User,
  ChevronLeft,
  ChevronRight,
  Zap,
  TrendingUp,
  Award
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
import { PasswordStrength } from '../../components/auth/CodeInput';
import { Field, FormAlert, PrefixedField, SelectField } from '../../components/common/FormField';
import { GHANA_REGIONS, SCHOOL_CLASSIFICATIONS } from '../../utils/constants';

// Sliding Carousel Data for the Signup Aside panel
const signupSlideContent = [
  {
    badge: "TERM 1 & 2 ADMISSIONS LIVE",
    title: "Start Collecting Fees the Smart Way.",
    description: "Eliminate cash leakage, automate MoMo reconciliation, and offer flexible installment plans parents love.",
    icon: TrendingUp,
    highlight: "Zero onboarding & maintenance fees for pilot schools.",
    stat: "GH₵ 42M+ Disbursed"
  },
  {
    badge: "INSTITUTIONAL AUTOMATION",
    title: "Instant Push-USSD to Parent Handsets.",
    description: "Accept payments straight via MTN MoMo, Telecel Cash & AT Money with real-time bursary dashboard updates.",
    icon: Zap,
    highlight: "99.8% MoMo SLA uptime guarantee across all networks.",
    stat: "140+ Partner Schools"
  },
  {
    badge: "VERIFIED EXCELLENCE",
    title: "Empowering Top Ghanaian Institutions.",
    description: "Join leading basic and high schools scaling their bursary operations securely and efficiently.",
    icon: Award,
    highlight: "Reconcile 1,200+ student payments in just 15 minutes.",
    stat: "5.0 Verified Rating"
  }
];

const SignupAsideCarousel = () => {
  const [currentSlide, setCurrentSlide] = useState(0);

  // Auto-advance slides every 5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % signupSlideContent.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % signupSlideContent.length);
  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + signupSlideContent.length) % signupSlideContent.length);

  const slide = signupSlideContent[currentSlide];
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
            type="button"
            onClick={prevSlide}
            aria-label="Previous slide"
            className="p-1 rounded-md hover:bg-emerald-800 text-emerald-200 hover:text-white transition-colors"
          >
            <ChevronLeft size={14} />
          </button>
          <button 
            type="button"
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
          {signupSlideContent.map((_, idx) => (
            <button
              key={idx}
              type="button"
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

const EMPTY_FORM = {
  schoolName: '',
  schoolClassification: '',
  region: '',
  principalName: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
  agreed: false,
};

const validate = (form) => {
  const errors = {};

  if (!form.principalName.trim()) errors.principalName = 'Enter the headteacher’s full name';
  if (!form.schoolName.trim()) errors.schoolName = 'Enter your school’s registered name';
  if (!form.schoolClassification) errors.schoolClassification = 'Select a category';
  if (!form.region) errors.region = 'Select a region';
  if (!/^\S+@\S+\.\S+$/.test(form.email)) errors.email = 'Enter a valid email address';
  if (form.phone.replace(/\D/g, '').length < 9) errors.phone = 'Enter a valid Ghanaian number';

  if (form.password.length < 8) errors.password = 'Password must be at least 8 characters';
  else if (!/[a-zA-Z]/.test(form.password) || !/\d/.test(form.password)) {
    errors.password = 'Include at least one letter and one number';
  }

  if (form.password !== form.confirmPassword) errors.confirmPassword = 'Passwords do not match';
  if (!form.agreed) errors.agreed = 'You must accept the terms to continue';

  return errors;
};

const PasswordConfirm = ({ value, onChange, error }) => {
  const [visible, setVisible] = useState(false);
  return (
    <Field
      label="Confirm password"
      required
      icon={ShieldCheck}
      type={visible ? 'text' : 'password'}
      autoComplete="new-password"
      placeholder="Re-enter password"
      value={value}
      onChange={onChange}
      error={error}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((prev) => !prev)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="transition-colors hover:text-slate-700 text-slate-400"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      }
    />
  );
};

const Signup = () => {
  const { signup } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const set = (name) => (event) => {
    const value =
      event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError('');

    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setLoading(true);
    try {
      const response = await signup({
        name: form.principalName.trim(),
        email: form.email.trim().toLowerCase(),
        phone: `+233${form.phone.replace(/\D/g, '').replace(/^233/, '')}`,
        password: form.password,
        position: form.schoolClassification,
        school: {
          name: form.schoolName.trim(),
          classification: form.schoolClassification,
          region: form.region,
        },
      });
      setResult(response);
    } catch (error) {
      setFormError(error.message || 'Failed to create account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const email = form.email.trim().toLowerCase();

  if (result) {
    return (
      <AuthShell
        aside={<SignupAsideCarousel />}
        eyebrow="Account created"
        title="Check your inbox"
        description={`We sent a ${
          result.verification?.expiresInMinutes ?? 15
        }-minute verification code to ${email}.`}
      >
        <div className="flex flex-col items-center rounded-xl border border-brand-200 bg-brand-50 px-5 py-6 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-700 text-white shadow-md">
            <CheckCircle2 className="h-6 w-6" />
          </span>
          <h2 className="mt-3 text-base font-extrabold text-ink">Account setup initiated</h2>
          <p className="mt-1.5 max-w-sm text-[12px] sm:text-[13px] leading-relaxed text-slate-600">
            Thank you, <span className="font-bold text-ink">{form.schoolName}</span>. Verify your
            email to activate the account, then our onboarding bursar in Accra/Tema will reach out
            within two hours.
          </p>
        </div>

        <div className="mt-4 space-y-3">
          <button
            type="button"
            onClick={() => navigate(`/verify-email?email=${encodeURIComponent(email)}`)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-[13px] font-extrabold text-white shadow-sm transition-colors hover:bg-brand-800"
          >
            Enter verification code
            <ArrowRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setResult(null);
              setForm(EMPTY_FORM);
            }}
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-[12px] font-bold text-slate-700 transition-colors hover:bg-slate-50"
          >
            Register another school
          </button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      aside={<SignupAsideCarousel />}
      eyebrow="Onboarding"
      title="Create your school account"
      description="Join leading Ghanaian private and international basic & high schools."
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-3.5">
        {formError && <FormAlert>{formError}</FormAlert>}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field
            label="School name"
            required
            icon={Building2}
            placeholder="Prampram Basic & JHS"
            value={form.schoolName}
            onChange={set('schoolName')}
            error={errors.schoolName}
          />
          <SelectField
            label="Classification"
            required
            value={form.schoolClassification}
            onChange={set('schoolClassification')}
            error={errors.schoolClassification}
          >
            <option value="">Select category...</option>
            {SCHOOL_CLASSIFICATIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectField>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SelectField
            label="Region"
            required
            icon={MapPin}
            value={form.region}
            onChange={set('region')}
            error={errors.region}
          >
            <option value="">Select region...</option>
            {GHANA_REGIONS.map((region) => (
              <option key={region} value={region}>
                {region}
              </option>
            ))}
          </SelectField>
          <Field
            label="Headteacher / principal"
            required
            icon={User}
            placeholder="Dr. Kwame Mensah"
            value={form.principalName}
            onChange={set('principalName')}
            error={errors.principalName}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field
            label="Official work email"
            required
            hint="Where receipts go"
            icon={Mail}
            type="email"
            placeholder="admin@school.edu.gh"
            value={form.email}
            onChange={set('email')}
            error={errors.email}
          />
          <PrefixedField
            label="Contact phone"
            required
            hint="MoMo enabled"
            prefix={
              <>
                <span aria-hidden="true">🇬🇭</span>
                <span>+233</span>
              </>
            }
            type="tel"
            inputMode="tel"
            placeholder="24 456 7890"
            value={form.phone}
            onChange={set('phone')}
            error={errors.phone}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Field
              label="Password"
              required
              icon={Lock}
              type="password"
              autoComplete="new-password"
              placeholder="Min 8 characters"
              value={form.password}
              onChange={set('password')}
              error={errors.password}
            />
            <PasswordStrength password={form.password} />
          </div>
          <PasswordConfirm
            value={form.confirmPassword}
            onChange={set('confirmPassword')}
            error={errors.confirmPassword}
          />
        </div>

        <div className="flex items-start gap-2.5 pt-1">
          <input
            id="agreed"
            type="checkbox"
            checked={form.agreed}
            onChange={set('agreed')}
            aria-invalid={errors.agreed ? 'true' : undefined}
            className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 text-brand-700 focus:ring-2 focus:ring-brand-700/40 accent-emerald-800"
          />
          <label htmlFor="agreed" className="cursor-pointer text-[12px] leading-relaxed text-slate-600 font-medium">
            I agree to the{' '}
            <Link to="/terms" className="font-bold text-brand-700 underline">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link to="/privacy" className="font-bold text-brand-700 underline">
              Privacy Policy
            </Link>
            , and confirm I am authorised to represent this institution.
          </label>
        </div>
        {errors.agreed && <p className="text-[11px] font-semibold text-red-600">{errors.agreed}</p>}

        <div className="pt-1">
          <SubmitButton pending={loading} pendingLabel="Creating account…" icon={ArrowRight}>
            Create school account
          </SubmitButton>
        </div>

        <OrDivider />

        <button
          type="button"
          onClick={() => setFormError('Google Workspace sign-in is not enabled yet — use the form above.')}
          className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[12px] font-bold text-slate-700 transition-colors hover:bg-slate-50 shadow-sm"
        >
          <GoogleMark />
          Continue with Google Workspace
        </button>

        <AuthLinks>
          <span className="text-slate-600 text-xs">Already registered?</span>
          <AsideLink to="/login">Log in instead</AsideLink>
        </AuthLinks>
      </form>
    </AuthShell>
  );
};

export default Signup;