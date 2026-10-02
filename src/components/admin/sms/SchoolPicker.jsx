import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Check, Loader2, Search, X } from 'lucide-react';
import { listSchools } from '../../../services/admin';
import { formatCount } from '../../../utils/format';

/**
 * A server-searched multi-select over the platform's schools.
 *
 * Exists once, for three callers, because all three need the *same* behaviour and
 * a divergent copy of a school picker is how a platform ends up with three
 * different ideas of what a school is selectable:
 *
 *   - `BroadcastModal` — which schools' **administrators** to message.
 *   - `SmsCredits` — which schools to credit, or none for a platform credit note.
 *   - `AnnouncementForm` — which schools to publish a notice to.
 *
 * **Searched against the server, not filtered client-side.**
 * `GET /admin/schools` accepts `search` and paginates, with `MAX_PER_PAGE = 200`
 * (`utils/platformQuery.js:36`). A client-side filter over one page of 200 would
 * silently omit every school past the two hundredth — on a picker whose whole job
 * is to let an operator name an arbitrary school, that is not a rounding error, it
 * is a school that cannot be selected and no error to explain why. So the term goes
 * to the server and the visible list is whatever it returns.
 *
 * `filterStatus` is the one real difference between callers, and it is passed
 * rather than baked in:
 *
 *   - the broadcast picker passes `active`, because `broadcastToSchoolAdmins`
 *     resolves recipients only for schools that are active and not archived. An
 *     archived school here would resolve to zero recipients and the send would
 *     look like it worked while reaching nobody.
 *   - the credits picker and the announcement picker pass nothing, because neither
 *     endpoint restricts the audience — a notice for a suspended school is
 *     meaningful (that school is suspended, which is often why the notice exists),
 *     and a credit can be granted to a school before it is reactivated.
 *
 * **Selection survives a search.** Changing the term refetches the list, and a
 * picker that dropped the ticked schools on every keystroke would make selecting
 * forty schools impossible — the ticks would vanish as fast as they were made.
 * The selection is therefore held here, keyed by id, and only the *visible* rows
 * change with the term. That is also why each chip is rendered from
 * `value` alone and never from the fetched rows: a selected school outside the
 * current search must still be removable.
 *
 * Accessibility is the reason this is a fieldset of checkboxes rather than a
 * multi-`<select>`. A native multiple select is a single tab stop holding an
 * opaque list, it has no per-option state announcement on most platforms, and
 * "which forty did I tick" is unanswerable. Here every option is a real
 * `<input type="checkbox">` with a visible label, the group is a labelled
 * `role="group"`, and the selected count is a polite live region so the effect of
 * ticking one is spoken rather than merely drawn.
 */
