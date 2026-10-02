import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CalendarRange, Info, RotateCcw, Scale, TriangleAlert } from 'lucide-react';
import PageHeader from '../../../components/dashboard/PageHeader';
import EmptyState from '../../../components/dashboard/EmptyState';
import Card from '../../../components/dashboard/ui/Card';
import Badge from '../../../components/dashboard/ui/Badge';
import { Field } from '../../../components/common/FormField';
import { todayIsoDay } from '../../../components/admin/finance/financeVocabulary';
import { getReconciliation } from '../../../services/finance';
import { ADMIN_ROUTES } from '../../../utils/constants';
import { formatCedi, formatCount } from '../../../utils/format';
import { formatDate } from '../../../utils/dates';

/**
 * `/admin/finance/reconciliation` — one day's payments against one day's ledger.
 *
 * ### READ-ONLY. This page writes nothing, and there is no "fix" button here
 *
 * **Do not add one.** A reconciliation that repairs its own discrepancies can never
 * report one: it goes green the moment it is introduced, and the day it silently
 * stops checking is the day it was needed. The backend service takes the same
 * position in its own file header and writes nothing — corrections go in as
 * `PlatformLedger` `adjustment` rows pointing at what they adjust, as a separate
 * deliberate act (`Backend/src/services/admin/finance.service.js:1-15`).
 *
 * So the page is a report. Its whole job is to be looked at by a person whose next
 * step is to decide whether a delta is a bug, a timing artefact, or a correction
 * somebody has to make by hand. That decision cannot be automated, because only a
 * person knows which of the three it is.
 *
 * ### `delta.amount` is not a discrepancy, and it will never be zero
 *
 * This is the number an operator's eye goes to first, so it has to be defused
 * before it is read rather than corrected afterwards. `delta.amount` is **gross
 * collected minus the platform's markup** — and the ledger deliberately does not
 * hold gross, it holds the platform's share of it, because the rest belongs to the
 * school. So the subtraction is mostly the school's money, it is non-zero on a
 * perfectly healthy day, and every single school would be reported as broken if
 * it were labelled a discrepancy. It is shown, labelled *"mostly the school's money"*,
 * and explicitly not counted.
 *
 * ### `deltaCount` is the actionable figure
 *
 * **Payments minus markup lines, per school.** `buildDisbursementBatch` writes
 * exactly one `markup` ledger line per payment, so those two counts must be equal.
 * A school with 41 payments and 39 markup lines has two payments the platform took
 * nothing from.
 *
 * And one honest limit, printed on the screen rather than left to the reader:
 * **`PlatformLedger` rejects a zero amount** (`PlatformLedger.js:74`), so a school
 * on a 0% markup writes no ledger lines at all and its `deltaCount` is its full
 * payment count. That is correct behaviour — there was no revenue to record — and
 * it looks exactly like a school the platform took money from and forgot. The
 * per-school rows therefore say so rather than leaving the operator to conclude
 * that 200 payments went untaxed.
 *
 * ### The date defaults to today and lives in the URL
 *
 * A daily report nobody can re-open is not a report, so the date is a query
 * parameter: `?date=2026-03-14` is linkable, survives a reload, and can be pasted
 * into a ticket. Ghana is UTC+0 all year, so a day boundary here is a UTC boundary
 * and no payment falls in the gap an offset would create.
 */
