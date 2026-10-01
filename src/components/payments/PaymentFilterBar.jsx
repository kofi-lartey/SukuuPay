import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search, Wallet } from 'lucide-react';
// Named import: `FormField.jsx` has `export default Field`, so a default import
// of `SelectField` resolves to the *text input* and silently renders with
// `<option>` children. Same trap `RosterFilterBar` documents.
import { SelectField } from '../common/FormField';
import Card from '../dashboard/ui/Card';
import { formatCount } from '../../utils/format';

const DEBOUNCE_MS = 300;

/**
 * Period presets.
 *
 * The API takes `startDate`/`endDate`, not a term id, so the design's
 * "Current Term - Term 1" control is expressed as the windows this backend can
 * actually resolve. Inventing a term endpoint to fill that dropdown would have
 * been the wrong fix: a term label that selects the wrong date range is worse
 * than a dropdown that says what the dates are.
 */
const PERIODS = [
  { value: 'month', label: 'This month' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: '', label: 'All time' },
];

const toIso = (date) => date.toISOString().slice(0, 10);

const periodToRange = (value, today = new Date()) => {
  if (!value) return { startDate: '', endDate: '' };

  const start = new Date(today);
  if (value === 'month') start.setUTCDate(1);
  else start.setUTCDate(start.getUTCDate() - (value === '30d' ? 29 : 89));

  return { startDate: toIso(start), endDate: toIso(today) };
};

/** Inverts `periodToRange`, so a shared link comes back on the right preset. */
const rangeToPeriod = ({ startDate, endDate }, today = new Date()) => {
  if (!startDate && !endDate) return '';
  if (!startDate || !endDate) return 'custom';

  const span = Math.round((today - new Date(startDate)) / 86_400_000);
  if (toIso(today) === endDate) {
    if (span < 29) return '30d';
    if (span < 89) return '90d';
  }
  if (startDate === `${new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))}`.slice(0, 10))
    return 'month';
  return 'custom';
};

/**
 * The transactions filter row.
 *
 * Search is debounced at 300ms because it re-runs the query on every keystroke,
 * and a bursar hunting one reference would otherwise fire a request per
 * character. Everything else is discrete and applies on change.
 *
 * **Every control is URL-driven**, so the row renders what the URL says on a
 * shared link rather than what this mount happened to have selected.
 *
 * The channel chips read their counts from the summary aggregation rather than
 * from the visible page. Counting the rows on screen would label "MTN MoMo (7)"
 * for a school with 232 MTN payments on page one, and a filter chip whose number
 * changes as you page through it is worse than no chip.
 */
const PaymentFilterBar = ({
  filters,
  setFilter,
  clearFilters,
  hasFilters,
  classes = [],
  summary,
  onRefresh,
  refreshing = false,
}) => {
  const [term, setTerm] = useState(filters.search);

  // Adopt an external search (the topbar linking here with `?q=`) without
  // stomping on what is being typed right now.
  useEffect(() => setTerm(filters.search), [filters.search]);

  useEffect(() => {
    if (term === filters.search) return undefined;
    const timer = setTimeout(() => setFilter({ q: term }), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [term, filters.search, setFilter]);

  const period = useMemo(() => rangeToPeriod(filters), [filters.startDate, filters.endDate]);

  const chips = useMemo(() => {
    const networks = (summary?.networks || [])
      .filter((n) => n.count > 0)
      .map((n) => ({
        key: `network:${n.network}`,
        label: n.label,
        count: n.count,
        active: filters.network === n.network,
        apply: () => setFilter({ network: n.network, paymentMethod: '' }),
      }));

    // Cash at the desk is a method, not a network — it has no `momoNetwork` — so
    // it cannot be a `network` chip without producing a filter that matches
    // nothing.
    const nonMomo = (summary?.byMethod || [])
      .filter((m) => m.method && m.method !== 'momo' && m.count > 0)
      .map((m) => ({
        key: `method:${m.method}`,
        label: m.label,
        count: m.count,
        active: filters.paymentMethod === m.method,
        apply: () => setFilter({ paymentMethod: m.method, network: '' }),
      }));

    return [
      {
        key: 'all',
        label: 'All inflows',
        count: summary?.totalTransactions || 0,
        active: !filters.network && !filters.paymentMethod,
        apply: () => setFilter({ network: '', paymentMethod: '' }),
      },
      ...networks,
      ...nonMomo,
    ];
  }, [summary, filters.network, filters.paymentMethod, setFilter]);

  return (
    <Card padding="p-4" className="mb-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="relative lg:max-w-sm lg:flex-1">
          <label
            htmlFor="payments-search"
            className="mb-0.5 block text-[11px] font-semibold text-slate-700"
          >
            Search
          </label>
          <Search
            className="pointer-events-none absolute bottom-2.5 left-3 h-4 w-4 text-slate-400"
            aria-hidden="true"
          />
          <input
            id="payments-search"
            type="search"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Transaction ref, receipt no. or student…"
            className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-[13px] font-semibold text-ink placeholder:font-medium placeholder:text-slate-400 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
          />
        </div>

        <SelectField
          label="Period"
          value={period}
          onChange={(event) => setFilter(periodToRange(event.target.value))}
          className="lg:w-44"
        >
          {PERIODS.map((option) => (
            <option key={option.label} value={option.value}>
              {option.label}
            </option>
          ))}
          {period === 'custom' && <option value="custom">Custom range</option>}
        </SelectField>

        <SelectField
          label="Channel"
          value={filters.network}
          onChange={(event) => setFilter({ network: event.target.value, paymentMethod: '' })}
          className="lg:w-44"
        >
          <option value="">All Channels</option>
          {(summary?.networks || []).map((network) => (
            <option key={network.network} value={network.network}>
              {network.label}
            </option>
          ))}
        </SelectField>

        <SelectField
          label="Status"
          value={filters.status}
          onChange={(event) => setFilter({ status: event.target.value })}
          className="lg:w-40"
        >
          <option value="all">All statuses</option>
          <option value="completed">Completed</option>
          <option value="processing">Processing</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
          <option value="cancelled">Cancelled</option>
        </SelectField>

        <SelectField
          label="Class"
          value={filters.class}
          onChange={(event) => setFilter({ class: event.target.value })}
          className="lg:w-40"
        >
          <option value="">All Classes</option>
          {classes.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </SelectField>

        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          aria-label="Refresh transactions"
          title="Refresh"
          className="mb-0.5 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
        </button>
      </div>

      {chips.length > 1 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          <span className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
            <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
            Batches
          </span>
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.apply}
              aria-pressed={chip.active}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-extrabold transition-colors ${
                chip.active
                  ? 'bg-brand-700 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {chip.label}
              <span className={chip.active ? 'text-brand-100' : 'text-slate-400'}>
                ({formatCount(chip.count)})
              </span>
            </button>
          ))}

          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="ml-1 text-[11px] font-extrabold text-brand-700 transition-colors hover:text-brand-800"
            >
              Clear filters
            </button>
          )}
        </div>
      )}
    </Card>
  );
};

export { periodToRange, rangeToPeriod };
export default React.memo(PaymentFilterBar);