const SchoolPicker = ({
  label = 'Schools',
  hint,
  error,
  value = [],
  onChange,
  filterStatus = '',
  disabled = false,
  placeholder = 'Search schools by name or code…',
  className = '',
}) => {
  const generatedId = useId();
  const [term, setTerm] = useState('');
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  const selected = useMemo(() => new Set((value || []).map(String)), [value]);

  /**
   * Debounced server search.
   *
   * 300ms is not decoration: without it, typing "Achimota" fires seven requests
   * and the response for "A" can land after the one for "Achimota" and win,
   * leaving the list showing a prefix of the name the operator just finished
   * typing. The `active` flag drops the superseded response as well, which is
   * the half the timeout alone does not fix.
   */
  useEffect(() => {
    let active = true;
    setLoading(true);

    const timer = setTimeout(() => {
      listSchools({
        search: term.trim(),
        status: filterStatus,
        // Sorted by name: an operator picking a school is looking it up by how it
        // is called, and the endpoint's default (`createdAt desc`) puts the newest
        // school first, which is the opposite of useful here.
        sortBy: 'name',
        sortOrder: 'asc',
        perPage: 200,
        page: 1,
      })
        .then((result) => {
          if (!active) return;
          setSchools(result.rows);
          setFetchError(null);
        })
        .catch((err) => {
          if (!active) return;
          setSchools([]);
          setFetchError(err);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, term ? 300 : 0);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [term, filterStatus]);

  const toggle = useCallback(
    (schoolId) => {
      const id = String(schoolId);
      const next = selected.has(id)
        ? (value || []).filter((entry) => String(entry) !== id)
        : [...(value || []), id];
      onChange?.(next);
    },
    [selected, value, onChange]
  );

  const clearAll = useCallback(() => onChange?.([]), [onChange]);

  /** The ids the operator picked but the current search does not show. */
  const offPage = useMemo(
    () => (value || []).filter((id) => !schools.some((school) => String(school._id) === String(id))),
    [value, schools]
  );

  return (
    <fieldset
      className={`rounded-xl border border-slate-200 bg-white p-3 ${className}`}
      disabled={disabled}
    >
      <legend className="px-1 text-[11px] font-semibold text-slate-700">
        {label}
        {hint && <span className="ml-1.5 text-[10px] font-medium text-slate-500">{hint}</span>}
      </legend>

      <div className="relative mt-1">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          aria-hidden="true"
        />
        <input
          id={`${generatedId}-search`}
          type="search"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder={placeholder}
          aria-label={`${label} — search`}
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-[13px] font-medium text-ink placeholder:font-normal placeholder:text-slate-500 focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/30"
        />
      </div>

      {/*
        The selection, read out.

        `aria-live="polite"` rather than `role="status"` on the container: the
        container also holds the scrollable list, and a `status` region wrapping
        re-rendered checkboxes announces more than anybody needs. This node is a
        single sentence whose only job is the count.
      */}
      <p aria-live="polite" className="mt-2 text-[11px] font-extrabold text-slate-600">
        {formatCount(selected.size)} selected
        {selected.size > 0 && (
          <>
            {' · '}
            <button
              type="button"
              onClick={clearAll}
              className="font-extrabold text-brand-700 underline underline-offset-2 hover:text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
            >
              Clear selection
            </button>
          </>
        )}
      </p>

      {/* Chips for the picks that the current search has scrolled off. */}
      {offPage.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {offPage.map((id) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => toggle(id)}
                aria-label={`Remove school ${id} from the selection`}
                className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-[10px] font-extrabold text-brand-800 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700"
              >
                {String(id).slice(-6)}
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-slate-200">
        {loading && schools.length === 0 ? (
          <p className="flex items-center gap-2 px-3 py-6 text-[12px] font-semibold text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Loading schools…
          </p>
        ) : fetchError ? (
          <p role="alert" className="px-3 py-6 text-[12px] font-semibold text-red-600">
            {fetchError.message}
          </p>
        ) : schools.length === 0 ? (
          <p className="px-3 py-6 text-center text-[12px] font-semibold text-slate-500">
            {term.trim()
              ? `No school matches “${term.trim()}”.`
              : filterStatus === 'active'
                ? 'There are no active schools on the platform.'
                : 'There are no schools on the platform.'}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {schools.map((school) => {
              const checked = selected.has(String(school._id));
              return (
                <li key={school._id}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2 transition-colors hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(school._id)}
                      className="h-4 w-4 shrink-0 accent-brand-700"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] font-extrabold text-ink">
                        {school.name}
                      </span>
                      <span className="block truncate font-mono text-[10px] font-bold text-slate-400">
                        {school.schoolCode || '—'}
                        {school.region ? ` · ${school.region}` : ''}
                        {school.status ? ` · ${school.status}` : ''}
                      </span>
                    </span>
                    {checked && (
                      <Check className="h-3.5 w-3.5 shrink-0 text-brand-700" aria-hidden="true" />
                    )}
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/*
        The 200 cap, stated. `perPage: 200` is the server's `MAX_PER_PAGE`, so this
        list is every school that matches the term up to that ceiling — not, on a
        platform with more than 200 schools, every school. Saying so is the
        difference between an operator narrowing the search and an operator
        concluding that a school does not exist.
      */}
      {!loading && schools.length >= 200 && (
        <p className="mt-2 text-[10px] font-semibold text-amber-700">
          Showing the first 200 matches. Narrow the search to reach the rest.
        </p>
      )}

      {error && (
        <p role="alert" className="mt-2 text-[11px] font-semibold text-red-600">
          {error}
        </p>
      )}
    </fieldset>
  );
};

export default SchoolPicker;