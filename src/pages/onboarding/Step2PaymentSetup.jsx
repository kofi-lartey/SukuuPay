import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Info,
  Landmark,
  Smartphone,
  Building2,
  Wallet,
} from 'lucide-react';
import { Field, FormAlert, SelectField } from '../../components/common/FormField';
import useOnboardingProgress from '../../hooks/useOnboardingProgress';
import useToast from '../../hooks/useToast';
import { updatePayoutAccount } from '../../services/school';
import { useAuth } from '../../context/AuthContext';
import { GHANA_BANKS, MOMO_NETWORKS } from '../../utils/constants';
import { useStepChrome } from './OnboardingStepContext';

const GHANA_PHONE = /^(0[2-5]\d{8}|233[2-5]\d{8})$/;

/**
 * How the money is collected.
 *
 * Self-Collection model: the school collects payments directly using their own
 * credentials. SukuuPay does not hold or settle funds — the school's own
 * payment methods (Merchant ID, collection phone, etc.) receive money directly.
 *
 * Mobile Money collections use the default system number configured by the
 * Super Admin, so the school does not need to provide a separate MoMo number
 * for that channel.
 */
const EMPTY = {
  mode: 'self_collection',
  collectionMethod: 'bank',
  merchantId: '',
  collectionPhone: '',
  accountName: '',
  accountNumber: '',
  bankName: '',
  momoNumber: '',
  momoNetwork: '',
};

