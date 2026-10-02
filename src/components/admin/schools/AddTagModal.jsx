import React, { useEffect, useMemo, useState } from 'react';
import { LoaderCircle, Tag, X } from 'lucide-react';
import Modal from '../../common/Modal';
import { Field, FormAlert } from '../../common/FormField';
import { updateSchoolTags } from '../../../services/admin';

/**
 * The server's own caps, from `updateTagsSchema`
 * (`Backend/src/validations/admin.schools.validation.js:131`) and the identical
 * re-check in `normaliseTags` / `updateSchoolTags`
 * (`Backend/src/services/admin/schools.service.js:951-952, 976-979`). Both places
 * enforce them, so a form that knows them never produces a 400 for something its own
 * copy said was fine.
 */
const MAX_TAGS = 20;
const MAX_TAG_LENGTH = 50;

/**
 * Mirrors `normaliseTags` on the server (`schools.service.js:954-972`).
 *
 * Written out rather than imported — the frontend cannot import backend modules —
 * and deliberately the *same* rules, because a tag system whose write side lowercases
 * and whose filter side does not is a filter that silently matches an empty set. The
 * backend's own comment makes the same point: tags are a filter key, so normalisation
 * has to happen on write.
 *
 * The one thing it does *not* mirror is truncation. The server clips at 50 characters;
 * this refuses to commit a longer one instead, because a tag silently cut in half is
 * a label the operator cannot recognise afterwards, whereas a rejected one tells them
 * what happened.
 */
const normaliseTag = (raw) =>
  String(raw ?? '')
    .trim()
    .toLowerCase()
    .slice(0, MAX_TAG_LENGTH);

/**
 * Add or remove one of the operator's labels on a school.
 *
 * **`updateSchoolTags` replaces the whole array rather than merging, so this dialog
 * keeps the existing set in view and submits the set plus the new tag.** A merge on
 * the server would make "remove the last tag" inexpressible — which is why the
 * backend chose replace (its own comment says so). Sending the full set is the
 * honest consequence: the dialog is showing the operator exactly what will be written,
 * not an optimistic preview.
 *
 * Tags are free text, not an enum, and that is the point: the vocabulary grows
 * without a deploy. The suggestions are therefore drawn from the tags already in use
 * *on this school* rather than from a fixed list, because an operator labelling a
 * school mid-support-call wants "the same label the other Kumasi school has", and a
 * hard-coded list would be a second thing to keep in step with the first.
 */
const AddTagModal = ({ open, school, onClose, onSaved, suggestions = [] }) => {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const current = useMemo(
    () => (Array.isArray(school?.tags) ? school.tags : []),
    [school?.tags]
  );

  const trimmed = draft.trim();
  const tooLong = trimmed.length > MAX_TAG_LENGTH;
  const candidate = trimmed ? normaliseTag(trimmed) : '';
  const alreadyThere = candidate ? current.includes(candidate) : false;
  const atCapacity = current.length >= MAX_TAGS;

  useEffect(() => {
    if (!open) return;
    setDraft('');
    setError(null);
  }, [open, school?._id]);

  /** Submit `next`, with the same `{ ok, error }`-never-throw discipline. */
  const commit = async (next) => {
    setBusy(true);
    setError(null);
    try {
      await updateSchoolTags(school._id, next);
      onSaved?.(next);
      onClose();
    } catch (caught) {
      setError(caught.message || 'The tags could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  const add = (value) => {
    const tag = normaliseTag(value || draft);
    if (!tag) return;
    if (current.includes(tag)) {
      setDraft('');
      return;
    }
    if (current.length >= MAX_TAGS) return;
    commit([...current, tag]);
  };

  const remove = (tag) => {
    if (busy) return;
    commit(current.filter((entry) => entry !== tag));
  };

  if (!school) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Tags"
      description={`Operator labels on ${school.name}. Free text — nothing here is visible to the school.`}
      size="sm"
      footer={
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
        >
          Done
        </button>
      }
    >
      <div>
        <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
          On this school ({current.length}/{MAX_TAGS})
        </p>

        {current.length === 0 ? (
          <p className="mt-2 text-[12px] font-semibold text-slate-400">
            No tags yet. Add one below.
          </p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {current.map((tag) => (
              <li key={tag}>
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 py-1 pl-2.5 pr-1 text-[11px] font-extrabold text-brand-800">
                  {tag}
                  <button
                    type="button"
                    onClick={() => remove(tag)}
                    disabled={busy}
                    aria-label={`Remove the tag ${tag}`}
                    className="flex h-5 w-5 items-center justify-center rounded-full text-brand-800/60 transition-colors hover:bg-brand-100 hover:text-brand-800 disabled:opacity-50"
                  >
                    {busy ? (
                      <LoaderCircle className="h-3 w-3 animate-spin" aria-hidden="true" />
                    ) : (
                      <X className="h-3 w-3" aria-hidden="true" />
                    )}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && (
        <div className="mt-3">
          <FormAlert tone="error">{error}</FormAlert>
        </div>
      )}

      <div className="mt-4 border-t border-slate-100 pt-4">
        <Field
          label="Add a tag"
          value={draft}
          maxLength={MAX_TAG_LENGTH}
          disabled={busy || atCapacity}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            // Enter and comma both commit. Comma because a tag list is typed as a
            // comma-separated sequence by anyone who has used a filter bar before,
            // and refusing it would make them press a button for the obvious thing.
            if (event.key === 'Enter' || event.key === ',') {
              event.preventDefault();
              if (!alreadyThere && !atCapacity) add();
            }
          }}
          placeholder={atCapacity ? 'Tag limit reached' : 'pilot, kumasi, needs-integration'}
          hint={`${trimmed.length}/${MAX_TAG_LENGTH}`}
          error={
            tooLong
              ? `Tags are capped at ${MAX_TAG_LENGTH} characters`
              : alreadyThere
                ? `${candidate} is already on this school`
                : null
          }
        />

        <button
          type="button"
          onClick={() => add()}
          disabled={busy || !candidate || alreadyThere || atCapacity}
          className="mt-2 inline-flex items-center gap-2 rounded-xl bg-brand-700 px-3.5 py-2 text-[13px] font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
        >
          {busy ? (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Tag className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          Add tag
        </button>

        {atCapacity && (
          <p className="mt-2 text-[11px] font-semibold text-amber-700">
            A school may carry at most {MAX_TAGS} tags. Remove one before adding another.
          </p>
        )}
      </div>

      {suggestions.length > 0 && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
            In use on this school&rsquo;s page
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {suggestions
              .filter((tag) => !current.includes(tag))
              .slice(0, 12)
              .map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => add(tag)}
                  disabled={busy || atCapacity}
                  className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-extrabold text-slate-600 transition-colors hover:bg-slate-200 hover:text-ink disabled:opacity-50"
                >
                  + {tag}
                </button>
              ))}
          </div>
        </div>
      )}
    </Modal>
  );
};

export default AddTagModal;