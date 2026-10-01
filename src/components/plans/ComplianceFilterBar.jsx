import React from 'react';
import { useEffect, useState } from 'react';
import { ChevronDown, LayoutGrid, List, RefreshCw, Search } from 'lucide-react';
import { formatCount } from '../../utils/format';

/**
 * Search, class, term, refresh and the view toggle.
 *
 * **The search box is debounced and local-to-the-input.** It writes to the same
 * URL the other filters use, so a searched compliance list is a link — but a
 * keystroke must not become a request, and it must not push a history entry per
 * character. The input keeps its own value while the URL only ever receives the
 * settled term, which is also why the box does not show the URL's value: the two
 * differ for 300ms on every search and reading the URL back would fight the user.
 */
const ComplianceFilterBar = ({
  filters,
  onFilter,
  onClear,
  hasFilters,
  onRefresh,
  refreshing,
  classes,
  terms,
  resultCount,
  view,
  onViewChange,
}) => {
  const [draft, setDraft] = useState(filters.search);

  // Re-seed when the URL changes from outside this box (Clear, or a shared link).
  useEffect(() => {
    setDraft(filters.search);
  }, [filters.search]);

  useEffect(() => {
    if (draft === filters.search) return undefined;
    const timer = setTimeout(() => onFilter({ search: draft }), 350);
    return () => clearTimeout(timer);
  }, [draft, filters.search, onFilter]);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative min-w-[220px] flex-1">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          aria-hidden="true"
        />
        <input
          type="search"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Search student name, ID or parent…"
          aria-label="Search plans by student name, ID or parent"
          className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-[13px] font-medium text-ink placeholder:text-slate-400 focus:border-brand-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-700/30"
        />
      </div>

      <SelectControl
        label="All Classes"
        value={filters.class}
        onChange={(value) => onFilter({ class: value })}
        options={classes}
        emptyLabel="All Classes"
        hint={resultCount !== null ? `${formatCount(resultCount)} shown` : null}
      />

      <SelectControl
        label="Current Term"
        value={filters.term}
        onChange={(value) => onFilter({ term: value })}
        options={terms}
        emptyLabel="All Terms"
      />

      {hasFilters && (
        <button
          type="button"
          onClick={onClear}
          className="rounded-xl border border-slate-200 px-3 py-2.5 text-[12px] font-extrabold text-slate-600 transition-colors hover:bg-slate-50"
        >
          Clear
        </button>
      )}

      <div className="ml-auto flex items-center gap-1.5">
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          aria-label="Refresh plan compliance"
          className="rounded-xl border border-slate-200 p-2.5 text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw
            className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
        </button>

        {/* The toggle is wired to a real view state, and the card view is
            implemented below rather than left as a dead control — a view toggle
            that never changes anything is worse than not offering it. */}
        <div role="group" aria-label="View mode" className="inline-flex rounded-xl border border-slate-200 p-0.5">
          <ViewButton
            active={view === 'table'}
            onClick={() => onViewChange('table')}
            label="Table view"
          >
            <List className="h-4 w-4" aria-hidden="true" />
          </ViewButton>
          <ViewButton
            active={view === 'cards'}
            onClick={() => onViewChange('cards')}
            label="Card view"
          >
            <LayoutGrid className="h-4 w-4" aria-hidden="true" />
          </ViewButton>
        </div>
      </div>
    </div>
  );
};

const ViewButton = ({ active, onClick, label, children }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    aria-label={label}
    className={`rounded-[10px] p-2 transition-colors ${
      active ? 'bg-slate-100 text-ink' : 'text-slate-400 hover:text-slate-600'
    }`}
  >
    {children}
  </button>
);

/** A labelled `<select>`. The native control, not a custom listbox. */
const SelectControl = ({ label, value, onChange, options, emptyLabel, hint }) => (
  <div className="relative">
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label={label}
      className="cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-3.5 pr-9 text-[13px] font-extrabold text-ink focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/30"
    >
      <option value="">{emptyLabel}</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
    <ChevronDown
      className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
      aria-hidden="true"
    />
    {hint && <span className="sr-only">{hint}</span>}
  </div>
);

export default ComplianceFilterBar;
