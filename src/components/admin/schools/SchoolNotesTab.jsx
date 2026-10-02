import React, { useEffect, useState } from 'react';
import { EyeOff, LoaderCircle, NotebookPen, ShieldCheck } from 'lucide-react';
import Card from '../../dashboard/ui/Card';
import { FormAlert } from '../../common/FormField';
import { useToast } from '../../../hooks/useToast';
import { updateInternalNotes } from '../../../services/admin';

/** `updateInternalNotesSchema`'s own cap (`admin.schools.validation.js:143`). */
const MAX_NOTES = 2000;

/**
 * The account manager's private column on a school.
 *
 * **"No school admin can read this" is the label, not a footnote, and it is load-
 * bearing in a way that is easy to miss.** `internalNotes` is stored on
 * `School.subscription` and read by exactly one endpoint — `GET /admin/schools/:id`,
 * which is the one school endpoint a school admin cannot read. Nothing in the school
 * console touches it; there is no list, no export, no field on the school's own
 * profile. That is the entire point of the field.
 *
 * So the only thing that determines whether anybody writes anything useful here is
 * whether they believe it. An owner who assumes the bursar can see this writes
 * "disputed Kwame Mensah bill, do not waive" — an apology to themselves — or writes
 * nothing at all, because every sentence is a thing they would not want read aloud in
 * a staff meeting. An owner who has been told, at the point of typing, that no school
 * admin can read it writes the thing that makes the field worth having: "bursar
 * disputed the Jomoro class total on 12 Oct; receipt 4471 has the real figure;
 * agreed to correct the SMS to parents." The disclosure is therefore the feature, it
 * is repeated above the field *and* beside it, and it is stated as a positive fact
 * about the system rather than as a warning — the field is private, that is the point,
 * and the UI should sound like it means it.
 *
 * **No audit trail on this tab, because there is no list.** `updateInternalNotes` is
 * audited server-side as `admin.notes_update` with a before/after pair, so the record
 * exists in the platform audit log — but a note is 2,000 characters of prose with no
 * pagination, no author and no timestamp on the row, and inventing an audit list over
 * it would be a UI that suggests more rigour than the data carries. The write is
 * still confirmed, still toasts, and still reports the server's message on failure.
 */
const SchoolNotesTab = ({ school, record }) => {
  const toast = useToast();
  const [notes, setNotes] = useState(record?.internalNotes || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const saved = record?.internalNotes || '';
  const dirty = notes.trim() !== saved.trim();
  const tooLong = notes.length > MAX_NOTES;

  /*
   * Adopt the server's value when it changes, but never mid-keystroke.
   *
   * A refetch after a save hands back a new `record`; without this the field would
   * keep showing what was typed while the header above it showed what was stored —
   * and the server trims and normalises the string, so those genuinely can differ.
   * The `busy` guard is what stops a save's own refetch from overwriting the box the
   * operator is still correcting.
   */
  useEffect(() => {
    if (!busy) setNotes(record?.internalNotes || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record?.internalNotes, busy]);

  const save = async () => {
    if (tooLong) {
      setError(`Notes are limited to ${MAX_NOTES} characters.`);
      return { ok: false, error: 'too long' };
    }

    setBusy(true);
    setError(null);
    try {
      await updateInternalNotes(school._id, notes);
      toast.success('Internal notes saved. No school admin can read them.');
      return { ok: true };
    } catch (caught) {
      // Never thrown out of a confirm handler. A 2,000-character note somebody wrote
      // about a live dispute is not something to lose to a transient 500.
      setError(caught.message || 'The notes could not be saved.');
      return { ok: false, error: caught.message };
    } finally {
      setBusy(false);
    }
  };

  if (!school) return null;

  return (
    <div className="space-y-4">
      <Card padding="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-[13px] font-extrabold leading-tight text-ink">
              <NotebookPen className="h-4 w-4 text-slate-400" aria-hidden="true" />
              Internal notes
            </h2>
            <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
              {school.name} · for the platform team. Private to this console.
            </p>
          </div>
          <span className="shrink-0 text-[11px] font-bold tabular-nums text-slate-400">
            {notes.length}/{MAX_NOTES}
          </span>
        </div>

        {/* The disclosure, above the field and again beside it. */}
        <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50 px-3.5 py-3">
          <p className="flex items-start gap-2 text-[13px] font-extrabold text-brand-800">
            <EyeOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            No school admin can read this
          </p>
          <p className="mt-1 text-[12px] font-semibold leading-relaxed text-brand-800/85">
            Not the headteacher, not the bursar, not a viewer. Nothing in this school&rsquo;s own
            console reads this field — there is no list, no export and no field on their profile — so
            write the thing you would not want read aloud: what was disputed, what was agreed, and
            what you would do differently next term.
          </p>
        </div>

        {error && (
          <div className="mt-3">
            <FormAlert tone="error">{error}</FormAlert>
          </div>
        )}

        <div className="mt-4">
          <label
            htmlFor="school-internal-notes"
            className="mb-0.5 block text-[11px]/[15px] font-semibold text-slate-700"
          >
            Notes for the platform team — no school admin can read this
          </label>
          <textarea
            id="school-internal-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={12}
            maxLength={MAX_NOTES}
            aria-describedby="school-internal-notes-help"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[13px]/[20px] font-medium text-ink placeholder:text-slate-500 focus:border-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/30"
            placeholder="Bursar disputed the Jomoro class total on 12 Oct. Receipt 4471 has the real figure. Agreed to correct the SMS sent to parents."
          />
          <p id="school-internal-notes-help" className="mt-1.5 text-[11px] font-semibold leading-relaxed text-slate-400">
            Capped at {MAX_NOTES} characters, trimmed by the server, and saved as
            <code className="mx-1 rounded bg-slate-100 px-1 py-0.5 font-mono text-[10px]">admin.notes_update</code>{' '}
            in the platform audit log.
          </p>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={busy || !dirty || tooLong}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-3.5 py-2 text-[13px] font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
          >
            {busy ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {busy ? 'Saving…' : 'Save notes'}
          </button>

          {dirty && !busy && (
            <p className="text-[11px] font-semibold text-amber-700">
              Unsaved changes — they are only stored once you save.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
};

export default SchoolNotesTab;