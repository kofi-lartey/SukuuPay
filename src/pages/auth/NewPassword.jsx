import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import { resetPassword, clearTokens } from '../../services/auth';
import AuthShell from '../../components/auth/AuthShell';
import {
  AsideLink,
  AuthLinks,
  ResetPasswordAside,
  SubmitButton,
} from '../../components/auth/OnboardingAside';
import { Field, FormAlert } from '../../components/common/FormField';

/**
 * Rules the API enforces. `test` is the same predicate the server uses, so a
 * client that passes every rule cannot fail validation at the endpoint.
 */
const RULES = [
  {
    key: 'length',
    label: 'At least 8 characters',
    test: (v) => v.length >= 8,
  },
  {
    key: 'mixed',
    label: 'A letter and a number',
    test: (v) => /[a-zA-Z]/.test(v) && /\d/.test(v),
  },
  {
    key: 'symbol',
    label: 'A symbol (recommended)',
    test: (v) => /[^a-zA-Z0-9]/.test(v),
    recommended: true,
  },
];

/**
 * Password strength, scored 0–4.
 *
 * The score drives the strength bar. It is not shown as a word ("weak",
 * "strong") because words read as judgment and the user is already anxious
 * — a bar with color and motion tells them what to do without telling them
 * what they are.
 */
const strengthOf = (password) => {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^a-zA-Z0-9]/.test(password)) score += 1;
  return score; // 0–4
};

const STRENGTH_BARS = [
  { width: '0%', tone: 'bg-slate-200' },
  { width: '25%', tone: 'bg-red-400' },
  { width: '50%', tone: 'bg-amber-400' },
  { width: '75%', tone: 'bg-sky-500' },
  { width: '100%', tone: 'bg-emerald-500' },
];

const StrengthMeter = ({ password }) => {
  const score = strengthOf(password);
  const bar = STRENGTH_BARS[score];

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-slate-400">
          Password strength
        </p>
        <p className="text-[10.5px] font-semibold text-slate-400 tabular-nums">
          {score} / 4
        </p>
      </div>
      <div className="mt-1.5 flex h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all duration-300 ${bar.tone}`}
          style={{ width: bar.width }}
        />
      </div>
    </div>
  );
};

