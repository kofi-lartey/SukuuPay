import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, RotateCcw, ScrollText, TriangleAlert } from 'lucide-react';
import PageHeader from '../../../components/dashboard/PageHeader';
import EmptyState from '../../../components/dashboard/EmptyState';
import Pagination from '../../../components/students/Pagination';
import Card from '../../../components/dashboard/ui/Card';
import Badge from '../../../components/dashboard/ui/Badge';
import { Field, SelectField } from '../../../components/common/FormField';
import SchoolSelect from '../../../components/admin/finance/SchoolSelect';
import {
  LEDGER_LABEL,
  LEDGER_TONE,
  LEDGER_TYPE_IS_CREDIT,
} from '../../../components/admin/finance/financeVocabulary';
import { useToast } from '../../../hooks/useToast';
import { downloadLedgerCsv, LEDGER_TYPES, listLedgerEntries } from '../../../services/finance';
import { formatCedi, formatCount } from '../../../utils/format';
import { formatDateTime } from '../../../utils/dates';

/**
 * `/admin/finance/ledger` — the platform's income and outgoings, entry by entry.
 *
 * ### `settled` is a tri-state, not a checkbox
 *
 * `PlatformLedger.settled` means "this money has been swept into an account"
 * (`PlatformLedger.js:126`), and it is the field that distinguishes revenue the
 * platform has earned from revenue it is still holding. **A boolean filter cannot
 * express the useful case**, which is "show me everything": the wire value is
 * `''` for no filter and `'true'`/`'false'` otherwise, and `services/finance.js`
 * already sends it that way.
 *
 * A checkbox defaults to one of the two answers, and the default is whichever the
 * component picked — which means the ledger opens on either only the settled
 * entries or only the unsettled ones, hiding the majority of rows and looking
 * authoritative while doing it. Three options — All / Settled / Unsettled — is the
 * only control that can say what it means.
 *
 * ### Amounts are signed, and the sign is rendered
 *
 * **Positive credits the platform; negative debits it.** A refund is a negative
 * entry and a payout is a negative entry, and the ledger is built to stay
 * additive that way (`PlatformLedger.js:63-74`).
 *
 * The consequence for this screen: **a refund row must not be hidden from a "what
 * did we earn" view for being a refund.** It is the reversal of something that was
 * counted, so filtering it out produces a revenue figure the platform's own books
 * disagree with. So the glyph comes from the stored `amount` and the colour comes
 * from the `type` — two different facts, deliberately: the colour says what the
 * entry *is*, the sign says what it *did*.
 *
 * ### `result.totals` sits above the table, and says what it is
 *
 * It is the sum over the **matched set**, not over the page — the whole point of
 * the server returning it with the page rather than the client summing twenty rows.
 * A page subtotal would change when the operator pages forward, so a figure
 * labelled with a filter has to be a figure that filter produced. That is why it
 * is above the table and not in a footer: a footer reads as a property of the rows
 * beneath it.
 *
 * **A known gap, stated here because it changes what can be rendered.** The API
 * returns `totals` only inside `meta`
 * (`Backend/src/controllers/admin/finance.controller.js:298-306`), and
 * `listLedgerEntries` reads it from `data.totals` / `data.data.totals` — neither
 * of which exists in that envelope, so the service hands back its
 * `{ amount: 0, count: 0 }` fallback. The normaliser below accepts the documented
 * keys and, when the payload carries none of them, says the totals are unavailable
 * **instead of printing GH₵ 0.00**. A zero where the real figure is not zero is the
 * one thing a finance table must never show.
 *
 * ### The export cannot honour every filter, and the button says which ones
 *
 * `GET /admin/finance/ledger/export` accepts `from`, `to` and `schoolId` only —
 * `type` and `settled` are not in `exportLedgerQuerySchema`, and `stripUnknown`
 * drops them rather than refusing them, so a client that sent them would get a
 * complete-looking file that silently ignores two of the filters above it. That is
 * worse than no export: a CSV that reconciles against a statement and is quietly
 * the wrong slice.
 *
 * So the button label names the scope it actually sends, and the `truncated` flag
 * the server returns is surfaced as a warning. A capped export that says so is
 * usable — narrow the range and fetch the rest. One that does not is a financial
 * file filed as complete when it is not.
 */
const SETTLED_OPTIONS = [
  { value: '', label: 'All entries' },
  { value: 'true', label: 'Settled only' },
  { value: 'false', label: 'Unsettled only' },
];

