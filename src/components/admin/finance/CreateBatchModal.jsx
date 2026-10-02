import React, { useEffect, useState } from 'react';
import { CalendarClock, Plus } from 'lucide-react';
import Modal from '../../common/Modal';
import { Field, FormAlert } from '../../common/FormField';
import { SchoolPicker } from './SchoolSelect';
import { todayIsoDay } from './financeVocabulary';

/**
 * Builds a disbursement batch: one school, one window.
 *
 * ### This writes money-adjacent records, so it is a dialog and a confirm
 *
 * `buildDisbursementBatch` creates a `pending_approval` batch, writes one
 * `PlatformLedger` line per payment at the school's markup rate, and stamps
 * `disbursementBatchId` onto every payment in the window
 * (`Backend/src/services/admin/disbursements.service.js:309-687`). Nothing
 * *moves* — the batch waits for a human — but the batch number is issued from an
 * atomic counter and the anti-join that stops a payment being claimed twice reads
 * the ledger lines this call writes. So this is a confirm, with the refusals
 * stated in the dialog rather than discovered after the fact.
 *
 * ### The two refusals an operator will hit, named up front
 *
 *   - **409 `DUPLICATE_WINDOW`.** A batch already exists for this school and
 *     window. The server names it: *"already covered by batch DISB-… (paid)"*.
 *     The unique index on `{schoolId, periodStart, periodEnd}`
 *     (`DisbursementBatch.js:257`) is the real guard; the application check runs
 *     first only because it can return a message somebody can act on. "Approve
 *     All" is not a way past it — a batch that does not exist cannot be approved,
 *     and one that exists twice pays the school twice.
 *   - **409 `NO_PAYMENTS_IN_WINDOW`.** No completed payments in the window. An
 *     empty batch would be a `paid`-able row worth 0 pesewas that sits in
 *     "awaiting approval" forever and shows the school a payout week that
 *     collected nothing — which reads to a school as a lost payment rather than a
 *     quiet week.
 *
 * Both are in the dialog body rather than only in the error slot, because both
 * are predictable from what the operator is typing, and an error that only
 * appears after the request is a worse way to learn a rule than a sentence shown
 * before it.
 *
 * ### `periodEnd` before `periodStart` is caught here, and still checked there
 *
 * An inverted window is a `$gte` later than a `$lte`, which matches **nothing** —
 * byte-for-byte identical to a school that genuinely collected nothing that week.
 * It is also the one mistake a human types by accident, by swapping the two date
 * boxes. So the client refuses it with a message about ordering, and the server
 * refuses it too (`INVERTED_PERIOD`, 400) because the service is reachable from
 * jobs and from tests that never pass through validation.
 */
