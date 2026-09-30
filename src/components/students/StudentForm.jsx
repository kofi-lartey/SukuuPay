import React, { useEffect, useState } from 'react';
import { Field, FormAlert, SelectField } from '../common/FormField';
import MoneyInput from '../common/MoneyInput';
import PhoneInput from '../common/PhoneInput';
import Button from '../common/Button';
import { isValidGhanaPhone } from '../common/PhoneInput';
import { createStudent, updateStudent } from '../../services/students';

const emptyDraft = (classes) => ({
  studentName: '',
  studentClass: classes[0] || '',
  gender: '',
  dateOfBirth: '',
  totalOwed: null,
  deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  academicYear: '',
  guardians: [{ parentName: '', relationship: 'guardian', phone: '', email: '', isPrimary: true }],
});

/**
 * Add or edit one student.
 *
 * **The fee field is a `MoneyInput`,** which shows cedi and sends pesewas. That
 * is the whole point: the API takes an integer number of pesewas, so a plain
 * number field will eventually be given `850` meaning GH₵ 850, and the student's
 * balance is then a hundredth of what the school intended with nothing anywhere
 * to catch it. The field is the fix.
 *
 * **Guardians are edited as a list, not a nested form,** because the API replaces
 * the array wholesale and a partial merge is how a guardian silently disappears.
 * Each keeps its `_id` so the server's parent endpoints can still address it.
 *
 * The same component serves create and edit. They are the same fields with the
 * same rules, and two forms would drift — which is how a phone number ends up
 * validated on the way in and not on the way back.
 */
