import React, { useCallback, useMemo, useState } from 'react';
import { AtSign, Info, KeyRound, UserPlus, UserRound } from 'lucide-react';
import Modal from '../common/Modal';
import { Field, SelectField, FormAlert } from '../common/FormField';
import { POSITIONS, OTHER_POSITION, SIGNUP_ROLES } from '../../utils/constants';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const InviteTeamMemberDialog = ({
  open,
  onClose,
  onInvite,
  busy = false,
  schoolName,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('teacher');
  const [position, setPosition] = useState('');
  const [customPosition, setCustomPosition] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);

  const handleName = useCallback((e) => {
    setName(e.target.value);
    setErrors((c) => (c.name ? { ...c, name: undefined } : c));
  }, []);

  const handleEmail = useCallback((e) => {
    setEmail(e.target.value);
    setErrors((c) => (c.email ? { ...c, email: undefined } : c));
  }, []);

  const handleRole = useCallback((e) => setRole(e.target.value), []);

  const handlePosition = useCallback((e) => setPosition(e.target.value), []);

  const handleCustomPosition = useCallback(
    (e) => setCustomPosition(e.target.value),
    []
  );

  const handlePhone = useCallback((e) => setPhone(e.target.value), []);

  const isOtherPosition = position === OTHER_POSITION;

  const validate = useCallback(() => {
    const next = {};
    if (name.trim().length < 2) next.name = 'Enter their full name.';
    if (!EMAIL_RE.test(email.trim())) next.email = 'Enter a valid email address.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }, [name, email]);

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      setServerError(null);
      if (!validate()) return;

      const result = await onInvite({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role,
        position: isOtherPosition ? customPosition.trim() : position,
        phone: phone.trim() || undefined,
      });

      if (!result?.ok) {
        setServerError(
          result?.error?.message || 'Could not send that invitation.'
        );
        return;
      }

      onClose();
    },
    [
      validate,
      onInvite,
      name,
      email,
      role,
      position,
      isOtherPosition,
      customPosition,
      phone,
      onClose,
    ]
  );

  const handleClose = useCallback(() => {
    setName('');
    setEmail('');
    setRole('teacher');
    setPosition('');
    setCustomPosition('');
    setPhone('');
    setErrors({});
    setServerError(null);
    onClose();
  }, [onClose]);

  const ready = useMemo(
    () => name.trim().length >= 2 && EMAIL_RE.test(email.trim()),
    [name, email]
  );

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
      <form
        id="invite-team-member-form"
        onSubmit={handleSubmit}
        noValidate
        className="space-y-4"
      >
        {serverError && <FormAlert tone="error">{serverError}</FormAlert>}

        <Field
          label="Full name"
          required
          icon={UserRound}
          autoComplete="off"
          placeholder="e.g. Rev. B. Quaye"
          value={name}
          onChange={handleName}
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
          value={email}
          onChange={handleEmail}
          error={errors.email}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField label="Role" value={role} onChange={handleRole}>
            {SIGNUP_ROLES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Position"
            value={position}
            onChange={handlePosition}
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

        {/*
          Both of these blocks stay mounted at all times. Only their
          visibility flips via the `hidden` class. If we used
          `{isOtherPosition && <Field ... />}`, React would insert or
          remove an element in the middle of the tree, and the sibling
          below it would be remounted on every toggle. That is exactly
          what caused the phone field to lose focus.
        */}
        <div className={isOtherPosition ? 'block' : 'hidden'}>
          <Field
            label="Job title"
            autoComplete="off"
            placeholder="e.g. Assistant Bursar"
            value={customPosition}
            onChange={handleCustomPosition}
          />
        </div>

        <div className={isOtherPosition ? 'hidden' : 'block'}>
          <Field
            label="Phone number"
            type="tel"
            autoComplete="off"
            placeholder="+233 24 000 0000"
            hint="Optional"
            value={phone}
            onChange={handlePhone}
          />
        </div>

        <div className="rounded-xl border border-brand-200 bg-brand-50/60 p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-brand-700">
              <KeyRound className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-extrabold text-brand-900">
                What happens next
              </p>
              <p className="mt-1 text-[12px]/[17px] font-medium leading-relaxed text-brand-800">
                We create their account and generate a temporary password from
                your school ID, then email both to the address above — along
                with your name, so they know who invited them. They change the
                password after signing in.
              </p>
            </div>
          </div>
        </div>

        <p className="flex items-start gap-2 text-[11px]/[16px] font-medium text-slate-500">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            Only you and the recipient will ever see the temporary password. If
            the email does not arrive, re-send it from the team list —
            re-sending replaces the password.
          </span>
        </p>
      </form>
    </Modal>
  );
};

export default InviteTeamMemberDialog;