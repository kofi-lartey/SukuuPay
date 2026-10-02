import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import Card from '../../dashboard/ui/Card';
import Badge from '../../dashboard/ui/Badge';
import EmptyState from '../../dashboard/EmptyState';
import Pagination from '../../students/Pagination';
import { SelectField } from '../../common/FormField';
import { LEDGER_TYPES, listLedgerEntries } from '../../../services/finance';
import { formatCedi, formatCount } from '../../../utils/format';
import { formatDate } from '../../../utils/dates';

/**
 * The platform's own income from one school, entry by entry.
 *
 * ── Why this is the Ledger tab and not the school's fee ledger ──
 *
 * `PlatformLedger` records what *SukuuPay* earned from this tenant — markup skims,
 * monthly platform fees, SMS, gateway fees, refunds, payouts. It is not the school's
 * own books, which live in `Payment` and are the Payments tab's subject. Putting the
 * two side by side without a heading is how a reader comes away believing a school's
 * fee ledger is on this screen, so the panel's own subtitle says which one it is.
 *
 * ── Settled vs unsettled is the distinction that matters ──
 *
 * `settled` is not a nicety: an unsettled entry is *accrued* — taken from a parent,
 * shown on the dashboard, not yet in an account. A per-type total that merged the two
 * would answer "what has Kumasi Basic earned us" with a figure that includes money
 * still sitting in the gateway, which is the exact confusion the field exists to
 * prevent. So the band splits them rather than summing to one number, and the
 * tri-state filter is `'' | true | false` rather than a boolean: there is no way to
 * express "either" with a boolean, and defaulting it to "not settled" would hide
 * every settled entry — which is the majority.
 *
 * Signs are preserved. A `refund` entry is negative and is supposed to reduce the
 * balance, so it is never absolutised on the way to the screen.
 *
 * `totals` arrives with the response and is summed over the **matched** set, so the
 * figure above the table describes the filter above it rather than the page below it.
 */
