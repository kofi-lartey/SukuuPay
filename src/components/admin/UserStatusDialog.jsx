import React, { useEffect, useState } from 'react';
import Modal from '../common/Modal';
import { FormAlert, SelectField } from '../common/FormField';
import { USER_STATUSES } from '../../services/admin';

/**
 * The statuses the platform may put an account into.
 *
 * **`USER_STATUSES` has four members and this offers three.** The fourth is
 * `invited`, which is a state the *invitation flow* creates and which the platform
 * console must not be able to manufacture: `ASSIGNABLE_STATUSES` in
 * `Backend/src/services/admin/users.service.js:82` is deliberately
 * `active | suspended | deactivated`, and its own comment gives the reason — an
 * account that was never invited and cannot sign in is not a state an operator
 * should be able to create by typing. Offering it would produce a 400 on submit
 * for a choice the UI presented as legitimate.
 *
 * So the list is derived here rather than imported wholesale, and the derivation
 * is one line that says what it removes. If the server widens the set, this
 * widens with it; if it narrows it, this is the place that has to be revisited,
 * which is preferable to the failure where the two lists quietly disagree.
 */
const ASSIGNABLE_STATUSES = USER_STATUSES.filter((status) => status !== 'invited');

const STATUS_LABELS = {
  active: 'Active',
  suspended: 'Suspended',
  deactivated: 'Deactivated',
};

/**
 * What each status actually does, at the moment the operator picks it.
 *
 * This is not filler. The distinction that matters is that `suspended` and
 * `deactivated` take effect **immediately** rather than at token expiry:
 * `middleware/authenticate.js` re-reads the user on every authenticated request
 * and refuses anything whose status is not `active`, so the account stops working
 * on its next call from any live session on any device. An operator who believes
 * a suspension is queued until a session expires will tell the school something
 * untrue, and the school's own observation ("they are still logged in") will be
 * read as a bug rather than as a lag.
 */
const STATUS_EFFECT = {
  active:
    'Restores sign-in. Any live session works again immediately.',
  suspended:
    'Signs them out of every device on their next request. Nothing is deleted — the account and its records stay, and this can be undone from here.',
  deactivated:
    'Also blocks sign-in, and is the state to use for somebody who has left. Unlike a suspension nothing here reopens it; restoring access is a deliberate act.',
};

/**
 * Change an account's status.
 *
 * **Hiding the controls for the platform owner rather than disabling them**, and
 * the distinction matters: a greyed-out button reports a permission problem, and
 * the truth is that this write is refused for *every* caller because the target is
 * the account that defines the deployment
 * (`users.service.js:110`, `refusePlatformOwner`). So the screen says the account
 * is managed by the server environment — which is also the only thing that would
 * ever change it, a redeploy with different environment variables.
 *
 * `onConfirm(status)` returns `{ ok, error }` and does not throw, per the house
 * convention: a refusal leaves the dialog open on the operator's choice.
 */
const UserStatusDialog = ({ open, user, onClose, onConfirm, isProtected = false }) => {
  const [nextStatus, setNextStatus] = useState('active');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState(null);

  useEffect(() => {
    if (!open) return;
    // `invited` is not in `ASSIGNABLE_STATUSES`, and neither is `super_admin`'s
    // notion of status — so the fallback is the only choice there is for an
    // account currently in a state the platform cannot re-select.
    setNextStatus(ASSIGNABLE_STATUSES.includes(user?.status) ? user.status : 'active');
    setFormError(null);
    setBusy(false);
  }, [open, user]);

  if (!open || !user) return null;

  const unchanged = nextStatus === user.status;

  const submit = async () => {
    if (unchanged || busy) {
      if (unchanged) onClose?.();
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      const result = await onConfirm(nextStatus);
      if (result?.ok) onClose?.();
      else setFormError(result?.error || 'That account status could not be changed.');
    } catch (error) {
      setFormError(error?.message || 'That account status could not be changed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Change this account’s status"
      description={
        isProtected
          ? `${user.name} · managed by the server environment`
          : `${user.name} · ${user.email || 'no email on file'} · currently ${STATUS_LABELS[user.status] || user.status || 'unknown'}`
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
            disabled={busy || unchanged || isProtected}
            className={`rounded-xl px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors disabled:opacity-60 ${
              nextStatus === 'active' ? 'bg-brand-700 hover:bg-brand-800' : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {busy
              ? 'Saving…'
              : nextStatus === 'active'
                ? 'Restore access'
                : nextStatus === 'suspended'
                  ? 'Suspend account'
                  : 'Deactivate account'}
          </button>
        </>
      }
    >
      {formError && <FormAlert tone="error">{formError}</FormAlert>}

      {isProtected ? (
        <FormAlert tone="info">
          This is the platform owner account and its status cannot be changed from the console.
        </FormAlert>
      ) : (
        <div className={formError ? 'mt-3' : ''}>
          <SelectField
            label="Status"
            value={nextStatus}
            onChange={(event) => setNextStatus(event.target.value)}
            disabled={busy}
          >
            {ASSIGNABLE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status] || status}
              </option>
            ))}
          </SelectField>

          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2.5 text-[11px] font-semibold leading-relaxed text-slate-500">
            {STATUS_EFFECT[nextStatus] || ''}
          </p>

          {/*
            The blast radius, named. Both non-active states reach every session on
            every device at once, which is the part that is not obvious from the
            word "suspend", and it is the part a school will ask about.
          */}
          {nextStatus !== 'active' && (
            <p className="mt-2 text-[11px] font-semibold leading-relaxed text-amber-700">
              This takes effect on their next request, not at the end of their session, and it
              is recorded in the activity log with your account as the actor.
            </p>
          )}
        </div>
      )}
    </Modal>
  );
};

export { ASSIGNABLE_STATUSES, STATUS_EFFECT, STATUS_LABELS };
export default UserStatusDialog;