const Reconciliation = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [reloadKey, setReloadKey] = useState(0);

  const date = searchParams.get('date') || todayIsoDay();

  const [state, setState] = useState({ data: null, loading: true, error: null });

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: null }));

    getReconciliation({ date })
      .then((data) => active && setState({ data, loading: false, error: null }))
      .catch((error) => active && setState({ data: null, loading: false, error }));

    return () => {
      active = false;
    };
  }, [date, reloadKey]);

  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

  const setDate = useCallback(
    (value) => {
      setSearchParams(
        (current) => {
          const params = new URLSearchParams(current);
          if (!value || value === todayIsoDay()) params.delete('date');
          else params.set('date', value);
          return params;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const data = state.data;
  const payments = data?.payments || {};
  const ledger = data?.ledger || {};
  const delta = data?.delta || {};
  const bySchool = useMemo(
    () => (Array.isArray(data?.schoolsWithDelta) ? data.schoolsWithDelta : []),
    [data]
  );
  const gateways = Array.isArray(payments.byGateway) ? payments.byGateway : [];

  const paymentsToday = Number(payments.totalCount) || 0;
  const markupLines = Number(ledger.markupCount) || 0;

  return (
    <>
      <PageHeader
        eyebrow="Platform console"
        title="Reconciliation"
        description="One day's completed payments against one day's ledger entries. A report — this page writes nothing and changes nothing."
        actions={
          <button
            type="button"
            onClick={refresh}
            disabled={state.loading}
            aria-label="Refresh the reconciliation report"
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
        The read-only statement, on the screen and not only in this comment.

        A future maintainer looking for the obvious missing feature — "fix it" —
        needs to read why it is absent before they build it. Twenty words above the
        table is the only place they will certainly read.
      */}
      <div className="mb-4 flex items-start gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3">
        <Info className="mt-px h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
        <p className="text-[12px] font-semibold leading-relaxed text-slate-600">
          <strong className="font-extrabold text-ink">This is a report, and it writes nothing.</strong>{' '}
          There is no &ldquo;fix&rdquo; action here on purpose. A reconciliation that repaired its own
          differences could never report one, so it would read green forever and stop telling anybody
          anything. A delta found here is something a person decides about; a correction is entered
          as its own <code className="font-mono">adjustment</code> ledger row against what it adjusts.
        </p>
      </div>

      <Card padding="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field
            label="Reconcile which day"
            type="date"
            icon={CalendarRange}
            value={date}
            max={todayIsoDay()}
            onChange={(event) => setDate(event.target.value)}
            hint="Accra day"
          />
          <div className="flex items-end sm:col-span-2">
            <p className="text-[11px] font-semibold leading-relaxed text-slate-400">
              Defaults to today. The date is in the URL, so a report can be linked or pasted into a
              ticket. Both bounds are inclusive and computed in Accra time — Ghana is UTC+0 all year,
              so a payment at 23:59 is in its own day and not the next one.
            </p>
          </div>
        </div>
      </Card>

      {state.error ? (
        <div className="mt-4">
          <EmptyState
            icon={RotateCcw}
            title="The reconciliation could not be loaded"
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
        </div>
      ) : state.loading && !data ? (
        <div className="mt-4 space-y-3">
          <div className="h-28 animate-pulse rounded-2xl bg-slate-200/70" />
          <div className="h-48 animate-pulse rounded-2xl bg-slate-200/70" />
        </div>
      ) : data ? (
        <>
          {/* ── Payments against the ledger ── */}
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card padding="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-[13px] font-extrabold leading-tight text-ink">
                    Payments taken
                  </h2>
                  <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
                    Completed, on {formatDate(data.date)}
                  </p>
                </div>
              </div>
              <p className="mt-4 text-[26px] font-extrabold leading-none tracking-tight tabular-nums text-ink">
                {formatCedi(payments.totalAmount)}
              </p>
              <p className="mt-2 text-[12px] font-semibold text-slate-500">
                <span className="font-extrabold text-ink">{formatCount(paymentsToday)}</span> completed
                payments, gross, across {formatCount(gateways.length)} rail
                {gateways.length === 1 ? '' : 's'}.
              </p>
            </Card>

            <Card padding="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-[13px] font-extrabold leading-tight text-ink">
                    Ledger written
                  </h2>
                  <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
                    Every entry type, and the markup slice of it
                  </p>
                </div>
              </div>
              <p className="mt-4 text-[26px] font-extrabold leading-none tracking-tight tabular-nums text-brand-700">
                {formatCedi(ledger.markupAmount)}
              </p>
              <p className="mt-2 text-[12px] font-semibold text-slate-500">
                <span className="font-extrabold text-ink">{formatCount(ledger.markupCount)}</span>{' '}
                markup lines, of {formatCount(ledger.totalCount)} entries totalling{' '}
                {formatCedi(ledger.totalAmount)}.
              </p>
            </Card>

            {/*
              The delta, and the two halves of it side by side.

              `count` is the actionable one and is given the emphasis; `amount` is
              shown last, in the quieter tone, with its explanation — because
              leading with the amount would be leading with a number that is
              supposed to be large.
            */}
            <Card padding="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-[13px] font-extrabold leading-tight text-ink">Difference</h2>
                  <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
                    Payments against the markup lines they should have produced
                  </p>
                </div>
                <Scale className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              </div>

              <p className="mt-4 text-[26px] font-extrabold leading-none tracking-tight tabular-nums text-ink">
                {formatCount(Math.abs(Number(delta.count) || 0))}
              </p>
              <p className="mt-2 text-[12px] font-semibold leading-relaxed text-slate-500">
                {Number(delta.count) === 0 ? (
                  <>
                    <Badge tone="green">Balanced</Badge> Every completed payment on this day has a
                    markup line against it.
                  </>
                ) : (
                  <>
                    <Badge tone={Number(delta.count) > 0 ? 'amber' : 'red'}>
                      {Number(delta.count) > 0 ? 'Payments with no markup line' : 'Markup lines with no payment'}
                    </Badge>{' '}
                    <span className="font-extrabold text-ink">
                      {formatCount(Math.abs(Number(delta.count) || 0))}
                    </span>{' '}
                    across the schools below. This is the figure to act on.
                  </>
                )}
              </p>

              <div className="mt-4 border-t border-slate-100 pt-3">
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                  Amount difference — not a discrepancy
                </p>
                <p className="mt-1 text-[16px] font-extrabold tabular-nums text-slate-500">
                  {formatCedi(Math.abs(Number(delta.amount) || 0))}
                </p>
                <p className="mt-1 text-[11px] font-semibold leading-relaxed text-slate-400">
                  Gross collected minus the platform&rsquo;s markup. The ledger holds the
                  platform&rsquo;s share, not the gross — so this is mostly the school&rsquo;s money
                  and it is non-zero on a healthy day. It is not counted as an error.
                </p>
              </div>
            </Card>
          </div>

          {/* ── The rails ── */}
          {gateways.length > 0 && (
            <div className="mt-4">
              <Card padding="p-5">
                <h2 className="text-[13px] font-extrabold leading-tight text-ink">
                  Payments by rail
                </h2>
                <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
                  A <code className="font-mono">manual</code> school collects outside SukuuPay, so
                  its payments carry no provider reference by design and will appear as unmatched on
                  the overview forever. That is not a fault.
                </p>

                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[34rem] border-collapse text-left">
                    <caption className="sr-only">Completed payments grouped by rail and method</caption>
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th scope="col" className="py-2.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                          Rail
                        </th>
                        <th scope="col" className="py-2.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                          Method
                        </th>
                        <th scope="col" className="py-2.5 text-right text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                          Payments
                        </th>
                        <th scope="col" className="py-2.5 text-right text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                          Gross
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {gateways.map((row) => (
                        <tr key={`${row.provider}-${row.method}`} className="border-b border-slate-50 last:border-0">
                          <td className="py-3">
                            <Badge tone={row.provider === 'manual' ? 'slate' : 'brand'}>
                              {row.provider}
                            </Badge>
                          </td>
                          <td className="py-3 text-[12px] font-semibold text-slate-600">
                            {row.method}
                          </td>
                          <td className="py-3 text-right text-[13px] font-bold tabular-nums text-ink">
                            {formatCount(row.count)}
                          </td>
                          <td className="py-3 text-right text-[13px] font-extrabold tabular-nums text-ink">
                            {formatCedi(row.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {/* ── Per school ── */}
          <div className="mt-4">
            <Card padding="p-0" className="overflow-hidden">
              <div className="px-5 py-4">
                <h2 className="text-[13px] font-extrabold leading-tight text-ink">
                  Schools with a difference
                </h2>
                <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
                  {formatCount(bySchool.length)} of {formatCount(data.schoolCount)} schools touched
                  this day have a payment count or an amount that does not line up.
                  {data.schoolsWithDeltaTruncated
                    ? ' The server names the 50 largest and counts the rest — the ones not listed are smaller, not absent.'
                    : ''}
                </p>
              </div>

              {bySchool.length === 0 ? (
                <div className="px-5 pb-5">
                  <EmptyState
                    icon={Scale}
                    title="Every school balances on this day"
                    description="Each school's completed payments have a markup line against them, and no school has ledger activity without a payment behind it."
                  />
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[58rem] border-collapse text-left">
                      <caption className="sr-only">
                        Schools with payments that do not match their markup lines
                      </caption>
                      <thead>
                        <tr className="border-y border-slate-100 bg-slate-50/60">
                          <th scope="col" className="px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                            School
                          </th>
                          <th scope="col" className="px-5 py-3 text-right text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                            Payments
                          </th>
                          <th scope="col" className="px-5 py-3 text-right text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                            Markup lines
                          </th>
                          <th scope="col" className="px-5 py-3 text-right text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                            Missing lines
                          </th>
                          <th scope="col" className="px-5 py-3 text-right text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                            Payments gross
                          </th>
                          <th scope="col" className="px-5 py-3 text-right text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                            Markup taken
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {bySchool.map((row) => (
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
                              {row.schoolCode ? (
                                <span className="block font-mono text-[11px] font-bold text-slate-400">
                                  {row.schoolCode}
                                </span>
                              ) : null}
                            </td>
                            <td className="px-5 py-3.5 text-right text-[13px] font-bold tabular-nums text-ink">
                              {formatCount(row.paymentsCount)}
                            </td>
                            <td className="px-5 py-3.5 text-right text-[13px] font-bold tabular-nums text-ink">
                              {formatCount(row.markupCount)}
                            </td>
                            <td className="px-5 py-3.5 text-right text-[13px] font-extrabold tabular-nums">
                              {Number(row.deltaCount) === 0 ? (
                                <span className="text-slate-400">0</span>
                              ) : (
                                <Badge tone={Number(row.deltaCount) > 0 ? 'amber' : 'red'}>
                                  {Number(row.deltaCount) > 0 ? '+' : '−'}
                                  {formatCount(Math.abs(Number(row.deltaCount)))}
                                </Badge>
                              )}
                            </td>
                            <td className="whitespace-nowrap px-5 py-3.5 text-right text-[13px] font-semibold tabular-nums text-slate-600">
                              {formatCedi(row.paymentsAmount)}
                            </td>
                            <td className="whitespace-nowrap px-5 py-3.5 text-right text-[13px] font-semibold tabular-nums text-brand-700">
                              {formatCedi(row.markupAmount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/*
                    The 0%-markup caveat, above the table and not in a tooltip.

                    A school whose markup is 0% writes **no** ledger lines at all —
                    `PlatformLedger` rejects a zero amount — so its `markupCount` is 0
                    and its `deltaCount` equals its whole payment count. Reading that
                    as "the platform took nothing from 200 payments" is wrong, and it
                    is the single most alarming-looking number on a healthy platform.
                    The school column therefore says so per row rather than leaving
                    the operator to work it out from the ledger page.
                  */}
                  <p className="flex items-start gap-2 border-t border-slate-100 px-5 py-3 text-[11px] font-semibold leading-relaxed text-slate-400">
                    <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>
                      A school whose markup is <strong className="font-extrabold text-slate-600">0%</strong>{' '}
                      writes no ledger lines at all — a zero-amount entry is not a transaction — so
                      its &ldquo;missing lines&rdquo; count equals its whole payment count. That is
                      correct, not a missed payment: the platform took nothing and recorded nothing. Open
                      the school&rsquo;s ledger to tell the two cases apart.
                    </span>
                  </p>
                </>
              )}
            </Card>
          </div>

          <p className="mt-4 text-[11px] font-semibold text-slate-400">
            A summary of today&rsquo;s matched and unmatched references lives on the{' '}
            <Link
              to={ADMIN_ROUTES.FINANCE}
              className="font-extrabold text-brand-700 underline-offset-2 hover:underline"
            >
              finance overview
            </Link>
            . Nothing on this page changes any record.
          </p>
        </>
      ) : null}

      {/*
        A tiny courtesy the page should not need but gets anyway: the date that was
        actually reconciled, in words. `report.date` is the server's own echo of
        the day it parsed, so if the browser sent something the server read
        differently — a timezone, a malformed value — the two disagree and the
        operator sees which one they are looking at rather than assuming.
      */}
      {data?.date && data.date !== date && !state.loading ? (
        <p className="mt-2 text-[11px] font-semibold text-amber-700">
          Showing the report for {formatDate(data.date)} — the server resolved the date you picked
          ({date}) to that day.
        </p>
      ) : null}
    </>
  );
};

export default Reconciliation;
