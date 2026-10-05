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
  SubmitButton,
} from '../../components/auth/OnboardingAside';
import GoogleSignInButton from '../../components/auth/GoogleSignInButton';
import { PasswordStrength } from '../../components/auth/CodeInput';
import { Field, FormAlert, PrefixedField, SelectField } from '../../components/common/FormField';
import { signInWithGoogle } from '../../services/auth';
import RoleSelector from '../../components/auth/RoleSelector';
import PositionSelect from '../../components/auth/PositionSelect';
import {
  GHANA_REGIONS,
  OTHER_POSITION,
  SCHOOL_CLASSIFICATIONS,
  canCreateSchool,
} from '../../utils/constants';

// Sliding Carousel Data for the Signup Aside panel
//
// Same fabricated track-record figures the login carousel carried, and the same
// orphaned 1,200-student reconciliation claim: "GH₵ 42M+ Disbursed", "140+ Partner
// Schools", "5.0 Verified Rating". See the note in Login.jsx.
const signupSlideContent = [
  {
    badge: "TERM 1 & 2 ADMISSIONS LIVE",
    title: "Start Collecting Fees the Smart Way.",
    description: "Eliminate cash leakage, automate MoMo reconciliation, and offer flexible installment plans parents love.",
    icon: TrendingUp,
    highlight: "Zero onboarding & maintenance fees for pilot schools.",
    stat: "MoMo, card & bank transfer"
  },
  {
    badge: "INSTITUTIONAL AUTOMATION",
    title: "Instant Push-USSD to Parent Handsets.",
    description: "Accept payments straight via MTN MoMo, Telecel Cash & AT Money with real-time bursary dashboard updates.",
    icon: Zap,
    highlight: "Every payment reconciled against the student's balance automatically.",
    stat: "MTN · Telecel · AT"
  },
  {
    badge: "BUILT FOR GHANAIAN SCHOOLS",
    title: "Termly Fees, Ghana-Post Verified.",
    description: "Set classes and term fees the way a Ghanaian school is actually structured, then let the dashboard do the reconciling.",
    icon: Award,
    highlight: "Bring your existing roster as a spreadsheet and we will load it.",
    stat: "CSV & Excel import"
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
  role: 'school_admin',
  position: '',
  positionOther: '',
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

/**
 * The concrete job title to persist.
 *
 * `OTHER` is a UI sentinel and must never be stored — `User.position` would end up
 * holding the literal string "OTHER". Resolving it here keeps that knowledge in
 * one place rather than at every call site.
 */
const resolvePosition = (form) =>
  form.position === OTHER_POSITION ? form.positionOther.trim() : form.position;

const validate = (form) => {
  const errors = {};

  if (!form.role) errors.role = 'Choose how you will use SukuuPay';

  if (form.position === OTHER_POSITION) {
    if (!form.positionOther.trim()) errors.position = 'Enter your position';
    else if (form.positionOther.trim().length > 80) {
      errors.position = 'Keep the position to 80 characters or fewer';
    }
  } else if (!form.position) {
    errors.position = 'Select your position';
  }

  if (!form.principalName.trim()) errors.principalName = 'Enter your full name';

  // Only a `school_admin` registers a school; the other roles join one that
  // already exists, so asking them to name and categorise their own school would
  // be asking for information they do not have.
  if (canCreateSchool(form.role)) {
    if (!form.schoolName.trim()) errors.schoolName = 'Enter your school’s registered name';
    if (!form.schoolClassification) errors.schoolClassification = 'Select a category';
    if (!form.region) errors.region = 'Select a region';
  }

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

  // Declared before `handleSubmit`, which uses it: a `const` further down the
  // component body is in its temporal dead zone when the handler runs.
  const email = form.email.trim().toLowerCase();

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
        email: email,
        phone: `+233${form.phone.replace(/\D/g, '').replace(/^233/, '')}`,
        password: form.password,
        // `position` is the job title on the User model. This used to send
        // `schoolClassification`, so every account created here was saved with a
        // job title of "senior_high" — and the headteacher's own name was never
        // recorded as their role at all.
        position: resolvePosition(form),
        // Server-validated against `SELF_SIGNUP_ROLES`, which excludes
        // `super_admin`. The client constrains the choice too, but that is
        // convenience, not the control — the server must not trust this field.
        role: form.role,
        // The classification belongs in `school`, which the signup schema used to
        // have no key for: the shared `validate` middleware runs Joi with
        // `stripUnknown`, so the whole object was deleted before the controller
        // ran, and the bursar was asked for their school twice — the second time
        // behind a dead end. It is now kept as `User.schoolIntent` and prefills
        // Step 1.
        //
        // Sent only for roles that register a school. For the others it would be
        // another thing to invent, and it would prefill a Step 1 they never reach.
        ...(canCreateSchool(form.role)
          ? {
              school: {
                name: form.schoolName.trim(),
                classification: form.schoolClassification,
                region: form.region,
              },
            }
          : {}),
      });

      // The account exists but the code was never delivered. Re-rendering the
      // completed form here would invite a resubmit, which can only fail as a
      // duplicate email. Send the user to the one screen that can still help.
      if (response.partial) {
        navigate(`/verify-email?email=${encodeURIComponent(email)}&reason=email-failed`, {
          replace: true,
        });
        return;
      }

      setResult(response);
    } catch (error) {
      setFormError(error.message || 'Failed to create account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Google sign-up.
   *
   * **Deliberately does not set `result`.** That state renders the "check your inbox"
   * screen, which is the correct outcome for a password signup and a lie for this one:
   * nothing was mailed, because Google already verified the address. Sending a new user
   * to an inbox they never had to open is the kind of small wrongness that makes a
   * whole flow feel broken.
   *
   * So this navigates instead, and the destination comes from the server's resolved
   * link state — the same `onboarding.nextRoute` the password path uses once the code
   * is entered. A Google account has no school, so that is `/onboarding/school-profile`,
   * which is where the missing phone, role and school name get collected.
   *
   * Failures are translated rather than shown raw, for the same reasons as the login
   * page: the commonest outcomes here are refusals, and the API's wording is written
   * for logs.
   */
  const handleGoogleCredential = async (idToken) => {
    setFormError('');
    setLoading(true);

    try {
      const result = await signInWithGoogle(idToken);
      navigate(result.onboarding?.nextRoute || '/onboarding/school-profile', {
        replace: true,
      });
    } catch (err) {
      switch (err.code) {
        case 'ACCOUNT_EXISTS_PASSWORD':
          setFormError(
            'An account with this email already exists and uses a password. Log in with it instead — we cannot let a Google account take over an existing one.'
          );
          break;
        case 'GOOGLE_ACCOUNT_MISMATCH':
          setFormError(
            'That email address is linked to a different Google account. Use the Google account you signed up with originally.'
          );
          break;
        case 'GOOGLE_EMAIL_NOT_VERIFIED':
          setFormError(
            'Google reports this email address as unverified. Verify it in your Google account, then try again.'
          );
          break;
        case 'SELF_SIGNUP_DISABLED':
          setFormError(
            'Registration is closed at the moment. Ask your school administrator to invite you by email.'
          );
          break;
        default:
          setFormError(err.message || 'Google sign-up failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

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
            {canCreateSchool(form.role) ? (
              <>
                Verify your email, sign in, and you will set up{' '}
                <span className="font-bold text-ink">{form.schoolName}</span> yourself — the
                school details you just entered come with you, so it takes about two minutes.
              </>
            ) : (
              <>
                Verify your email, sign in, then enter the school code your headteacher gave you
                to join their school.
              </>
            )}
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
      <form onSubmit={handleSubmit} noValidate className="space-y-3">
        {formError && <FormAlert>{formError}</FormAlert>}

        <RoleSelector
          value={form.role}
          onChange={(value) => {
            setForm((prev) => ({ ...prev, role: value }));
            setErrors((prev) => ({ ...prev, role: undefined }));
          }}
          error={errors.role}
          touched={Boolean(errors.role)}
        />

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <PositionSelect
            value={form.position}
            otherValue={form.positionOther}
            onChange={(value) => {
              setForm((prev) => ({ ...prev, position: value }));
              setErrors((prev) => ({ ...prev, position: undefined }));
            }}
            onOtherChange={(value) => {
              setForm((prev) => ({ ...prev, positionOther: value }));
              setErrors((prev) => ({ ...prev, position: undefined }));
            }}
            error={errors.position}
            touched={Boolean(errors.position)}
          />

          <Field
            label={canCreateSchool(form.role) ? 'Headteacher / principal' : 'Your full name'}
            required
            icon={User}
            placeholder={canCreateSchool(form.role) ? 'Dr. Kwame Mensah' : 'Ama Serwa'}
            value={form.principalName}
            onChange={set('principalName')}
            error={errors.principalName}
          />
        </div>

        {/* Only someone registering their own school is asked to describe it.
            The other roles join an existing school with a code, so these fields
            are hidden rather than merely optional — asking an accountant to
            categorise a school they do not own invites a wrong answer. */}
        {canCreateSchool(form.role) ? (
          <>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
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
          </>
        ) : (
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
            <p className="text-[12px] font-medium leading-relaxed text-amber-900">
              You will be joining a school that is already on SukuuPay. After verifying your
              email, ask your headteacher for the school code and enter it on the next step —
              they will approve your access.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
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

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
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

        {/*
          Google sign-up.

          Replaces a button that set an error saying the feature was not enabled — a
          dead control on the page whose entire purpose is offering a way to register.

          `variant="signup"` changes the note under the button rather than the control:
          it is the same credential and the same API, but a different promise. Here
          Google creates a *new, smaller* account — a name and a verified email, no
          phone, no role, no school — and the user lands in onboarding to supply the
          rest. Saying so is the difference between a short path and an ambush.

          `busy` is shared with the password form so two authentication flows cannot be
          in flight on one page: both write to the same token storage, and whichever
          response landed last would decide whose tokens are kept.
        */}
        <GoogleSignInButton
          variant="signup"
          disabled={loading}
          onCredential={handleGoogleCredential}
          onError={(err) => setFormError(err?.message || 'Google sign-up failed. Please try again.')}
        />

        <AuthLinks>
          <span className="text-slate-600 text-xs">Already registered?</span>
          <AsideLink to="/login">Log in instead</AsideLink>
        </AuthLinks>
      </form>
    </AuthShell>
  );
};

export default Signup;