const StudentForm = ({ open, onClose, onSaved, classes = [], student = null }) => {
  const isEdit = Boolean(student);
  const [draft, setDraft] = useState(() => emptyDraft(classes));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setFormError(null);

    if (student) {
      setDraft({
        studentName: student.studentName || '',
        studentClass: student.studentClass || '',
        gender: student.gender || '',
        dateOfBirth: student.dateOfBirth
          ? new Date(student.dateOfBirth).toISOString().slice(0, 10)
          : '',
        totalOwed: student.totalOwed ?? null,
        deadline: student.deadline
          ? new Date(student.deadline).toISOString().slice(0, 10)
          : '',
        academicYear: student.academicYear || '',
        guardians: (student.parents || []).map((guardian) => ({ ...guardian })),
      });
    } else {
      setDraft(emptyDraft(classes));
    }
  }, [open, student, classes]);

  const setField = (patch) => setDraft((current) => ({ ...current, ...patch }));

  const setGuardian = (index, patch) =>
    setDraft((current) => {
      const guardians = current.guardians.map((guardian, i) =>
        i === index ? { ...guardian, ...patch } : guardian
      );
      // Exactly one primary, enforced here so the user sees it rather than
      // discovering it as a server error.
      if (patch.isPrimary) {
        guardians.forEach((guardian, i) => {
          guardian.isPrimary = i === index;
        });
      }
      return { ...current, guardians };
    });

  const validate = () => {
    const next = {};
    if (!draft.studentName || draft.studentName.trim().length < 2) {
      next.studentName = 'Enter the student’s full name';
    }
    if (!draft.studentClass) next.studentClass = 'Choose a class';
    if (!draft.gender) next.gender = 'Choose a gender';

    if (isEdit) {
      // On create, `totalOwed` is required by the API. On edit it is optional —
      // editing a guardian's phone number should not require restating the fee.
      if (draft.totalOwed !== null && draft.totalOwed < 0) {
        next.totalOwed = 'Cannot be negative';
      }
    } else if (draft.totalOwed === null) {
      next.totalOwed = 'Enter the fee for this term';
    }

    if (!draft.deadline) next.deadline = 'Choose a payment deadline';

    const primary = draft.guardians.find((g) => g.isPrimary) || draft.guardians[0];
    if (!primary?.parentName) next.guardianName = 'A guardian name is required';
    if (!primary?.phone) next.guardianPhone = 'A guardian phone is required';
    else if (!isValidGhanaPhone(primary.phone)) {
      next.guardianPhone = 'That is not a valid Ghana number';
    }

    draft.guardians.forEach((guardian, index) => {
      if (guardian.phone && !isValidGhanaPhone(guardian.phone)) {
        next[`guardian${index}Phone`] = 'That is not a valid Ghana number';
      }
    });

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (event) => {
    event.preventDefault();
    setFormError(null);
    if (!validate()) return;

    const primary = draft.guardians.find((g) => g.isPrimary) || draft.guardians[0];

    const payload = {
      studentName: draft.studentName.trim(),
      studentClass: draft.studentClass,
      gender: draft.gender,
      deadline: draft.deadline,
      parents: draft.guardians
        .filter((guardian) => guardian.parentName && guardian.phone)
        .map((guardian) => ({
          // The `_id` has to survive the round trip: the guardian endpoints
          // address a parent by its sub-document id.
          ...(guardian._id ? { _id: guardian._id } : {}),
          parentName: guardian.parentName.trim(),
          relationship: guardian.relationship,
          phone: guardian.phone,
          email: guardian.email || undefined,
          isPrimary: Boolean(guardian.isPrimary),
          isAlive: guardian.isAlive !== false,
        })),
    };

    if (draft.dateOfBirth) payload.dateOfBirth = draft.dateOfBirth;
    if (draft.academicYear) payload.academicYear = draft.academicYear;
    if (draft.totalOwed !== null) payload.totalOwed = draft.totalOwed;

    if (isEdit && !payload.parents.length) {
      setFormError('A student must keep at least one guardian.');
      return;
    }

    setSaving(true);
    try {
      const saved = isEdit
        ? await updateStudent(student._id || student.id, payload)
        : await createStudent(payload);
      onSaved(saved, isEdit);
      onClose();
    } catch (error) {
      setFormError(error.message);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 backdrop-blur-[2px]">
      <form
        onSubmit={submit}
        className="my-8 w-full max-w-2xl rounded-2xl bg-white shadow-2xl"
        aria-label={isEdit ? 'Edit student' : 'Add a student'}
      >
        <header className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-extrabold tracking-tight text-ink">
            {isEdit ? `Edit ${student.studentName}` : 'Add a new student'}
          </h2>
          <p className="text-[12px] font-semibold text-slate-500">
            {isEdit
              ? 'Fees are in cedis. The student number cannot be changed.'
              : 'Fees are in cedis. A guardian is required — reminders go to them.'}
          </p>
        </header>

        <div className="space-y-5 px-6 py-5">
          {formError && <FormAlert>{formError}</FormAlert>}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Full name"
              required
              value={draft.studentName}
              error={errors.studentName}
              onChange={(event) => setField({ studentName: event.target.value })}
              placeholder="e.g. Kwame Mensah"
            />
            <SelectField
              label="Class"
              required
              value={draft.studentClass}
              error={errors.studentClass}
              onChange={(event) => setField({ studentClass: event.target.value })}
            >
              {classes.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </SelectField>

            <SelectField
              label="Gender"
              required
              value={draft.gender}
              error={errors.gender}
              onChange={(event) => setField({ gender: event.target.value })}
            >
              <option value="">Choose…</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </SelectField>

            <Field
              label="Date of birth"
              type="date"
              max={new Date().toISOString().slice(0, 10)}
              value={draft.dateOfBirth}
              onChange={(event) => setField({ dateOfBirth: event.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <MoneyInput
              label="Total owed this term"
              hint="cedis"
              required={!isEdit}
              value={draft.totalOwed}
              error={errors.totalOwed}
              onChange={(value) => setField({ totalOwed: value })}
            />
            <Field
              label="Payment deadline"
              type="date"
              required
              min={new Date().toISOString().slice(0, 10)}
              value={draft.deadline}
              error={errors.deadline}
              onChange={(event) => setField({ deadline: event.target.value })}
            />
            <Field
              label="Academic year"
              hint="optional"
              placeholder="2025/2026"
              value={draft.academicYear}
              onChange={(event) => setField({ academicYear: event.target.value })}
            />
          </div>

          <fieldset className="rounded-xl border border-slate-200 p-4">
            <legend className="px-1 text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
              Guardians
            </legend>

            <div className="space-y-4">
              {draft.guardians.map((guardian, index) => (
                <div key={guardian._id || index} className="space-y-3">
                  {index > 0 && <div className="border-t border-slate-100" />}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Field
                      label={index === 0 ? 'Name' : `Guardian ${index + 1} name`}
                      required={index === 0}
                      value={guardian.parentName}
                      error={index === 0 ? errors.guardianName : undefined}
                      onChange={(event) => setGuardian(index, { parentName: event.target.value })}
                    />
                    <SelectField
                      label="Relationship"
                      value={guardian.relationship}
                      onChange={(event) => setGuardian(index, { relationship: event.target.value })}
                    >
                      <option value="father">Father</option>
                      <option value="mother">Mother</option>
                      <option value="guardian">Guardian</option>
                      <option value="other">Other</option>
                    </SelectField>
                    <PhoneInput
                      label="Phone"
                      required={index === 0}
                      value={guardian.phone}
                      error={errors[`guardian${index}Phone`] || (index === 0 ? errors.guardianPhone : undefined)}
                      onChange={(value) => setGuardian(index, { phone: value })}
                    />
                  </div>

                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-[12px] font-bold text-slate-600">
                      <input
                        type="radio"
                        name="primary-guardian"
                        checked={Boolean(guardian.isPrimary)}
                        onChange={() => setGuardian(index, { isPrimary: true })}
                        className="h-3.5 w-3.5"
                      />
                      Primary contact for reminders
                    </label>

                    {draft.guardians.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setDraft((current) => ({
                            ...current,
                            guardians: current.guardians.filter((_, i) => i !== index),
                          }))
                        }
                        className="text-[12px] font-bold text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  guardians: [
                    ...current.guardians,
                    { parentName: '', relationship: 'guardian', phone: '', email: '' },
                  ],
                }))
              }
              className="mt-3 text-[12px] font-extrabold text-brand-700 hover:text-brand-800"
            >
              + Add another guardian
            </button>
          </fieldset>
        </div>

        <footer className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add student'}
          </Button>
        </footer>
      </form>
    </div>
  );
};

export default StudentForm;
