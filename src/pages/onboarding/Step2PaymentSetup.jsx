import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BadgeCheck,
  Building2,
  Eye,
  EyeOff,
  Info,
  KeyRound,
  Landmark,
  LoaderCircle,
  ShieldCheck,
  Smartphone,
  Zap,
} from 'lucide-react';
import { Field, FormAlert, SelectField } from '../../components/common/FormField';
import useOnboardingProgress from '../../hooks/useOnboardingProgress';
import useToast from '../../hooks/useToast';
import { updatePayoutAccount, verifyHubtel } from '../../services/school';
import { useAuth } from '../../context/AuthContext';
import { GHANA_BANKS, MOMO_NETWORKS } from '../../utils/constants';
import { useStepChrome } from './OnboardingStepContext';

const GHANA_PHONE = /^(0[2-5]\d{8}|233[2-5]\d{8})$/;

/**
 * Two settlement modes. The School model stores `payment.gatewayMode` and
 * `payment.bankAccount`; there is no server field for "let SukuuPay collect and
 * remit weekly", so the mode is a client-side preference recorded in the draft
 * until a payout endpoint ships.
 */
const MODES = [
  {
    value: 'sukuupay',
    icon: Zap,
    badge: 'Recommended',
    badgeClass: 'bg-brand-50 text-brand-700 ring-brand-200',
    title: "Use SukuuPay's gateway",
    description:
      'Fastest setup. SukuuPay handles all payments. A small service fee (1.5%) is added to each payment. Money settles to your school weekly.',
  },
  {
    value: 'own-hubtel',
    icon: Building2,
    badge: 'Advanced',
    badgeClass: 'bg-slate-100 text-slate-600 ring-slate-200',
    title: "Connect your own Hubtel account",
    description:
      'All payments go directly to your school. No per-transaction markup. Requires a Hubtel merchant account.',
  },
];

const EMPTY = {
  mode: 'sukuupay',
  payoutMethod: 'bank',
  accountName: '',
  accountNumber: '',
  bankName: '',
  momoNumber: '',
  momoNetwork: '',
  hubtelClientId: '',
  hubtelClientSecret: '',
  hubtelMerchantId: '',
  hubtelApiKey: '',
  hubtelVerified: false,
};

const StepHeader = ({ title, description }) => (
  <header className="mb-7">
    <p className="text-[11px] font-extrabold uppercase tracking-wider text-brand-700">Step 2 of 4</p>
    <h1 className="mt-1.5 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{title}</h1>
    <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-slate-500">{description}</p>
  </header>
);

