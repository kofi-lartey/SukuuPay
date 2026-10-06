import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, ImagePlus, Megaphone } from 'lucide-react';
import PageHeader from '../../components/dashboard/PageHeader';
import Card from '../../components/dashboard/ui/Card';
import Modal from '../../components/common/Modal';
import { Field, SelectField, FormAlert } from '../../components/common/FormField';
import SchoolPicker from '../../components/admin/sms/SchoolPicker';
import { CarouselView } from '../../components/auth/SchoolAdCarousel';
import { useToast } from '../../hooks/useToast';
import { useImpersonation } from '../../hooks/useImpersonation';
import { AD_PLACEMENTS, AD_PLACEMENT_DETAILS, createSchoolAd } from '../../services/admin';
import { ROUTES } from '../../utils/constants';

/**
 * `/admin/content/new` — a super admin authoring a creative.
 *
 * The schools' side of this already exists (`/dashboard/advertisements`, which posts
 * to `/schools/me/ad-requests`) and so does this route's own endpoint —
 * `POST /admin/school-ads` has been `super_admin`-gated at the router level since it
 * was written (`admin.routes.js:282`) — but nothing in the console ever called it.
 * `createSchoolAd` sat in the service layer unused, so the ability existed and was
 * unreachable. This page is the missing half.
 *
 * ## A school asks; the platform posts
 *
 * The two are deliberately different, and the difference is the whole product
 * decision:
 *
 *   - A school submits a request. It waits in the queue, a moderator decides, and the
 *     school is told the answer. `createSchoolAdRequestSchema` has no `status` field
 *     and `schoolAdRequest.service.js:127-144` forces `pending` — a school has no route
 *     to the public pages at all.
 *   - The platform owner writes the ad, so the ad goes live when they post it. The
 *     confirmation step is a **preview**, not a moderation hand-off: there is no second
 *     person to wait for, and pretending otherwise is what made this page's first
 *     version a lie — it offered "Submit for approval" against an endpoint that files
 *     everything as `pending` and then needs the same person to approve it.
 *
 * The mechanism is `publish: true` on the create body, not a `status` field. The
 * schema documents why (a boolean verb rather than an open vocabulary of states), and
 * it **defaults to `false`**, so the invariant that nothing reaches the login page of
 * every visitor without somebody asking for it survives a caller that forgets it.
 *
 * ## The preview renders the real component, not a mock of it
 *
 * `CarouselView` is the exact markup `SchoolAdCarousel` puts on the login page —
 * exported separately from the data-owning wrapper for precisely this reason. A
 * hand-built preview card would drift from production the first time the carousel's
 * gradient, the overlay text order or the `object-cover` crop changed, and it would
 * drift silently, because the drift is invisible until a parent sees the ad. One
 * component, rendered with one ad at the real slot height (`h-[200px]`,
 * `OnboardingAside.jsx:93`), so the crop and the line breaks are the ones that matter.
 *
 * This matters most for the image. A creative is mostly its picture, and the image is
 * the one field the operator can only judge by looking — hence the file's own preview
 * strip in the form, and the full card here.
 *
 * ## `schoolName` is required even when there is no school
 *
 * `adBody` requires `schoolName` (2–150) unconditionally, and it is what the public
 * carousel renders in the amber eyebrow above the headline. So `schoolId` is optional
 * (leave it blank for a platform-run ad) and the name is not, which is the opposite of
 * the shape the school-side form has. An operator who expects the name to follow the
 * picked school would submit a 422 on an empty field.
 *
 * ## `SchoolPicker` is a multi-select and an ad belongs to one school
 *
 * It is shared by `BroadcastModal`, `SmsCredits` and `AnnouncementForm` precisely so
 * the platform has one idea of what a school is selectable. A second, single-select
 * copy would undo that, so the single-slot rule is enforced in the handler: the last
 * id wins, and re-ticking the current pick clears it. Both paths are what an operator
 * would expect from a "pick one" control, and neither needs a different component.
 */

