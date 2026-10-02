import React, { useMemo, useState } from 'react';
import { LoaderCircle, ShieldAlert } from 'lucide-react';
import Modal from '../common/Modal';
import { Field, FormAlert } from '../common/FormField';
import { formatCount } from '../../utils/format';

// The server's own bound, from `suspendSchema` in
// `Backend/src/validations/admin.validation.js`. Duplicated rather than imported:
// the frontend cannot import backend modules, and this is the one number worth
// stating in two places — a client that lets somebody type a 600-character reason
// and fail at submit has made the API's rule look arbitrary.
const REASON_MIN = 10;
const REASON_MAX = 500;

/**
 * Confirms suspending one school or a selected batch of them, and asks for the
 * reason.
 *
 * **The reason is the feature, not the gatekeeping.** `suspendSchoolSchema` requires
 * 10–500 characters because the string is what the school's staff are told when
 * they are signed out, and a suspension with no explanation is an action with no
 * trace in anyone's memory except the operator's.
 *
 * The dialog leads with the **cascade**, because that is the thing an operator
 * cannot see and the server does anyway: `suspendSchool` sets `status` on every
 * `User` document in the school (`MODULES_13_TO_17.md:1585`). One click signs out
 * a headmaster, three bursars and four hundred parents' account-holding staff
 * mid-term. This was deliberately not a row button on the schools table for that
 * reason — see `SchoolUsageDrawer`, which is where it lives instead. A row menu is
 * the compromise the list settled on: still one deliberate choice deep, but not
 * one keystroke away from a checkbox.
 *
 * The counts are the school's, passed in from the row, and they are shown because
 * "every user in this school" is abstract and "31 people" is not.
 *
 * ── The bulk variant ──
 *
 * Two shapes, one component, selected by which prop is passed (`school` for one,
 * `schools` for many). A separate dialog would have duplicated the reason bound, the
 * cascade copy and the `{ ok, error }` contract in a second file that could then
 * drift from this one — and the thing being duplicated is the sentence that has to
 * be exactly right.
 *
 * **One reason for N schools, not N reasons for N schools.** The reason is not an
 * internal justification; it is the string each school's own staff are shown when
 * they cannot sign in. Three schools suspended together on a shared cause — an
 * integration rollout, a billing migration, a fraud wave across a group — have one
 * thing to tell their staff, and splitting it into three free-text boxes produces
 * three differently-worded explanations of one decision, which is both worse for the
 * schools and *less* auditable: the audit log records what was actually written, and
 * an operator who typed three variants cannot afterwards say which one they meant.
 *
 * It is also a form nobody would fill in. A bulk action exists because an operator
 * has decided N schools share a cause; asking them to articulate that cause N times
 * is asking the same question N times, and the answer they gave the first time is
 * still on screen. If the causes genuinely differ, they are not one bulk action —
 * they are N single suspensions, and the operator already has a dialog for each.
 */
