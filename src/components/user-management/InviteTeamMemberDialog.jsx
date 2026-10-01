import React, { useState } from 'react';
import { AtSign, Info, KeyRound, UserPlus, UserRound } from 'lucide-react';
import Modal from '../common/Modal';
import { Field, SelectField, FormAlert } from '../common/FormField';
import { POSITIONS, OTHER_POSITION, SIGNUP_ROLES } from '../../utils/constants';

/**
 * The invitation form.
 *
 * Two required fields, and the sizing follows from that: a school admin inviting
 * a colleague knows their name and their work email and, often, not much else
 * reliable. The fields that used to be mandatory — phone in particular — are
 * optional and tucked below the two that matter, because a form that leads with
 * a phone number tells the user this is a significant act with a lot to get
 * wrong. It is not: it is typing two things and pressing a button.
 *
 * The panel states what is about to happen, in the order it happens. SukuuPay
 * will create the account, mint a temporary password, and email both to that
 * address. An admin handing this to a colleague should not have to open the
 * documentation to know what is on its way — and, more importantly, the person
 * who *receives* the mail should not be surprised by a password arriving.
 *
 * There is no password field, and its absence is deliberate. The credential is
 * generated server-side from the School ID (see `utils/defaultPassword.js`);
 * offering a field here would invite a client to believe it gets to choose, and
 * the only client that could act on that belief is one that stores a plaintext
 * password it received.
 *
 * Submit is disabled until the two required fields are valid, and the reason is
 * stated next to the button rather than left to be discovered — a disabled
 * control with no explanation is the most common dead end in an admin form.
 */
const InviteTeamMemberDialog = ({ open, onClose, onInvite, busy = false, schoolName }) => {
  const [form, setForm] = useState({ name: '', email: '', role: 'teacher', position: '', phone: '' });
  // The free text behind the `OTHER_POSITION` sentinel, held separately from
  // `position`. Sharing one field would mean choosing "Other" silently overwrote
  // whatever the user had typed into the phone box, and clearing it again wiped
  // the job title — two unrelated fields fighting over one string.
  const [customPosition, setCustomPosition] = useState('');
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);

  /**
   * `SIGNUP_ROLES` reused as the role list, because it is the same ladder a
   * person picks from when creating their own account — `school_admin`,
   * `accountant`, `teacher`, `viewer` — and `super_admin` is absent from it for
   * the same reason it is absent there: self-service signup must not be able to
   * mint a platform operator. The server refuses that grant independently;
   * matching it here means the dropdown never offers a choice the API rejects.
   */
  const roleOptions = SIGNUP_ROLES;

  const update = (field) => (event) => {
    const { value } = event.target;
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const validate = () => {
    const next = {};
    if (form.name.trim().length < 2) next.name = 'Enter their full name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = 'Enter a valid email address.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setServerError(null);
    if (!validate()) return;

    const result = await onInvite({
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      role: form.role,
      // `OTHER_POSITION` is a sentinel that is never stored; the free text beside
      // it is what gets persisted, matching `User.position`'s unconstrained shape.
      position: form.position === OTHER_POSITION ? customPosition.trim() : form.position,
      phone: form.phone.trim() || undefined,
    });

    if (!result?.ok) {
      setServerError(result?.error?.message || 'Could not send that invitation.');
      return;
    }

    // Closed on success whether or not the email went out. The account exists in
    // both cases, and the caller reports `emailSent: false` as a warning on the
    // row with a resend button — which is a better place to resolve it than
    // inside a dialog the user has already dismissed.
    onClose();
  };

  const handleClose = () => {
    setForm({ name: '', email: '', role: 'teacher', position: '', phone: '' });
    setCustomPosition('');
    setErrors({});
    setServerError(null);
    onClose();
  };

  const ready = form.name.trim().length >= 2 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Invite a team member"
      description={
        schoolName
          ? `They will be added to ${schoolName}.`
          : 'They will be added to your school.'
      }
      footer={
        <>
          <button
            type="button"
            onClick={handleClose}
            disabled={busy}
            className="rounded-lg px-4 py-2 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="invite-team-member-form"
            disabled={busy || !ready}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-700 px-4 py-2 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            {busy ? 'Sending…' : 'Send invitation'}
          </button>
        </>
      }
    >
      <form id="invite-team-member-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        {serverError && <FormAlert tone="error">{serverError}</FormAlert>}

        <Field
          label="Full name"
          required
          icon={UserRound}
          autoComplete="off"
          placeholder="e.g. Rev. B. Quaye"
          value={form.name}
          onChange={update('name')}
          error={errors.name}
        />

        <Field
          label="Email address"
          required
          type="email"
          icon={AtSign}
          autoComplete="off"
          placeholder="e.g. b.quaye@prampramschool.edu.gh"
          hint="Where the credentials are sent"
          value={form.email}
          onChange={update('email')}
          error={errors.email}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField label="Role" value={form.role} onChange={update('role')}>
            {roleOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Position"
            value={form.position}
            onChange={update('position')}
            hint="Optional"
          >
            <option value="">Not specified</option>
            {POSITIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectField>
        </div>

        {form.position === OTHER_POSITION ? (
          <Field
            label="Job title"
            autoComplete="off"
            placeholder="e.g. Assistant Bursar"
            value={customPosition}
            onChange={(event) => setCustomPosition(event.target.value)}
          />
        ) : (
          <Field
            label="Phone number"
            type="tel"
            autoComplete="off"
            placeholder="+233 24 000 0000"
            hint="Optional"
            value={form.phone}
            onChange={update('phone')}
          />
        )}

        {/*
          What the recipient gets. Stated before the button is pressed, not
          after, because once the mail is out the admin's only remedy is a
          resend — and a surprise at that point is an incident.
        */}
        <div className="rounded-xl border border-brand-200 bg-brand-50/60 p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-brand-700">
              <KeyRound className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-extrabold text-brand-900">What happens next</p>
              <p className="mt-1 text-[12px]/[17px] font-medium leading-relaxed text-brand-800">
                We create their account and generate a temporary password from your school ID, then
                email both to the address above — along with your name, so they know who invited
                them. They change the password after signing in.
              </p>
            </div>
          </div>
        </div>

        <p className="flex items-start gap-2 text-[11px]/[16px] font-medium text-slate-500">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            Only you and the recipient will ever see the temporary password. If the email does not
            arrive, re-send it from the team list — re-sending replaces the password.
          </span>
        </p>
      </form>
    </Modal>
  );
};

export default InviteTeamMemberDialog;