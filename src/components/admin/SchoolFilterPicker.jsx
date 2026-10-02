import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { AlertCircle, Check, ChevronDown, Loader2, Search, X } from 'lucide-react';
import { listSchools } from '../../services/admin';
import { formatCount } from '../../utils/format';

/**
 * The school filter the users and payments screens share.
 *
 * **A native `<select>` was the obvious choice and it does not work here.** The
 * platform console's two cross-tenant lists both need "one school out of every
 * school on SukuuPay", and `listSchools` answers with a page. A plain `<select>`
 * would carry either (a) the first 50 schools alphabetically, silently omitting
 * every school after Z-number-fifty, or (b) the full school list fetched on mount
 * — a request whose size grows with the platform and which nobody would want to
 * wait for on the school filter of a page they are trying to load. Both fail the
 * same way: the school they needed is not in the control, and nothing on screen
 * says so.
 *
 * So this searches **server-side**. `listSchools` accepts `search` and filters
 * `name`, `schoolCode` and `city` on it, which means the 50 rows it returns are
 * 50 *matches* rather than the first 50 of everything. The bound that exists —
 * `MAX_PER_PAGE = 200` in `Backend/src/utils/platformQuery.js`, which clamps
 * whatever page size a caller asks for — is deliberately never approached: the
 * picker asks for 50, and because the term is sent to the server, a platform with
 * 4,000 schools is exactly as reachable as one with 40. A client-side filter over
 * a bounded first page could not say that.
 *
 * **The term is debounced at 250ms.** Without it this is a request per keystroke,
 * and the responses race: "sun" can land after "sukuu" and win, leaving a list
 * that does not match the box above it. `PaymentFilterBar` states the same
 * trade-off at 300ms for the school console.
 *
 * `term` (what the operator typed) and `query` (what has actually been sent) are
 * separate state, deliberately. Choosing a school writes the school's name into
 * `term`, and if `term` were also the query the act of picking one would fire a
 * search for the name just chosen — a request whose only effect is to throw away
 * the option list the operator was reading.
 *
 * A plain combobox rather than a styled popover: this is a control an operator
 * touches a few times an hour, in a console that is otherwise entirely native
 * `<select>`s and text inputs, and a bespoke popover here would be the one
 * component in the console that behaves unlike everything beside it.
 */
const DEBOUNCE_MS = 250;
const PAGE_SIZE = 50;

