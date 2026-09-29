import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import { resetPassword } from '../../services/auth';
import AuthShell from '../../components/auth/AuthShell';
import {
  AsideLink,
  AuthLinks,
  ResetPasswordAside,
  SubmitButton,
} from '../../components/auth/OnboardingAside';
import { PasswordStrength } from '../../components/auth/CodeInput';
import { Field, FormAlert } from '../../components/common/FormField';

// Mirrors the API's `password` schema: 8+ chars, a letter and a digit.
const RULES = [
  { test: (v) => v.length >= 8, label: 'At least 8 characters' },
  { test: (v) => /[a-zA-Z]/.test(v) && /\d/.test(v), label: 'A letter and a number' },
  { test: (v) => /[^a-zA-Z0-9]/.test(v), label: 'A symbol (recommended)' },
];

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

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!RULES[0].test(password) || !RULES[1].test(password)) {
      setError('Your password must be at least 8 characters and include a letter and a number.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (err) {
      // The API uses the same response for an unknown and an expired token, so
      // the link is treated as spent either way.
      setExpired(true);
      setError(err.message || 'This password reset link is invalid or has expired.');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <AuthShell
        aside={<ResetPasswordAside />}
        eyebrow="Password updated"
        title="Password changed"
        description="Your new password is live and every other session has been signed out."
      >
        <div className="flex flex-col items-center rounded-xl border border-brand-200 bg-brand-50 px-6 py-8 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-700 text-white">
            <CheckCircle2 className="h-7 w-7" />
          </span>
          <h2 className="mt-4 text-lg font-extrabold text-ink">All set</h2>
          <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-slate-600">
            We&apos;ve emailed a confirmation to your school address. Sign in with your new
            password to continue.
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/login', { replace: true })}
          className="mt-4 w-full rounded-lg bg-brand-700 px-4 py-3 text-[15px] font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800"
        >
          Sign in now
        </button>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      aside={<ResetPasswordAside />}
      eyebrow="Password reset"
      title="Create a new password"
      description="This link works once and expires 30 minutes after it was sent."
    >
      {expired ? (
        <div className="space-y-4">
          <div className="flex flex-col items-center rounded-xl border border-amber-200 bg-amber-50 px-6 py-8 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-500 text-white">
              <AlertTriangle className="h-7 w-7" />
            </span>
            <h2 className="mt-4 text-lg font-extrabold text-ink">Link expired</h2>
            <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-slate-600">
              Password reset links are single-use and expire after 30 minutes. Request a fresh one
              and try again.
            </p>
          </div>

          <Link
            to="/reset-password"
            className="block w-full rounded-lg bg-brand-700 px-4 py-3 text-center text-[15px] font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800"
          >
            Request a new link
          </Link>

          <AuthLinks>
            <span className="text-slate-600">Remembered it?</span>
            <AsideLink to="/login">Back to sign in</AsideLink>
          </AuthLinks>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {error && <FormAlert>{error}</FormAlert>}

          <div>
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
                  className="transition-colors hover:text-slate-700"
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
            />
            <PasswordStrength password={password} />
          </div>

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
            error={confirmPassword && confirmPassword !== password ? 'Passwords do not match' : ''}
            required
          />

          <ul className="grid grid-cols-1 gap-1.5 rounded-lg bg-slate-50 p-3 sm:grid-cols-3">
            {RULES.map((rule) => {
              const met = rule.test(password);
              return (
                <li
                  key={rule.label}
                  className={`flex items-center gap-1.5 text-[11px] font-semibold ${
                    met ? 'text-brand-700' : 'text-slate-500'
                  }`}
                >
                  {met ? (
                    <Check className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <KeyRound className="h-3.5 w-3.5 shrink-0" />
                  )}
                  {rule.label}
                </li>
              );
            })}
          </ul>

          <SubmitButton pending={loading} pendingLabel="Saving…" icon={KeyRound}>
            Save new password
          </SubmitButton>
        </form>
      )}
    </AuthShell>
  );
};

export default NewPassword;