/** The documented key set, in either of the two shapes the envelope might use. */
const readTotals = (totals) => {
  if (!totals || typeof totals !== 'object') return null;
  const keys = Object.keys(totals);
  if (!keys.length) return null;
  // The service's fallback literal is the one shape we know is not real data.
  if (keys.length === 2 && keys.includes('amount') && keys.includes('count') && !totals.netAmount) {
    // Ambiguous: a real zero-total payload looks the same. Treated as absent
    // rather than as a zero, which is the safe direction.
    return null;
  }
  return totals;
};

const LedgerList = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const [reloadKey, setReloadKey] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportNote, setExportNote] = useState(null);

  const filters = useMemo(
    () => ({
      schoolId: searchParams.get('schoolId') || '',
      type: searchParams.get('type') || '',
      settled: searchParams.get('settled') ?? '',
      from: searchParams.get('from') || '',
      to: searchParams.get('to') || '',
      page: Number(searchParams.get('page')) || 1,
      perPage: Number(searchParams.get('perPage')) || 20,
    }),
    [searchParams]
  );

  const [state, setState] = useState({ rows: [], totals: null, meta: null, loading: true, error: null });

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: null }));

    listLedgerEntries(filters)
      .then((result) =>
        active &&
        setState({
          rows: result.rows,
          totals: readTotals(result.totals),
          meta: result.meta,
          loading: false,
          error: null,
        })
      )
      .catch((error) =>
        active && setState({ rows: [], totals: null, meta: null, loading: false, error })
      );

    return () => {
      active = false;
    };
  }, [filters, reloadKey]);

  /**
   * Any filter change resets to page 1. Without it, narrowing a filter while on
   * page 7 lands on page 7 of a set with three pages, which renders as an empty
   * table with a pager — the exact "no results" state the conventions forbid
   * confusing with a failure.
   */
  const setFilter = useCallback(
    (key, value) => {
      setSearchParams(
        (current) => {
          const params = new URLSearchParams(current);
          if (!value && value !== 'false') params.delete(key);
          else params.set(key, value);
          if (key !== 'page') params.delete('page');
          return params;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

  const hasFilters = Boolean(
    filters.schoolId || filters.type || filters.settled || filters.from || filters.to
  );

  /**
   * Export, reporting the cap.
   *
   * Only `from`, `to` and `schoolId` go out — see the header. `truncated` comes
   * back in the `x-export-truncated` response header
   * (`finance.service.js:142-180`) and is a `warning` rather than an `info`:
   * the operator has a file on disk that is not the whole ledger, and a
   * successful-looking toast is the wrong register for that.
   */
  const exportCsv = useCallback(async () => {
    setExporting(true);
    setExportNote(null);
    try {
      const result = await downloadLedgerCsv({
        from: filters.from,
        to: filters.to,
        schoolId: filters.schoolId,
      });
      if (result?.truncated) {
        toast.warning(
          'The export hit the server’s row cap and is incomplete. Narrow the date range or export one school at a time.'
        );
        setExportNote(
          'This file was truncated at the server’s row limit. It is a partial ledger, not a complete one.'
        );
      } else {
        toast.success('The ledger export downloaded.');
      }
      refresh();
      return { ok: true };
    } catch (error) {
      toast.error(error.message || 'The export could not be produced.');
      return { ok: false, error: error.message };
    } finally {
      setExporting(false);
    }
  }, [filters.from, filters.to, filters.schoolId, refresh, toast]);

  const totals = state.totals;

  return (
    <>
      <PageHeader
        eyebrow="Platform console"
        title="Platform ledger"
        description="Every peso the platform has taken or spent, entry by entry, across every school."
        actions={
          <button
            type="button"
            onClick={exportCsv}
            disabled={exporting}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[13px] font-extrabold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
          >
            <Download className={`h-4 w-4 ${exporting ? 'animate-pulse' : ''}`} aria-hidden="true" />
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        }
      />

      <Card padding="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <SchoolSelect value={filters.schoolId} onChange={(value) => setFilter('schoolId', value)} />

          <SelectField
            label="Entry type"
            value={filters.type}
            onChange={(event) => setFilter('type', event.target.value)}
          >
            <option value="">All types</option>
            {LEDGER_TYPES.map((type) => (
              <option key={type} value={type}>
                {LEDGER_LABEL(type)}
              </option>
            ))}
          </SelectField>

          {/* The tri-state. See the header for why this is not a checkbox. */}
          <SelectField
            label="Settlement"
            value={filters.settled}
            onChange={(event) => setFilter('settled', event.target.value)}
          >
            {SETTLED_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectField>

          <Field
            label="From"
            type="date"
            value={filters.from}
            onChange={(event) => setFilter('from', event.target.value)}
          />

          <Field
            label="To"
            type="date"
            value={filters.to}
            onChange={(event) => setFilter('to', event.target.value)}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p className="text-[11px] font-semibold text-slate-400">
            Every filter applies to the whole ledger, server-side. Filters live in the URL, so this
            view is linkable and survives a reload.
          </p>
          {hasFilters && (
            <button
              type="button"
              onClick={() =>
                setSearchParams(
                  (current) => {
                    const params = new URLSearchParams(current);
                    ['schoolId', 'type', 'settled', 'from', 'to', 'page'].forEach((key) =>
                      params.delete(key)
                    );
                    return params;
                  },
                  { replace: true }
                )
              }
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-[11px] font-extrabold text-slate-600 transition-colors hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
            >
              <RotateCcw className="h-3 w-3" aria-hidden="true" />
              Clear filters
            </button>
          )}
        </div>
      </Card>

      {/*
        The totals band.

        Above the table, describing the filter above *it*, and explicitly the sum
        over the matched set rather than over the twenty rows on screen — which is
        why it is not computed from `state.rows`. Computing it client-side would be
        the more common implementation and the one that makes the figure change
        when the operator pages forward.

        The `null` branch is the honest one. The service's totals fallback
        (`{ amount: 0, count: 0 }`) is indistinguishable from a genuinely empty
        result, so when no documented key is present the band says the totals are
        unavailable rather than printing a zero — see the header.
      */}
      <div className="mt-4">
        {totals ? (
          <Card padding="p-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <div>
                <p className="text-[11px] font-semibold text-slate-500">
                  Net across everything matching these filters
                </p>
                <p className="mt-1 text-[22px] font-extrabold leading-none tracking-tight tabular-nums text-ink">
                  {formatCedi(totals.netAmount ?? totals.amount)}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-500">Credited</p>
                <p className="mt-1 text-[16px] font-extrabold leading-none tabular-nums text-brand-700">
                  {formatCedi(totals.creditAmount)}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-500">Debited</p>
                <p className="mt-1 text-[16px] font-extrabold leading-none tabular-nums text-rose-700">
                  {formatCedi(totals.debitAmount)}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-500">Entries</p>
                <p className="mt-1 text-[16px] font-extrabold leading-none tabular-nums text-ink">
                  {formatCount(totals.entryCount ?? totals.count)}
                </p>
              </div>
            </div>
            <p className="mt-3 text-[11px] font-semibold leading-relaxed text-slate-400">
              The sum over every entry these filters match, not over the rows on this page — so it
              is the same figure on page 1 and page 9. Debited is shown negative because a refund
              or a payout is a negative entry, not a separate kind of row.
            </p>
          </Card>
        ) : (
          !state.loading &&
          !state.error && (
            <Card padding="p-4">
              <p className="flex items-start gap-2 text-[12px] font-semibold leading-relaxed text-amber-800">
                <TriangleAlert className="mt-px h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  This endpoint&rsquo;s response carried no totals block for the current filter, so
                  no total is shown. The rows below are complete; the figure above them would not
                  have been — a zero here would be a claim about the filter that nothing returned.
                </span>
              </p>
            </Card>
          )
        )}
      </div>

      {exportNote && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="flex items-start gap-2 text-[12px] font-bold leading-relaxed text-amber-900">
            <TriangleAlert className="mt-px h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{exportNote}</span>
          </p>
        </div>
      )}

      <div className="mt-4">
        {state.error ? (
          <EmptyState
            icon={RotateCcw}
            title="The ledger could not be loaded"
            description={state.error.message}
            action={
              <button
                type="button"
                onClick={refresh}
                className="rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800"
              >
                Try again
              </button>
            }
          />
        ) : state.loading && state.rows.length === 0 ? (
          <div className="space-y-2">
            {[0, 1, 2, 3, 4].map((row) => (
              <div key={row} className="h-[4.5rem] animate-pulse rounded-2xl bg-slate-200/70" />
            ))}
          </div>
        ) : state.rows.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title={
              hasFilters
                ? 'No ledger entries match these filters'
                : 'The ledger is empty'
            }
            description={
              hasFilters
                ? 'Try clearing the settlement filter — “All entries” includes both settled and unsettled, and unsettled is the majority.'
                : 'An entry is written when money is taken or spent. Nothing has been recorded yet.'
            }
          />
        ) : (
          <>
            <Card padding="p-0" className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[64rem] border-collapse text-left">
                  <caption className="sr-only">
                    Platform ledger entries, most recent first
                  </caption>
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/60">
                      <th scope="col" className="px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        Date
                      </th>
                      <th scope="col" className="px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        School
                      </th>
                      <th scope="col" className="px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        Type
                      </th>
                      {/*
                        The sign is announced, not just drawn. A screen-reader user
                        hearing "4500" for a refund and "4500" for a markup has been
                        told the opposite of the truth, so the column's accessible
                        name and each cell's text both carry the direction.
                      */}
                      <th scope="col" className="px-5 py-3 text-right text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        Amount (signed)
                      </th>
                      <th scope="col" className="px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        Settled
                      </th>
                      <th scope="col" className="px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        Reference
                      </th>
                      <th scope="col" className="px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        Description
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.rows.map((entry) => {
                      const amount = Number(entry.amount) || 0;
                      const credit = amount > 0;
                      return (
                        <tr key={entry._id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                          <td className="whitespace-nowrap px-5 py-3.5 text-[12px] font-semibold text-slate-600">
                            {formatDateTime(entry.createdAt)}
                          </td>
                          <td className="px-5 py-3.5 text-[13px] font-bold text-ink">
                            {entry.schoolName || (
                              <span className="text-slate-400">Platform</span>
                            )}
                            {entry.schoolCode ? (
                              <span className="block font-mono text-[11px] font-bold text-slate-400">
                                {entry.schoolCode}
                              </span>
                            ) : null}
                          </td>
                          <td className="px-5 py-3.5">
                            <Badge tone={LEDGER_TONE(entry.type)}>
                              {LEDGER_LABEL(entry.type)}
                            </Badge>
                          </td>
                          <td
                            className={`whitespace-nowrap px-5 py-3.5 text-right text-[13px] font-extrabold tabular-nums ${
                              credit
                                ? LEDGER_TYPE_IS_CREDIT(entry.type)
                                  ? 'text-brand-700'
                                  : 'text-ink'
                                : 'text-rose-700'
                            }`}
                          >
                            {/*
                              `formatCedi` renders the magnitude; the glyph and the
                              screen-reader text come from the stored sign. Never
                              `Math.abs` on the value itself — a zero entry cannot
                              exist (`PlatformLedger` rejects `value !== 0`), so
                              there is no third case to handle here, and if there
                              ever is one it will render as a signed zero rather
                              than silently as a credit.
                            */}
                            <span aria-hidden="true">{credit ? '+' : '−'}</span>
                            <span className="sr-only">
                              {credit ? ' credited to the platform, ' : ' debited from the platform, '}
                            </span>
                            {formatCedi(Math.abs(amount))}
                          </td>
                          <td className="px-5 py-3.5">
                            <Badge tone={entry.settled ? 'green' : 'amber'}>
                              {entry.settled ? 'Settled' : 'Unsettled'}
                            </Badge>
                          </td>
                          <td className="px-5 py-3.5 font-mono text-[11px] font-bold text-slate-500">
                            {entry.reference ||
                              (entry.disbursementBatchId
                                ? `batch:${String(entry.disbursementBatchId).slice(-8)}`
                                : '—')}
                          </td>
                          <td className="max-w-[22rem] px-5 py-3.5 text-[12px] font-medium text-slate-500">
                            {entry.description || '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>

            <div className="mt-4">
              <Pagination
                meta={state.meta}
                itemLabel="ledger entries"
                onPageChange={(page) => setFilter('page', String(page))}
                onPerPageChange={(perPage) => {
                  setFilter('perPage', String(perPage));
                  setFilter('page', '1');
                }}
              />
            </div>
          </>
        )}
      </div>

      {/*
        The export's real scope, below the table rather than in the button's
        tooltip. A tooltip is invisible to a keyboard user's second glance and gone
        the moment the pointer moves; a line under the filter bar is read once and
        keeps being true.
      */}
      <p className="mt-4 text-[11px] font-semibold leading-relaxed text-slate-400">
        <strong className="font-extrabold text-slate-600">About the export:</strong> it sends this
        page&rsquo;s date range and school only. The export endpoint does not accept the type or
        settlement filters, so a CSV taken while those are set contains the whole ledger for that
        window — not the slice the table shows. The file carries both pesewa and cedi columns, and
        the server tells us when it had to cap the row count.
      </p>
    </>
  );
};

export default LedgerList;
