import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Building2,
  Camera,
  CheckCircle2,
  Clock,
  Copy,
  Globe,
  Hash,
  KeyRound,
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
import GhanaPostGpsPicker from '../../components/onboarding/GhanaPostGpsPicker';
import JoinSchoolSheet from '../../components/onboarding/JoinSchoolSheet';
import ReceiptPreview from '../../components/onboarding/ReceiptPreview';
import SchoolLocationPicker from '../../components/onboarding/SchoolLocationPicker';
import useOnboardingProgress from '../../hooks/useOnboardingProgress';
import useToast from '../../hooks/useToast';
import { getSchool, updateSchool, provisionMySchool, joinSchoolByCode } from '../../services/school';
import { uploadSchoolLogo } from '../../services/upload';
import { useAuth } from '../../context/AuthContext';
import { GHANA_REGIONS, GHANA_SCHOOL_TYPES, canCreateSchool } from '../../utils/constants';
import { isValidDigitalAddress, isInsideGhana } from '../../utils/ghanaPostGps';
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
  // Coordinates live outside `form` — they are an object on the School model, not
  // a flat field, and mixing them in here would let a half-updated object reach
  // `toPayload`. `label` is the place name shown on the picker's summary line;
  // it is display-only and is never sent to the server (see `toPayload`).
  location: { latitude: null, longitude: null, source: null, label: '' },
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

  // Optional, but if a value is present it must be a real digital address. The
  // server enforces this too (`gpsAddressValidator`); catching it here means the
  // error lands on the segment that is wrong instead of on a form-level banner
  // after a failed save.
  if (form.gpsAddress.trim() && !isValidDigitalAddress(form.gpsAddress)) {
    errors.gpsAddress = 'That is not a valid digital address.';
  }

  // Half a pair is not a location. Storing one coordinate would put a pin in the
  // Gulf of Guinea, which is worse than storing none.
  const { latitude, longitude } = form.location || {};
  const hasLat = Number.isFinite(latitude);
  const hasLng = Number.isFinite(longitude);
  if (hasLat !== hasLng) {
    errors.location = 'Give both coordinates, or neither.';
  } else if (hasLat && hasLng && !isInsideGhana(latitude, longitude)) {
    errors.location = 'Those coordinates are outside Ghana.';
  }

  return errors;
};

/** Strip the optional blanks so Joi does not receive `""` for a number field. */
const toPayload = (form) => {
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
  // No `logo` key. Neither school schema declares one, so `stripUnknown`
  // discarded it on every save and the only thing that ever set `School.logo`
  // was the upload endpoint — which sets it server-side itself. Sending it here
  // was dead code, and after the deferred-upload change it would have carried a
  // local `blob:` URL.

  // Coordinates are sent as flattened dotted keys because that is the only form
  // the Joi schemas accept for a nested path, and `updateSchool` reassembles them
  // into `school.location`. A half-pair is never sent: `validate` already blocks
  // it, and the guard here means a programmatic caller cannot slip one through.
  const { latitude, longitude, source } = form.location || {};
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    payload['location.latitude'] = latitude;
    payload['location.longitude'] = longitude;
    payload['location.source'] = source || 'manual';
  }
  // `label` is deliberately not sent. It is a cached human name for the
  // coordinates, not school data — `School.location` has no field for it, and
  // `stripUnknown` would discard it anyway. See `SchoolLocationPicker`, which
  // falls back to a generic label when the name is absent.

  return payload;
};

/**
 * Signup classification → `School.type`.
 *
 * Mirrors `toSchoolType` in Backend/src/utils/schoolTypeMapping.js. The signup
 * form offers `senior_high` and `university`, which the School enum does not
 * contain, so the two vocabularies have to meet somewhere. The server maps them
 * too; doing it here as well means the select shows a value the server will
 * accept, rather than rendering an option that fails on submit.
 *
 * `senior_high` and `university` collapse to their nearest enum member. That is
 * lossy, so the UI says so instead of quietly rewriting the bursar's answer —
 * see `LossyTypeNote`.
 */
