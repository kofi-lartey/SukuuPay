import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, KeyRound, LoaderCircle } from 'lucide-react';
import Modal from '../common/Modal';
import { Field } from '../common/FormField';

/**
 * Escape hatch for the one case provisioning cannot handle.
 *
 * `POST /schools/me` refuses an email that already belongs to a School, because
 * `School.email` is unique. That is correct — it stops two bursars of different
 * schools claiming the same address — but it means a *second* admin of a school
 * someone else already registered gets a 409. A 409 with no way forward is the
 * same dead end in a smaller window, so this sheet is the other half of that
 * branch.
 *
 * The school code identifies the school; it does not authenticate the applicant.
 * `generateSchoolCode` produces three initials plus a three-digit counter, so
 * codes are guessable by anyone who knows the school's name. Approval by an
 * existing admin of that school is therefore required, and the sheet says so
 * plainly — promising access the user has not been granted would be the worse
 * failure.
 */
const JoinSchoolSheet = ({ open, onClose, onRequested, requestSchoolByCode, applicant }) => {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(null);

  const close = () => {
    setCode('');
    setError('');
    setPending(null);
    onClose();
  };

  const submit = async (event) => {
    event.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 4) {
      setError('Enter the code your headteacher gave you.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const result = await requestSchoolByCode({
        schoolCode: trimmed,
        applicantName: applicant?.name,
        applicantPosition: applicant?.position,
      });
      setPending(result);
    } catch (requestError) {
      setError(requestError.message || 'We could not send your request. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (pending) {
    return (
      <Modal
        open={open}
        onClose={close}
        title="Request sent"
        description={`${pending.schoolName || 'Your school'} has been notified.`}
        footer={
          <button
            type="button"
            onClick={() => {
              close();
              onRequested?.(pending);
            }}
            className="rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-800"
          >
            Got it
          </button>
        }
      >
        <div className="flex flex-col items-center rounded-xl border border-brand-200 bg-brand-50 px-5 py-6 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-700 text-white shadow-md">
            <CheckCircle2 className="h-6 w-6" />
          </span>
          <h3 className="mt-3 text-base font-extrabold text-ink">Waiting for approval</h3>
          <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">
            An administrator of{' '}
            <span className="font-bold text-ink">{pending.schoolName || 'your school'}</span> has
            to approve you. We will email you the moment they do.
          </p>
          <p className="mt-3 inline-flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-left text-[12px] font-semibold text-amber-800">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            A school code on its own never grants access — that is what stops a guessed code from
            handing out the bursary.
          </p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Join an existing school"
      description="Already registered with us? Ask your headteacher for your school code."
      footer={
        <>
          <button
            type="button"
            onClick={close}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
          >
            Back to the form
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {busy ? 'Sending…' : 'Send request'}
          </button>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        <div className="flex items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3">
          <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
          <p className="text-[12px] leading-relaxed text-slate-600">
            Your school code looks like <span className="font-bold text-ink">ABC123</span>. You will
            find it on your school's SukuuPay dashboard, or ask your headteacher for it.
          </p>
        </div>

        {error && (
          <p role="alert" className="text-[13px] font-semibold text-red-600">
            {error}
          </p>
        )}

        <Field
          label="School code"
          required
          onChange={(event) => {
            setCode(event.target.value);
            setError('');
          }}
          placeholder="ABC123"
          value={code}
          maxLength={12}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          hint="Not case sensitive"
        />
      </form>
    </Modal>
  );
};

export default JoinSchoolSheet;
