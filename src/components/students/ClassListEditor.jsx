import React, { useEffect, useRef, useState } from 'react';
import { GraduationCap, Plus, Trash2 } from 'lucide-react';
import { FormAlert } from '../common/FormField';
import Button from '../common/Button';
import { updateSchoolClasses } from '../../services/school';

/**
 * The class list a Ghanaian basic-and-JHS school actually runs, offered as
 * one-click presets.
 *
 * Not a default: nothing is pre-selected. A preset that silently pre-fills a
 * class the school does not teach would show up in the roster as an empty
 * filter option, and the graduation guard reads the tail of this list — so a
 * pre-filled list is worse than an empty one. These are shortcuts, and the
 * school chooses.
 */
const PRESETS = {
  'Basic + JHS': ['Nursery 1', 'Nursery 2', 'Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6', 'JHS 1', 'JHS 2', 'JHS 3'],
  'Basic only': ['Nursery 1', 'Nursery 2', 'Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6'],
  'JHS only': ['JHS 1', 'JHS 2', 'JHS 3'],
  'Primary only': ['Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6'],
  'SHS only': ['Year 1', 'Year 2', 'Year 3'],
};

/**
 * Manage `School.academic.classes`.
 *
 * **This exists because a self-provisioned school starts with none.** The class
 * list is what the roster's class filter, the Add Student class dropdown, the
 * Import tab's validation and the graduation guard are all built on, and
 * `provisionMySchoolSchema` accepts no `classes` field — so every school created
 * through onboarding landed on a Students page whose primary action was disabled
 * and whose only remedy was a Settings page that did not exist. That is a dead
 * end at the exact moment a new admin is trying to do their first real task.
 *
 * The list is free-text names rather than a collection, because `Student` stores
 * `studentClass` as the name itself — there is no class id anywhere to switch
 * to. Removal is therefore allowed but never silent: the students keep their
 * record, they just fall out of the class filter and out of the final-year
 * guard, so the dialog says so on the row rather than discovering it later.
 */
const ClassListEditor = ({ open, onClose, onSaved, schoolId, classes: initial = [] }) => {
  const [draft, setDraft] = useState(initial);
  const [name, setName] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setDraft(initial);
    setName('');
    setError(null);
    setRemoving(null);
  }, [open, initial]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (!open) return null;

  /** Duplicates are rejected rather than merged: two "JHS 1" rows would make the class filter ambiguous. */
  const addClass = (value) => {
    const label = String(value ?? name).trim();
    if (!label) return;
    if (draft.some((c) => c.toLowerCase() === label.toLowerCase())) {
      setError(`"${label}" is already on the list.`);
      return;
    }
    setDraft((current) => [...current, label]);
    setName('');
    setError(null);
    inputRef.current?.focus();
  };

  const save = async () => {
    if (!draft.length) {
      setError('Add at least one class — students are placed in a class.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = await updateSchoolClasses(schoolId, draft);
      // The response is the authoritative list: the server trims, and it is the
      // value every child component reads its options from.
      onSaved(saved?.academic?.classes || draft);
      onClose();
    } catch (err) {
      setError(err.message || 'Your class list could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 backdrop-blur-[2px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Manage your classes"
        className="my-8 w-full max-w-lg rounded-2xl bg-white shadow-2xl"
      >
        <header className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-extrabold tracking-tight text-ink">Your classes</h2>
          <p className="text-[12px] font-semibold text-slate-500">
            Every student sits in one of these, and the roster filters by them.
          </p>
        </header>

        <div className="space-y-5 px-6 py-5">
          {error && <FormAlert>{error}</FormAlert>}

          <div>
            <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
              Start from a template
            </p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(PRESETS).map(([label, list]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    setDraft(list);
                    setError(null);
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-bold text-slate-700 transition-colors hover:border-brand-700 hover:text-brand-700"
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] font-medium text-slate-500">
              Replaces the list below. Edit it before saving.
            </p>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
              Classes ({draft.length})
            </p>
            {draft.length ? (
              <ul className="space-y-1.5">
                {draft.map((c, index) => (
                  <li
                    key={`${c}-${index}`}
                    className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2"
                  >
                    <GraduationCap className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                    <span className="flex-1 text-[13px] font-bold text-ink">{c}</span>
                    {removing === index ? (
                      <span className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-slate-500">
                          Students here will leave the class filter. Remove?
                        </span>
                        <Button type="button" variant="secondary" size="sm" onClick={() => {
                          setDraft((current) => current.filter((_, i) => i !== index));
                          setRemoving(null);
                        }}>
                          Yes
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setRemoving(null)}>
                          No
                        </Button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        aria-label={`Remove ${c}`}
                        onClick={() => setRemoving(index)}
                        className="rounded p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-[12px] font-semibold text-slate-500">
                No classes yet. Pick a template or add one below.
              </p>
            )}
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              addClass();
            }}
          >
            {/* A native input rather than `Field`: this one needs a ref, so
                focus returns to it after every add. `Field` is a plain function
                component and React 18 will not forward a ref to it. */}
            <label
              htmlFor="class-list-new-class"
              className="mb-0.5 block text-[11px]/[15px] font-semibold text-slate-700"
            >
              Add a class
              <span className="ml-1.5 text-[10px]/[14px] font-medium text-slate-500">
                e.g. JHS 1
              </span>
            </label>
            <div className="flex gap-2">
              <input
                id="class-list-new-class"
                ref={inputRef}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Class name"
                maxLength={50}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px]/[18px] font-medium text-ink placeholder:font-normal placeholder:text-slate-500 transition-all focus:border-brand-700 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/30"
              />
              <Button type="submit" variant="secondary" disabled={!name.trim()}>
                <Plus className="mr-1 inline h-4 w-4" aria-hidden="true" />
                Add class
              </Button>
            </div>
          </form>
        </div>

        <footer className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant="primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save classes'}
          </Button>
        </footer>
      </div>
    </div>
  );
};

export default ClassListEditor;
