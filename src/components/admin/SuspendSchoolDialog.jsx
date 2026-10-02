import React, { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import Modal from '../common/Modal';
import { Field, FormAlert } from '../common/FormField';
import { formatCount } from '../../utils/format';

// The server's own bound, from `suspendSchoolSchema` in
// `Backend/src/validations/admin.validation.js`. Duplicated rather than imported:
// the frontend cannot import backend modules, and this is the one number worth
// stating in two places — a client that lets somebody type a 600-character reason
// and fail at submit has made the API's rule look arbitrary.
const REASON_MIN = 10;
const REASON_MAX = 500;

/**
 * Confirms suspending a school, and asks for the reason.
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
 * reason — see `SchoolUsageDrawer`, which is where it lives instead.
 *
 * The counts are the school's, passed in from the row, and they are shown because
 * "every user in this school" is abstract and "31 people" is not.
 */
const SuspendSchoolDialog = ({ school, counts, open, onClose, onConfirm }) => {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const trimmed = reason.trim();
  const tooShort = trimmed.length > 0 && trimmed.length < REASON_MIN;
  const tooLong = trimmed.length > REASON_MAX;

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

    setBusy(true);
    setError(null);
    const result = await onConfirm(school, trimmed);
    setBusy(false);

    if (result?.ok) {
      setReason('');
      setError(null);
      return;
    }
    setError(result?.error || 'This school could not be suspended.');
  };

  if (!school) return null;

  const affected = Number(counts?.staff) || 0;
  const students = Number(counts?.students) || 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Suspend ${school.name}?`}
      description="Nobody in this school will be able to sign in until it is restored."
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
            <ShieldAlert className="h-4 w-4" aria-hidden="true" />
            {busy ? 'Suspending…' : `Suspend ${school.name}`}
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
          This signs out {formatCount(affected)} staff account{affected === 1 ? '' : 's'} immediately
        </p>
        <ul className="mt-1.5 space-y-1 text-[12px] font-semibold leading-relaxed text-red-700">
          <li>
            Every account in {school.name} is set to suspended — not just the school&rsquo;s
            record. They cannot sign in until it is restored.
          </li>
          <li>
            {formatCount(students)} student records and this school&rsquo;s payment history stay
            exactly where they are. Nothing is deleted.
          </li>
          <li>
            SMS reminders stop for this school. Parents stop being told what is owed.
          </li>
        </ul>
      </div>

      {error && (
        <div className="mt-3">
          <FormAlert tone="error">{error}</FormAlert>
        </div>
      )}

      <Field
        label="Reason"
        required
        className="mt-3"
        value={reason}
        maxLength={REASON_MAX}
        onChange={(event) => setReason(event.target.value)}
        placeholder="What is the school being told?"
        hint={`${trimmed.length}/${REASON_MAX}`}
        error={
          tooShort
            ? `${REASON_MIN - trimmed.length} more character${REASON_MIN - trimmed.length === 1 ? '' : 's'}`
            : tooLong
              ? 'Too long'
              : null
        }
      />

      <p className="mt-2 text-[11px] font-semibold leading-relaxed text-slate-400">
        Required by the API at {REASON_MIN}–{REASON_MAX} characters, and recorded in the activity
        log alongside your name.
      </p>
    </Modal>
  );
};

export default SuspendSchoolDialog;