/** A 60-day default: long enough to be useful, and never in the past. */
const defaultEndsAt = () => {
  const date = new Date();
  date.setDate(date.getDate() + 60);
  return date.toISOString().slice(0, 10);
};

const EMPTY_FORM = {
  schoolName: '',
  headline: '',
  writeup: '',
  imageAlt: '',
  imageUrl: '',
  linkUrl: '',
  placement: 'advertisement_page',
  endsAt: '',
  sortWeight: '0',
};

/** The slot `OnboardingAside` gives the carousel, so the preview is the real size. */
const PREVIEW_SLOT = 'h-[200px]';

const AdminAdCreate = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { isImpersonating } = useImpersonation();

  const [form, setForm] = useState({ ...EMPTY_FORM, endsAt: defaultEndsAt() });
  // One slot at most — see the header note on `SchoolPicker`. An empty array is the
  // platform's own ad, and the key is omitted from the payload in that case rather
  // than sent as `schoolId: ''`.
  const [schoolIds, setSchoolIds] = useState([]);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [formError, setFormError] = useState(null);

  const fileInput = useRef(null);

  // Object URLs outlive the component unless they are revoked, and a leaked blob
  // survives for the life of the tab — which on a low-memory handset is a crash
  // rather than a leak.
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview]
  );

  const setField = useCallback((key) => (event) => {
    const value = event.target.value;
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: null }));
  }, []);

  const pickSchool = useCallback((ids) => {
    const next = ids.length ? [ids[ids.length - 1]] : [];
    setSchoolIds(next);
    setErrors((current) => ({ ...current, schoolId: null }));
  }, []);

  const onPickImage = useCallback((event) => {
    const picked = event.target.files?.[0] || null;
    setErrors((current) => ({ ...current, file: null, imageUrl: null }));

    // Pasting a hosted URL and uploading a file are two routes to one field, so
    // choosing a file clears the typed URL rather than leaving the controller to
    // pick between them. `createSchoolAd` prefers `req.file` anyway
    // (`schoolAd.controller.js:133`), and leaving both filled would silently discard
    // whatever the operator pasted.
    setForm((current) => ({ ...current, imageUrl: '' }));

    setFile(picked);
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return picked ? URL.createObjectURL(picked) : null;
    });
  }, []);

  /**
   * Mirrors `createSchoolAdSchema`, so the round trip is not the first check.
   *
   * The rules restated here rather than left to the server because each one is a
   * field whose failure is a 422 sentence about a name the operator did not write:
   * the 60-character headline cap, the 5-character alt-text floor, the https-only
   * link, and the future end date. The server is still the boundary — this only says
   * which field is at fault.
   */
  const validateForm = useCallback(() => {
    const found = {};

    const schoolName = form.schoolName.trim();
    const headline = form.headline.trim();
    const imageAlt = form.imageAlt.trim();
    const linkUrl = form.linkUrl.trim();

    if (schoolName.length < 2) found.schoolName = 'At least 2 characters';
    else if (schoolName.length > 150) found.schoolName = '150 characters is the limit';

    if (headline.length < 4) found.headline = 'At least 4 characters';
    else if (headline.length > 60) found.headline = '60 characters is the limit';

    if (form.writeup.length > 600) found.writeup = '600 characters is the limit';

    // One of the two, never both — see `onPickImage` for why they are exclusive.
    if (!file && !form.imageUrl.trim()) {
      found.file = 'Upload an image, or paste a link to one you already host';
    }

    if (imageAlt.length < 5) found.imageAlt = 'Describe the image';
    else if (imageAlt.length > 160) found.imageAlt = '160 characters is the limit';

    // https only. `safeUrl` in the schema is an XSS control — this value is rendered
    // as an anchor on every unauthenticated page — and a `http://` link is refused
    // with the same rule, not merely discouraged.
    if (!/^https:\/\/\S+$/i.test(linkUrl)) {
      found.linkUrl = 'A full https:// link, e.g. https://yourschool.edu.gh';
    }

    if (!form.endsAt) found.endsAt = 'Choose an end date';
    else if (new Date(`${form.endsAt}T23:59:59`) <= new Date()) {
      found.endsAt = 'Choose a date in the future';
    }

    const weight = Number(form.sortWeight);
    if (!Number.isInteger(weight) || weight < -100 || weight > 100) {
      found.sortWeight = 'A whole number between −100 and 100';
    }

    setErrors(found);
    return Object.keys(found).length === 0;
  }, [form, file]);

  const buildPayload = useCallback(() => {
    const payload = new FormData();

    // Key by key, never a spread. `stripUnknown` would drop unknown keys anyway, but
    // a hand-built payload also cannot accidentally send a field this endpoint does
    // not accept — and there is one that must not be sent: `status`.
    payload.append('schoolName', form.schoolName.trim());
    payload.append('headline', form.headline.trim());
    payload.append('writeup', form.writeup.trim());
    payload.append('imageAlt', form.imageAlt.trim());
    payload.append('linkUrl', form.linkUrl.trim());
    payload.append('placement', form.placement);
    payload.append('sortWeight', String(Number(form.sortWeight)));

    // The decision, as a verb. `true` resolves server-side to `approved` +
    // `approvedBy`/`approvedAt`; there is no status for the client to name.
    payload.append('publish', 'true');

    // Full ISO rather than the bare `YYYY-MM-DD` the date input gives. The schema
    // asks for `.iso()` and the day is the last thing this ad runs, so the end of the
    // chosen day is the moment the operator meant.
    payload.append('endsAt', new Date(`${form.endsAt}T23:59:59`).toISOString());

    // Absent rather than empty. The controller reads `schoolId ? … : null`, so an
    // empty string is tolerated — but omitting it is what makes the intent
    // ("this is the platform's own ad") survive the round trip.
    if (schoolIds.length === 1) payload.append('schoolId', String(schoolIds[0]));

    /*
     * The filename is stated rather than left to `FormData.append` deriving it from
     * the `File`, matching `createAdRequest`. Not strictly required — a `File` carries
     * its own name — but the one thing this part must never be is a nameless blob: a
     * part with no filename is a field to multer, not a file, so `req.file` stays
     * undefined and the server answers "an ad image is required" about a picture the
     * operator can see attached.
     */
    if (file) payload.append('image', file, file.name);
    else if (form.imageUrl.trim()) payload.append('imageUrl', form.imageUrl.trim());

    return payload;
  }, [form, file, schoolIds]);

  /**
   * The creative as the public will see it, assembled from the form.
   *
   * The image is the uploaded file's object URL rather than the eventual Cloudinary
   * URL, which does not exist until the upload happens — so this is the operator's own
   * bytes at the real size. The link and the alt text are carried through untouched,
   * because the alt text is what a screen reader will announce and the link is what a
   * click will follow; a preview that filled either in would be reviewing something
   * other than what gets posted.
   */
  const previewAd = useMemo(
    () => ({
      schoolName: form.schoolName.trim() || 'Advertiser name',
      headline: form.headline.trim() || 'Headline',
      imageUrl: preview || form.imageUrl.trim(),
      imageAlt: form.imageAlt.trim(),
      linkUrl: form.linkUrl.trim() || 'https://example.com',
    }),
    [form.schoolName, form.headline, form.imageAlt, form.linkUrl, form.imageUrl, preview]
  );

  const submit = async () => {
    if (submitting || isImpersonating) return;

    setSubmitting(true);
    setPreviewing(false);

    try {
      const created = await createSchoolAd(buildPayload());

      toast.success(
        created?.status === 'approved'
          ? `“${form.headline.trim()}” is live on the public pages.`
          : `“${form.headline.trim()}” was filed as pending.`
      );

      // Back to the queue rather than a blank form: the new row is at the top of that
      // list, so "where did it go" is answered by the page the operator has to visit
      // anyway.
      navigate(ROUTES.ADMIN_CONTENT);
    } catch (error) {
      /*
       * The form keeps every field, and the preview is dismissed rather than left
       * standing. A 422 here is one sentence on a server rule this form has already
       * mirrored, and losing a typed headline — or re-opening a preview of a creative
       * that was not accepted — is a worse outcome than one extra click.
       */
      setFormError(error.message || 'This creative could not be posted.');
    } finally {
      setSubmitting(false);
    }
  };

  const cancel = useCallback(() => navigate(ROUTES.ADMIN_CONTENT), [navigate]);
  const placementHelp = AD_PLACEMENT_DETAILS[form.placement]?.help || '';

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="Platform console"
        title="New creative"
        description="Author an advertisement for the public pages. You will see it exactly as a parent will before it goes live."
      />

      {isImpersonating && (
        <div role="alert" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3">
          <p className="text-[12px] font-semibold leading-relaxed text-amber-900">
            Creating a creative is blocked while you are impersonating a school. Writes on this route
            are refused server-side during an impersonation — end the session and try again.
          </p>
        </div>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!isImpersonating && validateForm()) {
            setFormError(null);
            setPreviewing(true);
          }
        }}
        noValidate
        className="space-y-4"
      >
        {formError && <FormAlert tone="error">{formError}</FormAlert>}

        <Card padding="p-5">
          <h2 className="text-sm font-extrabold text-ink">The creative</h2>
          <p className="mt-0.5 text-[12px] font-medium text-slate-500">
            What a parent sees on the login pages, the home page banner or a school dashboard.
          </p>

          <div className="mt-4 space-y-4">
            <Field
              label="Advertiser name"
              required
              value={form.schoolName}
              onChange={setField('schoolName')}
              maxLength={150}
              placeholder="Greenfield Academy"
              error={errors.schoolName}
              hint={`${form.schoolName.trim().length}/150`}
            />

            <p className="-mt-2 text-[11px] font-medium leading-relaxed text-slate-500">
              Required whether or not a school is picked below — it is the name printed beside
              the creative on the public pages, so a platform-run ad still needs one.
            </p>

            {/*
              Unmounted rather than shown as an empty box, and the empty state is the
              default: most console-authored ads are the platform's own. The picker is
              there when an ad belongs to a named school, which is how an operator
              attributes a creative to a school that has asked for one.
            */}
            <SchoolPicker
              label="Belongs to a school"
              value={schoolIds}
              onChange={pickSchool}
              placeholder="Search schools by name or code…"
            />

            <p className="-mt-2 text-[11px] font-medium leading-relaxed text-slate-500">
              Optional. Tick one school to attribute this creative to it; tick it again to clear
              it, and leave it empty for an ad that belongs to SukuuPay.
            </p>

            <Field
              label="Headline"
              required
              value={form.headline}
              onChange={setField('headline')}
              maxLength={60}
              placeholder="Admissions open for 2026/27"
              error={errors.headline}
              hint={`${form.headline.trim().length}/60`}
            />

            <div>
              <label
                htmlFor="admin-ad-writeup"
                className="mb-0.5 flex items-baseline justify-between gap-3"
              >
                <span className="text-[11px]/[15px] font-semibold text-slate-700">
                  Write-up <span className="font-medium text-slate-400">optional</span>
                </span>
                <span className="shrink-0 text-[10px]/[14px] font-medium text-slate-500">
                  {form.writeup.length}/600
                </span>
              </label>
              <textarea
                id="admin-ad-writeup"
                rows={4}
                value={form.writeup}
                onChange={setField('writeup')}
                maxLength={600}
                placeholder="What should a parent know? Fees, subjects, the boarding option, where to apply."
                aria-invalid={errors.writeup ? 'true' : undefined}
                className={`w-full resize-y rounded-lg border bg-white p-3 text-[13px] leading-relaxed text-ink placeholder:font-normal placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-700/30 ${
                  errors.writeup
                    ? 'border-red-300'
                    : 'border-slate-200 focus:border-brand-700'
                }`}
              />
              {errors.writeup && (
                <p className="mt-1 text-[11px] font-semibold text-red-600">{errors.writeup}</p>
              )}
            </div>

            <div>
              <span className="mb-0.5 block text-[11px]/[15px] font-semibold text-slate-700">
                Image <span className="text-red-600">*</span>
              </span>
              <div className="flex flex-wrap items-center gap-3">
                <label
                  htmlFor="admin-ad-image"
                  className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3.5 py-2 text-[12px] font-extrabold text-slate-600 transition-colors hover:border-slate-400 hover:bg-slate-50"
                >
                  <ImagePlus className="h-4 w-4" aria-hidden="true" />
                  {file ? 'Choose another' : 'Upload an image'}
                </label>
                <input
                  ref={fileInput}
                  id="admin-ad-image"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={onPickImage}
                  className="sr-only"
                />
                {preview ? (
                  <img
                    src={preview}
                    alt=""
                    className="h-14 w-20 rounded-lg object-cover ring-1 ring-slate-200"
                  />
                ) : (
                  <span className="text-[11px] font-medium text-slate-500">PNG, JPEG or WebP</span>
                )}
              </div>

              {/* The second route to the same field, and the reason the two are exclusive. */}
              <div className="mt-3">
                <Field
                  label="…or link to an image you already host"
                  type="url"
                  inputMode="url"
                  value={form.imageUrl}
                  onChange={setField('imageUrl')}
                  placeholder="https://res.cloudinary.com/…/ad.jpg"
                  disabled={Boolean(file)}
                  hint={file ? 'An upload takes precedence — clear it to paste a link' : undefined}
                />
              </div>

              {errors.file && (
                <p className="mt-1 text-[11px] font-semibold text-red-600">{errors.file}</p>
              )}
            </div>

            {/*
              Required, and not auto-filled from the filename. On the school form that
              decision is documented at the point it is made; it is repeated here
              because this is the second form to make it, and "IMG_4821.jpg" describes
              nothing to the screen-reader user this text exists for.
            */}
            <Field
              label="Describe the image"
              required
              value={form.imageAlt}
              onChange={setField('imageAlt')}
              maxLength={160}
              placeholder="Students in the science laboratory"
              error={errors.imageAlt}
              hint={`${form.imageAlt.trim().length}/160`}
            />

            <Field
              label="Where should this link to?"
              required
              type="url"
              inputMode="url"
              value={form.linkUrl}
              onChange={setField('linkUrl')}
              placeholder="https://yourschool.edu.gh/admissions"
              error={errors.linkUrl}
            />

            <p className="-mt-2 text-[11px] font-medium leading-relaxed text-slate-500">
              Must start with https://. Only https is accepted — this link is rendered on
              every unauthenticated page, so anything else would put a script URL in front of
              every visitor.
            </p>
          </div>
        </Card>

        <Card padding="p-5">
          <h2 className="text-sm font-extrabold text-ink">Where and when</h2>
          <p className="mt-0.5 text-[12px] font-medium text-slate-500">
            Which slot it occupies, how long it runs, and where it sits when more than one
            creative shares the slot.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SelectField
              label="Where it appears"
              required
              value={form.placement}
              onChange={setField('placement')}
            >
              {AD_PLACEMENTS.map((placement) => (
                <option key={placement} value={placement}>
                  {AD_PLACEMENT_DETAILS[placement]?.label || placement}
                </option>
              ))}
            </SelectField>

            <Field
              label="Run until"
              required
              type="date"
              value={form.endsAt}
              onChange={setField('endsAt')}
              error={errors.endsAt}
            />

            <Field
              label="Sort weight"
              type="number"
              min={-100}
              max={100}
              step={1}
              value={form.sortWeight}
              onChange={setField('sortWeight')}
              error={errors.sortWeight}
            />
          </div>

          {placementHelp && (
            <p className="mt-2 text-[11px] font-medium leading-relaxed text-slate-500">
              {placementHelp}
            </p>
          )}

          <p className="mt-2 text-[11px] font-medium leading-relaxed text-slate-500">
            Sort weight is the tiebreaker inside a slot, not a priority across the site — higher
            runs first. It defaults to 0.
          </p>
        </Card>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={submitting || isImpersonating}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
          >
            <Eye className="h-4 w-4" aria-hidden="true" />
            {isImpersonating
              ? 'Blocked while impersonating'
              : submitting
                ? 'Posting…'
                : 'Preview and post'}
          </button>

          <button
            type="button"
            onClick={cancel}
            disabled={submitting}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      </form>

      {/*
        The last thing between the operator and the login page of every visitor.

        The card above is the real `CarouselView` at the real slot height, so what is
        approved here is what renders — not a hand-built approximation of it. Below
        it, the three facts a picture cannot show: where it runs, when it stops, and
        what it links to. The last one is also a working link, so the destination can
        be opened and checked from here rather than after it is in front of parents.
      */}
      <Modal
        open={previewing}
        onClose={() => setPreviewing(false)}
        title="Preview before it goes live"
        description="This is the advertisement as a parent sees it, on the page it will appear on."
        size="lg"
        footer={
          <>
            <button
              type="button"
              onClick={() => setPreviewing(false)}
              disabled={submitting}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
            >
              Keep editing
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 disabled:opacity-60"
            >
              <Megaphone className="h-4 w-4" aria-hidden="true" />
              {submitting ? 'Posting…' : 'Post it live'}
            </button>
          </>
        }
      >
        {/*
          One ad, so `index` is 0 and the arrows and dots are suppressed by
          `total > 1` inside the carousel. The handlers are still passed rather than
          omitted: they are required props, and leaving them out would make this a
          preview that crashes the moment the carousel is changed to accept a missing
          handler.
        */}
        <div className={PREVIEW_SLOT}>
          <CarouselView
            ads={[previewAd]}
            index={0}
            className="h-full"
            onPause={() => {}}
            onStep={() => {}}
            onGoTo={() => {}}
          />
        </div>

        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
          <div className="flex gap-2 text-[12px]">
            <dt className="shrink-0 font-semibold text-slate-400">Appears in</dt>
            <dd className="min-w-0 font-extrabold text-slate-700">
              {AD_PLACEMENT_DETAILS[form.placement]?.label || form.placement}
            </dd>
          </div>
          <div className="flex gap-2 text-[12px]">
            <dt className="shrink-0 font-semibold text-slate-400">Runs until</dt>
            <dd className="font-extrabold text-slate-700">
              {new Date(`${form.endsAt}T23:59:59`).toLocaleDateString('en-GB')}
            </dd>
          </div>
          <div className="flex gap-2 text-[12px]">
            <dt className="shrink-0 font-semibold text-slate-400">Advertiser</dt>
            <dd className="min-w-0 font-extrabold text-slate-700">
              {schoolIds.length === 1 ? 'Attributed to the school you picked' : 'SukuuPay’s own'}
            </dd>
          </div>
          <div className="flex gap-2 text-[12px] sm:col-span-2">
            <dt className="shrink-0 font-semibold text-slate-400">Links to</dt>
            <dd className="min-w-0 truncate font-mono text-[11px] font-bold text-slate-700">
              {form.linkUrl.trim()}
            </dd>
          </div>
        </dl>

        <p className="mt-4 rounded-xl bg-slate-50 px-3.5 py-3 text-[12px] font-semibold leading-relaxed text-slate-600">
          Posting puts this on the public pages straight away — there is no second
          approval step, because you are the approval. It will stop on{' '}
          {new Date(`${form.endsAt}T23:59:59`).toLocaleDateString('en-GB')}, and the audit log
          records it as published by its author.
        </p>
      </Modal>
    </div>
  );
};

export default AdminAdCreate;