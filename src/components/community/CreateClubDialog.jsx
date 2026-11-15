import React, { useCallback, useMemo, useState } from 'react';
import { Dumbbell, GraduationCap, Laptop, LoaderCircle, Palette, Users } from 'lucide-react';
import Modal from '../common/Modal';
import { Field, FormAlert, TextareaField } from '../common/FormField';
import { useToast } from '../../hooks/useToast';

/**
 * Create Club dialog.
 *
 * ## Information architecture
 *
 * Three numbered sections, ordered by the sequence the user actually decides
 * in — not by data type:
 *
 *   01 Identity        Name, Description          (what it is)
 *   02 Classification  Category, Privacy        (what kind, who can see it)
 *   03 Access          Roles, Club password      (who can get in)
 *
 * Identity → Classification → Access puts the two pure-policy fields
 * (Privacy, Roles) adjacent, so the relationship between them is visible
 * instead of being separated by a password field. The numbered headers give
 * the eye four fixed anchors in a scrolling panel, which is what makes a
 * long form feel short.
 *
 * ## Primitives, not re-implementations
 *
 * The shell is the shared `Modal` (portal, Escape, focus management, scroll
 * lock, ARIA, stable header/body/footer tree) and every control is a shared
 * `Field`/`TextareaField`. The previous version hand-rolled all of it and
 * was missing Escape, focus entry, scroll lock and a portal — each of which
 * `Modal` already solves.
 *
 * ## The mount invariant
 *
 * The role grid is toggled with the `hidden` class, never by conditional
 * rendering. Inserting or removing an element in the middle of the tree
 * remounts the sibling below it and kills focus in the field the user is
 * typing into. `InviteTeamMemberDialog` documents the same bug; do not
 * reintroduce it here.
 */

const CATEGORIES = [
  { value: 'academic', label: 'Academic', icon: GraduationCap },
  { value: 'hobby', label: 'Hobby', icon: Palette },
  { value: 'sports', label: 'Sports', icon: Dumbbell },
  { value: 'tech', label: 'Tech', icon: Laptop },
];

const ROLES = [
  { value: 'teacher', label: 'Teachers' },
  { value: 'accountant', label: 'Bursar (Accountant)' },
  { value: 'school_admin', label: 'School Admin' },
  { value: 'student', label: 'Students' },
];

const ALL_ROLE_VALUES = ROLES.map((r) => r.value);

const PRIVACY = [
  { value: 'public', label: 'Public' },
  { value: 'private', label: 'Private' },
];

// Mirrors `createClubSchema` in Backend/src/validations/community.validation.js.
// The client enforces the same limits so a violation is caught before a
// round-trip that would only return a generic 422.
const LIMITS = { nameMax: 100, descriptionMax: 2000, passwordMin: 4, passwordMax: 128 };

const buildInitialState = (club = null) => {
  if (!club) {
    return {
      name: '',
      description: '',
      category: 'academic',
      privacy: 'public',
      password: '',
      permissionMode: 'all',
      selectedRoles: new Set(ALL_ROLE_VALUES),
    };
  }

  const roles = Array.isArray(club.eligibleRoles) ? club.eligibleRoles : [];
  const isAll = roles.length === ALL_ROLE_VALUES.length;

  return {
    name: club.name || '',
    description: club.description || '',
    category: club.category || 'academic',
    privacy: club.privacy || 'public',
    // The stored hash is never sent to the client (`password` is `select: false`
    // on the model), so this is always blank on edit. Blank means "unchanged".
    password: '',
    permissionMode: isAll ? 'all' : 'select',
    selectedRoles: new Set(roles),
  };
};

const SectionHeader = ({ step, title, description }) => (
  <div className="mb-3">
    <div className="flex items-baseline gap-2">
      <span className="text-[11px] font-extrabold tabular-nums text-brand-700">{step}</span>
      <h3 className="text-[11px] font-extrabold uppercase tracking-wide text-slate-400">{title}</h3>
    </div>
    <p className="mt-0.5 text-[12px] font-medium leading-snug text-slate-500">{description}</p>
  </div>
);

/**
 * A single selectable card backed by a real radio input.
 *
 * Using a native `<input type="radio">` rather than a styled `<div>` means
 * arrow-key navigation, form semantics and screen-reader announcement come
 * for free. The input is visually hidden but remains the interactive
 * element, and the card is its `<label>`.
 *
 * `layout="row"` is a real prop, not a class override: flex direction and
 * padding are set by the branch, so callers never have to fight the base
 * classes with `!` important modifiers.
 */