const SuspendSchoolDialog = ({ school, schools, counts, open, onClose, onConfirm, onFinished }) => {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const trimmed = reason.trim();
  const tooShort = trimmed.length > 0 && trimmed.length < REASON_MIN;
  const tooLong = trimmed.length > REASON_MAX;

  /**
   * The selection, normalised to a list.
   *
   * `useMemo` on the prop identity so the derived totals do not recompute on every
   * keystroke of the reason — the dialog is re-rendered on each character, and a
   * `reduce` over the selection is cheap but pointless twenty times a second.
   */
  const targets = useMemo(() => {
    if (Array.isArray(schools) && schools.length) return schools.filter(Boolean);
    return school ? [school] : [];
  }, [school, schools]);

  const isBulk = targets.length > 1;

  /**
   * The staff that will be signed out, summed.
   *
   * `staffCount` comes off the list row, which already carries it
   * (`admin.service.js` counts `school_admin | accountant | teacher`), so the bulk
   * total costs no extra request. Rows that predate it — or a school filtered out
   * from under a stale selection — contribute 0, and the copy below says "at least"
   * so a missing count cannot read as a smaller blast radius than the truth.
   */
  const staffTotal = targets.reduce(
    (sum, entry) => sum + (Number(counts?.staff ?? entry?.staffCount) || 0),
    0
  );
  const studentTotal = targets.reduce(
    (sum, entry) => sum + (Number(counts?.students ?? entry?.studentCount) || 0),
    0
  );

  const submit = async () => {
    // Checked for a better message than the server's 422, not instead of it. The
    // server stays the boundary; this says *which field* is wrong instead of
    // returning "reason length must be between 10 and 500 characters long" with no
    // pointer to the box.
    if (trimmed.length < REASON_MIN) {
      setError(`Write at least ${REASON_MIN} characters — this is what the school is told.`);
      return;
    }
    if (tooLong) {
      setError(`Keep it under ${REASON_MAX} characters.`);
      return;
    }
    if (!targets.length) return;

    setBusy(true);
    setError(null);

    // The whole selection is suspended as one sequential pass rather than a
    // `Promise.all`. Sequential on purpose: each call is individually audited and
    // each signs out a school's staff, so a burst of concurrent writes against the
    // same collections is a thundering herd with no way to say which of them landed.
    // A failure stops the pass and the dialog reports how far it got — a partial
    // suspension that says so is recoverable; one that reports success having
    // stopped at school two is not.
    let done = 0;
    for (const target of targets) {
      // eslint-disable-next-line no-await-in-loop
      const result = await onConfirm(target, trimmed);
      if (result?.ok === false) {
        setBusy(false);
        setError(
          done > 0
            ? `${done} of ${targets.length} schools were suspended before this one failed: ${
                result?.error || 'unknown error'
              }. The rest were left alone.`
            : result?.error || 'This school could not be suspended.'
        );
        return;
      }
      done += 1;
    }

    setBusy(false);
    setReason('');
    setError(null);

    /*
     * `onFinished` fires only after the whole pass succeeds, and it is optional so the
     * single-school caller can keep its own behaviour: the list page closes the bulk
     * dialog and clears the selection here, while the single-school flow closes its
     * own target from inside `confirmSuspend` and needs nothing.
     *
     * Not fired on a partial failure — the dialog stays up with what landed and what
     * did not, which is the only thing an operator can act on. Closing it would hide
     * the count of schools that are now suspended.
     */
    onFinished?.();
  };

  if (!targets.length) return null;

  const affected = staffTotal;
  const plural = targets.length === 1 ? 'staff account' : 'staff accounts';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isBulk ? `Suspend ${formatCount(targets.length)} schools?` : `Suspend ${targets[0].name}?`}
      description={
        isBulk
          ? 'Nobody at any of these schools will be able to sign in until they are restored.'
          : 'Nobody in this school will be able to sign in until it is restored.'
      }
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
          <button
            type="button"
            onClick={submit}
            disabled={busy || trimmed.length < REASON_MIN}
            className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600/40"
          >
            {busy ? (
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <ShieldAlert className="h-4 w-4" aria-hidden="true" />
            )}
            {busy
              ? 'Suspending…'
              : isBulk
                ? `Suspend ${formatCount(targets.length)} schools`
                : `Suspend ${targets[0].name}`}
          </button>
        </>
      }
    >
      {/*
        The cascade, stated before the field.

        Ordered this way on purpose: an operator who reads the reason box first has
        already started composing an apology email, and by the time they reach this
        paragraph they have committed to the action. The consequence goes first, the
        reason second.
      */}
      <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3">
        <p className="text-[13px] font-extrabold text-red-800">
          {isBulk
            ? `This signs out at least ${formatCount(affected)} ${plural} immediately`
            : `This signs out ${formatCount(affected)} ${plural} immediately`}
        </p>
        <ul className="mt-1.5 space-y-1 text-[12px] font-semibold leading-relaxed text-red-700">
          <li>
            {isBulk
              ? `Every account in all ${formatCount(targets.length)} selected schools is set to suspended — not just the schools' own records. None of them can sign in until they are restored.`
              : `Every account in ${targets[0].name} is set to suspended — not just the school's record. They cannot sign in until it is restored.`}
          </li>
          <li>
            {formatCount(studentTotal)} student records and every school&rsquo;s payment history stay
            exactly where they are. Nothing is deleted.
          </li>
          <li>
            SMS reminders stop for these schools. Parents stop being told what is owed.
          </li>
        </ul>
      </div>

      {isBulk && (
        <div className="mt-3">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
            Selected schools
          </p>
          <ul className="mt-1.5 max-h-40 space-y-1 overflow-y-auto rounded-lg border border-slate-200 px-3 py-2">
            {targets.map((entry) => (
              <li key={entry._id} className="flex items-baseline justify-between gap-3 text-[12px]">
                <span className="min-w-0 truncate font-bold text-ink">{entry.name}</span>
                <span className="shrink-0 font-mono text-[11px] font-semibold text-slate-400">
                  {entry.schoolCode || '—'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <div className="mt-3">
          <FormAlert tone="error">{error}</FormAlert>
        </div>
      )}

      <Field
        label={isBulk ? 'One reason, shared by every selected school' : 'Reason'}
        required
        className="mt-3"
        value={reason}
        maxLength={REASON_MAX}
        disabled={busy}
        onChange={(event) => setReason(event.target.value)}
        placeholder={
          isBulk
            ? 'What are these schools being told? The same words reach all of them.'
            : 'What is the school being told?'
        }
        hint={`${trimmed.length}/${REASON_MAX}`}
        error={
          tooShort
            ? `${REASON_MIN - trimmed.length} more character${REASON_MIN - trimmed.length === 1 ? '' : 's'}`
            : tooLong
              ? 'Too long'
              : null
        }
      />

      {isBulk && (
        <p className="mt-2 text-[11px] font-semibold leading-relaxed text-slate-400">
          One reason, not one each. The schools were selected because they share a cause, and this
          string is what each school&rsquo;s staff are shown when they are locked out. Three
          differently-worded explanations of one decision would be worse for them and harder for you
          to explain later. If the causes genuinely differ, suspend them one at a time.
        </p>
      )}

      <p className="mt-2 text-[11px] font-semibold leading-relaxed text-slate-400">
        Required by the API at {REASON_MIN}–{REASON_MAX} characters, and recorded in the activity
        log alongside your name.
      </p>
    </Modal>
  );
};

export default SuspendSchoolDialog;