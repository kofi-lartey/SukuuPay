import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, LoaderCircle, ShieldAlert } from 'lucide-react';
import PageHeader from '../../../components/dashboard/PageHeader';
import Card from '../../../components/dashboard/ui/Card';
import Modal from '../../../components/common/Modal';
import { Field, SelectField, FormAlert } from '../../../components/common/FormField';
import PhoneInput from '../../../components/common/PhoneInput';
import { useToast } from '../../../hooks/useToast';
import { createSchool } from '../../../services/admin';
import { GHANA_REGIONS, GHANA_SCHOOL_TYPES, ROUTES } from '../../../utils/constants';

/**
 * Confirm the school that is about to exist.
 *
 * A separate step rather than a `window.confirm`, for the reason every other
 * confirmed action in this console is a dialog: the operator is about to create a
 * tenant that will appear on the schools list, on the platform dashboard, and on
 * every regional report, and the summary below is the last place the *shape* of what
 * they typed is visible before it is stored. A browser confirm says "are you sure?" and
 * nothing else, which is enough for "delete my draft" and not enough for "provision a
 * customer".
 *
 * It also states what the operator did **not** set â€” the markup and the trial â€” and
 * where those values came from, because those are the two fields that decide what the
 * school pays and for how long, and they are both defaults the server filled in rather
 * than anything on this form.
 */
const ConfirmCreateDialog = ({ open, draft, busy, error, onCancel, onConfirm }) => {
  const rows = [
    ['Name', draft.name],
    ['Type', GHANA_SCHOOL_TYPES.find((entry) => entry.value === draft.type)?.label || draft.type],
    ['Phone', draft.phone],
    ['Email', draft.email],
    ['Region', draft.region],
    ['City', draft.city],
    ['Address', draft.address],
    ['Website', draft.website || 'â€”'],
    ['Motto', draft.motto || 'â€”'],
    ['GPS address', draft.gpsAddress || 'â€”'],
    ['Year founded', draft.yearFounded || 'â€”'],
  ].filter(([, value]) => value);

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title="Create this school?"
      description="It will appear immediately on the schools list and on every platform report."
      size="sm"
      footer={
        <>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
          >
            Go back
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? (
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Building2 className="h-4 w-4" aria-hidden="true" />
            )}
            {busy ? 'Creatingâ€¦' : 'Create school'}
          </button>
        </>
      }
    >
      {error && <FormAlert tone="error">{error}</FormAlert>}

      <dl className={`divide-y divide-slate-100 ${error ? 'mt-3' : ''}`}>
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-3 py-2">
            <dt className="shrink-0 text-[12px] font-semibold text-slate-500">{label}</dt>
            <dd className="min-w-0 truncate text-right text-[12px] font-extrabold text-ink">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3">
        <p className="flex items-start gap-2 text-[12px] font-extrabold text-ink">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
          Set by the platform, not by this form
        </p>
        <p className="mt-1 text-[11px] font-semibold leading-relaxed text-slate-500">
          The <strong>school code</strong> and <strong>URL slug</strong> are generated server-side
          and will be unique. The <strong>markup percentage</strong> comes from the platform
          default, and the school starts on the <strong>trial</strong> plan with a trial end date
          derived from the platform&rsquo;s trial-days setting. All three are editable from the
          school&rsquo;s page the moment you land on it.
        </p>
      </div>
    </Modal>
  );
};

