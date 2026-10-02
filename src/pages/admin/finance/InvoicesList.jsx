import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Info, Receipt, RotateCcw } from 'lucide-react';
import PageHeader from '../../../components/dashboard/PageHeader';
import EmptyState from '../../../components/dashboard/EmptyState';
import Pagination from '../../../components/students/Pagination';
import Card from '../../../components/dashboard/ui/Card';
import Badge from '../../../components/dashboard/ui/Badge';
import { SelectField } from '../../../components/common/FormField';
import SchoolSelect from '../../../components/admin/finance/SchoolSelect';
import {
  currentMonthKey,
  shiftMonthKey,
} from '../../../components/admin/finance/financeVocabulary';
import { listInvoices } from '../../../services/finance';
import { ADMIN_ROUTES } from '../../../utils/constants';
import { formatCedi, formatCount } from '../../../utils/format';

/**
 * `/admin/finance/invoices` — monthly platform fees for Mode B schools.
 *
 * ### There is no invoice. These rows are derived, and the screen has to say so
 *
 * **There is no `Invoice` collection in this codebase.** A row is derived on read
 * from that school's `PlatformLedger` entries of type `subscription` or
 * `platform_fee` for the month (`Backend/src/services/admin/finance.service.js:510-560`).
 * Two consequences are not cosmetic, and both are printed above the table rather
 * than left in this comment:
 *
 *   1. **There is no invoice number.** A row's identity is `{ schoolId, month }`,
 *      which exists only for as long as the ledger entries do. Nothing here can be
 *      quoted in a dispute, referenced on a bank transfer, or produced as a tax
 *      document — and a correction made by `adjustment` silently restates it.
 *   2. **A month with no charges produces no row at all.** A Mode B school that was
 *      never charged for October does not appear in October's list. It is *absent*,
 *      not listed as owing nothing — so "this school is not on the list" means
 *      "no charges were recorded", and that absence is itself the signal that
 *      billing did not run.
 *
 * So this screen deliberately has **no "Download invoice" action**. A button that
 * produces a PDF implies a durable document exists behind it, and one does not.
 * The export people actually want is the ledger, which is a real export of real
 * records and lives on the ledger screen.
 *
 * ### The list is correct and empty today, and that must not read as good news
 *
 * **Nothing in this codebase writes `subscription` or `platform_fee` ledger
 * entries.** There is no invoice model, no subscription billing service and no
 * billing job. So this endpoint returns an empty, correct list — and an empty
 * table on a collections screen is the single most misleading thing this page
 * could render, because "no school owes a platform fee" reads as a healthy
 * platform rather than as a missing writer.
 *
 * Hence the standing note above the table, which is visible in every state
 * including the populated one: the emptiness is a property of the codebase, not a
 * finding about the schools. It disappears the moment a billing writer exists and
 * a developer should delete it then — which is why it says so.
 *
 * ### `month` is required by the endpoint and lives in the URL
 *
 * `listInvoicesQuerySchema` requires `month` in `YYYY-MM` and the service
 * re-checks it (`MONTH_REQUIRED`, 400), because an invoice list with no month
 * would have to guess between "this month" — which silently hides that March is
 * still unpaid — and "all time", which is a sum of months rather than a list of
 * invoices. So the month is a first-class control here, steppable a month at a
 * time, and in the query string so a specific month is linkable.
 *
 * **`month` is not currently on the wire.** `services/finance.js`'s `listInvoices`
 * accepts `page`, `perPage`, `schoolId` and `status` and sends none of a month, so
 * the request is refused with the endpoint's own message. The control and the
 * filters are built anyway, because the fix belongs in the service's parameter
 * list and not in a screen; the error is surfaced as the server words it rather
 * than being swallowed into an empty table that looks like a result.
 */
const STATUS_FILTERS = [
  { value: '', label: 'Both due and paid' },
  { value: 'due', label: 'Due only' },
  { value: 'paid', label: 'Paid only' },
];

const STATUS_TONES = { due: 'amber', paid: 'green' };
const STATUS_COPY = {
  due: 'A charge was recorded for the month and no matching entry has settled.',
  paid: 'At least one charge for the month has settled — the money left the float.',
};

