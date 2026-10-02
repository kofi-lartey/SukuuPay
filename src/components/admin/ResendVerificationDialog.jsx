import React, { useEffect, useState } from 'react';
import { MailCheck, TriangleAlert } from 'lucide-react';
import Modal from '../common/Modal';
import { FormAlert } from '../common/FormField';

/**
 * Re-send an account's email verification code.
 *
 * **Idempotence is the whole design of this dialog.** `resendUserVerificationAsPlatform`
 * (`Backend/src/services/admin/users.service.js:489`) answers
 * `alreadyVerified: true` with a plain message when the address is already verified,
 * and that is a *success with nothing to do* rather than a failure. The public
 * `authController.resendVerification` has to answer neutrally because it is handed
 * an email from an unauthenticated caller and cannot confirm the account exists;
 * this endpoint is addressed by id behind `authorize('super_admin')`, so it knows,
 * and a 409 would be the API declining to tell the operator something they are
 * entitled to know — on precisely the account a console operator is most often
 * asked about.
 *
 * So `alreadyVerified` renders in `FormAlert tone="info"`, not `tone="error"`. A
 * red banner on an account that is in perfect health teaches an operator to
 * distrust the button, and the next time they press it on a genuinely unverified
 * account they will read a success as a failure.
 *
 * A *mail* failure, by contrast, is a warning and not an info state: the code was
 * created and never reached anybody, so the account is stuck with a reason nobody
 * can see. The service reports it as `emailSent: false` rather than throwing,
 * because the OTP itself is now stored and the request did succeed.
 *
 * The OTP is echoed outside production only, on the same rule as the reset token —
 * it is a live login credential and the audit log is read by more people than wrote
 * to it. Unlike the reset dialog there is nothing to copy here: the code is short
 * enough to read aloud on a support call, and putting a copy button on it would be
 * an invitation.
 *
 * `onConfirm()` returns `{ ok, error, data }`, per the house convention with the
 * response body added for the success state.
 */
const ResendVerificationDialog = ({ open, user, onClose, onConfirm }) => {
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState(null);
  const [outcome, setOutcome] = useState(null);

  useEffect(() => {
    if (!open) return;
    setBusy(false);
    setFormError(null);
    setOutcome(null);
  }, [open, user]);

  if (!open || !user) return null;

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setFormError(null);
    try {
      const result = await onConfirm();
      if (result?.ok) {
        setOutcome(result.data || {});
      } else {
        setFormError(result?.error || 'The verification email could not be sent.');
      }
    } catch (error) {
      setFormError(error?.message || 'The verification email could not be sent.');
    } finally {
      setBusy(false);
    }
  };

  const verified = outcome?.alreadyVerified === true || user.isEmailVerified === true;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Re-send the verification code"
      description={`${user.name} · ${user.email || 'no email on file'}`}
      footer={
        outcome ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800"
          >
            Done
          </button>
        ) : (
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
              disabled={busy}
              className="rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 disabled:opacity-60"
            >
              {busy ? 'Sending…' : 'Send code again'}
            </button>
          </>
        )
      }
    >
      {!outcome ? (
        <div className="space-y-3">
          {formError && <FormAlert tone="error">{formError}</FormAlert>}

          {verified ? (
            <>
              <FormAlert tone="info">
                <span className="flex items-start gap-2">
                  <MailCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    This address is already verified, so there is nothing to re-send. The button is
                    left enabled because the server answers this idempotently — pressing it tells
                    you the same thing rather than failing.
                  </span>
                </span>
              </FormAlert>
              <p className="text-[13px] leading-relaxed text-slate-600">
                Sending anyway will not hurt: the server notices the account is verified, sends
                nothing, and reports so. If somebody is telling you they never received a code, that
                is a different problem — check whether they are signing in with this address.
              </p>
            </>
          ) : (
            <p className="text-[13px] leading-relaxed text-slate-600">
              A new one-time code goes to {user.email || 'this account’s address'}. Any code sent
              earlier stops working — this replaces it rather than adding to it.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {formError && <FormAlert tone="error">{formError}</FormAlert>}

          {outcome.alreadyVerified ? (
            <FormAlert tone="info">
              {outcome.message || `${outcome.email || user.email} is already verified — no code was sent.`}
            </FormAlert>
          ) : outcome.emailSent === false ? (
            <FormAlert tone="warning">
              <span className="flex items-start gap-2">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  The code was created but the email could not be sent
                  {outcome.emailError ? `: ${outcome.emailError}` : '.'} Nobody has it — the account
                  cannot sign in until a code is delivered.
                </span>
              </span>
            </FormAlert>
          ) : (
            <FormAlert tone="success">
              A new code was sent to {outcome.email || user.email}.
              {outcome.expiresInMinutes ? ` It expires in ${outcome.expiresInMinutes} minutes.` : ''}
            </FormAlert>
          )}

          {outcome.otp ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-amber-800">
                Development only — one-time code
              </p>
              <p className="mt-1 font-mono text-lg font-extrabold tracking-widest text-ink">
                {outcome.otp}
              </p>
              <p className="mt-1.5 text-[11px] font-semibold leading-relaxed text-amber-800">
                Shown once and omitted from every production response. This is a live login
                credential.
              </p>
            </div>
          ) : null}
        </div>
      )}
    </Modal>
  );
};

export default ResendVerificationDialog;