/**
 * Create one school by hand.
 *
 * â”€â”€ Why this exists at all â”€â”€
 *
 * Rarely the right tool, and the service's own doc comment says so: self-signup and the
 * onboarding wizard both provision a school already. It exists for the school a
 * customer has paid for and whose administrator will never complete the wizard â€” a
 * migration from a competitor, or a school with no reliable email. Those are the two
 * cases where a platform operator is the only person who can get them onto the
 * platform, and where "send them a signup link" has already been tried.
 *
 * â”€â”€ `slug` and `schoolCode` are deliberately absent from this form â”€â”€
 *
 * The server generates both (`generateUniqueSlug`, `generateSchoolCode`) and the schema
 * accepts them only as an *override* for the case where an operator has been handed a
 * school's existing code by telephone. Putting them in the form as ordinary fields
 * would be worse than not offering them at all, for two reasons:
 *
 *   - **a hand-typed code collides.** `schoolCode` is `unique`. An operator inventing
 *     `ACC-2026-01` for two schools gets a 409 on the second one â€” and by then they
 *     have typed it twice and believed it was accepted the first time. Generating
 *     server-side removes a whole class of failure that the operator cannot see coming;
 *   - **nobody can guess the format.** If codes were `ABC-1234`, then generating them
 *     is obvious; if they encode the region or the school's founding year, then an
 *     operator who has not read `generateCode.js` cannot produce a valid one, and the
 *     field is a slot for a 422. A field whose correct value is not inferable from the
 *     screen should not be on the screen.
 *
 * The override remains reachable, deliberately, for the operator who genuinely has a
 * code â€” and it is not this form, because this form is for the common case.
 *
 * â”€â”€ `yearFounded` is on the form, with an honest hint â”€â”€
 *
 * `School.yearFounded` exists on the model (`schoolModel.js:36-40`) but
 * `createSchoolAsPlatformSchema` does not list it, and `middleware/validate` runs
 * `stripUnknown: true` â€” so a submitted `yearFounded` is **silently removed**. That is
 * a one-line backend gap, not a reason to drop the field: the operator has the year in
 * front of them and somebody will want it stored. So it is on the form with a hint
 * that says plainly that the create endpoint does not persist it yet, rather than
 * letting an operator type it in, watch it succeed, and find it absent three months
 * later. When the schema gains the key, the hint goes and the field starts working with
 * no change here.
 *
 * On success this navigates to the new school's detail page rather than back to the
 * list. The list would confirm the school exists; the detail page is where the next
 * four things happen â€” markup, plan, gateway, flags â€” and a create that drops the
 * operator on a table row is a create that ends with them hunting for where to go next.
 */
