import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  Globe,
  Hash,
  Landmark,
  LoaderCircle,
  Mail,
  MapPin,
  Phone,
  Quote,
  School,
  Trash2,
} from 'lucide-react';
import { Field, FormAlert, SelectField } from '../../components/common/FormField';
import useOnboardingProgress from '../../hooks/useOnboardingProgress';
import useToast from '../../hooks/useToast';
import { getSchool, updateSchool } from '../../services/school';
import { uploadSchoolLogo } from '../../services/upload';
import { useAuth } from '../../context/AuthContext';
import { GHANA_REGIONS, GHANA_SCHOOL_TYPES } from '../../utils/constants';
import { useStepChrome } from './OnboardingStepContext';

const CURRENT_YEAR = new Date().getFullYear();

const EMPTY = {
  name: '',
  type: '',
  yearFounded: '',
  motto: '',
  phone: '',
  email: '',
  website: '',
  address: '',
  city: '',
  region: '',
  gpsAddress: '',
};

/**
 * Mirrors `validateGhanaPhone` in Backend/src/utils/generateCode.js: ten digits
 * starting 0, or the 233 country form. Accepting only the local form in the UI
 * and normalising on submit keeps the draft readable.
 */
const GHANA_PHONE = /^(0[2-5]\d{8}|233[2-5]\d{8})$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const validate = (form) => {
  const errors = {};

  if (form.name.trim().length < 2) errors.name = 'Enter the school name (at least 2 characters).';
  if (!form.type) errors.type = 'Choose a school type.';
  if (form.yearFounded !== '') {
    const year = Number(form.yearFounded);
    if (!Number.isInteger(year) || year < 1800 || year > CURRENT_YEAR) {
      errors.yearFounded = `Enter a year between 1800 and ${CURRENT_YEAR}.`;
    }
  }
  if (form.motto.length > 200) errors.motto = 'Keep the motto to 200 characters or fewer.';

  const digits = form.phone.replace(/[\s-]/g, '');
  if (!digits) errors.phone = 'Enter a contact phone number.';
  else if (!GHANA_PHONE.test(digits)) {
    errors.phone = 'Use a Ghana number, e.g. 0241234567 or 233241234567.';
  }

  if (!form.email.trim()) errors.email = 'Enter a contact email.';
  else if (!EMAIL.test(form.email.trim())) errors.email = 'Enter a valid email address.';

  if (form.website.trim() && !/^https?:\/\/.+\..+/.test(form.website.trim())) {
    errors.website = 'Enter a full URL starting with https://';
  }

  if (form.address.trim().length < 5) errors.address = 'Enter the school address.';
  if (form.city.trim().length < 2) errors.city = 'Enter the city or town.';
  if (!form.region) errors.region = 'Choose a region.';

  return errors;
};

/** Strip the optional blanks so Joi does not receive `""` for a number field. */
const toPayload = (form, logoUrl) => {
  const payload = {
    name: form.name.trim(),
    type: form.type,
    phone: form.phone.replace(/[\s-]/g, ''),
    email: form.email.trim().toLowerCase(),
    address: form.address.trim(),
    city: form.city.trim(),
    region: form.region,
  };
  if (form.yearFounded !== '') payload.yearFounded = Number(form.yearFounded);
  if (form.motto.trim()) payload.motto = form.motto.trim();
  if (form.website.trim()) payload.website = form.website.trim();
  if (form.gpsAddress.trim()) payload.gpsAddress = form.gpsAddress.trim();
  if (logoUrl) payload.logo = logoUrl;
  return payload;
};

const StepHeader = ({ step, title, description }) => (
  <header className="mb-7">
    <p className="text-[11px] font-extrabold uppercase tracking-wider text-brand-700">
      Step {step} of 4
    </p>
    <h1 className="mt-1.5 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{title}</h1>
    <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-slate-500">{description}</p>
  </header>
);

const LogoPicker = ({ logoUrl, busy, onSelect, onClear }) => {
  const inputRef = useRef(null);

  return (
    <div className="flex items-center gap-5">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        aria-label={logoUrl ? 'Replace school logo' : 'Upload school logo'}
        className="group relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-slate-300 bg-slate-50 transition-colors hover:border-brand-500 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {logoUrl ? (
          <img src={logoUrl} alt="School logo" className="h-full w-full object-cover" />
        ) : (
          <School className="h-8 w-8 text-slate-300 transition-colors group-hover:text-brand-500" aria-hidden="true" />
        )}

        <span className="absolute inset-0 flex items-center justify-center bg-ink/45 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          {busy ? (
            <LoaderCircle className="h-6 w-6 animate-spin text-white" aria-hidden="true" />
          ) : (
            <Camera className="h-6 w-6 text-white" aria-hidden="true" />
          )}
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Reset so re-picking the same file still fires a change event.
          event.target.value = '';
          if (file) onSelect(file);
        }}
      />

      <div className="min-w-0">
        <p className="text-sm font-bold text-ink">School logo</p>
        <p className="mt-1 text-[12px] font-medium leading-snug text-slate-500">
          Optional. PNG, JPG or WebP up to 2&nbsp;MB. Shown on SMS receipts and parent payment
          pages.
        </p>
        {logoUrl && (
          <button
            type="button"
            onClick={onClear}
            className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-bold text-red-600 hover:underline"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            Remove logo
          </button>
        )}
      </div>
    </div>
  );
};