const StepHeader = ({ title, description }) => (
  <header className="mb-7">
    <p className="text-[11px] font-extrabold uppercase tracking-wider text-brand-700">Step 2 of 4</p>
    <h1 className="mt-1.5 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{title}</h1>
    <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-slate-500">{description}</p>
  </header>
);

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
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const draft = getStepDraft('payment-setup');
    if (draft) {
      setForm((current) => ({ ...current, ...draft, mode: 'self_collection' }));
    }
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

    if (form.collectionMethod === 'bank') {
      if (form.accountName.trim().length < 2) found.accountName = 'Enter the account name.';
      const accountNumber = form.accountNumber.replace(/\s/g, '');
      if (!/^\d{10}$/.test(accountNumber)) found.accountNumber = 'Ghana account numbers are 10 digits.';
      if (!form.bankName) found.bankName = 'Choose the bank.';
    } else if (form.collectionMethod === 'momo') {
      const momo = (form.momoNumber || '').replace(/[\s-]/g, '');
      if (!momo) found.momoNumber = 'Enter your Mobile Money number.';
      else if (!GHANA_PHONE.test(momo)) found.momoNumber = 'Use a Ghana number, e.g. 0241234567.';
      if (!form.momoNetwork) found.momoNetwork = 'Choose the network.';
    } else if (form.collectionMethod === 'merchant') {
      if (form.merchantId.trim().length < 3) found.merchantId = 'Enter your Merchant ID.';
      const phone = form.collectionPhone.replace(/[\s-]/g, '');
      if (phone && !GHANA_PHONE.test(phone)) found.collectionPhone = 'Use a Ghana number, e.g. 0241234567.';
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

      const collection =
        form.collectionMethod === 'bank'
          ? {
              accountName: form.accountName.trim(),
              accountNumber: form.accountNumber.replace(/\s/g, ''),
              bankName: form.bankName,
            }
          : form.collectionMethod === 'momo'
            ? { momoNumber: (form.momoNumber || '').replace(/[\s-]/g, ''), momoNetwork: form.momoNetwork }
            : {
                merchantId: form.merchantId.trim(),
                collectionPhone: form.collectionPhone.replace(/[\s-]/g, ''),
              };

      try {
        await updatePayoutAccount(schoolId, { ...collection, method: form.collectionMethod, mode: form.mode });
        toast.success('Collection details saved.');
      } catch (error) {
        if (error.code === 'PAYOUT_NOT_SUPPORTED') {
          setFormError(
            'Your collection details are saved on this device only — the API does not accept them yet. Nothing was lost, but re-enter them once support ships.'
          );
          toast.warning('Collection details kept on this device; the server has no endpoint yet.');
        } else {
          setFormError(error.message || 'We could not save your collection details.');
          toast.error(error.message || 'We could not save your collection details.');
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

  const showError = (key) => (touched[key] ? errors[key] : undefined);

  return (
    <div>
      <StepHeader
        title="How should parents pay?"
        description="Set up your school's own collection methods. Parents will pay directly into your accounts — SukuuPay does not hold or settle funds."
      />

      <div className="space-y-6">
        {formError && <FormAlert tone="error">{formError}</FormAlert>}

        <div className="flex items-start gap-2.5 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3.5">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" aria-hidden="true" />
          <p className="text-[13px] font-semibold leading-relaxed text-brand-800">
            <strong>Self-Collection model:</strong> Your school collects payments directly using its own
            credentials. Funds go straight to your bank account, Mobile Money wallet, or merchant terminal.
            There is no weekly settlement — you receive money as parents pay.
          </p>
        </div>

        <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
          <p className="text-[12px] font-medium leading-relaxed text-slate-600">
            <strong>Platform-managed collections</strong> (where SukuuPay holds funds and settles weekly) is
            a separate option available to verified schools. In this onboarding, you are setting up
            <strong> self-collection</strong> — your school keeps full control of its money.
          </p>
        </div>

        <SectionCard
          icon={Wallet}
          title="Collection method"
          description="How parents will pay your school. Choose the method you want to receive funds through."
        >
          <fieldset className="mb-4">
            <legend className="mb-1.5 text-[12px] font-semibold text-slate-700">
              Collection method
            </legend>
            <div className="flex flex-wrap gap-2.5">
              {[
                { value: 'bank', label: 'Bank account', icon: Landmark },
                { value: 'momo', label: 'Mobile Money', icon: Smartphone },
                { value: 'merchant', label: 'Merchant ID', icon: Building2 },
              ].map((option) => {
                const Icon = option.icon;
                const active = form.collectionMethod === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => update('collectionMethod', option.value)}
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
              <button
                type="button"
                onClick={() => toast.info('Platform-managed collections (SukuuPay collects) will be available soon.')}
                className="flex items-center gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-500 transition-colors hover:border-slate-400 hover:bg-slate-100"
              >
                <Wallet className="h-4 w-4" aria-hidden="true" />
                Platform-managed
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                  Coming soon
                </span>
              </button>
            </div>
          </fieldset>

          {form.collectionMethod === 'bank' && (
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
          )}

          {form.collectionMethod === 'momo' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="MoMo number"
                icon={Smartphone}
                type="tel"
                inputMode="tel"
                placeholder="0241234567"
                value={form.momoNumber || ''}
                onChange={onChange('momoNumber')}
                onBlur={blur('momoNumber')}
                error={showError('momoNumber')}
                required
                hint="The number parents will send Mobile Money payments to"
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

          {form.collectionMethod === 'merchant' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Merchant ID"
                placeholder="e.g. MCH-12345"
                value={form.merchantId}
                onChange={onChange('merchantId')}
                onBlur={blur('merchantId')}
                error={showError('merchantId')}
                required
              />
              <Field
                label="Collection phone number"
                icon={Smartphone}
                type="tel"
                inputMode="tel"
                placeholder="0241234567 (optional)"
                value={form.collectionPhone}
                onChange={onChange('collectionPhone')}
                onBlur={blur('collectionPhone')}
                error={showError('collectionPhone')}
                hint="Optional — the number parents can call for payment support"
              />
            </div>
          )}

          <p className="mt-4 flex items-start gap-2 text-[12px] font-medium leading-relaxed text-slate-500">
            <Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Since your school collects funds directly, there is no weekly settlement — money arrives in
            your account as parents pay. You can change these details later from Settings.
          </p>
        </SectionCard>
      </div>
    </div>
  );
};

export default Step2PaymentSetup;