const SchoolCreate = () => {
  const navigate = useNavigate();
  const toast = useToast();

  const [draft, setDraft] = useState({
    name: '',
    type: 'private',
    phone: '',
    email: '',
    region: '',
    city: '',
    address: '',
    website: '',
    motto: '',
    gpsAddress: '',
    yearFounded: '',
  });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const set = (key, value) => setDraft((current) => ({ ...current, [key]: value }));

  const currentYear = new Date().getFullYear();

  /**
   * Client-side validation, for a message that points at the field.
   *
   * Mirrors `createSchoolAsPlatformSchema` rather than replacing it: the server stays
   * the boundary, and this only says *which* box is wrong instead of returning
   * "email must be a valid email" with no pointer to the form. Every rule the schema
   * states is a rule this form can state too, and a form that lets somebody submit a
   * known-invalid shape has made the API look arbitrary.
   */
  const problems = useMemo(() => {
    const found = {};
    if (!draft.name || draft.name.trim().length < 2) found.name = 'At least 2 characters';
    if (!draft.type) found.type = 'Required';
    if (!draft.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) {
      found.email = 'A valid email address is required';
    }
    if (!draft.phone || draft.phone.replace(/\D/g, '').length < 9) {
      found.phone = 'A Ghana phone number is required â€” this is what parents are told';
    }
    if (!draft.region) found.region = 'Required';
    if (!draft.city.trim()) found.city = 'Required';
    if (!draft.address.trim()) found.address = 'Required';

    const year = Number(draft.yearFounded);
    if (draft.yearFounded && (!Number.isInteger(year) || year < 1800 || year > currentYear)) {
      found.yearFounded = `Between 1800 and ${currentYear}`;
    }
    return found;
  }, [draft, currentYear]);

  const isValid = Object.keys(problems).length === 0;

  /**
   * The payload.
   *
   * **Only the keys the schema lists, and nothing empty.** `stripUnknown: true`
   * removes unknown keys rather than rejecting them, so a stray field is not a 422 â€”
   * it is a silent no-op, which is worse. And `''` is not a valid string for most of
   * these (`website` and `motto` use `.allow('')`, the rest do not), so an untouched
   * optional field is *omitted* rather than sent blank.
   */
  const payload = useMemo(() => {
    const body = {
      name: draft.name.trim(),
      type: draft.type,
      phone: draft.phone.trim(),
      email: draft.email.trim().toLowerCase(),
      region: draft.region,
      city: draft.city.trim(),
      address: draft.address.trim(),
    };
    if (draft.website.trim()) body.website = draft.website.trim();
    if (draft.motto.trim()) body.motto = draft.motto.trim();
    if (draft.gpsAddress.trim()) body.gpsAddress = draft.gpsAddress.trim();
    // Sent, and stripped by the server today. See the doc comment.
    if (draft.yearFounded.trim()) body.yearFounded = Number(draft.yearFounded);
    return body;
  }, [draft]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const created = await createSchool(payload);
      const id = created?._id;
      toast.success(`${created?.name || draft.name.trim()} created.`);
      setConfirmOpen(false);
      if (id) {
        navigate(`${ROUTES.ADMIN_SCHOOLS}/${id}`, { replace: true });
      } else {
        // The endpoint returns the school document directly, so this should not
        // happen. Landing on the list rather than a broken detail URL is the
        // recoverable outcome if it ever does.
        navigate(ROUTES.ADMIN_SCHOOLS, { replace: true });
      }
      return { ok: true };
    } catch (caught) {
      // Never thrown out of a confirm handler. A 409 here is usually the email, slug
      // or code already existing, and the server's message says which â€” which is the
      // one piece of information the operator needs and a generic failure would throw
      // away.
      setError(caught.message || 'That school could not be created.');
      return { ok: false, error: caught.message };
    } finally {
      setBusy(false);
    }
  };

  /*
   * Escape closes the confirmation.
   *
   * `Modal` already handles Escape, so this is not about the key â€” it is about the
   * *state*: Escape leaves the form's draft intact and closes the dialog, which is
   * what a keyboard user expects, and nothing else in this page needs a listener.
   */
  useEffect(() => {
    document.title = 'New school Â· SukuuPay';
    return () => {
      document.title = 'SukuuPay';
    };
  }, []);

  return (
    <>
      <PageHeader
        eyebrow="Platform console"
        title="New school"
        description="For the school a customer has paid for and whose administrator will never complete the wizard. Ordinary signups do not come through here."
        actions={
          <Link
            to={ROUTES.ADMIN_SCHOOLS}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[13px] font-extrabold text-slate-700 transition-colors hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            All schools
          </Link>
        }
      />

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (isValid) setConfirmOpen(true);
        }}
      >
        <Card padding="p-5">
          <h2 className="text-[13px] font-extrabold leading-tight text-ink">Identity</h2>
          <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
            The four fields the School model marks required, plus how the school can be reached.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              label="School name"
              required
              className="sm:col-span-2"
              value={draft.name}
              onChange={(event) => set('name', event.target.value)}
              placeholder="Kumasi Basic School"
              error={problems.name}
            />

            <SelectField
              label="Type"
              required
              value={draft.type}
              onChange={(event) => set('type', event.target.value)}
              error={problems.type}
            >
              {GHANA_SCHOOL_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </SelectField>

            <SelectField
              label="Region"
              required
              value={draft.region}
              onChange={(event) => set('region', event.target.value)}
              error={problems.region}
            >
              <option value="">Select a region</option>
              {GHANA_REGIONS.map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </SelectField>

            {/*
              `PhoneInput` normalises to the `0xx` form the backend stores, and the
              comment in `createSchoolAsPlatform` explains why this is validated at all:
              the school's phone is what the payment gateway calls back and what SMS
              receipts are quoted from, so a stored "0244 123 456" that no gateway will
              dial is a school whose parents pay and hear nothing.
            */}
            <PhoneInput
              label="Phone"
              required
              value={draft.phone}
              onChange={(value) => set('phone', value)}
              error={problems.phone}
            />

            <Field
              label="Email"
              type="email"
              required
              value={draft.email}
              onChange={(event) => set('email', event.target.value)}
              placeholder="office@example.com"
              error={problems.email}
            />
          </div>
        </Card>

        <Card padding="p-5" className="mt-4">
          <h2 className="text-[13px] font-extrabold leading-tight text-ink">Location</h2>
          <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
            A school without a region cannot be filtered, billed by region or appear on a regional
            report, so these are required rather than assumed.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              label="City / town"
              required
              value={draft.city}
              onChange={(event) => set('city', event.target.value)}
              error={problems.city}
            />
            <Field
              label="Postal address"
              required
              value={draft.address}
              onChange={(event) => set('address', event.target.value)}
              placeholder="P.O. Box 214, Adum Street"
              error={problems.address}
            />
            <Field
              label="GPS address"
              className="sm:col-span-2"
              value={draft.gpsAddress}
              onChange={(event) => set('gpsAddress', event.target.value)}
              placeholder="Only if the school uses one â€” parents pay by name, not location"
            />
          </div>
        </Card>

        <Card padding="p-5" className="mt-4">
          <h2 className="text-[13px] font-extrabold leading-tight text-ink">Optional</h2>
          <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
            Nothing here is required, and nothing here is sent blank â€” an untouched field is
            omitted so the server applies its own default.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              label="Website"
              value={draft.website}
              onChange={(event) => set('website', event.target.value)}
              placeholder="https://"
            />
            <Field
              label="Year founded"
              type="number"
              min="1800"
              max={currentYear}
              value={draft.yearFounded}
              onChange={(event) => set('yearFounded', event.target.value)}
              error={problems.yearFounded}
              hint="1800â€“present"
            />
            <Field
              label="Motto"
              className="sm:col-span-2"
              value={draft.motto}
              onChange={(event) => set('motto', event.target.value)}
            />
          </div>

          {/*
            Said on the form, not only in a comment. The server's create schema does
            not list `yearFounded`, and `stripUnknown: true` removes it â€” so a value
            typed here is accepted and then discarded. Better one sentence of warning
            than a field that quietly loses what somebody typed.
          */}
          <p className="mt-3 text-[11px] font-semibold leading-relaxed text-amber-700">
            The platform create endpoint does not store a year founded yet â€” the field exists on the
            school record but is not yet accepted here, so a value typed above is discarded. The
            school&rsquo;s own settings save it.
          </p>
        </Card>

        {Object.keys(problems).length > 0 && (
          <div className="mt-4">
            <FormAlert tone="error">
              {Object.keys(problems).length} field
              {Object.keys(problems).length === 1 ? '' : 's'} need attention before this school can
              be created.
            </FormAlert>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={!isValid}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
          >
            <Building2 className="h-4 w-4" aria-hidden="true" />
            Create school
          </button>

          <Link
            to={ROUTES.ADMIN_SCHOOLS}
            className="rounded-xl px-3 py-2.5 text-sm font-extrabold text-slate-500 transition-colors hover:bg-slate-100 hover:text-ink"
          >
            Cancel
          </Link>
        </div>
      </form>

      <ConfirmCreateDialog
        open={confirmOpen}
        draft={draft}
        busy={busy}
        error={error}
        onCancel={() => {
          setConfirmOpen(false);
          setError(null);
        }}
        onConfirm={submit}
      />
    </>
  );
};

export default SchoolCreate;