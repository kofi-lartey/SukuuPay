import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CircleAlert, Loader2, Megaphone, Send } from 'lucide-react';
import Modal from '../../common/Modal';
import { FormAlert, SelectField } from '../../common/FormField';
import SchoolPicker from './SchoolPicker';
import { countSegments } from '../../../services/sms';
import { formatCediShort, formatCount } from '../../../utils/format';

/**
 * Sends metered SMS to school administrators across the platform.
 *
 * **This is the most consequential button in the console**, and the shape of the
 * dialog is an argument about that rather than a preference. `sendSmsToParents` in
 * the school console is a different job — one school, parents the school already
 * has a relationship with, a message about money that school is owed — so
 * `components/sms/SendBar.jsx` is deliberately *not* reused here: its
 * inline-confirmation design ("one checkbox for the whole-school case and a
 * sentence for everything else") was chosen for a routine action whose blast
 * radius ends at one school. This is a second click and a real dialog.
 *
 * What was taken from the school composer, and what was not:
 *
 *   - **Taken: the segment and cost maths, from `services/sms.js`.**
 *     `countSegments` mirrors the server's `countSmsParts` (`sms.service.js`) and
 *     is the same function the school composer's counter uses. Re-deriving it here
 *     would put a second, subtly different segment count on screen, and the one
 *     that disagrees with the invoice is the one the operator trusted.
 *   - **Taken: the cost card's honesty.** `ComposerPanel` labels its figure
 *     "Estimated Broadcast Cost" and prints the rate beneath it. Same wording here,
 *     for the same reason.
 *   - **Not taken: the token row, the templates and the phone preview.** The
 *     recipients are school *administrators*, not parents, so there is no student,
 *     no `{balance}` and no payment link to render; there is nothing for
 *     `PhonePreview` to preview, and a phone frame implying a per-parent pay card
 *     on a platform-wide broadcast would be actively misleading. `TemplatesTab` is
 *     school-scoped (`GET /sms/templates?own=true`) and its four presets are
 *     fee-reminder bodies for parents — none of which is this message.
 *   - **Not taken: `SendBar`'s scheduler.** `broadcastToSchoolAdmins` takes no
 *     `scheduledAt`; the field exists on the *school* send path only. Offering it
 *     here would be a control that sends nothing.
 *
 * **Segment boundaries, and what happens past them.**
 *
 * `countSegments` implements the concatenated-SMS rules exactly:
 *
 *   - GSM-7 (the default ASCII set): **160** characters for the first segment,
 *     then **153** for each one after it, because the 7-bit UDH header consumes
 *     7 of the 153 user-data characters. So 160 is one part and 161 is two, and
 *     306 is two and 307 is three. The boundary lands mid-sentence, which is
 *     exactly why the counter has to be live rather than a note at the bottom.
 *   - UCS-2 (dropped into by a single emoji, a curly apostrophe or an em dash):
 *     **70** then **67**. That is a 2.3× cost increase for the same sentence, and
 *     `countSegments` detects it.
 *
 * **This component blocks; it never truncates.** There is no `maxLength` on the
 * textarea and nothing clips the body on submit. Silently shortening a platform
 * owner's message would mean broadcasting a *different sentence* than the one
 * approved — for an incident notice ("payments will be down on Saturday
 * 02:00–06:00") a truncated tail is the difference between a useful warning and a
 * misleading one, delivered to every school administrator in the country. So the
 * send button is disabled with the reason stated underneath, which is the same
 * contract `SendBar` uses for the 10-part limit.
 *
 * **The recipient count is the operator's main defence, and it is only an
 * estimate.** Recipients resolve server-side to `school_admin` accounts on active,
 * non-archived schools — the server owns that query and this client cannot
 * reproduce it, because it would need every school's admin roster and the
 * permission state of each account. So the number shown is `schools × 1 admin
 * each`, which is a floor rather than a promise, and it is labelled as one. What
 * *is* exact is the ceiling: above 500 recipients the server answers a **400
 * `TOO_MANY_RECIPIENTS`** carrying the resolved count in `meta.recipients`, and
 * this dialog stops the operator reaching that — a refusal after they have written
 * a 400-recipient message is a worse place to learn the rule than before they
 * pressed Send. When that refusal does arrive anyway (because the real admin count
 * exceeded the one-per-school floor), `submit` surfaces the server's own count in
 * the error rather than restating the floor, so the operator sees the number that
 * actually mattered.
 *
 * ## No school's balance is spent, and the dialog says so
 *
 * A platform broadcast is sent on the **platform's own sender ID** and is not
 * billed to any school's SMS credit — there is no platform credit pool to bill it
 * to (`platformPool: null`, and `SmsCreditTopUp.schoolId` is `required`). So the
 * cost card below deliberately frames the figure as *the platform's expense* and
 * says that no school's "messages left" figure moves. Showing a cost next to a
 * school picker without that sentence invites an operator to believe they are
 * spending a school's credit, and to pick schools by who can afford it.
 */

