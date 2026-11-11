import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { initiateSubscriptionPayment } from '../services/school';
import { Phone, Copy, AlertCircle, CheckCircle, LoaderCircle } from 'lucide-react';
import { ROUTES } from '../utils/constants';

const GHS = (amount) => `GH₵ ${amount.toLocaleString('en-GH')}`;

/**
 * Manual subscription payment page.
 *
 * A school on trial (or whose trial expired) selects a paid tier here, pays the
 * platform's Mobile Money number, and awaits administrator approval before
 * access is activated. Nothing unlocks until a human approves the payment.
 */
const ManualPayment = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [initiated, setInitiated] = useState(false);
  const [referenceCode, setReferenceCode] = useState('');
  const [expectedAmount, setExpectedAmount] = useState(0);
  const [payeePhone, setPayeePhone] = useState('05576655008');
  const [error, setError] = useState(null);

  const planFromUrl = searchParams.get('plan') || 'starter';
  const monthlyFeeFromUrl = Number(searchParams.get('monthlyFee')) || 16500;

  const tiers = {
    starter: { label: 'Starter', monthlyFee: 16500 },
    growth: { label: 'Growth', monthlyFee: 27500 },
    campus: { label: 'Campus', monthlyFee: 44000 },
  };

  const tier = tiers[planFromUrl] || tiers.starter;

  const initiatePayment = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await initiateSubscriptionPayment({
        plan: planFromUrl,
        monthlyFee: monthlyFeeFromUrl,
      });
      setInitiated(true);
      setReferenceCode(result.referenceCode || '');
      setExpectedAmount(result.expectedAmount || monthlyFeeFromUrl / 100);
      setPayeePhone(result.payeePhone || '05576655008');
    } catch (err) {
      setError(err.message || 'We could not start your payment. Please try again.');
    } finally {
      setBusy(false);
    }
  }, [planFromUrl, monthlyFeeFromUrl]);

  const copyReference = () => {
    navigator.clipboard.writeText(referenceCode);
  };

  // Compute the card content based on state, avoiding nested ternaries in JSX.
  let card;
  if (!user) {
    card = (
      <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-soft text-center">
        <h3 className="text-base font-extrabold text-ink mb-2">Create an account first</h3>
        <p className="mb-4 text-slate-500">
          You will get a 7-day free trial. After that, your school is locked
          until you complete a paid manual payment here and an administrator
          approves it.
        </p>
        <Link
          to={ROUTES.SIGNUP}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-bold text-white shadow-lift hover:bg-brand-800"
        >
          Sign up
        </Link>
      </div>
    );
  } else if (initiated) {
    card = (
      <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-soft">
        <div className="flex items-start gap-3">
          <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" aria-hidden="true" />
          <div className="min-w-0">
            <h3 className="text-base font-extrabold text-ink mb-1">
              Payment initiated — pay now
            </h3>
            <p className="text-slate-500">
              Your subscription is{' '}
              <span className="font-medium text-amber-700">pending approval</span>. Features stay locked until an administrator verifies your payment.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-3">
            <Phone className="h-4 w-4 text-slate-400" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-[12px] font-medium text-slate-500">Payee number</p>
              <p className="font-mono font-bold text-ink">{payeePhone}</p>
            </div>
            <button
              onClick={() => navigator.clipboard.writeText(payeePhone)}
              className="p-1 text-slate-400 hover:text-brand-600"
              title="Copy number"
            >
              <Copy className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-3">
            <Copy className="h-4 w-4 text-slate-400" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-[12px] font-medium text-slate-500">Reference code</p>
              <p className="font-mono font-bold text-ink">{referenceCode}</p>
            </div>
            <button
              onClick={copyReference}
              className="p-1 text-slate-400 hover:text-brand-600"
              title="Copy code"
            >
              <Copy className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-amber-100 bg-amber-50 p-4">
          <p className="text-[13px] text-amber-800">
            <strong>Include the reference code</strong>{' '}
            <span className="font-mono">{referenceCode}</span>{' '}
as the payment narration when you send Mobile Money to{' '}
            <span className="font-mono font-bold">{payeePhone}</span>. Amount:{' '}
            <strong>{GHS(expectedAmount)}</strong>.
          </p>
        </div>

        <p className="mt-4 text-[13px] text-slate-500">
          Once paid, an administrator will review and approve your payment. Your
          subscription activates automatically after approval — no further action
          needed from you.
        </p>
      </div>
    );
  } else {
    card = (
      <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-soft text-center">
        <p className="text-slate-500 mb-6">
          Select a plan below, then pay via Mobile Money. Your school stays on
          the 7-day free trial until the payment is approved by an administrator.
        </p>

        <button
          onClick={initiatePayment}
          disabled={busy}
          className={`inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold shadow-lift transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            busy ? 'bg-slate-200 text-slate-500' : 'bg-brand-700 text-white hover:bg-brand-800'
          }`}
        >
          {busy ? (
            <>
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
              Initiating…
            </>
          ) : (
            <>
              <Phone className="h-4 w-4" aria-hidden="true" />
              Pay via Mobile Money
            </>
          )}
        </button>

        {error && (
          <p className="mt-4 text-[12px] font-medium text-red-600">
            <AlertCircle className="mr-1.5 h-4 w-4" aria-hidden="true" />
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 sm:py-16">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10 text-center">
          <span className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-brand-50 text-brand-700">
            <Phone className="h-6 w-6" aria-hidden="true" />
          </span>
          <h1 className="mt-6 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
            Pay for your plan
          </h1>
          <p className="mt-2 text-slate-500">
            Complete a manual Mobile Money payment to activate your school
            subscription.
          </p>
        </div>

        {/* Plan card */}
        <div className="mb-8 rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-soft">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-extrabold text-ink">{tier.label} plan</h2>
              <p className="mt-1 text-[13px] text-slate-500">
                {GHS(tier.monthlyFee / 100)}{' · '}
                {planFromUrl === 'starter'
                  ? 'Up to 300 students'
                  : planFromUrl === 'growth'
                    ? '301–1,000 students'
                    : '1,000+ students'}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-brand-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-brand-800">
              Manual payment
            </span>
          </div>
          <p className="mt-4 text-[13px] font-medium text-slate-600">
            Pay to:{' '}
            <span className="font-mono font-bold text-brand-700">05576655008</span>{' '}
            <span className="ml-2 text-[12px] text-slate-400">MTN / Telecel / AT</span>
          </p>
        </div>

        {card}
      </div>
    </div>
  );
};

export default ManualPayment;