const CreateBatchModal = ({ open, onClose, onConfirm, defaultSchoolId = '' }) => {
  const [schoolId, setSchoolId] = useState(defaultSchoolId);
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [schools, setSchools] = useState([]);

  /*
   * Reset on open, keyed on the incoming default.
   *
   * Without this the dialog keeps the last window an operator typed, closes, and
   * reopens already filled — so the second batch they stage for a school is the
   * first batch's window with one digit changed, which the server refuses as a
   * duplicate. A refusal that is correct and confusing is still a bad dialog.
   */
  useEffect(() => {
    if (!open) return;
    setSchoolId(defaultSchoolId);
    setPeriodStart('');
    setPeriodEnd('');
    setError(null);
    setBusy(false);
  }, [open, defaultSchoolId]);

  /*
   * The selected school's name, for this dialog's own subtitle.
   *
   * `schoolName` is **not sent** — `createDisbursementBatchSchema` validates
   * `schoolId`, `periodStart` and `periodEnd` and nothing else, so `stripUnknown`
   * would drop it. It is resolved here purely so the operator reads which school is
   * about to be staged instead of a dropdown's current value. Confirming a payout
   * for the wrong tenant is the failure this dialog exists to prevent, and a
   * 24-character id in the subtitle is not a check anybody performs.
   *
   * The rows come from the picker's own already-resolved 200-school request
   * (`SchoolSelect`'s `onLoaded`) rather than a second one, because the console has
   * no "all schools" endpoint and re-fetching a clamped platform-wide list to read
   * one name out of it is the wrong trade twice over.
   */
  const selected = schools.find((school) => school._id === schoolId);
  const schoolName = selected?.name || '';

  const inverted = Boolean(periodStart && periodEnd && periodEnd < periodStart);
  const ready = Boolean(schoolId && periodStart && periodEnd) && !inverted;

  const submit = async () => {
    if (busy) return;

    if (!schoolId) {
      setError('Choose the school this batch pays.');
      return;
    }
    if (!periodStart || !periodEnd) {
      setError('Both dates are required — a batch always covers a window, never an instant.');
      return;
    }
    if (inverted) {
      setError(
        'The end of the window is before its start. That window matches no payments and looks exactly like a school that collected nothing.'
      );
      return;
    }

    setBusy(true);
    setError(null);

    // Returns `{ ok, error }`, never throws, so a 409 leaves the dialog open with
    // the window the operator chose intact — which is the whole point, because
    // the common failure here *is* the chosen window.
    const result = await onConfirm({ schoolId, periodStart, periodEnd });

    setBusy(false);

    if (result?.ok) {
      onClose?.();
      return;
    }
    setError(result?.error || 'This batch could not be created.');
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Stage a disbursement batch"
      description={
        schoolName
          ? `${schoolName} · every completed parent payment in the window, split off at this school's markup rate.`
          : 'Choose a school and the window of parent payments to pay out.'
      }
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy || !ready}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {busy ? 'Staging…' : 'Stage this batch'}
          </button>
        </>
      }
    >
      <SchoolPicker
        value={schoolId}
        onChange={setSchoolId}
        error={!schoolId && error ? 'Choose a school' : undefined}
        onLoaded={setSchools}
      />

      {/*
        Two dates, one window.

        `type="date"` rather than a text box because the endpoint validates
        `periodStart`/`periodEnd` with `Joi.date().iso()` and an inverted pair is
        the mistake this form exists to prevent — a free-text box makes that
        mistake available in a way a date picker does not.

        `max={today}` on neither: a window may legitimately end in the future
        (`periodEnd` defaults a month out from the subscription's current period
        start), and the server accepts it. Capping would forbid a legitimate
        forward-looking window to prevent a typo the server's own 409 already
        catches for the case that actually costs money.
      */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field
          label="Window starts"
          type="date"
          required
          value={periodStart}
          max={periodEnd || undefined}
          onChange={(event) => {
            setPeriodStart(event.target.value);
            setError(null);
          }}
          hint="inclusive"
        />
        <Field
          label="Window ends"
          type="date"
          required
          value={periodEnd}
          min={periodStart || undefined}
          onChange={(event) => {
            setPeriodEnd(event.target.value);
            setError(null);
          }}
          hint="inclusive"
          error={inverted ? 'Ends before it starts' : undefined}
        />
      </div>

      <p className="mt-2 text-[11px] font-semibold leading-relaxed text-slate-400">
        Both bounds are inclusive, to the end of the end date. Ghana is UTC+0 all year, so a
        payment recorded at 23:59 on the closing date is in this batch. Today is{' '}
        {todayIsoDay()}.
      </p>

      {/*
        The two refusals, before the click rather than after it.

        Stated as facts about the system rather than as warnings, because nothing
        here is a risk to be managed — it is what the endpoint does, and an
        operator who has read it knows which 409 they are looking at when one comes
        back.
      */}
      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-3">
        <h3 className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
          <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
          What this can be refused for
        </h3>
        <ul className="mt-2 space-y-1.5 text-[12px] font-semibold leading-relaxed text-slate-600">
          <li>
            <strong>A window that already has a batch.</strong> The server refuses with a 409 naming
            the existing batch and its status. One batch per school per window — a second one would
            pay the school twice.
          </li>
          <li>
            <strong>A window with no completed payments in it.</strong> Also a 409, because an empty
            batch is a payout row that never drains and shows the school a payment week that
            collected nothing.
          </li>
          <li>
            <strong>A suspended school.</strong> Refused before anything is written — a tenant the
            platform has said should not be transacting must not have money queued to leave it.
          </li>
          <li>
            Payments already paid out in an earlier <code className="font-mono">paid</code> batch are
            excluded automatically. The batch reports how many it skipped.
          </li>
        </ul>
      </div>

      <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] font-semibold leading-relaxed text-amber-800">
        Staging moves no money. The batch is written as <code className="font-mono">pending_approval</code>{' '}
        and waits for a person to approve it — and approving it will not send anything either,
        because no payout provider is wired yet.
      </p>

      {error && (
        <div className="mt-3">
          <FormAlert tone="error">{error}</FormAlert>
        </div>
      )}
    </Modal>
  );
};

export default CreateBatchModal;