const RuleList = ({ password }) => (
  <ul className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
    {RULES.map((rule) => {
      const met = rule.test(password);
      return (
        <li
          key={rule.key}
          className={`flex items-center gap-1.5 text-[11px] font-semibold transition-colors ${
            met ? 'text-emerald-700' : 'text-slate-500'
          }`}
        >
          <span
            className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full transition-colors ${
              met
                ? 'bg-emerald-600 text-white'
                : rule.recommended
                  ? 'bg-amber-100 text-amber-600'
                  : 'bg-slate-100 text-slate-400'
            }`}
          >
            {met ? (
              <Check className="h-2 w-2" strokeWidth={3} aria-hidden="true" />
            ) : (
              <span className="h-1 w-1 rounded-full bg-current" aria-hidden="true" />
            )}
          </span>
          <span>{rule.label}</span>
        </li>
      );
    })}
  </ul>
);

const ProgressBar = () => (
  <div className="mb-6 flex items-center gap-2 text-[10.5px] font-extrabold uppercase tracking-[0.14em]">
    <span className="flex items-center gap-1.5 text-slate-400">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-700 text-white">
        <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
      </span>
      Verified
    </span>
    <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
    <span className="flex items-center gap-1.5 text-brand-700">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-700 text-[10px] text-white">
        2
      </span>
      Reset
    </span>
    <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
    <span className="flex items-center gap-1.5 text-slate-400">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[10px] text-slate-500">
        3
      </span>
      Sign in
    </span>
  </div>
);

const NewPassword = () => {
  const { token } = useParams();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [expired, setExpired] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  // The submit button is disabled until every rule passes, so a user
  // cannot reach a server round-trip that will only come back with the
  // same message they could have seen on the client.
  const allRulesPassed = useMemo(
    () => RULES.filter((r) => !r.recommended).every((r) => r.test(password)),
    [password]
  );
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const canSubmit = allRulesPassed && passwordsMatch && !loading;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!allRulesPassed) {
      setError('Your password does not meet the requirements yet.');
      return;
    }
    if (!passwordsMatch) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await resetPassword(token, password);
      clearTokens();
      setDone(true);
    } catch (err) {
      // The API uses the same response for an unknown and an expired token,
      // so the link is treated as spent either way.
      setExpired(true);
      setError(err.message || 'This password reset link is invalid or has expired.');
    } finally {
      setLoading(false);
    }
  };

  // ── Success ──────────────────────────────────────────────────────────
  if (done) {
    return (
      <AuthShell
        aside={<ResetPasswordAside />}
        eyebrow="Password updated"
        title="You're all set"
        description="Your new password is active and every other session has been signed out."
      >
        <div className="flex flex-col items-center text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-600/20">
            <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
          </span>
          <h2 className="mt-4 text-lg font-extrabold text-ink">
            Password changed
          </h2>
          <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-slate-600">
            We&rsquo;ve emailed a confirmation to your school address. Sign in
            with your new password to continue.
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/login', { replace: true })}
          className="mt-6 w-full rounded-xl bg-brand-700 px-4 py-3.5 text-[14px] font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800"
        >
          Sign in with new password
        </button>
      </AuthShell>
    );
  }

  // ── Expired link ─────────────────────────────────────────────────────
  if (expired) {
    return (
      <AuthShell
        aside={<ResetPasswordAside />}
        eyebrow="Password reset"
        title="That link has expired"
        description="Password reset links are single-use and last 30 minutes."
      >
        <div className="flex flex-col items-center text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-500 text-white shadow-lg shadow-amber-500/20">
            <AlertTriangle className="h-8 w-8" aria-hidden="true" />
          </span>
          <h2 className="mt-4 text-lg font-extrabold text-ink">
            Request a new link
          </h2>
          <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-slate-600">
            Enter your school email on the next screen and we&rsquo;ll send a
            fresh password reset link immediately.
          </p>
        </div>

        <Link
          to="/reset-password"
          className="mt-6 block w-full rounded-xl bg-brand-700 px-4 py-3.5 text-center text-[14px] font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800"
        >
          Request a new link
        </Link>

        <AuthLinks>
          <span className="text-slate-600">Remembered it?</span>
          <AsideLink to="/login">Back to sign in</AsideLink>
        </AuthLinks>
      </AuthShell>
    );
  }

  // ── Form ─────────────────────────────────────────────────────────────
  return (
    <AuthShell
      aside={<ResetPasswordAside />}
      eyebrow="Password reset"
      title="Create a new password"
      description="Choose something strong. This becomes the key to your SukuuPay account."
    >
      <ProgressBar />

      {error && <FormAlert>{error}</FormAlert>}

      <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
        <Field
          label="New password"
          icon={Lock}
          type={show ? 'text' : 'password'}
          autoComplete="new-password"
          placeholder="Enter a new password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setError('');
          }}
          required
          trailing={
            <button
              type="button"
              onClick={() => setShow((prev) => !prev)}
              aria-label={show ? 'Hide password' : 'Show password'}
              className="text-slate-400 transition-colors hover:text-slate-700"
            >
              {show ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          }
        />

        <StrengthMeter password={password} />
        <RuleList password={password} />

        <div className="pt-2">
          <Field
            label="Confirm new password"
            icon={ShieldCheck}
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="Re-enter your new password"
            value={confirmPassword}
            onChange={(event) => {
              setConfirmPassword(event.target.value);
              setError('');
            }}
            error={
              confirmPassword && confirmPassword !== password
                ? 'Passwords do not match'
                : ''
            }
            required
          />
        </div>

        <div className="pt-2">
          <SubmitButton
            pending={loading}
            pendingLabel="Saving…"
            icon={KeyRound}
            disabled={!canSubmit}
          >
            Save new password
          </SubmitButton>
        </div>

        <p className="pt-2 text-center text-[11.5px] font-medium text-slate-500">
          <Link to="/login" className="font-extrabold text-brand-700 hover:underline">
            <ArrowLeft className="mr-1 inline h-3 w-3" aria-hidden="true" />
            Back to sign in
          </Link>
        </p>
      </form>
    </AuthShell>
  );
};

export default NewPassword;