const CLASSIFICATION_TO_TYPE = {
  private: 'private',
  international: 'international',
  senior_high: 'public',
  university: 'private',
};

const toSchoolType = (value) => {
  if (typeof value !== 'string' || !value) return '';
  const key = value.trim().toLowerCase();
  if (GHANA_SCHOOL_TYPES.some((option) => option.value === key)) return key;
  return CLASSIFICATION_TO_TYPE[key] ?? '';
};

const isLossy = (value) => {
  if (typeof value !== 'string' || !value) return false;
  const key = value.trim().toLowerCase();
  if (GHANA_SCHOOL_TYPES.some((option) => option.value === key)) return false;
  return CLASSIFICATION_TO_TYPE[key] !== undefined;
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

const SectionHeading = ({ children }) => (
  <h2 className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
    <span className="h-px w-4 bg-slate-300" aria-hidden="true" />
    {children}
  </h2>
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

/**
 * Confirmation shown once provisioning succeeds.
 *
 * The school code is the load-bearing element, not decoration: it is the only
 * thing a second bursar can use to request access, so burying it in a settings
 * page would strand the exact scenario this flow exists to rescue.
 *
 * Deliberately has no button of its own. Navigation belongs to
 * `OnboardingLayout`, which owns `unlockStep` — a second `unlockStep` call from
 * here would update this component's copy of the wizard progress and not the
 * layout's, and the layout would then bounce the user straight back to step 1.
 * The sticky action bar below is what advances, relabelled to match.
 */
const CreatedPanel = ({ school }) => {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(school.schoolCode || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard is permission-gated and can be blocked outright. The code is
      // on screen and selectable, so failing silently here is survivable.
    }
  };

  return (
    <div className="rounded-2xl border border-brand-200 bg-brand-50 p-6 text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-700 text-white shadow-md">
        <CheckCircle2 className="h-7 w-7" />
      </span>
      <h2 className="mt-4 text-xl font-extrabold tracking-tight text-ink">
        {school.name} is ready
      </h2>
      <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-slate-600">
        Your 30-day trial is active. Next, connect how you will receive payments.
      </p>

      <div className="mx-auto mt-5 max-w-xs rounded-xl border border-brand-200 bg-white p-4">
        <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
          Your school code
        </p>
        <p className="mt-1.5 font-mono text-2xl font-extrabold tracking-[0.2em] text-ink">
          {school.schoolCode}
        </p>
        <button
          type="button"
          onClick={copy}
          className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] font-bold text-slate-700 transition-colors hover:bg-slate-50"
        >
          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
          {copied ? 'Copied' : 'Copy code'}
        </button>
        <p className="mt-2.5 text-[11px] font-medium leading-snug text-slate-500">
          Share this with other staff so they can join this school.
        </p>
      </div>

      <p className="mt-5 text-[12px] font-semibold text-slate-500">
        Continue below to set up payments.
      </p>
    </div>
  );
};

/**
 * Shown instead of the create form to an accountant, teacher or viewer.
 *
 * The wizard's Continue stays disabled for this role — correctly, since there is
 * nothing for them to configure and onboarding cannot complete until a school
 * admin approves their join. Without an explanation that reads as a broken page,
 * so the state is stated plainly rather than left for the user to infer.
 */