const Step1SchoolProfile = () => {
  const { user } = useAuth();
  const toast = useToast();
  const { getStepDraft, setStepDraft } = useOnboardingProgress();
  const { register } = useStepChrome();

  const schoolId = user?.schoolId;
  const userEmail = user?.email;

  const [form, setForm] = useState(EMPTY);
  const [logoUrl, setLogoUrl] = useState('');
  const [logoBusy, setLogoBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [touched, setTouched] = useState({});
  const [hydrated, setHydrated] = useState(false);

  // Restore the draft, then let the server's copy fill any field the draft
  // never had — a refresh mid-typing must not lose work, but a stale draft
  // should not pin the form to values the bursar has since changed elsewhere.
  useEffect(() => {
    let active = true;

    const hydrate = async () => {
      const draft = getStepDraft('school-profile');
      if (draft) setForm((current) => ({ ...current, ...draft.form }));
      if (draft?.logoUrl) setLogoUrl(draft.logoUrl);
      setHydrated(true);

      if (!schoolId) return;
      try {
        const school = await getSchool(schoolId);
        if (!active || !school) return;
        setForm((current) => ({
          ...current,
          name: current.name || school.name || '',
          type: current.type || school.type || '',
          yearFounded: current.yearFounded || school.yearFounded || '',
          motto: current.motto || school.motto || '',
          phone: current.phone || school.phone || '',
          email: current.email || school.email || userEmail || '',
          website: current.website || school.website || '',
          address: current.address || school.address || '',
          city: current.city || school.city || '',
          region: current.region || school.region || '',
          gpsAddress: current.gpsAddress || school.gpsAddress || '',
        }));
        setLogoUrl((current) => current || school.logo || '');
      } catch (error) {
        // The draft alone is enough to continue; a failed prefetch is not fatal.
        toast.warning('Could not load your saved school details. Your draft is still here.');
      }
    };

    hydrate();
    return () => {
      active = false;
    };
  }, [schoolId, userEmail, getStepDraft, toast]);

  const errors = useMemo(() => validate(form), [form]);
  const isValid = Object.keys(errors).length === 0;

  const update = (key) => (event) => {
    const value = event.target.value;
    setForm((current) => ({ ...current, [key]: value }));
    setFormError('');
    if (touched[key]) setTouched((current) => ({ ...current, [key]: true }));
  };

  const blur = (key) => () => setTouched((current) => ({ ...current, [key]: true }));

  // Persist on every change, but only once hydrated — otherwise the initial
  // `EMPTY` state would overwrite a good draft before it was ever read.
  useEffect(() => {
    if (!hydrated) return;
    setStepDraft('school-profile', { form, logoUrl, savedAt: new Date().toISOString() });
  }, [form, logoUrl, hydrated, setStepDraft]);

  // Tell the layout whether Continue is allowed. Re-registers whenever the
  // validity or the save handler changes; the handler is a ref-backed callback
  // so this does not loop on every render.
  const saveRef = useRef(null);
  saveRef.current = async () => {
    setSaving(true);
    setFormError('');
    try {
      if (!schoolId) {
        setFormError('Your account is not linked to a school yet. Contact support to finish setup.');
        return false;
      }
      await updateSchool(schoolId, toPayload(form, logoUrl));
      toast.success('School profile saved.');
      return true;
    } catch (error) {
      setFormError(error.message || 'We could not save your school details.');
      toast.error(error.message || 'We could not save your school details.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const submit = () => saveRef.current();
    register({ valid: isValid && !saving, busy: saving, label: 'Continue', onSubmit: submit });
  }, [isValid, saving, register]);

  const handleLogo = async (file) => {
    if (file.size > 2 * 1024 * 1024) {
      toast.error('That image is larger than 2 MB. Please choose a smaller file.');
      return;
    }
    setLogoBusy(true);
    try {
      const url = await uploadSchoolLogo(file, schoolId);
      setLogoUrl(url || '');
      toast.success('Logo uploaded.');
    } catch (error) {
      toast.error(error.message || 'The logo could not be uploaded.');
    } finally {
      setLogoBusy(false);
    }
  };

  const showError = useCallback((key) => (touched[key] ? errors[key] : undefined), [errors, touched]);

  if (!schoolId) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <StepHeader
          step={1}
          title="School Profile"
          description="We could not find a school linked to your account."
        />
        <FormAlert tone="error">
          This account is not linked to a school yet. Contact the SukuuPay desk at{' '}
          <a className="underline" href="mailto:hello@sukuupay.com">
            hello@sukuupay.com
          </a>{' '}
          and we will link it for you.
        </FormAlert>
      </div>
    );
  }

  return (
    <div>
      <StepHeader
        step={1}
        title="Tell us about your school"
        description="This is what parents see on receipts, reminders and payment pages. Fields marked * are required."
      />

      <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-soft sm:p-7">
        {formError && <FormAlert tone="error">{formError}</FormAlert>}

        <LogoPicker
          logoUrl={logoUrl}
          busy={logoBusy || saving}
          onSelect={handleLogo}
          onClear={() => setLogoUrl('')}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            className="sm:col-span-2"
            label="School name"
            icon={School}
            placeholder="Morning Star Preparatory School"
            value={form.name}
            onChange={update('name')}
            onBlur={blur('name')}
            error={showError('name')}
            required
            maxLength={150}
          />

          <SelectField
            label="School type"
            icon={Landmark}
            value={form.type}
            onChange={update('type')}
            onBlur={blur('type')}
            error={showError('type')}
            required
          >
            <option value="">Select a type…</option>
            {GHANA_SCHOOL_TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectField>

          <Field
            label="Year founded"
            icon={Hash}
            type="number"
            inputMode="numeric"
            min={1800}
            max={CURRENT_YEAR}
            placeholder="1998"
            value={form.yearFounded}
            onChange={update('yearFounded')}
            onBlur={blur('yearFounded')}
            error={showError('yearFounded')}
            hint="Optional"
          />

          <Field
            className="sm:col-span-2"
            label="School motto"
            icon={Quote}
            placeholder="Knowledge, Discipline, Service"
            value={form.motto}
            onChange={update('motto')}
            onBlur={blur('motto')}
            error={showError('motto')}
            hint="Optional"
            maxLength={200}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Phone"
            icon={Phone}
            type="tel"
            inputMode="tel"
            placeholder="0241234567"
            value={form.phone}
            onChange={update('phone')}
            onBlur={blur('phone')}
            error={showError('phone')}
            required
          />

          <Field
            label="Email"
            icon={Mail}
            type="email"
            autoComplete="email"
            placeholder="bursary@school.edu.gh"
            value={form.email}
            onChange={update('email')}
            onBlur={blur('email')}
            error={showError('email')}
            required
          />

          <Field
            className="sm:col-span-2"
            label="Website"
            icon={Globe}
            type="url"
            placeholder="https://school.edu.gh"
            value={form.website}
            onChange={update('website')}
            onBlur={blur('website')}
            error={showError('website')}
            hint="Optional"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            className="sm:col-span-2"
            label="Address"
            icon={MapPin}
            placeholder="12 Independence Avenue, Cantonments"
            value={form.address}
            onChange={update('address')}
            onBlur={blur('address')}
            error={showError('address')}
            required
            maxLength={300}
          />

          <Field
            label="City / town"
            placeholder="Accra"
            value={form.city}
            onChange={update('city')}
            onBlur={blur('city')}
            error={showError('city')}
            required
            maxLength={100}
          />

          <SelectField
            label="Region"
            value={form.region}
            onChange={update('region')}
            onBlur={blur('region')}
            error={showError('region')}
            required
          >
            <option value="">Select a region…</option>
            {GHANA_REGIONS.map((region) => (
              <option key={region} value={region}>
                {region}
              </option>
            ))}
          </SelectField>

          <Field
            className="sm:col-span-2"
            label="Ghana Post GPS address"
            placeholder="GA-376-2513"
            value={form.gpsAddress}
            onChange={update('gpsAddress')}
            hint="Optional — helps parents find you"
            maxLength={200}
          />
        </div>
      </div>

      <p className="mt-3 text-center text-[12px] font-semibold text-slate-400 sm:hidden">
        Use the button below to continue.
      </p>
      {saving && (
        <p className="mt-3 text-center text-[12px] font-bold text-brand-700" role="status">
          Saving your school profile…
        </p>
      )}
    </div>
  );
};

export default Step1SchoolProfile;
