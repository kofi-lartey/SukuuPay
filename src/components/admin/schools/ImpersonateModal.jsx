import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, LoaderCircle } from 'lucide-react';
import Modal from '../../common/Modal';
import { Field, FormAlert } from '../../common/FormField';
import { impersonateSchool } from '../../../services/impersonation';
import { ADMIN_ROUTES } from '../../../utils/constants';

/**
 * The server's own bound, from `impersonateSchema` in
 * `Backend/src/validations/admin.impersonation.validation.js`. Duplicated rather
 * than imported — the frontend cannot import backend modules — and worth stating in
 * both places, because a box that lets somebody submit four characters and 422 is a
 * control that has made the API's rule look arbitrary.
 */
const REASON_MIN = 10;

/**
 * Open an impersonation session as a school.
 *
 * **"This is recorded and shown in the school's activity log" is the load-bearing
 * sentence in this dialog, and it is placed above the field rather than under the
 * confirm button.** The reason is not an internal ticket reference: it is stored on
 * the `ImpersonationSession` and rendered in that school's own console
 * (`services/impersonation.js:64-70` says so directly). Which means it is read by
 * the people whose school it is. An operator who believes they are writing to a
 * colleague writes "checking the disputed Kwame Mensah bill"; an operator who has been
 * told the school will read it writes "called by the bursar about a disputed bill,
 * confirmed the amount". The two sentences produce completely different behaviour,
 * and only one of them is the behaviour that makes impersonation trustworthy. A
 * disclosure buried under a button is a disclosure nobody reads before they need it.
 *
 * **Why the dialog says "read-only" when it is offering to give someone access.**
 * Because the moment the session opens, `ImpersonationBanner` replaces the page
 * header with an amber strip, `AdminGuard` refuses to let the operator navigate
 * outside this school (`routes/AdminGuard.jsx:88-95`), and the server rejects every
 * write with `403 IMPERSONATION_READ_ONLY`
 * (`Backend/src/middleware/impersonation.js`). So the session is genuinely narrower
 * than the console they are leaving — reads of this school, no writes at all. Saying
 * it here, before the switch, is what stops the first reaction inside the session
 * from being "the platform has broken". The prohibition itself belongs in the API;
 * the *expectation* belongs here.
 *
 * On success this navigates to `/admin/schools/:id` rather than to wherever the
 * operator was standing. The impersonated tab is scoped to that school by
 * `AdminGuard`, so any other platform route would bounce straight back here with a
 * `replace` the operator would read as a glitch; and landing on the school's own
 * page is where a support session actually starts.
 */
const ImpersonateModal = ({ open, school, onClose, onStarted }) => {
  const navigate = useNavigate();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const trimmed = reason.trim();
  const tooShort = trimmed.length > 0 && trimmed.length < REASON_MIN;

  // Reset on open so a cancelled reason is not sitting in the box next time, and so
  // a previous school's reason is never visible while this school's name is in the
  // title.
  useEffect(() => {
    if (!open) return;
    setReason('');
    setError(null);
  }, [open, school?._id]);

  const submit = async () => {
    if (trimmed.length < REASON_MIN) {
      setError(`Write at least ${REASON_MIN} characters — this is what the school is told.`);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await impersonateSchool(school._id, trimmed);

      /*
       * The service has already swapped `auth_token` for the impersonation token and
       * stashed the platform owner's under its own key, so from here on every request
       * in this tab goes out scoped to this school. `ImpersonationBanner` re-reads
       * localStorage on mount, so navigating rather than just re-rendering is what
       * makes the banner appear; and `AdminGuard` is what keeps the rest of the
       * console out of reach for as long as the session is open.
       */
      onStarted?.();
      onClose();
      navigate(`${ADMIN_ROUTES.SCHOOL_DETAIL.replace(':schoolId', school._id)}`, { replace: true });
    } catch (caught) {
      // The dialog stays open with the reason intact. Losing a paragraph somebody
      // wrote about a real support call is the worst outcome this screen could have.
      setError(caught.message || 'That school could not be impersonated.');
    } finally {
      setBusy(false);
    }
  };

  if (!school) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Sign in as ${school.name}`}
      description="You will see this school's console, with your own platform access suspended until you exit."
      size="sm"
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
            className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
          >
            {busy ? (
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Eye className="h-4 w-4" aria-hidden="true" />
            )}
            {busy ? 'Opening…' : 'Open session'}
          </button>
        </>
      }
    >
      {/*
        The disclosure, first. Everything else on this screen is mechanics; this is the
        one thing the operator has to know before they press the button.
      */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3">
        <p className="text-[13px] font-extrabold text-amber-800">
          This is recorded and shown in the school&rsquo;s activity log
        </p>
        <p className="mt-1 text-[12px] font-semibold leading-relaxed text-amber-800/90">
          The bursar and the headteacher can read this reason. Write it to them, not to a colleague:
          say what you called about and what you checked.
        </p>
      </div>

      {/* The session is read-only. Stated here and in the banner, never assumed. */}
      <p className="mt-3 flex items-start gap-2 rounded-xl bg-slate-50 px-3.5 py-2.5 text-[12px] font-semibold leading-relaxed text-slate-600">
        <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
        <span>
          <strong className="font-extrabold text-ink">Read-only.</strong> The session can look at this
          school and nothing else, and every write is refused by the server until you exit. An amber
          banner stays on screen for as long as it is open, and every read you make is attributed to
          you by name.
        </span>
      </p>

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
        maxLength={500}
        onChange={(event) => setReason(event.target.value)}
        placeholder="What are you looking into, in words the school would accept?"
        hint={`${trimmed.length}/500`}
        error={tooShort ? `${REASON_MIN - trimmed.length} more character${REASON_MIN - trimmed.length === 1 ? '' : 's'}` : null}
      />

      <p className="mt-2 text-[11px] font-semibold leading-relaxed text-slate-400">
        Required by the API at {REASON_MIN} characters minimum, recorded against your name, and shown
        in the banner for the rest of the session.
      </p>
    </Modal>
  );
};

export default ImpersonateModal;