const monthLabel = (key) => {
  const [year, month] = String(key || '').split('-').map(Number);
  if (!year || !month) return key || '';
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleString('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
};

const InvoicesList = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [reloadKey, setReloadKey] = useState(0);

  const month = searchParams.get('month') || currentMonthKey();

  const filters = useMemo(
    () => ({
      schoolId: searchParams.get('schoolId') || '',
      status: searchParams.get('status') || '',
      page: Number(searchParams.get('page')) || 1,
      perPage: Number(searchParams.get('perPage')) || 20,
    }),
    [searchParams]
  );

  const [state, setState] = useState({ rows: [], meta: null, loading: true, error: null });

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: null }));

    listInvoices(filters)
      .then((result) =>
        active && setState({ rows: result.rows, meta: result.meta, loading: false, error: null })
      )
      .catch((error) => active && setState({ rows: [], meta: null, loading: false, error }));

    return () => {
      active = false;
    };
  }, [filters, reloadKey]);

  const setFilter = useCallback(
    (key, value) => {
      setSearchParams(
        (current) => {
          const params = new URLSearchParams(current);
          if (!value) params.delete(key);
          else params.set(key, value);
          if (key !== 'page') params.delete('page');
          return params;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const setMonth = useCallback(
    (value) => {
      setSearchParams(
        (current) => {
          const params = new URLSearchParams(current);
          if (!value || value === currentMonthKey()) params.delete('month');
          else params.set('month', value);
          params.delete('page');
          return params;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

  const hasFilters = Boolean(filters.schoolId || filters.status);
  const total = state.rows.reduce((sum, row) => sum + (Number(row.total) || 0), 0);
  const dueCount = state.rows.filter((row) => row.status === 'due').length;

  return (
    <>
      <PageHeader
        eyebrow="Platform console"
        title="Invoices"
        description="Monthly subscription and platform fees, derived from the ledger. There is no invoice document behind these rows."
        actions={
          <button
            type="button"
            onClick={refresh}
            disabled={state.loading}
            aria-label="Refresh the invoice list"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[13px] font-extrabold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
          >
            <RotateCcw
              className={`h-4 w-4 ${state.loading ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            Refresh
          </button>
        }
      />

      {/*
        Two facts, on screen, above everything.

        The first is the one that would otherwise be discovered as a bug: nothing
        writes `subscription` or `platform_fee` ledger entries yet, so this list is
        empty and correct. Saying it here rather than only in this comment is what
        stops an operator reading "no school owes a platform fee" as a healthy
        platform.

        The second is why there is no download button and no invoice number. A row
        here is a sum of ledger entries, not an artefact — which means it cannot be
        quoted in a dispute and a later `adjustment` restates it silently.
      */}
      <div className="mb-4 space-y-2">
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <Info className="mt-px h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
          <p className="text-[12px] font-semibold leading-relaxed text-amber-900">
            <strong className="font-extrabold">This list is empty by design, and that is not good
            news.</strong> Nothing in SukuuPay writes <code className="font-mono">subscription</code>{' '}
            or <code className="font-mono">platform_fee</code> ledger entries yet — there is no
            billing service or billing job. So &ldquo;no school here&rdquo; means{' '}
            <em>no charges were ever recorded</em>, not <em>no school owes anything</em>. This screen
            becomes useful the moment a billing writer exists; when it does, this note should be
            deleted.
          </p>
        </div>

        <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3">
          <Info className="mt-px h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
          <p className="text-[12px] font-semibold leading-relaxed text-slate-600">
            <strong className="font-extrabold text-ink">These are computed rows, not
            documents.</strong> Each one is summed from a school&rsquo;s ledger entries for the month,
            so there is no invoice number to quote in a dispute, and a later{' '}
            <code className="font-mono">adjustment</code> restates it without telling anybody. A
            school with no charges for the month has <strong>no row at all</strong> rather than a row
            owing nothing — so a missing school is itself a finding. For the underlying records, use{' '}
            <Link
              to={ADMIN_ROUTES.LEDGER}
              className="font-extrabold text-brand-700 underline-offset-2 hover:underline"
            >
              the platform ledger
            </Link>
            .
          </p>
        </div>
      </div>

      <Card padding="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/*
            Month as a stepper rather than a `<select>` of months.

            A dropdown would have to enumerate every month since launch to be
            complete, and would offer years nobody wants; a stepper asks the
            question people actually have ("last month", "the month before"),
            works from any current month, and cannot produce an invalid `YYYY-MM`.
          */}
          <div>
            <label
              htmlFor="invoice-month"
              className="mb-0.5 block text-[11px]/[15px] font-semibold text-slate-700"
            >
              Month
            </label>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setMonth(shiftMonthKey(month, -1))}
                aria-label="Previous month"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
              <span
                id="invoice-month"
                className="flex h-9 flex-1 items-center justify-center rounded-lg border border-slate-200 bg-white px-2 text-[13px]/[18px] font-extrabold text-ink"
              >
                {monthLabel(month)}
              </span>
              <button
                type="button"
                onClick={() => setMonth(shiftMonthKey(month, 1))}
                disabled={month >= currentMonthKey()}
                aria-label="Next month"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <p className="mt-1 text-[10px]/[14px] font-medium text-slate-500">
              Charges are attributed to the month the ledger entry was written.
            </p>
          </div>

          <SchoolSelect value={filters.schoolId} onChange={(value) => setFilter('schoolId', value)} />

          <SelectField
            label="Status"
            value={filters.status}
            onChange={(event) => setFilter('status', event.target.value)}
            hint={filters.status ? STATUS_COPY[filters.status] : undefined}
          >
            {STATUS_FILTERS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectField>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p className="text-[11px] font-semibold text-slate-400">
            The month is required by the API — an invoice list with no month could not be a list of
            invoices. Filters live in the URL.
          </p>
          {hasFilters && (
            <button
              type="button"
              onClick={() =>
                setSearchParams(
                  (current) => {
                    const params = new URLSearchParams(current);
                    ['schoolId', 'status', 'page'].forEach((key) => params.delete(key));
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

      <div className="mt-4">
        {state.error ? (
          <EmptyState
            icon={RotateCcw}
            title="The invoice list could not be loaded"
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
            {[0, 1, 2].map((row) => (
              <div key={row} className="h-[4.5rem] animate-pulse rounded-2xl bg-slate-200/70" />
            ))}
          </div>
        ) : state.rows.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title={
              hasFilters
                ? 'No derived rows match these filters'
                : `Nothing was charged in ${monthLabel(month)}`
            }
            description={
              hasFilters
                ? 'Try clearing the status filter. A school appears here only when the ledger holds a charge for it in this month.'
                : 'That is the expected result today, because no billing writer exists to record a monthly fee. It is not a statement that every school is up to date.'
            }
          />
        ) : (
          <>
            <Card padding="p-0" className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[52rem] border-collapse text-left">
                  <caption className="sr-only">
                    Derived monthly platform fees for {monthLabel(month)}
                  </caption>
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/60">
                      <th scope="col" className="px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        School
                      </th>
                      <th scope="col" className="px-5 py-3 text-right text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        Subscription fee
                      </th>
                      <th scope="col" className="px-5 py-3 text-right text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        Platform fee
                      </th>
                      <th scope="col" className="px-5 py-3 text-right text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        Total
                      </th>
                      <th scope="col" className="px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.rows.map((row) => (
                      <tr
                        key={row.schoolId}
                        className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60"
                      >
                        <td className="px-5 py-3.5">
                          <Link
                            to={`${ADMIN_ROUTES.LEDGER}?schoolId=${row.schoolId}`}
                            className="text-[13px] font-extrabold text-ink underline-offset-2 hover:text-brand-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
                          >
                            {row.schoolName || 'Unknown school'}
                          </Link>
                          <span className="block text-[11px] font-semibold text-slate-400">
                            {row.schoolCode || '—'}
                            {row.plan ? ` · ${row.plan}` : ''}
                            {row.gatewayMode ? ` · ${row.gatewayMode}` : ''}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-5 py-3.5 text-right text-[13px] font-semibold tabular-nums text-slate-600">
                          {formatCedi(row.subscriptionFee)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3.5 text-right text-[13px] font-semibold tabular-nums text-slate-600">
                          {formatCedi(row.platformFee)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3.5 text-right text-[13px] font-extrabold tabular-nums text-ink">
                          {formatCedi(row.total)}
                        </td>
                        <td className="px-5 py-3.5">
                          {/*
                            `due`/`paid` and nothing more specific. Not "invoice
                            status" and not "OVERDUE": the derived rule is "at least one
                            charge for the month has a settled entry", which is a
                            weaker guarantee than an invoice payment record and does
                            not support a dunning claim. Calling it overdue would be
                            a statement the data cannot make.
                          */}
                          <Badge tone={STATUS_TONES[row.status] || 'slate'}>
                            {row.status === 'paid' ? 'Paid' : 'Due'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/*
                The sum over the page, labelled as such. Not presented as the
                month's total — this endpoint does not return a totals block
                through `services/finance.js`, so the page sum is the only figure
                available and calling it "the month's total" would be a claim about
                rows nobody has seen.
              */}
              <p className="border-t border-slate-100 px-5 py-3 text-[11px] font-semibold leading-relaxed text-slate-400">
                <span className="font-extrabold text-ink">{formatCedi(total)}</span> across the{' '}
                {formatCount(state.rows.length)} row{state.rows.length === 1 ? '' : 's'} shown, of
                which <span className="font-extrabold text-ink">{formatCount(dueCount)}</span> are
                due. A row exists only because the ledger holds a charge for that school this month.
              </p>
            </Card>

            <div className="mt-4">
              <Pagination
                meta={state.meta}
                itemLabel="rows"
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
        The deliberate absence, stated so it is not read as an oversight.

        "No Download invoice" is a decision with a reason, and a reader who finds
        the screen without one will otherwise assume the feature was forgotten. The
        ledger export is the real, durable export of the same figures — it is a file
        of actual records, with a row cap it tells you about, and it is the thing
        somebody reconciling a month should use.
      */}
      <p className="mt-4 text-[11px] font-semibold leading-relaxed text-slate-400">
        <strong className="font-extrabold text-slate-600">There is no download here, and that is
        deliberate.</strong> A document button would imply a durable artefact behind each row, and
        there is none — the numbers come from ledger entries that may be adjusted later. For a file
        you can actually reconcile, export the{' '}
        <Link
          to={ADMIN_ROUTES.LEDGER}
          className="font-extrabold text-brand-700 underline-offset-2 hover:underline"
        >
          platform ledger
        </Link>{' '}
        instead; it is a CSV of the real records, and it tells you when it had to cap the row count.
      </p>
    </>
  );
};

export default InvoicesList;