const SchoolFilterPicker = ({
  value,
  onChange,
  label = 'School',
  id,
  className = '',
  disabled = false,
}) => {
  const generatedId = useId();
  const inputId = id || generatedId;
  const listId = `${inputId}-list`;
  const optionId = (index) => `${inputId}-option-${index}`;

  const [term, setTerm] = useState('');
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [chosen, setChosen] = useState(null);
  const rootRef = useRef(null);

  const load = useCallback(async (search) => {
    setLoading(true);
    setError(null);
    try {
      const result = await listSchools({
        perPage: PAGE_SIZE,
        search: search || '',
        // Name order, because this is a "find the school I am thinking of" box and
        // alphabetical is how anyone looks one up. The list endpoint's default is
        // `createdAt desc`, which is right for the schools *table* and wrong here.
        sortBy: 'name',
        sortOrder: 'asc',
      });
      setOptions(result.rows || []);
      setActiveIndex(0);
    } catch (apiError) {
      // A failed lookup renders as an empty, errored control rather than as "no
      // schools match" — the two look identical otherwise, and an operator would
      // conclude the school does not exist.
      setOptions([]);
      setError(apiError.message || 'Schools could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Two steps, so that picking a school does not re-query (see the header).
  useEffect(() => {
    const timer = setTimeout(() => setQuery(term.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [term]);

  useEffect(() => {
    load(query);
  }, [query, load]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const choose = useCallback(
    (school) => {
      setChosen(school);
      setTerm(school ? school.name : '');
      onChange(school ? school._id : '');
      setOpen(false);
    },
    [onChange]
  );

  const onKeyDown = (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => {
        const delta = event.key === 'ArrowDown' ? 1 : -1;
        // Clamped rather than wrapped: wrapping past the end of 50 schools means
        // an operator holding Down has to release and press again to get back.
        const next = current + delta;
        return Math.max(0, Math.min(next, options.length - 1));
      });
      return;
    }
    if (event.key === 'Enter') {
      if (!open || !options[activeIndex]) return;
      // Prevented, because this control lives inside filter `<form>`-shaped
      // markup in places and an unprevented Enter would submit whatever encloses it.
      event.preventDefault();
      choose(options[activeIndex]);
      return;
    }
    if (event.key === 'Escape') setOpen(false);
  };

  /**
   * The name of the school currently being filtered by.
   *
   * `chosen` is a cache of the option that was clicked, and it exists for one
   * case: a link arriving with `?schoolId=…` already set, before this component
   * has ever had a school to click. The filter is definitely applied — the URL
   * says so — but there is no name to show for it yet, and "School" alone would
   * leave the operator unable to tell what they are looking at. So the caption
   * falls back to a truthful "the selected school" rather than pretending.
   */
  const selectedName = useMemo(() => {
    if (!value) return null;
    return chosen?.name || options.find((school) => school._id === value)?.name || null;
  }, [value, chosen, options]);

  return (
    <div className={`relative ${className}`} ref={rootRef}>
      <label htmlFor={inputId} className="mb-0.5 block text-[11px]/[15px] font-semibold text-slate-700">
        {label}
      </label>

      <div className="relative">
        <Search className="pointer-events-none absolute bottom-2.5 left-3 h-4 w-4 text-slate-400" aria-hidden="true" />

        <input
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && options[activeIndex] ? optionId(activeIndex) : undefined}
          aria-describedby={`${inputId}-status`}
          autoComplete="off"
          value={term}
          disabled={disabled}
          onChange={(event) => {
            setTerm(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search every school by name or code"
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-9 text-[13px]/[18px] font-medium text-ink placeholder:font-normal placeholder:text-slate-500 transition-all focus:border-brand-700 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/30"
        />

        {(loading || value) && (
          <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <button
                type="button"
                onClick={() => choose(null)}
                aria-label="Clear the school filter"
                className="rounded p-0.5 text-slate-400 transition-colors hover:text-slate-700"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </span>
        )}
      </div>

      {/*
        The status line is a live region so the result count is announced when the
        list settles. It is `sr-only` when nothing is wrong — a visible count on
        every keystroke is noise, and the row count is already in the table's
        pager — but it becomes visible on an error, because that is the one state
        an operator must not miss.
      */}
      <p id={`${inputId}-status`} className="sr-only" role="status">
        {error
          ? error
          : `${options.length} school${options.length === 1 ? '' : 's'} match. Use the arrow keys to move through the list.`}
      </p>
      {error && (
        <p className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-red-600">
          <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
          {error}
        </p>
      )}

      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Schools"
          className="absolute z-40 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-soft"
        >
          {options.length === 0 ? (
            <li className="px-3 py-2.5 text-[12px] font-semibold text-slate-500">
              {loading ? 'Searching…' : `No school matches “${term.trim()}”.`}
            </li>
          ) : (
            options.map((school, index) => {
              const isSelected = school._id === value;
              return (
                <li
                  key={school._id}
                  id={optionId(index)}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(school)}
                  className={`flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-[13px] ${
                    index === activeIndex ? 'bg-brand-50' : 'bg-white'
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-bold text-ink">{school.name}</span>
                    <span className="block truncate font-mono text-[11px] font-semibold text-slate-400">
                      {[school.schoolCode, school.city].filter(Boolean).join(' · ') || 'No code on file'}
                    </span>
                  </span>
                  {isSelected && <Check className="h-4 w-4 shrink-0 text-brand-700" aria-hidden="true" />}
                </li>
              );
            })
          )}
        </ul>
      )}

      {/*
        What is applied, stated. A filter whose effect is invisible once the list
        is open is a filter the operator has to remember they set.
      */}
      {value && (
        <p className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
          <ChevronDown className="h-3 w-3 -rotate-90" aria-hidden="true" />
          Showing one school only
          {selectedName ? `: ${selectedName}` : ''}.{' '}
          <button
            type="button"
            onClick={() => choose(null)}
            className="font-extrabold text-brand-700 transition-colors hover:text-brand-800"
          >
            Show all schools
          </button>
        </p>
      )}
      {!value && !error && options.length > 0 && (
        <p className="mt-1 text-[11px] font-semibold text-slate-400">
          Listing the first {formatCount(options.length)} schools by name — narrow the box to reach any
          other.
        </p>
      )}
    </div>
  );
};

export { SchoolFilterPicker };
export default SchoolFilterPicker;