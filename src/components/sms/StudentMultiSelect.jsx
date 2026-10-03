import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CircleAlert, Loader2, Search, X } from 'lucide-react';
import { listStudents } from '../../services/students';
import { formatCedis, formatCount } from '../../utils/format';

/**
 * The recipient list for the "By Specific Students" audience rule.
 *
 * This component exists because the rule was advertised in the picker before
 * anything could satisfy it: `AUDIENCE_RULES` offered `students`, the backend
 * resolved `audience.studentIds` into `filter._id`, and the schema required it —
 * but nothing ever collected it, so selecting the option sent a payload the server
 * refused with `audience.type "students" requires studentIds`, on the preview and
 * then again on the send. The rule was a dead end presented as a feature.
 *
 * ## Why this is not `plans/StudentPicker.jsx`
 *
 * That one is single-select, hard-filters to `feeStatus: 'owing'`, and is scoped
 * to a card with a "Change" button — a shape that does not compose into a
 * multi-select over a whole roster. Adapting it would have meant five optional
 * props and a `multiple` flag through a component built for one other caller.
 *
 * ## Search is a server-side query, not a client filter
 *
 * A roster is a thousand students and the server returns twenty. Filtering those
 * twenty client-side would tell a bursar "no match" for a school with four hundred
 * owing families, and make the only way to find someone paging all the way round.
 * So `search` goes to the server as its own filter, debounced.
 *
 * Not filtered to `owing`, unlike the plans picker: "Whole School" is the rule that
 * messages settled students, so restricting this one would make it a strictly worse
 * version of that. A bursar reminding one family about a school closure wants to be
 * able to find that family, settled or not.
 *
 * ## The cap is the schema's cap
 *
 * `MAX_SMS_SEND_BATCH` is 500, and `studentIds` is the only audience rule that
 * scales with the request body. A selection past that is refused by the server, so
 * it is refused here instead — with a count — rather than at send time.
 */
const MAX_SELECTION = 500;

const StudentMultiSelect = ({ selectedIds, onChange }) => {
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState([]);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState(null);

  const selected = selectedIds || [];
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  // Coalesce keystrokes. 400ms is the same budget `useStudents` uses on the
  // roster, so the feel of typing here matches typing there — and a bursar typing
  // "Mensah" would otherwise fire four requests for one word.
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setFetching(true);
      setError(null);

      listStudents({ search: search.trim(), perPage: 20 })
        .then((result) => {
          if (active) setRows(result?.rows || []);
        })
        .catch((err) => {
          if (!active) return;
          setRows([]);
          setError(err);
        })
        .finally(() => {
          if (active) setFetching(false);
        });
    }, 400);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [search]);

  const toggle = useCallback(
    (id) => {
      onChange?.(
        selectedSet.has(id) ? selected.filter((existing) => existing !== id) : [...selected, id]
      );
    },
    [onChange, selected, selectedSet]
  );

  const atCap = selected.length >= MAX_SELECTION;

  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      {/* Chosen recipients, so a selection of forty is legible without scrolling
          the search results back through. Only the first few are listed; the count
          carries the rest, because forty chips would push the rest of the card
          off screen on a laptop and the composer with it. */}
      {selected.length ? (
        <div className="mb-2.5">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
              Chosen
            </p>
            <p className="text-[11px] font-bold text-slate-500 tabular-nums">
              {formatCount(selected.length)}
              {atCap ? ' · limit reached' : ` of ${MAX_SELECTION}`}
            </p>
          </div>

          <ul className="mb-2 flex flex-wrap gap-1.5">
            {selected.slice(0, 12).map((id) => (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => toggle(id)}
                  className="inline-flex max-w-[14rem] items-center gap-1 rounded-lg bg-brand-700 py-1 pl-2 pr-1.5 text-[11px] font-bold text-white transition-colors hover:bg-brand-800"
                >
                  <span className="truncate">{nameFor(id, rows)}</span>
                  <X className="h-3 w-3 shrink-0" aria-hidden="true" />
                  <span className="sr-only">Remove {nameFor(id, rows)}</span>
                </button>
              </li>
            ))}
            {selected.length > 12 ? (
              <li className="inline-flex items-center rounded-lg bg-slate-200 px-2 py-1 text-[11px] font-bold text-slate-600">
                +{formatCount(selected.length - 12)} more
              </li>
            ) : null}
          </ul>

          <button
            type="button"
            onClick={() => onChange?.([])}
            className="min-h-[32px] text-[11px] font-bold text-slate-500 underline underline-offset-2 hover:text-slate-700"
          >
            Clear all
          </button>
        </div>
      ) : null}

      <label className="sr-only" htmlFor="sms-student-search">
        Search students by name or ID
      </label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
          aria-hidden="true"
        />
        <input
          id="sms-student-search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by student name or ID…"
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-[12px] font-semibold text-ink placeholder:font-normal placeholder:text-slate-400 focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/30"
        />
      </div>

      {error ? (
        <p className="mt-2 flex items-start gap-1.5 text-[11px] font-semibold text-red-700">
          <CircleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error?.message || 'The roster could not be read.'}
        </p>
      ) : null}

      <div className="mt-2 max-h-56 overflow-y-auto overscroll-contain">
        {fetching && !rows.length ? (
          <p className="flex items-center justify-center gap-2 py-4 text-[12px] font-semibold text-slate-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            Loading students…
          </p>
        ) : rows.length ? (
          <ul className="space-y-1">
            {rows.map((row) => {
              const checked = selectedSet.has(row.id ?? row._id);
              const id = row.id ?? row._id;

              return (
                <li key={id}>
                  <label
                    className={`flex cursor-pointer items-center gap-2.5 rounded-lg border bg-white px-2.5 py-2 transition-colors ${
                      checked ? 'border-brand-700 bg-brand-50/40' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(id)}
                      disabled={!checked && atCap}
                      className="h-3.5 w-3.5 shrink-0 rounded border-slate-300 text-brand-700 focus:ring-brand-700/30"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] font-extrabold text-ink">
                        {row.studentName}
                      </span>
                      <span className="block truncate text-[11px] font-semibold text-slate-500">
                        {row.studentClass} · {row.studentId}
                      </span>
                    </span>
                    <span className="shrink-0 text-[11px] font-extrabold tabular-nums text-slate-600">
                      GH₵ {formatCedis(row.balance)}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        ) : search.trim() ? (
          <p className="py-4 text-center text-[12px] font-semibold text-slate-400">
            Nobody on the roster matches “{search.trim()}”.
          </p>
        ) : null}
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
        {selected.length
          ? 'Shown above, so this is the audience the preview and the send will use.'
          : 'Pick at least one student — an empty selection cannot be previewed or sent.'}
      </p>
    </div>
  );
};

/**
 * A chip label for an id that may not be in the current result page.
 *
 * A selection survives a change of search term, so most chips have no matching row
 * once the bursar searches for the next name. Falling back to a shortened id beats
 * rendering "undefined" or dropping the chip — the chip is the only record that
 * student is still in the audience, and losing it silently is how a reminder goes
 * out to three of the four families it was meant for.
 */
const nameFor = (id, rows) => {
  const match = rows.find((row) => (row.id ?? row._id) === id);
  return match ? match.studentName : `…${String(id).slice(-6)}`;
};

export default StudentMultiSelect;