const SchoolLedgerTab = ({ school, record }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [reloadKey, setReloadKey] = useState(0);

  const type = searchParams.get('type') || '';
  const settled = searchParams.get('settled') || '';
  const page = Number(searchParams.get('page')) || 1;
  const perPage = Number(searchParams.get('perPage')) || 20;

  const [state, setState] = useState({
    rows: [],
    totals: { amount: 0, count: 0 },
    meta: null,
    loading: true,
    error: null,
  });

  const filters = useMemo(() => ({ type, settled, page, perPage }), [type, settled, page, perPage]);

  useEffect(() => {
    if (!school?._id) return undefined;
    let active = true;
    setState((current) => ({ ...current, loading: true, error: null }));

    listLedgerEntries({
      schoolId: school._id,
      page,
      perPage,
      type: type || undefined,
      // Sent as a string, and only when set: `services/finance.js` drops `''` and
      // forwards `'true'`/`'false'`, which is the only way to say "either".
      //
      // It used to be written twice in this object literal — once bare and once
      // guarded. In an object literal the **last** key wins, so the behaviour was
      // correct by accident and `vite build` failed on the duplicate. One key, with
      // the guard, so it is right on purpose rather than by ordering.
      settled: settled === '' ? undefined : settled,
    })
      .then((result) =>
        active &&
        setState({
          rows: result.rows,
          totals: result.totals || { amount: 0, count: 0 },
          meta: result.meta,
          loading: false,
          error: null,
        })
      )
      .catch((error) =>
        active && setState({ rows: [], totals: { amount: 0, count: 0 }, meta: null, loading: false, error })
      );

    return () => {
      active = false;
    };
  }, [school?._id, filters, reloadKey]);

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

  if (!school) return null;

  const summary = record?.ledgerSummary || {};
  const byType = summary.byType || {};
  const hasFilters = Boolean(type || settled);

  return (
    <div className="space-y-4">
      {/*
        The lifetime picture, from the detail payload's own aggregation rather than
        summing the page below. `getAdminSchoolDetail` groups on `(type, settled)`
        server-side for exactly this reason — a client fold over a page of twenty
        entries would report the twenty as the school's whole history with the
        platform.
      */}
      <Card padding="p-5">
        <h2 className="text-[13px] font-extrabold leading-tight text-ink">
          What SukuuPay has earned from this school
        </h2>
        <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
          Not the school&rsquo;s own fee ledger — that is the Payments tab. Every figure is in pesewas
          on the wire and cedis on screen.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-slate-50 px-3.5 py-3">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Lifetime
            </p>
            <p className="mt-0.5 text-[17px] font-extrabold tabular-nums text-ink">
              {formatCedi(summary.total)}
            </p>
          </div>
          <div className="rounded-xl bg-emerald-50 px-3.5 py-3">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">
              Settled
            </p>
            <p className="mt-0.5 text-[17px] font-extrabold tabular-nums text-emerald-800">
              {formatCedi(summary.settled)}
            </p>
            <p className="text-[10px] font-semibold text-emerald-700">in an account</p>
          </div>
          <div className="rounded-xl bg-amber-50 px-3.5 py-3">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700">
              Unsettled
            </p>
            <p className="mt-0.5 text-[17px] font-extrabold tabular-nums text-amber-800">
              {formatCedi(summary.unsettled)}
            </p>
            <p className="text-[10px] font-semibold text-amber-700">accrued, not yet in an account</p>
          </div>
        </div>

        {Object.keys(byType).length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {Object.entries(byType).map(([entryType, entry]) => (
              <Badge key={entryType} tone="slate">
                {entryType} · {formatCedi(entry.amount)} ({formatCount(entry.count)})
              </Badge>
            ))}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SelectField
          label="Entry type"
          value={type}
          onChange={(event) => setFilter('type', event.target.value)}
        >
          <option value="">Every type</option>
          {LEDGER_TYPES.map((value) => (
            <option key={value} value={value}>
              {value.replace(/_/g, ' ')}
            </option>
          ))}
        </SelectField>

        <SelectField
          label="Settlement"
          value={settled}
          onChange={(event) => setFilter('settled', event.target.value)}
        >
          <option value="">Settled and unsettled</option>
          <option value="true">Settled only — money in an account</option>
          <option value="false">Unsettled only — accrued</option>
        </SelectField>
      </div>

      {state.error ? (
        <EmptyState
          icon={BookOpen}
          title="The platform ledger for this school could not be loaded"
          description={state.error.message}
          action={
            <button
              type="button"
              onClick={() => setReloadKey((key) => key + 1)}
              className="rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800"
            >
              Try again
            </button>
          }
        />
      ) : (
        <Card padding="p-0" className="overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              Matched entries
            </p>
            <p className="mt-1 text-xl font-extrabold tabular-nums text-ink">
              {formatCedi(state.totals.amount)}
              <span className="ml-2 text-[12px] font-semibold text-slate-500">
                {formatCount(state.totals.count)} entries
              </span>
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] border-collapse text-left">
              <caption className="sr-only">Platform ledger entries for this school</caption>
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  {['Date', 'Type', 'Reference', 'Settled', 'Amount'].map((label) => (
                    <th
                      key={label}
                      scope="col"
                      className={`whitespace-nowrap px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400 ${
                        label === 'Amount' ? 'text-right' : ''
                      }`}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {state.loading && state.rows.length === 0
                  ? [0, 1, 2, 3].map((row) => (
                      <tr key={row} className="border-b border-slate-50">
                        <td colSpan={5} className="px-5 py-4">
                          <div className="h-5 animate-pulse rounded bg-slate-100" />
                        </td>
                      </tr>
                    ))
                  : state.rows.map((entry) => (
                      <tr
                        key={entry._id}
                        className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60"
                      >
                        <td className="whitespace-nowrap px-5 py-3.5 text-[12px] font-semibold text-slate-500">
                          {formatDate(entry.createdAt)}
                        </td>
                        <td className="px-5 py-3.5">
                          <Badge tone="slate">{(entry.type || '—').replace(/_/g, ' ')}</Badge>
                        </td>
                        <td className="px-5 py-3.5 font-mono text-[11px] font-bold text-slate-500">
                          {entry.reference || entry.paymentId || entry.batchNumber || '—'}
                        </td>
                        <td className="px-5 py-3.5">
                          <Badge tone={entry.settled ? 'green' : 'amber'}>
                            {entry.settled ? 'Settled' : 'Accrued'}
                          </Badge>
                        </td>
                        <td
                          className={`px-5 py-3.5 text-right text-[13px] font-extrabold tabular-nums ${
                            Number(entry.amount) < 0 ? 'text-red-600' : 'text-ink'
                          }`}
                        >
                          {formatCedi(entry.amount)}
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>

          {!state.loading && state.rows.length === 0 && (
            <div className="p-5">
              <EmptyState
                icon={BookOpen}
                title={
                  hasFilters ? 'No ledger entries match these filters' : 'No platform ledger entries yet'
                }
                description={
                  hasFilters
                    ? 'Clear the type or settlement filter. An empty set here is normal for a school on a 0% markup that has not yet been invoiced.'
                    : 'Entries are written as the platform skims markup on each payment, and when a monthly platform fee is charged.'
                }
              />
            </div>
          )}

          {state.meta?.total > 0 && (
            <Pagination
              meta={state.meta}
              itemLabel="entries"
              onPageChange={(next) => setFilter('page', String(next))}
              onPerPageChange={(next) => {
                setFilter('perPage', String(next));
                setFilter('page', '1');
              }}
            />
          )}
        </Card>
      )}
    </div>
  );
};

export default SchoolLedgerTab;