const ModeCard = ({ mode, selected, onSelect }) => {
  const Icon = mode.icon;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`flex w-full flex-col rounded-2xl border-2 p-5 text-left transition-all ${
        selected
          ? 'border-brand-600 bg-brand-50/60 shadow-soft'
          : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
            selected ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-500'
          }`}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ring-1 ${mode.badgeClass}`}
        >
          {mode.badge}
        </span>
      </div>

      <p className="mt-3.5 text-[15px] font-extrabold tracking-tight text-ink">{mode.title}</p>
      <p className="mt-1.5 text-[13px] font-medium leading-relaxed text-slate-600">
        {mode.description}
      </p>
    </button>
  );
};

const SectionCard = ({ icon: Icon, title, description, children }) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft sm:p-6">
    <div className="mb-4 flex items-start gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <h2 className="text-[15px] font-extrabold tracking-tight text-ink">{title}</h2>
        {description && (
          <p className="mt-0.5 text-[12px] font-medium leading-snug text-slate-500">{description}</p>
        )}
      </div>
    </div>
    {children}
  </section>
);

const Step2PaymentSetup = () => {
  const { user } = useAuth();
  const toast = useToast();
  const { getStepDraft, setStepDraft } = useOnboardingProgress();
  const { register } = useStepChrome();

  const schoolId = user?.schoolId;

  const [form, setForm] = useState(EMPTY);
  const [touched, setTouched] = useState({});
  const [verifying, setVerifying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [verifyNotice, setVerifyNotice] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    const draft = getStepDraft('payment-setup');
    if (draft) setForm((current) => ({ ...current, ...draft }));
    setHydrated(true);
  }, [getStepDraft]);

  const update = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFormError('');
  };

  const onChange = (key) => (event) => update(key, event.target.value);
  const blur = (key) => () => setTouched((current) => ({ ...current, [key]: true }));

  useEffect(() => {
    if (!hydrated) return;
    setStepDraft('payment-setup', { ...form, savedAt: new Date().toISOString() });
  }, [form, hydrated, setStepDraft]);

  const errors = useMemo(() => {
    const found = {};
    if (!form.mode) found.mode = 'Choose how you want to collect payments.';

    if (form.payoutMethod === 'bank') {
      if (form.accountName.trim().length < 2) found.accountName = 'Enter the account name.';
      const accountNumber = form.accountNumber.replace(/\s/g, '');
      if (!/^\d{10}$/.test(accountNumber)) {
        found.accountNumber = 'Ghana account numbers are 10 digits.';
      }
      if (!form.bankName) found.bankName = 'Choose the bank.';
    } else {
      const momo = form.momoNumber.replace(/[\s-]/g, '');
      if (!momo) found.momoNumber = 'Enter your Mobile Money number.';
      else if (!GHANA_PHONE.test(momo)) found.momoNumber = 'Use a Ghana number, e.g. 0241234567.';
      if (!form.momoNetwork) found.momoNetwork = 'Choose the network.';
    }

    if (form.mode === 'own-hubtel') {
      if (!form.hubtelClientId.trim()) found.hubtelClientId = 'Enter your Hubtel Client ID.';
      if (!form.hubtelClientSecret.trim()) found.hubtelClientSecret = 'Enter your Hubtel Client Secret.';
      if (!form.hubtelMerchantId.trim()) found.hubtelMerchantId = 'Enter your Hubtel Merchant ID.';
      if (!form.hubtelApiKey.trim()) found.hubtelApiKey = 'Enter your Hubtel API key.';
    }

    return found;
  }, [form]);

  const isValid = Object.keys(errors).length === 0;

  const saveRef = useRef(null);
  saveRef.current = async () => {
    setSaving(true);
    setFormError('');
    try {
      if (!schoolId) {
        setFormError('Your account is not linked to a school yet. Contact support to finish setup.');
        return false;
      }

      const payout =
        form.payoutMethod === 'bank'
          ? {
              accountName: form.accountName.trim(),
              accountNumber: form.accountNumber.replace(/\s/g, ''),
              bankName: form.bankName,
            }
          : { momoNumber: form.momoNumber.replace(/[\s-]/g, ''), momoNetwork: form.momoNetwork };

      try {
        await updatePayoutAccount(schoolId, { ...payout, method: form.payoutMethod, mode: form.mode });
        toast.success('Settlement account saved.');
      } catch (error) {
        // The API has no payout route yet. The draft is already in localStorage,
        // so say what is and is not true rather than claiming a save.
        if (error.code === 'PAYOUT_NOT_SUPPORTED') {
          setFormError(
            'Your settlement account is saved on this device only — the API does not accept payout details yet. Nothing was lost, but re-enter them once payout support ships.'
          );
          toast.warning('Settlement details kept on this device; the server has no payout endpoint yet.');
        } else {
          setFormError(error.message || 'We could not save your settlement account.');
          toast.error(error.message || 'We could not save your settlement account.');
          return false;
        }
      }
      return true;
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    register({ valid: isValid && !saving, busy: saving, label: 'Continue', onSubmit: () => saveRef.current() });
  }, [isValid, saving, register]);

  const handleVerify = async () => {
    setVerifying(true);
    setVerifyNotice('');
    try {
      await verifyHubtel(schoolId, {
        clientId: form.hubtelClientId.trim(),
        clientSecret: form.hubtelClientSecret.trim(),
        merchantId: form.hubtelMerchantId.trim(),
        apiKey: form.hubtelApiKey.trim(),
      });
      update('hubtelVerified', true);
      toast.success('Hubtel credentials verified.');
    } catch (error) {
      update('hubtelVerified', false);
      if (error.code === 'HUBTEL_VERIFY_NOT_SUPPORTED') {
        setVerifyNotice(
          'The API has no Hubtel verification endpoint yet, so we cannot confirm these credentials. You can still save them — they will be checked when verification ships.'
        );
        toast.warning('Hubtel verification is not available on the API yet.');
      } else {
        setVerifyNotice(error.message || 'Hubtel rejected those credentials.');
        toast.error(error.message || 'Hubtel rejected those credentials.');
      }
    } finally {
      setVerifying(false);
    }
  };

  const showError = (key) => (touched[key] ? errors[key] : undefined);
  const hubtelErrors = ['hubtelClientId', 'hubtelClientSecret', 'hubtelMerchantId', 'hubtelApiKey'];
  const hubtelReady = hubtelErrors.every((key) => !errors[key]);

  return (
    <div>
      <StepHeader
        title="How should parents pay?"
        description="Choose where the money lands. You can change this later from Settings — it does not affect your student roster."
      />

      <div className="space-y-6">
        {formError && <FormAlert tone="error">{formError}</FormAlert>}

        <div
          role="radiogroup"
          aria-label="Payment gateway mode"
          className="grid gap-4 lg:grid-cols-2"
        >
          {MODES.map((mode) => (
            <ModeCard
              key={mode.value}
              mode={mode}
              selected={form.mode === mode.value}
              onSelect={() => update('mode', mode.value)}
            />
          ))}
        </div>

        {form.mode === 'sukuupay' && (
          <div className="flex items-start gap-2.5 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3.5">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" aria-hidden="true" />
            <p className="text-[13px] font-semibold leading-relaxed text-brand-800">
              You&apos;ll receive weekly settlements every Monday for the previous week&apos;s
              collections.
            </p>
          </div>
        )}

        {form.mode === 'own-hubtel' && (
          <SectionCard
            icon={ShieldCheck}
            title="Hubtel credentials"
            description="Found in your Hubtel merchant dashboard under Developer → API Keys."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Hubtel Client ID"
                icon={KeyRound}
                value={form.hubtelClientId}
                onChange={onChange('hubtelClientId')}
                onBlur={blur('hubtelClientId')}
                error={showError('hubtelClientId')}
                required
                autoComplete="off"
              />

              <Field
                label="Hubtel Client Secret"
                icon={KeyRound}
                type={showSecret ? 'text' : 'password'}
                value={form.hubtelClientSecret}
                onChange={onChange('hubtelClientSecret')}
                onBlur={blur('hubtelClientSecret')}
                error={showError('hubtelClientSecret')}
                required
                autoComplete="off"
                trailing={
                  <button
                    type="button"
                    onClick={() => setShowSecret((prev) => !prev)}
                    aria-label={showSecret ? 'Hide Hubtel client secret' : 'Show Hubtel client secret'}
                    className="transition-colors hover:text-slate-700 text-slate-400"
                  >
                    {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
              />

              <Field
                label="Hubtel Merchant ID"
                icon={Building2}
                value={form.hubtelMerchantId}
                onChange={onChange('hubtelMerchantId')}
                onBlur={blur('hubtelMerchantId')}
                error={showError('hubtelMerchantId')}
                required
                autoComplete="off"
              />

              <Field
                label="Hubtel API Key"
                icon={KeyRound}
                type={showApiKey ? 'text' : 'password'}
                value={form.hubtelApiKey}
                onChange={onChange('hubtelApiKey')}
                onBlur={blur('hubtelApiKey')}
                error={showError('hubtelApiKey')}
                required
                autoComplete="off"
                trailing={
                  <button
                    type="button"
                    onClick={() => setShowApiKey((prev) => !prev)}
                    aria-label={showApiKey ? 'Hide Hubtel API key' : 'Show Hubtel API key'}
                    className="transition-colors hover:text-slate-700 text-slate-400"
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleVerify}
                disabled={!hubtelReady || verifying}
                className="flex items-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {verifying ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                )}
                {verifying ? 'Verifying…' : 'Verify Credentials'}
              </button>

              {form.hubtelVerified && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-[12px] font-extrabold text-brand-700 ring-1 ring-brand-200">
                  <BadgeCheck className="h-4 w-4" aria-hidden="true" />
                  Verified
                </span>
              )}
            </div>

            {verifyNotice && (
              <div className="mt-3">
                <FormAlert tone="info">{verifyNotice}</FormAlert>
              </div>
            )}
          </SectionCard>
        )}

        <SectionCard
          icon={Landmark}
          title="Settlement account"
          description="Where your collected money is paid out. Required in both modes — it is the fallback if a gateway payout is reversed."
        >
          <fieldset className="mb-4">
            <legend className="mb-1.5 text-[12px] font-semibold text-slate-700">
              Payout method
            </legend>
            <div className="flex flex-wrap gap-2.5">
              {[
                { value: 'bank', label: 'Bank account', icon: Landmark },
                { value: 'momo', label: 'Mobile Money', icon: Smartphone },
              ].map((option) => {
                const Icon = option.icon;
                const active = form.payoutMethod === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => update('payoutMethod', option.value)}
                    className={`flex items-center gap-2 rounded-lg border-2 px-4 py-2.5 text-sm font-bold transition-colors ${
                      active
                        ? 'border-brand-600 bg-brand-50 text-brand-800'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {form.payoutMethod === 'bank' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Account name"
                placeholder="Morning Star Preparatory School"
                value={form.accountName}
                onChange={onChange('accountName')}
                onBlur={blur('accountName')}
                error={showError('accountName')}
                required
              />
              <Field
                label="Account number"
                inputMode="numeric"
                placeholder="0123456789"
                value={form.accountNumber}
                onChange={onChange('accountNumber')}
                onBlur={blur('accountNumber')}
                error={showError('accountNumber')}
                required
                maxLength={14}
              />
              <SelectField
                className="sm:col-span-2"
                label="Bank"
                value={form.bankName}
                onChange={onChange('bankName')}
                onBlur={blur('bankName')}
                error={showError('bankName')}
                required
              >
                <option value="">Select a bank…</option>
                {GHANA_BANKS.map((bank) => (
                  <option key={bank} value={bank}>
                    {bank}
                  </option>
                ))}
              </SelectField>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="MoMo number"
                icon={Smartphone}
                type="tel"
                inputMode="tel"
                placeholder="0241234567"
                value={form.momoNumber}
                onChange={onChange('momoNumber')}
                onBlur={blur('momoNumber')}
                error={showError('momoNumber')}
                required
              />
              <SelectField
                label="Network"
                value={form.momoNetwork}
                onChange={onChange('momoNetwork')}
                onBlur={blur('momoNetwork')}
                error={showError('momoNetwork')}
                required
              >
                <option value="">Select a network…</option>
                {MOMO_NETWORKS.map((network) => (
                  <option key={network.value} value={network.value}>
                    {network.label}
                  </option>
                ))}
              </SelectField>
            </div>
          )}

          <p className="mt-4 flex items-start gap-2 text-[12px] font-medium leading-relaxed text-slate-500">
            <Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {form.mode === 'sukuupay'
              ? "SukuuPay holds the collections and remits them to this account. You'll receive weekly settlements every Monday."
              : 'Hubtel pays this account directly, so keep it accurate — a wrong number delays every settlement.'}
          </p>
        </SectionCard>
      </div>
    </div>
  );
};

export default Step2PaymentSetup;
