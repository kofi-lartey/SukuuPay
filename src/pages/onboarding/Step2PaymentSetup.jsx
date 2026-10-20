import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Info,
  Landmark,
  Smartphone,
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
 * There is one answer to this now. Collections run on SukuuPay's own Moolre
 * account, so every school uses the platform gateway and the School model
 * stores `payment.gatewayMode` as `moolre` whether the school chose it or not.
 * A school cannot bring its own gateway, so the mode is not a choice and is
 * not asked for.
 *
 * What *is* asked for is where the money lands: the settlement account.
 */
const EMPTY = {
  mode: 'sukuupay',
  payoutMethod: 'bank',
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
      // The mode is not a choice any more, so a draft written before that
      // change cannot bring it back — it is pinned to the platform gateway.
      setForm((current) => ({ ...current, ...draft, mode: 'sukuupay' }));
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

  const showError = (key) => (touched[key] ? errors[key] : undefined);

  return (
    <div>
      <StepHeader
        title="How should parents pay?"
        description="Choose where the money lands. You can change this later from Settings — it does not affect your student roster."
      />

      <div className="space-y-6">
        {formError && <FormAlert tone="error">{formError}</FormAlert>}

        <div className="flex items-start gap-2.5 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3.5">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" aria-hidden="true" />
          <p className="text-[13px] font-semibold leading-relaxed text-brand-800">
            SukuuPay collects every payment on your behalf. A small service fee is added to
            each payment, and you&apos;ll receive weekly settlements every Monday for the
            previous week&apos;s collections.
          </p>
        </div>

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
            SukuuPay holds the collections and remits them to this account. You&apos;ll
            receive weekly settlements every Monday.
          </p>
        </SectionCard>
      </div>
    </div>
  );
};

export default Step2PaymentSetup;
