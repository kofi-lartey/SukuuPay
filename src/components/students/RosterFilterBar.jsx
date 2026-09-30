import React, { useEffect, useState } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
// Named import, not default: `FormField.jsx` has `export default Field`, so a
// default import of `SelectField` resolves to the *text input* and silently
// renders it with `<option>` children — which React rejects at render time with
// an error that names neither the field nor the import.
import { SelectField } from '../common/FormField';
import Card from '../dashboard/ui/Card';

/**
 * The roster's filter row.
 *
 * Search is debounced at 300ms because it re-runs the query on every keystroke,
 * and a school of 1,000 students searching "Kwam" would otherwise fire four
 * requests for one word. The other filters are discrete, so they apply on change
 * with no debounce.
 *
 * Every control is driven from the URL rather than local state, so the row
 * renders what the URL says on a shared link, not what this mount happened to
 * have selected.
 */
const DEBOUNCE_MS = 300;

const RosterFilterBar = ({ filters, setFilter, clearFilters, hasFilters, classes = [] }) => {
  const [term, setTerm] = useState(filters.search);
  const [expanded, setExpanded] = useState(false);

  // Adopt an external search (the topbar linking here with `?q=`) without
  // stomping on what is being typed right now.
  useEffect(() => setTerm(filters.search), [filters.search]);

  useEffect(() => {
    if (term === filters.search) return undefined;
    const timer = setTimeout(() => setFilter({ q: term }), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [term, filters.search, setFilter]);

  const update = (patch) => setFilter(patch);

  return (
    <Card padding="p-4" className="mb-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="relative lg:max-w-sm lg:flex-1">
          <label htmlFor="roster-search" className="mb-0.5 block text-[11px] font-semibold text-slate-700">
            Search
          </label>
          <Search
            className="pointer-events-none absolute bottom-2.5 left-3 h-4 w-4 text-slate-400"
            aria-hidden="true"
          />
          <input
            id="roster-search"
            type="search"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Student name, ID, or parent phone…"
            className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-[13px] font-semibold text-ink placeholder:font-medium placeholder:text-slate-400 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
          />
        </div>

        <SelectField
          label="Class"
          value={filters.class}
          onChange={(event) => update({ class: event.target.value })}
          className="lg:w-44"
        >
          <option value="">All Classes</option>
          {classes.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </SelectField>

        <SelectField
          label="Fee Status"
          value={filters.feeStatus}
          onChange={(event) => update({ feeStatus: event.target.value })}
          className="lg:w-40"
        >
          <option value="">All</option>
          <option value="cleared">Fully Cleared</option>
          <option value="owing">Owing</option>
          <option value="overdue">Overdue</option>
        </SelectField>

        <SelectField
          label="Plan Status"
          value={filters.planStatus}
          onChange={(event) => update({ planStatus: event.target.value })}
          className="lg:w-40"
        >
          <option value="">All Students</option>
          <option value="active">On Track</option>
          <option value="pending">Awaiting Parent</option>
          <option value="completed">Completed</option>
          <option value="defaulted">Defaulted</option>
          <option value="none">No Plan</option>
        </SelectField>

        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="mb-0.5 inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-[13px] font-extrabold text-slate-600 transition-colors hover:bg-slate-50"
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          {expanded ? 'Fewer' : 'More'}
        </button>
      </div>

      {expanded && (
        <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-end">
          <SelectField
            label="Record status"
            value={filters.status}
            onChange={(event) => update({ status: event.target.value })}
            className="sm:w-44"
          >
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="graduated">Graduated</option>
            <option value="transferred_out">Transferred Out</option>
            <option value="all">All Records</option>
          </SelectField>

          <SelectField
            label="Gender"
            value={filters.gender}
            onChange={(event) => update({ gender: event.target.value })}
            className="sm:w-40"
          >
            <option value="">All</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </SelectField>

          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="mb-0.5 h-9 rounded-lg px-3 text-[13px] font-extrabold text-brand-700 transition-colors hover:bg-brand-50"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}
    </Card>
  );
};

export default React.memo(RosterFilterBar);
