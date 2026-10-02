import React, { useEffect, useState } from 'react';
import { Check, Copy, KeyRound, TriangleAlert } from 'lucide-react';
import Modal from '../common/Modal';
import { FormAlert } from '../common/FormField';

/**
 * Whether the clipboard actually took the secret.
 *
 * `navigator.clipboard` is unavailable on an insecure origin and throws in some
 * embedded webviews, so a bare `writeText` is a button that appears to work and
 * copies nothing — which on this particular value means an operator reads a
 * password off the screen instead. The failure is reported rather than swallowed.
 */
const copyToClipboard = async (text) => {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (error) {
    // Fall through to the reported failure below.
  }
  return false;
};

/**
 * Mint and send a password reset link.
 *
 * **This sends a link; it does not set a password.** `resetUserPasswordAsPlatform`
 * (`Backend/src/services/admin/users.service.js:424`) mints a reset token, stores
 * only `hashToken(token)`, and mails the plaintext in a link — the same flow as
 * `POST /auth/forgot-password`, reused on purpose so there is one expiry policy.
 * No live credential is created, and sessions are deliberately **not** revoked: the
 * user has not used the link yet, and revoking now would lock them out of the
 * account the link is meant to recover.
 *
 * **The one-shot value is rendered only when the response carries it.** In
 * development the service appends `resetToken` (the raw link token) to the
 * response; in production the key is omitted entirely rather than nulled, because
 * a key present-and-null teaches every client to read it anyway. So the check is
 * `typeof value === 'string' && value.length > 0` and nothing else is drawn when
 * it fails — no empty input, no disabled copy button, no "your password is"
 * sentence with nothing after it. A production console that shows an empty
 * password field is worse than one that shows none, because it reads as a broken
 * feature and invites an operator to go looking for the password somewhere else.
 *
 * **Two key names are read, and the reason is a documentation disagreement.**
 * `services/admin.js` documents this response as carrying `temporaryPassword`;
 * the service actually appends `resetToken`. Both are accepted so the dialog works
 * against whichever the backend settles on, and so nobody has to change a UI to fix
 * a comment. This is flagged in the build report — it is a doc bug in
 * `services/admin.js`, not a behaviour question, because a reset *link* token is not
 * a password and must not be labelled as one.
 *
 * **"Shown once" is stated on the screen, not implied.** The token lives in this
 * response object and nowhere else retrievable — the stored copy is a SHA-256 — so
 * an operator who closes this dialog without copying it has to mint a new one.
 *
 * `onConfirm()` returns `{ ok, error, data }`. The extra `data` is the response body
 * the success state renders; `{ ok, error }` is still the contract that decides
 * whether the dialog stays open.
 */
const ResetUserPasswordDialog = ({ open, user, onClose, onConfirm, isProtected = false }) => {
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState(null);
  const [outcome, setOutcome] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setBusy(false);
    setFormError(null);
    setOutcome(null);
    setCopied(false);
  }, [open, user]);

  if (!open || !user) return null;

  const secret =
    outcome?.temporaryPassword || outcome?.resetToken || outcome?.token || '';

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setFormError(null);
    try {
      const result = await onConfirm();
      if (result?.ok) {
        setOutcome(result.data || {});
        setCopied(false);
      } else {
        setFormError(result?.error || 'The reset link could not be sent.');
      }
    } catch (error) {
      setFormError(error?.message || 'The reset link could not be sent.');
    } finally {
      setBusy(false);
    }
  };

  const onCopy = async () => {
    const ok = await copyToClipboard(secret);
    setCopied(ok);
    if (!ok) {
      setFormError('This browser would not let the page write to the clipboard. Select the value and copy it by hand.');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Send a password reset link"
      description={
        isProtected
          ? `${user.name} · managed by the server environment`
          : `${user.name} · ${user.email || 'no email on file'}`
      }
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
              disabled={busy || isProtected}
              className="rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 disabled:opacity-60"
            >
              {busy ? 'Sending…' : 'Send reset link'}
            </button>
          </>
        )
      }
    >
      {isProtected ? (
        <FormAlert tone="info">
          This is the platform owner account. Its credential comes from the server environment, so
          there is nothing here to reset.
        </FormAlert>
      ) : !outcome ? (
        <div className="space-y-3">
          {formError && <FormAlert tone="error">{formError}</FormAlert>}

          <p className="text-[13px] leading-relaxed text-slate-600">
            This does not change {user.name.split(' ')[0]}&rsquo;s password and does not sign them
            out. It emails a one-time link that lets them choose a new password. Nothing is
            displayed to you in production, so if the address is wrong the only way to find out is
            to ask them.
          </p>

          <FormAlert tone="warning">
            <span className="flex items-start gap-2">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                Anyone who can read {user.email || 'that mailbox'} can take over this account
                until the link expires. Confirm you are speaking to the account holder.
              </span>
            </span>
          </FormAlert>
        </div>
      ) : (
        <div className="space-y-3">
          {formError && <FormAlert tone="error">{formError}</FormAlert>}

          {/*
            The mail failure is an informational state, not an error, and it is the
            one most likely to be missed. The service creates the link *before* it
            sends the mail and reports `emailSent: false` rather than 500ing, so
            the credential exists, nobody has it, and the account is unreachable.
            Rendering that as a red banner would say the operation failed, which is
            the opposite of what happened.
          */}
          {outcome.emailSent === false ? (
            <FormAlert tone="warning">
              The reset link was created but the email could not be sent
              {outcome.emailError ? `: ${outcome.emailError}` : '.'} The link is valid for{' '}
              {outcome.expiresInMinutes} minutes and has not been delivered to anybody — treat this
              account as needing a phone call.
            </FormAlert>
          ) : (
            <FormAlert tone="success">
              Sent to {outcome.email || user.email}.
              {outcome.expiresInMinutes ? ` It expires in ${outcome.expiresInMinutes} minutes.` : ''}
            </FormAlert>
          )}

          {/*
            Development only. The service omits the key entirely in production, so
            this block simply does not render there — there is no "hidden in
            production" flag in the UI that somebody could mistake for a broken
            field, because the whole node is gone.
          */}
          {secret ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wide text-amber-800">
                <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                Development only — link token
              </p>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={secret}
                  aria-label="The reset link token, development only"
                  className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 font-mono text-[12px] font-bold text-ink focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                />
                <button
                  type="button"
                  onClick={onCopy}
                  aria-label="Copy the reset link token"
                  className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 text-[11px] font-extrabold text-amber-800 transition-colors hover:bg-amber-100"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <p className="mt-2 text-[11px] font-semibold leading-relaxed text-amber-800">
                Shown once. This is the only copy of the token in existence — the server stored a
                hash of it — so closing this dialog without copying it means sending another link.
                It is a live credential for {outcome.expiresInMinutes || 'a few'} minutes, and this
                value is absent from every production response by design.
              </p>
            </div>
          ) : null}
        </div>
      )}
    </Modal>
  );
};

export default ResetUserPasswordDialog;