const RadioCard = ({
  name,
  value,
  checked,
  onChange,
  icon: Icon,
  label,
  layout = 'tile',
  className = '',
}) => (
  <label
    className={`flex cursor-pointer select-none rounded-xl border transition-colors ${
      layout === 'row'
        ? 'items-center justify-start gap-2 px-3 py-2.5'
        : 'flex-col items-center justify-center gap-1.5 px-2 py-3 text-center'
    } ${
      checked
        ? 'border-brand-600 bg-brand-50/60 ring-1 ring-brand-600'
        : 'border-slate-200 bg-white hover:border-slate-300'
    } ${className}`}
  >
    <input
      type="radio"
      name={name}
      value={value}
      checked={checked}
      onChange={onChange}
      className="sr-only"
    />
    {Icon && (
      <Icon
        className={`${layout === 'row' ? 'h-4 w-4' : 'h-5 w-5'} ${
          checked ? 'text-brand-700' : 'text-slate-400'
        }`}
        aria-hidden="true"
      />
    )}
    <span
      className={`text-[12px] font-bold leading-tight ${
        checked ? 'text-brand-800' : 'text-slate-600'
      }`}
    >
      {label}
    </span>
  </label>
);

const CreateClubDialog = ({ open, onClose, onSubmit, club = null }) => {
  const { success } = useToast();
  const isEdit = !!club;
  const [form, setForm] = useState(() => buildInitialState(club));
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [busy, setBusy] = useState(false);
  // Tracks whether the user has interacted with the role selection at all, so
  // the "at least one role" error is only shown after they have had a chance
  // to make a choice — not the instant the mode flips.
  const [rolesTouched, setRolesTouched] = useState(false);
  // Edit only: clearing the club password is a distinct action from leaving the
  // field blank, which means "unchanged". Needs its own control.
  const [removePassword, setRemovePassword] = useState(false);
  // The club the form was seeded from. Re-seeding is keyed on this rather than on
  // a `key` prop on the dialog, because remounting would destroy focus in the
  // field the user is typing into (see FormField's mount-invariant note).
  const [seededFor, setSeededFor] = useState(club?._id || null);

  if (open && (club?._id || null) !== seededFor) {
    setSeededFor(club?._id || null);
    setForm(buildInitialState(club));
    setErrors({});
    setServerError(null);
    setRolesTouched(false);
    setRemovePassword(false);
  }

  const { name, description, category, privacy, password, permissionMode, selectedRoles } = form;

  const setField = useCallback((key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  }, []);

  const setMode = useCallback((mode) => {
    setRolesTouched(false);
    setForm((prev) => ({
      ...prev,
      permissionMode: mode,
      // Switching to "Everyone" keeps the previous selection intact; switching
      // back restores it rather than starting from nothing.
      selectedRoles: mode === 'all' ? new Set(ALL_ROLE_VALUES) : prev.selectedRoles,
    }));
  }, []);

  const toggleRole = useCallback((roleValue) => {
    setRolesTouched(true);
    setForm((prev) => {
      const next = new Set(prev.selectedRoles);
      if (next.has(roleValue)) next.delete(roleValue);
      else next.add(roleValue);
      return { ...prev, selectedRoles: next };
    });
  }, []);

  const selectAllRoles = useCallback(() => {
    setRolesTouched(true);
    setForm((prev) => ({ ...prev, selectedRoles: new Set(ALL_ROLE_VALUES) }));
  }, []);

  const clearRoles = useCallback(() => {
    setRolesTouched(true);
    setForm((prev) => ({ ...prev, selectedRoles: new Set() }));
  }, []);

  const resetAll = useCallback(() => {
    setForm(buildInitialState(club));
    setErrors({});
    setServerError(null);
    setRolesTouched(false);
    setRemovePassword(false);
    setSeededFor(club?._id || null);
  }, [club]);

  const handleClose = useCallback(() => {
    if (busy) return;
    // Reset on close, matching InviteTeamMemberDialog.handleClose, so a stale
    // half-filled form never greets the user the next time the dialog opens.
    resetAll();
    onClose();
  }, [busy, onClose, resetAll]);

  const isSubmittable = useMemo(() => {
    if (!name.trim()) return false;
    if (password && password.length < LIMITS.passwordMin) return false;
    if (permissionMode === 'select' && selectedRoles.size === 0) return false;
    return true;
  }, [name, password, permissionMode, selectedRoles]);

  const validate = useCallback(() => {
    const next = {};
    const trimmedName = name.trim();
    if (!trimmedName) next.name = 'Give the club a name.';
    else if (trimmedName.length > LIMITS.nameMax) {
      next.name = `Keep the name under ${LIMITS.nameMax} characters.`;
    }
    if (password && password.length < LIMITS.passwordMin) {
      next.password = `Use at least ${LIMITS.passwordMin} characters, or leave it blank.`;
    }
    if (permissionMode === 'select' && selectedRoles.size === 0) {
      next.roles = 'Pick at least one role, or choose “Everyone at school”.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }, [name, password, permissionMode, selectedRoles]);

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      setServerError(null);
      if (!validate()) return;

      setBusy(true);
      try {
        const eligibleRoles =
          permissionMode === 'all' ? ALL_ROLE_VALUES : Array.from(selectedRoles);

        if (isEdit) {
          // `removePassword` is separate from `password` because blank means
          // "leave unchanged" — overloading it to also mean "clear" would make
          // removal impossible to express.
          await onSubmit({
            name: name.trim(),
            description: description.trim(),
            category,
            privacy,
            eligibleRoles,
            password: password.trim() || undefined,
            removePassword: removePassword || undefined,
          });
          success(`${name.trim()} was updated.`);
        } else {
          await onSubmit({
            name: name.trim(),
            description: description.trim(),
            category,
            privacy,
            eligibleRoles,
            password: password.trim() || null,
          });
          success(`${name.trim()} was created.`);
        }

        resetAll();
        onClose();
      } catch (err) {
        const code = err?.response?.data?.code;
        const message =
          err?.response?.data?.message ||
          err?.message ||
          (isEdit
            ? 'Could not save your changes. Please try again.'
            : 'Could not create the club. Please try again.');

        // A club that vanished, or one whose ownership changed under us, is not
        // something the user can fix in the form — close it and let the list
        // refresh show the current state.
        if (code === 'CLUB_NOT_FOUND') {
          setServerError(message);
          resetAll();
          onClose();
          return;
        }

        setServerError(message);
      } finally {
        setBusy(false);
      }
    },
    [
      validate,
      onSubmit,
      isEdit,
      permissionMode,
      selectedRoles,
      name,
      description,
      category,
      privacy,
      password,
      removePassword,
      success,
      resetAll,
      onClose,
    ]
  );

  const privacyHelp =
    privacy === 'private'
      ? 'Hidden from the club list. Members join with an invite link or the password below.'
      : 'Anyone at school can find this club and request to join.';

  const passwordHelp =
    privacy === 'private'
      ? 'Recommended for private clubs — members need both the link and this password.'
      : 'Members will need this password to join. Leave blank for no password.';

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={isEdit ? 'Edit club' : 'Create a club'}
      description={
        isEdit
          ? 'Update the details below. Only you, as the club’s creator, can change these.'
          : 'Start with the basics. You can change any of this later.'
      }
      size="lg"
      bodyClassName="scrollbar-none"
      footer={
        <>
          <button
            type="button"
            onClick={handleClose}
            disabled={busy}
            className="rounded-lg px-4 py-2 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="create-club-form"
            disabled={busy || !isSubmittable}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-700 px-4 py-2 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {busy ? (isEdit ? 'Saving…' : 'Creating…') : isEdit ? 'Save changes' : 'Create club'}
          </button>
        </>
      }
    >
      <form id="create-club-form" onSubmit={handleSubmit} noValidate className="space-y-6">
        {serverError && <FormAlert tone="error">{serverError}</FormAlert>}

        {/* ── 01 Identity ─────────────────────────────────────────────── */}
        <section>
          <SectionHeader
            step="01"
            title="Identity"
            description="What the club is called and what it is for."
          />
          <div className="space-y-3">
            <Field
              label="Name"
              required
              icon={Users}
              hint="Visible to your school"
              autoComplete="off"
              placeholder="e.g. Robotics Club"
              maxLength={LIMITS.nameMax}
              value={name}
              onChange={(e) => setField('name', e.target.value)}
              error={errors.name}
            />
            <TextareaField
              label="Description"
              hint={`${description.length}/${LIMITS.descriptionMax}`}
              rows={3}
              maxLength={LIMITS.descriptionMax}
              placeholder="What is this club about?"
              value={description}
              onChange={(e) => setField('description', e.target.value)}
            />
          </div>
        </section>

        {/* ── 02 Classification ───────────────────────────────────────── */}
        <section>
          <SectionHeader
            step="02"
            title="Classification"
            description="The kind of club it is, and who can see it."
          />
          <div className="space-y-4">
            <fieldset>
              <legend className="mb-1.5 text-[11px] font-semibold text-slate-700">
                Category
              </legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {CATEGORIES.map((c) => (
                  <RadioCard
                    key={c.value}
                    name="category"
                    value={c.value}
                    checked={category === c.value}
                    onChange={() => setField('category', c.value)}
                    icon={c.icon}
                    label={c.label}
                    className="h-[68px]"
                  />
                ))}
              </div>
            </fieldset>

            <fieldset aria-describedby="privacy-help">
              <legend className="mb-1.5 text-[11px] font-semibold text-slate-700">
                Privacy
              </legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {PRIVACY.map((p) => (
                  <RadioCard
                    key={p.value}
                    name="privacy"
                    value={p.value}
                    checked={privacy === p.value}
                    onChange={() => setField('privacy', p.value)}
                    label={p.label}
                    layout="row"
                  />
                ))}
              </div>
              <p
                id="privacy-help"
                className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-[11.5px] font-medium leading-snug text-slate-500"
              >
                {privacyHelp}
              </p>
            </fieldset>
          </div>
        </section>

        {/* ── 03 Access ───────────────────────────────────────────────── */}
        <section>
          <SectionHeader
            step="03"
            title="Access"
            description="Decide who can join, and whether a password is needed."
          />
          <div className="space-y-4">
            <fieldset aria-describedby={errors.roles ? 'roles-error' : undefined}>
              <legend className="mb-1.5 text-[11px] font-semibold text-slate-700">
                Who can join
              </legend>
              <div className="space-y-2">
                {[
                  {
                    value: 'all',
                    label: 'Everyone at school',
                    help: 'Teachers, bursars, admins and students can all join.',
                  },
                  {
                    value: 'select',
                    label: 'Only specific roles',
                    help: 'Choose which roles are allowed to join.',
                  },
                ].map((option) => (
                  <label
                    key={option.value}
                    className={`flex cursor-pointer select-none items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
                      permissionMode === option.value
                        ? 'border-brand-600 bg-brand-50/60'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="permissionMode"
                      value={option.value}
                      checked={permissionMode === option.value}
                      onChange={() => setMode(option.value)}
                      className="mt-0.5 h-4 w-4 shrink-0 border-slate-300 text-brand-700 focus:ring-brand-700/30"
                    />
                    <span className="min-w-0">
                      <span className="block text-[13px] font-bold text-ink">{option.label}</span>
                      <span className="mt-0.5 block text-[11.5px] font-medium leading-snug text-slate-500">
                        {option.help}
                      </span>
                    </span>
                  </label>
                ))}
              </div>

              {/* Kept mounted at all times; only visibility flips. Removing it
                  from the tree would remount the password field below and steal
                  focus mid-typing. */}
              <div className={permissionMode === 'select' ? 'mt-3 block' : 'hidden'}>
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[11px] font-extrabold uppercase tracking-wide text-slate-400">
                      Roles allowed to join
                    </span>
                    <span className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={selectAllRoles}
                        className="text-[11px] font-extrabold text-brand-700 hover:underline"
                      >
                        Select all
                      </button>
                      <span className="text-slate-300">·</span>
                      <button
                        type="button"
                        onClick={clearRoles}
                        className="text-[11px] font-extrabold text-slate-500 hover:underline"
                      >
                        Clear
                      </button>
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
                    {ROLES.map((role) => (
                      <label
                        key={role.value}
                        className="flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-1.5 py-1.5 hover:bg-white"
                      >
                        <input
                          type="checkbox"
                          checked={selectedRoles.has(role.value)}
                          onChange={() => toggleRole(role.value)}
                          className="h-4 w-4 shrink-0 rounded border-slate-300 text-brand-700 focus:ring-brand-700/30"
                        />
                        <span className="text-[12px] font-semibold text-slate-700">
                          {role.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {errors.roles && (
                <p id="roles-error" role="alert" className="mt-1.5 text-[11px] font-semibold text-red-600">
                  {errors.roles}
                </p>
              )}
              {!errors.roles && rolesTouched && selectedRoles.size === 0 && permissionMode === 'select' && (
                <p className="mt-1.5 text-[11px] font-semibold text-amber-600">
                  Select at least one role to continue.
                </p>
              )}
            </fieldset>

            <Field
              label={isEdit ? 'New password' : 'Club password'}
              hint="Optional"
              type="password"
              autoComplete="new-password"
              placeholder={
                isEdit ? 'Leave blank to keep the current password' : 'Set a password to protect this club'
              }
              maxLength={LIMITS.passwordMax}
              value={password}
              onChange={(e) => setField('password', e.target.value)}
              error={errors.password}
            />
            {isEdit ? (
              <div className="-mt-2 space-y-2">
                <p className="text-[11.5px] font-medium leading-snug text-slate-500">
                  Leave this blank to keep the current password. Enter a new one to replace it.
                </p>
                {removePassword ? (
                  <div className="flex items-center gap-2">
                    <span className="text-[11.5px] font-semibold text-amber-700">
                      The password will be removed when you save.
                    </span>
                    <button
                      type="button"
                      onClick={() => setRemovePassword(false)}
                      className="text-[11px] font-extrabold text-brand-700 hover:underline"
                    >
                      Undo
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setRemovePassword(true);
                      setField('password', '');
                    }}
                    className="text-[11px] font-extrabold text-red-600 hover:underline"
                  >
                    Remove password
                  </button>
                )}
              </div>
            ) : (
              <p className="-mt-2 text-[11.5px] font-medium leading-snug text-slate-500">
                {passwordHelp}
              </p>
            )}
          </div>
        </section>
      </form>
    </Modal>
  );
};

export default CreateClubDialog;