const JoinRequiredPanel = ({ role, requested, onRequest }) => {
  const roleLabel =
    { accountant: 'Accountant / bursar', teacher: 'Teacher', viewer: 'Viewer' }[role] ||
    'Staff member';

  return (
    <div className="mx-auto max-w-lg">
      <header className="mb-6">
        <p className="text-[11px] font-extrabold uppercase tracking-wider text-brand-700">
          Step 1 of 4 · Getting started
        </p>
        <h1 className="mt-1.5 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
          Join your school
        </h1>
        <p className="mt-2 text-sm font-medium leading-relaxed text-slate-500">
          You signed up as a {roleLabel.toLowerCase()}, so you need to join a school that is
          already on SukuuPay.
        </p>
      </header>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-soft">
        <span
          className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${
            requested ? 'bg-amber-100 text-amber-700' : 'bg-brand-50 text-brand-700'
          }`}
        >
          {requested ? (
            <Clock className="h-7 w-7" aria-hidden="true" />
          ) : (
            <School className="h-7 w-7" aria-hidden="true" />
          )}
        </span>

        <h2 className="mt-4 text-lg font-extrabold tracking-tight text-ink">
          {requested ? 'Waiting for approval' : 'You need a school code'}
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-slate-600">
          {requested
            ? 'Your request has been sent. An administrator of your school has to approve it before you get access, and we will email you the moment they do.'
            : 'Ask your headteacher for your school code — it looks like ABC123 and appears on your school’s SukuuPay dashboard.'}
        </p>

        <button
          type="button"
          onClick={onRequest}
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-bold text-white shadow-lift transition-colors hover:bg-brand-800"
        >
          <KeyRound className="h-4 w-4" aria-hidden="true" />
          {requested ? 'Resend request' : 'Enter school code'}
        </button>

        <p className="mt-4 text-[11px] font-medium leading-snug text-slate-400">
          A school code alone never grants access — it identifies your school, and one of its
          administrators decides. That is what stops a guessed code from handing out your bursary.
        </p>
      </div>
    </div>
  );
};

const Step1SchoolProfile = () => {
  const { user, setSchool, applyUser } = useAuth();
  const toast = useToast();
  const { getStepDraft, setStepDraft } = useOnboardingProgress();
  const { register } = useStepChrome();

  const schoolId = user?.schoolId;

  /**
   * The fix, in one line.
   *
   * This component previously returned a terminal "not linked to a school,
   * contact support" card whenever `schoolId` was absent — which was every
   * self-service signup, because `POST /auth/signup` never created a School and
   * `POST /schools` is super_admin-only. There was no action behind the branch,
   * only an apology.
   *
   * Now the same condition selects a *mode*: `create` provisions a school,
   * `edit` updates the existing one. Both render the same form, so a bursar does
   * not feel they landed in a different part of the app.
   */
const mode = schoolId ? 'edit' : 'create';

  /**
   * Whether this account is allowed to register a school at all.
   *
   * Only `school_admin` can: `POST /schools/me` rejects the other roles with
   * `ROLE_CANNOT_CREATE_SCHOOL`, and `POST /upload/school-logo` is separately
   * guarded by `authorize('super_admin', 'school_admin')`. Showing the create
   * form to a teacher would only reveal that on submit, so they get the join
   * path instead — which is the only route that can actually work for them.
   */
  const mayCreateSchool = canCreateSchool(user?.role);


  const [form, setForm] = useState(EMPTY);
  const [logoUrl, setLogoUrl] = useState('');
  const [logoBusy, setLogoBusy] = useState(false);
  /**
   * The chosen image while there is no school to attach it to.
   *
   * Held in state rather than uploaded eagerly because the upload endpoint scopes
   * by `user.schoolId`, which is null until provisioning runs — see `handleLogo`.
   * A `File` is not serialisable, so it is deliberately absent from the
   * localStorage draft; a refresh mid-selection loses the pick, which is the
   * lesser failure against trying to persist binary state.
   */
  const [pendingLogoFile, setPendingLogoFile] = useState(null);
  const localPreviewRef = useRef('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [touched, setTouched] = useState({});
  const [hydrated, setHydrated] = useState(false);
  const [created, setCreated] = useState(null);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinRequested, setJoinRequested] = useState(false);

  /**
   * Coordinates, kept beside `form` rather than inside it.
   *
   * `form` mirrors the flat field set of the School model and is what
   * `validate` walks. Location is a nested object addressed by dotted keys on
   * the wire, so folding it in would mean either special-casing it in the
   * validator or letting a half-updated object reach `toPayload`.
   */
  const [location, setLocation] = useState(EMPTY.location);


  /**
   * What signup already asked for, now that the API keeps it.
   *
   * Stored on `User.schoolIntent` rather than in the browser: the old flow
   * collected a school name, classification and region at `/signup`, had the
   * payload silently stripped by `stripUnknown`, and then had no way to ask for
   * them again. Prefilling from the server means the value also survives a
   * device change, which a localStorage draft would not.
   */
  const intent = user?.schoolIntent;

  // Restore the draft, then let the server's copy fill any field the draft
  // never had — a refresh mid-typing must not lose work, but a stale draft
  // should not pin the form to values the bursar has since changed elsewhere.
  useEffect(() => {
    let active = true;

    const hydrate = async () => {
      const draft = getStepDraft('school-profile');
      if (draft) setForm((current) => ({ ...current, ...draft.form }));
      if (draft?.logoUrl) setLogoUrl(draft.logoUrl);
      if (draft?.location) {
        setLocation((current) => ({ ...current, ...draft.location }));
      }
      setHydrated(true);

      if (mode === 'edit' && schoolId) {
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
            email: current.email || school.email || user?.email || '',
            website: current.website || school.website || '',
            address: current.address || school.address || '',
            city: current.city || school.city || '',
            region: current.region || school.region || '',
            gpsAddress: current.gpsAddress || school.gpsAddress || '',
          }));
          // Restored separately from the flat fields so a stored coordinate pair
          // survives a refresh. Without this a bursar who dropped a pin would lose
          // it on reload and assume the map never saved.
          setLocation((current) => ({
            latitude: current.latitude ?? school.location?.latitude ?? null,
            longitude: current.longitude ?? school.location?.longitude ?? null,
            source: current.source ?? school.location?.source ?? null,
            // No name comes back from the server, so a pin restored from the
            // database falls back to the generic label rather than showing a
            // stale one from a previous session.
            label: current.label || '',
          }));
          setLogoUrl((current) => current || school.logo || '');
        } catch (error) {
          // The draft alone is enough to continue; a failed prefetch is not fatal.
          toast.warning('Could not load your saved school details. Your draft is still here.');
        }
        return;
      }

      // Create mode: prefill from the signup intent, then from the account. The
      // phone and email the bursar already typed at signup are a better default
      // than a blank field they would only have to retype.
      if (!active || !intent) return;
      setForm((current) => ({
        ...current,
        name: current.name || intent.name || '',
        type: current.type || toSchoolType(intent.classification),
        region: current.region || intent.region || '',
        phone: current.phone || user?.phone || '',
        email: current.email || user?.email || '',
      }));
    };

    hydrate();
    return () => {
      active = false;
    };
  }, [mode, schoolId, user?.email, user?.phone, intent, getStepDraft, toast]);

  // Location is folded in for validation and serialisation, but stays in its own
  // state variable — see the note on the `location` declaration.
  const effectiveForm = useMemo(() => ({ ...form, location }), [form, location]);
  // Release the local preview URL on unmount. Leaving it unrevoked keeps the whole
  // image in memory for the lifetime of the tab, and the user may select several
  // while comparing them.
  useEffect(
    () => () => {
      if (localPreviewRef.current) URL.revokeObjectURL(localPreviewRef.current);
    },
    []
  );

  const errors = useMemo(() => validate(effectiveForm), [effectiveForm]);
  const isValid = Object.keys(errors).length === 0;

  const update = (key) => (event) => {
    const value = event.target.value;
    setForm((current) => ({ ...current, [key]: value }));
    setFormError('');
    if (touched[key]) setTouched((current) => ({ ...current, [key]: true }));
  };

  const blur = (key) => () => setTouched((current) => ({ ...current, [key]: true }));

  // Persist on every change, but only once hydrated — otherwise the initial
  // `EMPTY` state would overwrite a good draft before it was ever read. The pin
  // is included: a refresh must not silently discard a dropped marker.
  useEffect(() => {
    if (!hydrated) return;
    setStepDraft('school-profile', {
      form,
      location,
      logoUrl,
      savedAt: new Date().toISOString(),
    });
  }, [form, location, hydrated, logoUrl, setStepDraft]);

  // Tell the layout whether Continue is allowed. Re-registers whenever the
  // validity or the save handler changes; the handler is a ref-backed callback
  // so this does not loop on every render.
  const saveRef = useRef(null);
  saveRef.current = async () => {
    setSaving(true);
    setFormError('');
    try {
      if (mode === 'create') {
        const { school, user: updatedUser } = await provisionMySchool(
          toPayload(effectiveForm)
        );

        // Two things must happen before the wizard advances: the guard needs the
        // new `schoolId` to stop redirecting back here, and the later steps
        // read `user.schoolId` to scope their own requests. The response already
        // carries the linked user, so this needs no extra round trip.
        setSchool(school);
        if (updatedUser) applyUser(updatedUser);

        // The logo is uploaded only now, and only because it could not be done
        // earlier — see `handleLogo`. It mutates a local copy rather than calling
        // `setCreated` mid-flight, so the confirmation panel is rendered exactly
        // once with the final URL already in place.
        let createdSchool = school;
        if (pendingLogoFile) {
          try {
            const url = await uploadSchoolLogo(pendingLogoFile, school._id);
            if (url) {
              createdSchool = { ...school, logo: url };
              setLogoUrl(url);
            }
          } catch (uploadError) {
            // The school exists and the wizard can proceed; a missing logo is
            // cosmetic and is fixable from the school settings page. Failing the
            // whole save here would strand the user on Step 1 over an image.
            toast.warning(
              'Your school was created, but the logo could not be uploaded. You can add it later.'
            );
          }
        }

        setCreated(createdSchool);

        toast.success(`${school.name} is set up.`);
        // Deliberately `false`. Returning `true` would make `OnboardingLayout`
        // unlock step 2 and navigate immediately, so the confirmation — and the
        // school code the user needs to invite colleagues — would flash past
        // unseen. The registration effect below swaps the action bar over to an
        // unconditional advance, so the next press of Continue does exactly what
        // returning `true` would have done.
        return false;
      }

      await updateSchool(schoolId, toPayload(effectiveForm));
      toast.success('School profile saved.');
      return true;
    } catch (error) {
      // The one failure with a different next step: this email already belongs
      // to a School, so the bursar is a second admin of a school someone else
      // registered. Provisioning can never succeed for them — the join sheet is
      // the route that can.
      if (error.code === 'SCHOOL_ALREADY_REGISTERED') {
        setFormError('');
        setJoinOpen(true);
        return false;
      }

      setFormError(error.message || 'We could not save your school details.');
      toast.error(error.message || 'We could not save your school details.');
      return false;
    } finally {
      setSaving(false);
    }
  };

useEffect(() => {
    // Join-only accounts have nothing to save and cannot finish onboarding until a
    // school admin approves them. The form is never rendered for them, so
    // `isValid` would be a meaningless `false` derived from empty fields; the bar
    // is re-labelled instead so the reason is stated rather than implied.
    if (mode === 'create' && !mayCreateSchool) {
      register({
        valid: false,
        busy: false,
        label: 'Awaiting school access',
        onSubmit: async () => false,
      });
      return;
    }

    // Post-creation: the form is gone, so its validity is irrelevant. Advance on
    // the next press rather than on the one that created the school, which is
    // what leaves room to actually read the code.
    if (created) {
      register({
        valid: true,
        busy: false,
        label: 'Continue to payment setup',
        onSubmit: async () => true,
      });
      return;
    }

    register({
      valid: isValid && !saving,
      busy: saving,
      // Naming the action matters: "Continue" is ambiguous about whether a
      // school is about to exist, and this is the moment one does.
      label: mode === 'create' ? 'Create school & continue' : 'Continue',
      onSubmit: () => saveRef.current(),
    });
  }, [isValid, saving, mode, created, mayCreateSchool, register]);


  /**
   * Logo selection.
   *
   * The bug this branch exists to prevent: uploading immediately on selection
   * calls `POST /upload/school-logo`, whose scope is derived from `user.schoolId`
   * alone (`resolveSchoolId` in Backend/src/services/upload.service.js). In CREATE
   * mode `user.schoolId` is null — the School document does not exist until
   * `POST /schools/me` runs on Continue — so the upload resolved to no school and
   * the server answered `403 NO_SCHOOL_SCOPE` / "No school in scope". The empty
   * `schoolIntent` was irrelevant; it only prefills text fields.
   *
   * So in CREATE mode the file is held and uploaded after provisioning returns,
   * when there is a `schoolId` to scope it to. EDIT mode is unaffected and still
   * uploads straight away, because the school already exists there.
   *
   * A local object URL drives the preview either way, so the user sees their logo
   * immediately rather than after a round trip that may not even be possible yet.
   */
  const handleLogo = async (file) => {
    if (file.size > 2 * 1024 * 1024) {
      toast.error('That image is larger than 2 MB. Please choose a smaller file.');
      return;
    }
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      toast.error('Please choose a PNG, JPG or WebP image.');
      return;
    }

    // Revoked on every replacement so a long editing session cannot accumulate
    // blob URLs for the lifetime of the tab.
    if (localPreviewRef.current) URL.revokeObjectURL(localPreviewRef.current);
    const previewUrl = URL.createObjectURL(file);
    localPreviewRef.current = previewUrl;
    setLogoUrl(previewUrl);

    if (!schoolId) {
      setPendingLogoFile(file);
      toast.info('Logo ready — it will be uploaded when you create your school.');
      return;
    }

    setLogoBusy(true);
    try {
      const url = await uploadSchoolLogo(file, schoolId);
      if (url) setLogoUrl(url);
      toast.success('Logo uploaded.');
    } catch (error) {
      toast.error(error.message || 'The logo could not be uploaded.');
    } finally {
      setLogoBusy(false);
    }
  };

  const showError = useCallback((key) => (touched[key] ? errors[key] : undefined), [errors, touched]);

  // Confirmation replaces the form only in create mode; an edit keeps the form
  // visible so the bursar can correct what they just typed.
  if (created) {
    return (
      <>
        <StepHeader
          step={1}
          title="Your school is set up"
          description="Everything below is done. One more step and you can start collecting fees."
        />
        <CreatedPanel school={created} />
      </>
    );
  }

// Non-admin roles never see the create form. They are not blocked at submit
  // time — they are given the one route that can work for them, before they have
  // invested any effort filling in a school they are not allowed to register.
  if (mode === 'create' && !mayCreateSchool) {
    return (
      <>
        <JoinRequiredPanel
          role={user?.role}
          requested={joinRequested}
          onRequest={() => setJoinOpen(true)}
        />
        <JoinSchoolSheet
          open={joinOpen}
          onClose={() => setJoinOpen(false)}
          applicant={user}
          requestSchoolByCode={joinSchoolByCode}
          onRequested={() => {
            setJoinRequested(true);
            toast.info('We will email you when your request is approved.');
          }}
        />
      </>
    );
  }

  return (
    <>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* No top padding on mobile: the preview is `order-first` and `sticky`, so
            it sits in the document flow above this column rather than overlaying
            it. Nothing is hidden underneath it. */}
        <div className="min-w-0 lg:order-none">
          <StepHeader
            step={1}
            title={mode === 'create' ? "Let's set up your school" : 'Tell us about your school'}
            description="This is what parents see on receipts, reminders and payment pages. Fields marked * are required."
          />

          {/* Framing for the two modes. Without this, an unlinked bursar sees the
              identical page as a returning one and has no way to tell that
              pressing Continue will *create* something rather than save it. */}
          {mode === 'create' && (
            <div className="mb-5 flex items-start gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-700 text-white">
                <Building2 className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-extrabold text-ink">Your account is ready</p>
                <p className="mt-0.5 text-[12px] font-medium leading-relaxed text-slate-600">
                  It just needs a school to run. We have carried over what you entered at sign-up,
                  and your 30-day trial starts the moment you continue.
                </p>
              </div>
            </div>
          )}


          <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-soft sm:p-7">
            {formError && <FormAlert tone="error">{formError}</FormAlert>}

            <LogoPicker
              logoUrl={logoUrl}
              busy={logoBusy || saving}
              onSelect={handleLogo}
              onClear={() => {
                setLogoUrl('');
                setPendingLogoFile(null);
                if (localPreviewRef.current) {
                  URL.revokeObjectURL(localPreviewRef.current);
                  localPreviewRef.current = '';
                }
              }}
            />

            <div className="space-y-4">
              <SectionHeading>Identity</SectionHeading>
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

                <div>
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
                  {/* `senior_high` and `university` have no enum equivalent, so
                      the mapping is lossy. Saying so beats a silent rewrite. */}
                  {isLossy(intent?.classification) && (
                    <p className="mt-1.5 text-[11px] font-medium leading-snug text-slate-500">
                      Saved from your sign-up selection as “{GHANA_SCHOOL_TYPES.find((o) => o.value === form.type)?.label}”.
                      You can change this any time.
                    </p>
                  )}
                </div>

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
            </div>

            <div className="space-y-4">
              <SectionHeading>How parents reach you</SectionHeading>
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
                  hint="Reminders send from here"
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

                {/* Two optional ways to pin the school, in one block. Both are
                    optional individually and optional together: a bursar with
                    neither still finishes onboarding, because a missing map pin
                    is not a reason to block fee collection. */}
                <div className="sm:col-span-2 space-y-3">
<GhanaPostGpsPicker
                    value={form.gpsAddress}
                    onChange={(value) => {
                      setForm((current) => ({ ...current, gpsAddress: value }));
                      setFormError('');
                    }}
                    error={showError('gpsAddress')}
                    touched={Boolean(touched.gpsAddress)}
                  />

                  <SchoolLocationPicker
                    latitude={location.latitude}
                    longitude={location.longitude}
                    source={location.source}
                    label={location.label}
                    onChange={(next) => {
                      setLocation(next);
                      setFormError('');
                    }}
                    onClear={() =>
                      setLocation({ latitude: null, longitude: null, source: null, label: '' })
                    }
                    // Rendered inside the picker rather than as a separate alert
                    // above it: the message concerns the coordinates, and the
                    // picker owns both the search and the numeric inputs.
                    error={errors.location}
                    disabled={saving}
                  />
                </div>

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
            </div>

            {mode === 'create' && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[12px] font-medium leading-snug text-slate-600">
                  Setting up a school someone else registered?{' '}
                  <button
                    type="button"
                    onClick={() => setJoinOpen(true)}
                    className="font-bold text-brand-700 underline"
                  >
                    Join with a school code
                  </button>
                </p>
                <p className="text-[11px] font-semibold text-slate-400">
                  Draft saves automatically
                </p>
              </div>
            )}
          </div>

          <p className="mt-3 text-center text-[12px] font-semibold text-slate-400 sm:hidden">
            Use the button below to continue.
          </p>
          {saving && (
            <p className="mt-3 text-center text-[12px] font-bold text-brand-700" role="status">
              {mode === 'create' ? 'Setting up your school…' : 'Saving your school profile…'}
            </p>
          )}
        </div>

        <ReceiptPreview
          // Every field a parent would see, passed straight from live form state.
          // The component holds no copy of its own, so this is the whole
          // synchronisation mechanism — there is nothing to fall out of step.
          name={form.name}
          logoUrl={logoUrl}
          city={form.city}
          region={form.region}
          address={form.address}
          phone={form.phone}
          email={form.email}
          website={form.website}
          gpsAddress={form.gpsAddress}
          motto={form.motto}
          typeLabel={GHANA_SCHOOL_TYPES.find((option) => option.value === form.type)?.label || ''}
          yearFounded={form.yearFounded}
          placeLabel={location.label}
          latitude={location.latitude}
          longitude={location.longitude}
        />
      </div>

      <JoinSchoolSheet
        open={joinOpen}
        onClose={() => setJoinOpen(false)}
        applicant={user}
        requestSchoolByCode={joinSchoolByCode}
        onRequested={() => {
          toast.info('We will email you when your request is approved.');
        }}
      />
    </>
  );
};

export default Step1SchoolProfile;

