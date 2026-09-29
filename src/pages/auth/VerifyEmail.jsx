import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowRight, CheckCircle2, LogIn, Mail, RefreshCw, ShieldCheck } from 'lucide-react';
import { resendVerificationEmail, verifyEmail } from '../../services/auth';
import AuthShell from '../../components/auth/AuthShell';
import {
  AsideLink,
  AuthLinks,
  SubmitButton,
  VerifyAside,
} from '../../components/auth/OnboardingAside';
import OtpInput from '../../components/auth/CodeInput';
import { Field, FormAlert } from '../../components/common/FormField';

const RESEND_COOLDOWN = 60;
const CODE_LENGTH = 6;

const VerifyEmail = () => {
  const { token: pathToken } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();

  // The email body carries a bare code, so a link with the code in the path
  // arrives from the API's `verification.verifyUrl` and from a pasted link.
  const urlToken = params.get('token') || pathToken || '';
  const [email, setEmail] = useState(params.get('email') || '');

  const [code, setCode] = useState('');
  const [emailInput, setEmailInput] = useState(params.get('email') || '');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN);
  const [verified, setVerified] = useState(false);
  const autoSubmitted = useRef(false);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setTimeout(() => setCooldown((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const submitCode = useCallback(async (value, linkToken) => {
    const token = linkToken || value;
    if (!/^\d{6}$/.test(token)) {
      setError('Enter the 6-digit code from your email.');
      return;
    }

    setVerifying(true);
    setError('');
    setInfo('');
    try {
      await verifyEmail(token);
      setVerified(true);
      setCode('');
    } catch (err) {
      setError(err.message || 'This verification code is invalid or has expired.');
      setCode('');
    } finally {
      setVerifying(false);
    }
  }, []);

  // Auto-submit once when the user arrives from a link.
  useEffect(() => {
    if (!urlToken || autoSubmitted.current) return;
    autoSubmitted.current = true;
    submitCode('', urlToken);
  }, [urlToken, submitCode]);

  const handleSubmit = (event) => {
    event.preventDefault();
    submitCode(code);
  };

  const handleResend = async () => {
    const target = (emailInput || email).trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(target)) {
      setError('Enter the email address you registered with to resend the code.');
      return;
    }

    setResending(true);
    setError('');
    setInfo('');
    try {
      // Neutral response by design: the API never confirms whether the account
      // exists, and neither does this screen.
      await resendVerificationEmail(target);
      setEmail(target);
      setInfo('If that account exists and is unverified, a new code has been sent.');
      setCooldown(RESEND_COOLDOWN);
    } catch (err) {
      setError(err.message || 'Failed to send a new code. Please try again.');
    } finally {
      setResending(false);
    }
  };

  if (verified) {
    return (
      <AuthShell
        aside={<VerifyAside />}
        eyebrow="Email verified"
        title="Your bursary inbox is confirmed"
        description="Receipts, payment alerts and arrears reminders will now reach this address."
      >
        <div className="flex flex-col items-center rounded-xl border border-brand-200 bg-brand-50 px-6 py-8 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-700 text-white">
            <CheckCircle2 className="h-7 w-7" />
          </span>
          <h2 className="mt-4 text-lg font-extrabold text-ink">You&apos;re verified</h2>
          <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-slate-600">
            Sign in to reach your bursar workspace and upload the Term 2 student roster.
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/login', { replace: true })}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-brand-700 px-4 py-3 text-[15px] font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800"
        >
          <LogIn className="h-4 w-4" />
          Sign in
        </button>

        <p className="mt-3 text-center text-[11px] text-slate-600">
          Signed up for the wrong school?{' '}
          <button
            type="button"
            onClick={() => {
              setVerified(false);
              setCooldown(0);
            }}
            className="font-bold text-brand-700 hover:underline"
          >
            Enter a different code
          </button>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      aside={<VerifyAside />}
      eyebrow="Email verification"
      title="Enter your verification code"
      description={
        email
          ? `We sent a 6-digit code to ${email}. It expires in 15 minutes.`
          : 'Enter the 6-digit code from your verification email. It expires in 15 minutes.'
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {error && <FormAlert>{error}</FormAlert>}
        {info && <FormAlert tone="success">{info}</FormAlert>}

        <div>
          <span
            id="otp-label"
            className="mb-2.5 block text-center text-[12px] font-semibold text-slate-700"
          >
            Verification code
          </span>
          <OtpInput
            id="otp"
            value={code}
            onChange={(value) => {
              setCode(value);
              setError('');
            }}
            onComplete={submitCode}
            disabled={verifying}
            invalid={Boolean(error)}
          />
        </div>

        <SubmitButton
          pending={verifying}
          pendingLabel="Verifying…"
          icon={ArrowRight}
          disabled={code.length !== CODE_LENGTH}
        >
          Verify email
        </SubmitButton>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
            Didn&apos;t get the code?
          </p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
            <Field
              label="Resend to"
              icon={Mail}
              type="email"
              autoComplete="email"
              placeholder="admin@school.edu.gh"
              className="flex-1"
              value={emailInput}
              onChange={(event) => setEmailInput(event.target.value)}
            />
            <button
              type="button"
              onClick={handleResend}
              disabled={resending || cooldown > 0}
              className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 text-[13px] font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${resending ? 'animate-spin' : ''}`} />
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
            </button>
          </div>
        </div>

        <p className="flex items-start justify-center gap-1.5 text-center text-[11px] leading-relaxed text-slate-600">
          <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0 text-brand-700" />
          <span>
            Codes expire after 15 minutes and stop working the moment a new one is issued.
            SukuuPay staff will never ask you for this code.
          </span>
        </p>

        <AuthLinks>
          <span className="text-slate-600">Already verified?</span>
          <AsideLink to="/login">Sign in instead</AsideLink>
        </AuthLinks>
      </form>
    </AuthShell>
  );
};

export default VerifyEmail;