/** `MAX_SMS_SEND_BATCH`, from `LIMITS` in `Backend/src/config/constants.js:323`. */
const MAX_RECIPIENTS = 500;

/** `MAX_SMS_PARTS` from the same block. The server refuses a longer body. */
const MAX_PARTS = 10;

const AUDIENCES = [
  {
    value: 'all_schools',
    label: 'Every active school',
    description:
      'One message per administrator of every active, non-archived school on the platform.',
  },
  {
    value: 'selected_schools',
    label: 'Selected schools only',
    description: 'One message per administrator of each school you name below.',
  },
];

const BroadcastModal = ({ open, onClose, onConfirm, ratePes, provider, readOnly = false }) => {
  const [audience, setAudience] = useState('all_schools');
  const [schoolIds, setSchoolIds] = useState([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  /**
   * Re-seed on open, and only on open.
   *
   * Keyed on `open` rather than reset in an effect body, because the component
   * stays mounted (the parent renders it unconditionally) and a broadcast left
   * half-composed must not survive into the next one — nor must it survive a
   * failed send, which is why the reset happens on the open transition and
   * *before* `showPreview` is cleared, so the operator always lands back on the
   * composer with an empty box rather than on a confirmation for stale content.
   */
  useEffect(() => {
    if (!open) return;
    setAudience('all_schools');
    setSchoolIds([]);
    setMessage('');
    setError(null);
    setShowPreview(false);
  }, [open]);

  const trimmed = message.trim();
  const segments = countSegments(trimmed);
  const partsTooMany = segments > MAX_PARTS;
  const needsSchools = audience === 'selected_schools';
  const schoolsMissing = needsSchools && schoolIds.length === 0;

  /**
   * The resolved recipient count, as a floor.
   *
   * One administrator per school is the realistic minimum for a school that is
   * signed up and able to run the product at all, and it is the only figure this
   * client can compute without the server's admin-roster query. Over 500 the send
   * is refused outright, so this doubles as the guard on the ceiling.
   */
  const recipientFloor = needsSchools ? schoolIds.length : null;
  const overCeiling = recipientFloor !== null && recipientFloor > MAX_RECIPIENTS;

  const canSend =
    trimmed.length > 0 && !partsTooMany && !schoolsMissing && !overCeiling && !busy && !readOnly;

  const blockers = useMemo(() => {
    const list = [];
    if (needsSchools && schoolIds.length === 0) {
      list.push('Name at least one school, or switch the audience back to every active school.');
    }
    // The over-ceiling case is deliberately *not* in this list: it renders as an
    // error `FormAlert` below, because it is a hard server limit rather than a
    // field the operator has left blank, and saying the same thing twice in two
    // tones trains the reader to ignore one of them.
    if (partsTooMany) {
      list.push(
        `This message is ${segments} SMS parts and the provider refuses more than ${MAX_PARTS}. Nothing is truncated — shorten it to about ${formatCount(
          countSegments('x'.repeat(160 * MAX_PARTS))
        )} characters.`
      );
    }
    if (readOnly) {
      list.push('Writes are blocked while you are impersonating a school. Exit the session first.');
    }
    return list;
  }, [needsSchools, schoolIds.length, overCeiling, partsTooMany, segments, readOnly]);

  /**
   * The send, returning `{ ok, error }` and never throwing.
   *
   * The contract from `SUKUU_ADMIN_FRONTEND_CONVENTIONS.md` §4: the caller
   * branches on the result so a failure leaves this dialog open with the
   * operator's message intact. `broadcastToSchoolAdmins` throws on a 4xx/5xx, and
   * a broadcast that hits the 500-recipient ceiling server-side — because the real
   * admin count exceeded the one-school-one-admin floor — must come back as a
   * sentence in this dialog, not as an exception that unmounts it.
   */
  const submit = async () => {
    if (!canSend) return;
    setBusy(true);
    setError(null);

    const result = await onConfirm({
      targetAudience: audience,
      // Sent as `[]` for `all_schools` rather than omitted. The server treats a
      // non-empty list on a non-`selected_schools` audience as a contradiction,
      // and `[]` is the honest wire value for "no list applies here".
      schoolIds: needsSchools ? schoolIds : [],
      message: trimmed,
    });

setBusy(false);
    if (result?.ok) {
      onClose();
      return { ok: true };
    }

    /*
     * The over-500 refusal, named precisely.
     *
     * `POST /admin/sms/broadcast` answers a broadcast that resolves above 500
     * recipients with a 400 `TOO_MANY_RECIPIENTS` whose body carries the *resolved*
     * count in `meta.recipients`. That number is the one the ceiling is about — the
     * admin rosters hold more people than the schools hold, which is exactly why
     * the floor shown above can pass a check the server then fails.
     *
     * **Known gap, stated rather than papered over:** `toApiError`
     * (`services/toApiError.js:13-16`) copies `status` and `code` onto the wrapped
     * error and **drops `meta`**, so today `meta.recipients` never survives the
     * service layer and this branch is inert. The `code` half *does* arrive, so the
     * operator gets a specific sentence either way, and the count-specific wording
     * starts working the moment `toApiError` forwards `meta` — a one-line change in
     * a file this section is not allowed to edit. The fallback keeps the server's
     * own message so a refusal for any other reason still reads in its words.
     */
    const resolved = result?.code === 'TOO_MANY_RECIPIENTS' ? Number(result.meta?.recipients) : NaN;
    setError(
      Number.isFinite(resolved) && resolved > 0
        ? `The server resolved this to ${formatCount(resolved)} school administrators, above its ${MAX_RECIPIENTS} ceiling. Narrow the school selection and send again.`
        : result?.error || 'The broadcast could not be sent.'
    );
  };

  const rate = Number(ratePes) || 0;
  // The estimate is segments × recipients × rate, in pesewas, because
  // `ratePesewas` is per *message* and one recipient costs `segments` messages.
  const estimatedPes = recipientFloor === null ? null : segments * recipientFloor * rate;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Broadcast SMS to school administrators"
      description="Metered SMS from the platform account, to real handsets, on a provider's network."
      size="lg"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
          >
            Cancel
          </button>

          {showPreview ? (
            <button
              type="button"
              onClick={submit}
              disabled={!canSend}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="h-4 w-4" aria-hidden="true" />
              )}
              {busy
                ? 'Sending…'
                : `Send to ~${formatCount(recipientFloor || 0)} administrators now`}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowPreview(true)}
              disabled={!canSend}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
            >
              <Megaphone className="h-4 w-4" aria-hidden="true" />
              Review the send
            </button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        {error && <FormAlert tone="error">{error}</FormAlert>}

        <SelectField
          label="Audience"
          required
          value={audience}
          onChange={(event) => setAudience(event.target.value)}
          hint="Recipients are school administrators only"
        >
          {AUDIENCES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectField>

        <p className="-mt-2 text-[11px] font-semibold leading-relaxed text-slate-500">
          {AUDIENCES.find((option) => option.value === audience)?.description} Parents are never
          recipients — a parent&rsquo;s number is not reachable from this endpoint, and a
          broadcast aimed at them would be a different product with a different consent story.
        </p>

        {/*
          The picker is rendered *only* for `selected_schools`.

          Leaving a school list visible while the audience is `all_schools` is the
          exact failure named in `createAnnouncement`'s doc comment on the other
          side of this console: a control that is on screen, filled in, and then
          silently ignored by the server reads as a broken console, and the
          operator's reasonable conclusion — "my school selection is broken" —
          sends them looking for a bug that does not exist.
        */}
        {needsSchools && (
          <SchoolPicker
            label="Schools to message"
            required
            // `active`: the server resolves recipients only for active,
            // non-archived schools, so offering a suspended or archived one would
            // select something that resolves to zero people.
            filterStatus="active"
            value={schoolIds}
            onChange={setSchoolIds}
            error={schoolIds.length > 0 && schoolIds.length > MAX_RECIPIENTS ? 'Too many schools.' : null}
          />
        )}

        <div>
          <label
            htmlFor="broadcast-message"
            className="mb-0.5 flex items-baseline justify-between gap-3 text-[11px] font-semibold text-slate-700"
          >
            <span>
              Message <span className="text-red-600">*</span>
            </span>
            <span className="shrink-0 text-[10px] font-medium text-slate-500">
              {formatCount(trimmed.length)} characters &middot; {segments} part
              {segments === 1 ? '' : 's'}
            </span>
          </label>

          <textarea
            id="broadcast-message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={6}
            placeholder="SukuuPay will be unavailable on Saturday 02:00–06:00 GMT for scheduled maintenance. No action is needed."
            aria-describedby="broadcast-message-help"
            className="w-full resize-y rounded-xl border border-slate-200 bg-white p-3 text-[13px] font-medium leading-relaxed text-ink placeholder:font-normal placeholder:text-slate-400 focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/30"
          />

          <div id="broadcast-message-help" className="mt-1.5 space-y-1">
            {/*
              The 160 / 153 boundary, spelled out. 160 characters is one message;
              161 is two, and the second one costs the same as the first. Nothing
              here clips the body — the send button is disabled instead, because a
              silently shortened platform notice is a different notice.
            */}
            <p className="text-[11px] font-semibold leading-relaxed text-slate-500">
              160 characters is one SMS; each part after the first carries 153, because the
              provider&rsquo;s 7-bit header uses the rest. So 306 characters is two parts and 307
              is three. A curly apostrophe or an emoji drops the whole message to 70/67 and
              roughly doubles the cost.
            </p>
            <p className="text-[11px] font-semibold leading-relaxed text-slate-400">
              Nothing is ever truncated. Past {MAX_PARTS} parts the send is blocked rather than
              cut short.
            </p>
          </div>
        </div>

        {/* The cost estimate, beside the rate that produced it. */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[12px] font-extrabold text-slate-700">Estimated cost</p>
            <p className="text-[18px] font-extrabold tracking-tight text-ink">
              {estimatedPes === null || recipientFloor === 0 ? (
                <span className="text-[12px] font-semibold text-slate-400">—</span>
              ) : (
                formatCediShort(estimatedPes)
              )}
            </p>
          </div>
          <p className="mt-1 text-[11px] font-semibold leading-relaxed text-slate-500">
            {recipientFloor === null
              ? 'An estimate needs an audience. Choose “Selected schools only” to cost this.'
              : `${formatCount(segments)} part${segments === 1 ? '' : 's'} × ~${formatCount(
                  recipientFloor
                )} administrator${recipientFloor === 1 ? '' : 's'} × the configured rate of ${formatCediShort(
                  rate
                )} per message.`}
          </p>
          <p className="mt-1 text-[11px] font-semibold leading-relaxed text-slate-400">
            An estimate, not a quote. {provider ? `Sent through ${provider}. ` : ''}The
            provider&rsquo;s invoice will not match it exactly — bundles, per-network rates and
            refunds for failed messages all move the real figure.
          </p>
          {/*
            The sentence that keeps the picker above honest. A cost figure next to a
            list of schools reads, on its own, as "this will be taken out of those
            schools". It will not: the platform sends on its own sender ID and bills
            its own account, and no school's "messages left" figure moves as a result
            of this send. Stated here rather than assumed, because an operator who
            believes otherwise picks schools by who can afford the message — which is
            a platform-wide maintenance notice nobody should receive on the basis of
            their own credit balance.
          */}
          <p className="mt-1 text-[11px] font-semibold leading-relaxed text-slate-500">
            This is the platform&rsquo;s expense. No school&rsquo;s SMS credit is spent, and no
            school&rsquo;s &ldquo;messages left&rdquo; figure changes.
          </p>
        </div>

        {/* The confirmation, in the words of the thing being confirmed. */}
        {showPreview && (
          <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-3.5">
            <p className="text-[13px] font-extrabold text-amber-900">
              Send this to ~{formatCount(recipientFloor || 0)} school administrators?
            </p>

            <ul className="mt-2 space-y-1.5 text-[12px] font-semibold leading-relaxed text-amber-900">
              <li>
                <strong>This is metered SMS on a real provider&rsquo;s network.</strong> It is
                billed per part per recipient, to real handsets, and it is not a preview.
              </li>
              <li>
                <strong>It cannot be recalled.</strong> Once the provider accepts the
                submission there is no unsend — a mistyped maintenance window is already in
                three hundred administrators&rsquo; inboxes.
              </li>
              <li>
                <strong>It is recorded in the audit trail as</strong>{' '}
                <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[11px]">
                  admin.sms_broadcast
                </code>
                , against your name, with the audience and the resolved count.
              </li>
            </ul>

            <blockquote className="mt-3 whitespace-pre-wrap rounded-lg border border-amber-200 bg-white px-3 py-2.5 text-[12px] font-medium leading-relaxed text-ink">
              {trimmed}
            </blockquote>
          </div>
        )}

        {/* Blockers stated, never left as a disabled button with no explanation. */}
        {blockers.length > 0 && !showPreview && (
          <div>
            {blockers.map((blocker) => (
              <p
                key={blocker}
                className="mt-1 flex items-start gap-1.5 text-[11px] font-semibold text-amber-700"
              >
                <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {blocker}
              </p>
            ))}
          </div>
        )}

        {overCeiling && (
          <FormAlert tone="error">
            The server refuses a broadcast above {MAX_RECIPIENTS} recipients, and you have named{' '}
            {formatCount(schoolIds.length)} schools. Narrow the selection — at least one
            administrator per school is reached.
          </FormAlert>
        )}
      </div>
    </Modal>
  );
};

export { MAX_RECIPIENTS, MAX_PARTS };
export default BroadcastModal;