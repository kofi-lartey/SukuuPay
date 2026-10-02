import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Wallet } from 'lucide-react';
import Card from '../../dashboard/ui/Card';
import Badge from '../../dashboard/ui/Badge';
import EmptyState from '../../dashboard/EmptyState';
import Pagination from '../../students/Pagination';
import { SelectField } from '../../common/FormField';
import { DISBURSEMENT_STATUSES, listDisbursements } from '../../../services/finance';
import { formatCedi, formatCount } from '../../../utils/format';
import { formatDate } from '../../../utils/dates';

const STATUS_TONES = {
  draft: 'slate',
  pending_approval: 'amber',
  approved: 'blue',
  processing: 'blue',
  paid: 'green',
  failed: 'red',
  cancelled: 'slate',
};

/**
 * Every payout batch raised for one school.
 *
 * **A batch is a window of the school's collected money, split three ways** — gross
 * what parents paid, `platformAmount` what SukuuPay keeps, `netAmount` what goes to
 * the school — and the breakdown is *stored on the batch* rather than recomputed from
 * the school's current markup. That is deliberate and it is the reason this screen
 * shows all three figures side by side: the split still shows the rate that applied
 * when the batch was approved, and that is the only version of the number that
 * explains it. Recomputing against today's markup would make a batch approved last
 * month disagree with the ledger lines it produced, which is precisely the
 * discrepancy `getDisbursement` exists to prevent.
 *
 * **No approve or retry buttons here, and the reason is worth stating.** Both exist —
 * `POST /admin/finance/disbursements/:batchId/approve` is the one call in the console
 * that moves a school's money without asking the school — but they belong on the
 * Finance module's queue, where the operator is looking at money that has not moved
 * yet and every batch on screen is one they are about to release. Putting "release
 * GH₵ 40,000" on a school's detail page, above the tabs, would make it the easiest
 * button in the console to press and one of the least considered. The link below goes
 * there instead.
 *
 * `failed` counts as open. That is not a UI decision: `OPEN_DISBURSEMENT_STATUSES`
 * includes it because a failed batch is money that has not reached the school and
 * will be retried, and the retry has to go out on the same rail.
 */
const SchoolDisbursementsTab = ({ school }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [reloadKey, setReloadKey] = useState(0);

  const status = searchParams.get('status') || '';
  const page = Number(searchParams.get('page')) || 1;
  const perPage = Number(searchParams.get('perPage')) || 20;

  const [state, setState] = useState({ rows: [], meta: null, loading: true, error: null });

  const filters = useMemo(() => ({ status, page, perPage }), [status, page, perPage]);

  useEffect(() => {
    if (!school?._id) return undefined;
    let active = true;
    setState((current) => ({ ...current, loading: true, error: null }));

    listDisbursements({
      schoolId: school._id,
      page,
      perPage,
      status: status || undefined,
    })
      .then((result) =>
        active && setState({ rows: result.rows, meta: result.meta, loading: false, error: null })
      )
      .catch((error) => active && setState({ rows: [], meta: null, loading: false, error }));

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

  return (
    <Card padding="p-0" className="overflow-hidden">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-[13px] font-extrabold leading-tight text-ink">Payout batches</h2>
        <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
          Windows of this school&rsquo;s collected money, split gross / platform / net. The split is
          frozen at approval and is not recomputed from today&rsquo;s markup.
        </p>
      </div>

      <div className="border-b border-slate-100 px-5 py-4">
        <SelectField
          label="Status"
          value={status}
          onChange={(event) => setFilter('status', event.target.value)}
        >
          <option value="">Every status</option>
          {DISBURSEMENT_STATUSES.map((value) => (
            <option key={value} value={value}>
              {value.replace(/_/g, ' ')}
            </option>
          ))}
        </SelectField>
      </div>

      {state.error ? (
        <div className="p-5">
          <EmptyState
            icon={Wallet}
            title="Disbursements could not be loaded"
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
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[58rem] border-collapse text-left">
              <caption className="sr-only">Payout batches for this school</caption>
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  {['Batch', 'Window', 'Status', 'Gross', 'Platform', 'Net to school'].map((label) => (
                    <th
                      key={label}
                      scope="col"
                      className={`whitespace-nowrap px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400 ${
                        ['Gross', 'Platform', 'Net to school'].includes(label) ? 'text-right' : ''
                      }`}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {state.loading && state.rows.length === 0
                  ? [0, 1, 2].map((row) => (
                      <tr key={row} className="border-b border-slate-50">
                        <td colSpan={6} className="px-5 py-4">
                          <div className="h-5 animate-pulse rounded bg-slate-100" />
                        </td>
                      </tr>
                    ))
                  : state.rows.map((batch) => (
                      <tr
                        key={batch._id}
                        className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60"
                      >
                        <td className="px-5 py-3.5">
                          <span className="block font-mono text-[12px] font-extrabold text-ink">
                            {batch.batchNumber || '—'}
                          </span>
                          <span className="block text-[11px] font-semibold text-slate-400">
                            {formatCount(batch.paymentCount)} payments
                            {batch.provider ? ` · ${batch.provider}` : ''}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-5 py-3.5 text-[12px] font-semibold text-slate-500">
                          {batch.periodStart || batch.periodEnd
                            ? `${formatDate(batch.periodStart)} → ${formatDate(batch.periodEnd)}`
                            : '—'}
                        </td>
                        <td className="px-5 py-3.5">
                          <Badge tone={STATUS_TONES[batch.status] || 'slate'}>
                            {(batch.status || 'unknown').replace(/_/g, ' ')}
                          </Badge>
                          {batch.failureReason && (
                            <span className="mt-1 block max-w-[16rem] text-[11px] font-semibold text-red-600">
                              {batch.failureReason}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right text-[13px] font-bold tabular-nums text-slate-600">
                          {formatCedi(batch.grossAmount)}
                        </td>
                        <td className="px-5 py-3.5 text-right text-[13px] font-bold tabular-nums text-brand-700">
                          {formatCedi(batch.platformAmount)}
                        </td>
                        <td className="px-5 py-3.5 text-right text-[13px] font-extrabold tabular-nums text-ink">
                          {formatCedi(batch.netAmount)}
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>

          {!state.loading && state.rows.length === 0 && (
            <div className="p-5">
              <EmptyState
                icon={Wallet}
                title={
                  status
                    ? 'No batches with that status'
                    : 'This school has never been paid out'
                }
                description={
                  status
                    ? 'Clear the status filter to see the whole history.'
                    : 'A batch is built for a window of completed payments and must be approved before any money moves. The Finance module builds and approves them.'
                }
              />
            </div>
          )}

          {state.meta?.total > 0 && (
            <Pagination
              meta={state.meta}
              itemLabel="batches"
              onPageChange={(next) => setFilter('page', String(next))}
              onPerPageChange={(next) => {
                setFilter('perPage', String(next));
                setFilter('page', '1');
              }}
            />
          )}
        </>
      )}
    </Card>
  );
};

export default SchoolDisbursementsTab;