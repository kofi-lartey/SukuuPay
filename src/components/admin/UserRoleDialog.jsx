import React, { useEffect, useState } from 'react';
import Modal from '../common/Modal';
import { FormAlert, SelectField } from '../common/FormField';
import { ASSIGNABLE_ROLES } from '../../services/admin';
import { roleLabel } from '../../utils/constants';

/**
 * The consequence of each role, in words.
 *
 * A role is not a label — it is the boundary around a school's fee data — and the
 * operator choosing between "school administrator" and "viewer" has no way to tell
 * from the option text what they are handing over. `AdminUsers.jsx` already writes
 * these out for the same reason; they are repeated here rather than imported
 * because that file is on its way out (this dialog and the users list replace it),
 * and a shared constant imported from a page that is being deleted is a constant
 * with a shorter life than the code that uses it.
 */
const ROLE_EFFECT = {
  school_admin: 'Full governance of their school’s records, staff and settings.',
  accountant: 'Can take payments and read fee records, but cannot change school settings.',
  teacher: 'Can record marks and see their own classes’ payments. No school settings, no exports.',
  viewer: 'Read-only. Use this for anyone who only needs to see.',
};

/**
 * Change somebody's role.
 *
 * **The role list is `ASSIGNABLE_ROLES` and that is the server's rule, not a
 * preference.** The brief asked for "change any user's role"; this system does not
 * allow that, and the reason is structural rather than procedural. There is exactly
 * one platform owner, provisioned from the environment by
 * `Backend/src/boot/ensureSuperAdmin.js`, and no endpoint may create or promote a
 * second one. The copy of that rule lives in `ASSIGNABLE_ROLES`
 * (`Backend/src/validators/userValidators.js`) — `users.service.js:282` refuses
 * `super_admin` as an input before it looks at anything else — and
 * `Backend/tests/platformOwner.test.js` enforces it. So the list this component
 * iterates is imported from `services/admin.js`, which mirrors that array; it is
 * not a filtered copy of `USER_ROLES` filtered here, because a UI-side filter is
 * one edit away from being wrong and the failure is a 403 the operator reads as a
 * permissions bug on their own session.
 *
 * **The list is a filter, not an assignment rule — the two lists differ on
 * purpose.** `UsersList`'s *read* filter offers all five `USER_ROLES`, because the
 * owner's own row has to be findable; this *write* picker offers four. A row that
 * can be found but not edited is the correct shape: the owner is a fact of the
 * deployment, and hiding it from the filter would hide it from the console.
 *
 * **The platform owner's controls are hidden, not disabled.** A greyed-out button
 * says "you lack permission", and that is not the fact here — the server refuses
 * these writes for every caller including the owner, because `refusePlatformOwner`
 * (`users.service.js:110`) is about the *target*, not the actor. The parent's
 * `isProtected` prop carries that decision down, and the reason is printed on the
 * screen rather than left in a tooltip.
 *
 * `onConfirm(role)` must resolve to `{ ok, error }` and must not throw. That is the
 * house convention (`AdminSchools.jsx`, `hooks/useUsers.js`): the caller branches
 * on the result so a refusal leaves this dialog open with the operator's choice
 * still in it, instead of closing over what they picked.
 */
const UserRoleDialog = ({ open, user, onClose, onConfirm, isProtected = false }) => {
  const [nextRole, setNextRole] = useState('teacher');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState(null);

  useEffect(() => {
    if (!open) return;
    // Preselect the role they already hold, so the dialog opens on a no-op and a
    // careless Enter cannot demote somebody by accident. `ASSIGNABLE_ROLES.includes`
    // guards the owner, whose `super_admin` is not in the list at all — without it
    // the picker would silently open on "teacher" for the one account whose real
    // role it cannot express.
    setNextRole(ASSIGNABLE_ROLES.includes(user?.role) ? user.role : ASSIGNABLE_ROLES[0]);
    setFormError(null);
    setBusy(false);
  }, [open, user]);

  if (!open || !user) return null;

  const unchanged = nextRole === user.role;

  const submit = async () => {
    if (unchanged || busy) {
      if (unchanged) onClose?.();
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      const result = await onConfirm(nextRole);
      if (result?.ok) onClose?.();
      else setFormError(result?.error || 'That role could not be assigned.');
    } catch (error) {
      // Defensive only: `onConfirm` is contractually non-throwing. A confirm
      // handler that throws takes the dialog down with an empty screen instead of
      // a message, so the catch is here rather than nowhere.
      setFormError(error?.message || 'That role could not be assigned.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Change this person’s role"
      description={
        isProtected
          ? `${user.name} · managed by the server environment`
          : `${user.name} · ${user.email || 'no email on file'} · currently ${roleLabel(user.role).toLowerCase()}`
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
            className="rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 disabled:opacity-60"
          >
            {busy ? 'Saving…' : 'Change role'}
          </button>
        </>
      }
    >
      {formError && <FormAlert tone="error">{formError}</FormAlert>}

      {isProtected ? (
        <FormAlert tone="info">
          This is the platform owner account. It is provisioned from the server environment and
          cannot be re-roled, suspended or deactivated through any API — demoting it would leave
          the deployment with nobody able to administer it.
        </FormAlert>
      ) : (
        <div className={formError ? 'mt-3' : ''}>
          <SelectField
            label="Role"
            value={nextRole}
            onChange={(event) => setNextRole(event.target.value)}
            disabled={busy}
          >
            {ASSIGNABLE_ROLES.map((role) => (
              <option key={role} value={role}>
                {roleLabel(role)}
              </option>
            ))}
          </SelectField>

          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2.5 text-[11px] font-semibold leading-relaxed text-slate-500">
            {ROLE_EFFECT[nextRole] || ''}
          </p>
        </div>
      )}

      {/*
        Why the fifth role is missing, said out loud. An operator who knows the role
        exists and cannot find it will otherwise assume it is a permissions problem
        on their own session, and go looking for a setting that does not exist.
      */}
      <p className="mt-3 text-[11px] font-semibold leading-relaxed text-slate-400">
        Platform admin is not offered: SukuuPay has exactly one, it is defined by the
        server&rsquo;s environment, and no endpoint can grant it.
      </p>
    </Modal>
  );
};

export { ROLE_EFFECT };
export default UserRoleDialog;