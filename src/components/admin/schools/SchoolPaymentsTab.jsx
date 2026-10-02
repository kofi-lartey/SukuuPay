import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Receipt } from 'lucide-react';
import Card from '../../dashboard/ui/Card';
import Badge from '../../dashboard/ui/Badge';
import EmptyState from '../../dashboard/EmptyState';
import Pagination from '../../students/Pagination';
import { SelectField } from '../../common/FormField';
import { PaymentStatusBadge, PaymentChannelBadge } from '../../payments/PaymentBadges';
import { PAYMENT_STATUSES, listAllPayments } from '../../../services/admin';
import { formatCedi, formatCount } from '../../../utils/format';
import { formatDateTime, paymentTimestamp } from '../../../utils/dates';

/**
 * Every payment one school has taken.
 *
 * ── Why a plain table and not `components/payments/TransactionTable.jsx` ──
 *
 * That table is the school console's transaction list and it is permission-bound in
 * three ways a platform console must not inherit:
 *
 *   - `onRefund` calls `POST /admin/payments/:id/refund`, which returns money to a
 *     parent. The row's refund button is gated on a `canRefund` prop, which is
 *     exactly the gate a platform admin has not passed here — passing `false`
 *     removes one button and leaves a nine-column table of school-console
 *     furniture on a screen whose owner cannot use most of it.
 *   - `onViewReceipt` and `onOpenDetail` both open school-console surfaces
 *     (`ReceiptDialog`, `PaymentDetailDrawer`) built from the school's own endpoints.
 *   - it renders the guardian's phone **in full**, unmasked, with a comment saying
 *     that is right because "the row is opened by one named person at a time". That
 *     reasoning holds in a single-tenant console where the reader works there. On a
 *     platform-wide list screen — the same screen whose purpose is comparing schools
 *     — a column of unmasked parent numbers is a privacy exposure created by reuse
 *     rather than by any decision.
 *
 * The columns that do carry over — reference, student, channel, amount, status —
 * are worth keeping, because they are the columns an operator actually scans. What
 * is dropped is the school's action column, and this tab has no actions at all: it
 * is a read.
 *
 * ── The totals band ──
 *
 * `listAllPayments` returns `totals` as a sum over the **matched** set rather than
 * over the loaded page, which is the whole reason it travels with the response: two
 * requests can straddle a payment and disagree, and then the figure above the table
 * does not match the rows it is a total of.
 *
 * The copy underneath is not decoration. A refund is a **separate row with a
 * negative amount**, not a flag on the original, so "what this school collected" is
 * the sum of both — and a list filtered to `completed` does not include refunds.
 * Summing `completed` and calling it collections overstates the figure by every
 * refund the school has ever issued, and the direction of that error flatters the
 * school.
 */
const SchoolPaymentsTab = ({ school }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [reloadKey, setReloadKey] = useState(0);

  const status = searchParams.get('status') || '';
  const from = searchParams.get('from') || '';
  const to = searchParams.get('to') || '';
  const page = Number(searchParams.get('page')) || 1;
  const perPage = Number(searchParams.get('perPage')) || 20;

  const [state, setState] = useState({
    rows: [],
    totals: { amount: 0, count: 0 },
    meta: null,
    loading: true,
    error: null,
  });

  const filters = useMemo(
    () => ({ status, from, to, page, perPage }),
    [status, from, to, page, perPage]
  );

  useEffect(() => {
    if (!school?._id) return undefined;
    let active = true;
    setState((current) => ({ ...current, loading: true, error: null }));

    listAllPayments({
      schoolId: school._id,
      page,
      perPage,
      status: status || undefined,
      from: from || undefined,
      to: to || undefined,
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
      .catch((error) => active && setState({ rows: [], totals: { amount: 0, count: 0 }, meta: null, loading: false, error }));

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

  const hasFilters = Boolean(status || from || to);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SelectField
          label="Status"
          value={status}
          onChange={(event) => setFilter('status', event.target.value)}
        >
          <option value="">Every status</option>
          {PAYMENT_STATUSES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </SelectField>

        <div>
          <label htmlFor="school-payments-from" className="mb-0.5 block text-[11px]/[15px] font-semibold text-slate-700">
            From
          </label>
          <input
            id="school-payments-from"
            type="date"
            value={from ? from.slice(0, 10) : ''}
            onChange={(event) => setFilter('from', event.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-[13px]/[18px] font-medium text-ink focus:border-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/30"
          />
        </div>

        <div>
          <label htmlFor="school-payments-to" className="mb-0.5 block text-[11px]/[15px] font-semibold text-slate-700">
            To
          </label>
          <input
            id="school-payments-to"
            type="date"
            value={to ? to.slice(0, 10) : ''}
            onChange={(event) => setFilter('to', event.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-[13px]/[18px] font-medium text-ink focus:border-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/30"
          />
        </div>
      </div>

      <Card padding="p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
            Matched payments
          </p>
          <p className="text-xl font-extrabold tabular-nums text-ink">
            {formatCedi(state.totals.amount)}
            <span className="ml-2 text-[12px] font-semibold text-slate-500">
              {formatCount(state.totals.count)} payments
            </span>
          </p>
        </div>
        <p className="mt-2 text-[11px] font-semibold leading-relaxed text-slate-400">
          Sums the whole matched set, not the twenty rows below. A refund is a separate row with a
          negative amount rather than a flag on the original, so filtering to <em>completed</em>{' '}
          excludes refunds — “collected” is the signed total, never the completed total alone.
        </p>
      </Card>

      {state.error ? (
        <EmptyState
          icon={Receipt}
          title="This school’s payments could not be loaded"
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
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] border-collapse text-left">
              <caption className="sr-only">
                Payments taken by this school.{' '}
                {state.meta?.total ? formatCount(state.meta.total) : 0} payments.
              </caption>
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  {[
                    'Reference',
                    'Student',
                    'Channel',
                    'When',
                    'Status',
                    'Amount',
                  ].map((label) => (
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
                  ? [0, 1, 2, 3, 4].map((row) => (
                      <tr key={row} className="border-b border-slate-50">
                        <td colSpan={6} className="px-5 py-4">
                          <div className="h-5 animate-pulse rounded bg-slate-100" />
                        </td>
                      </tr>
                    ))
                  : state.rows.map((payment) => {
                      // A negative amount *is* a refund. Rendering the minus in red is
                      // what makes that legible; without it a refund row reads as a
                      // typo in the amount.
                      const isRefund = Number(payment.amount) < 0;
                      return (
                        <tr
                          key={payment._id}
                          className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60"
                        >
                          <td className="px-5 py-3.5 font-mono text-[11px] font-bold text-slate-600">
                            {payment.paymentId || '—'}
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="block text-[13px] font-extrabold text-ink">
                              {payment.studentId?.studentName || 'Unknown student'}
                            </span>
                            <span className="block text-[11px] font-semibold text-slate-400">
                              {payment.studentId?.studentClass || '—'}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            <PaymentChannelBadge
                              network={payment.momoNetwork}
                              paymentMethod={payment.paymentMethod}
                            />
                          </td>
                          <td className="whitespace-nowrap px-5 py-3.5 text-[12px] font-semibold text-slate-500">
                            {formatDateTime(paymentTimestamp(payment))}
                          </td>
                          <td className="px-5 py-3.5">
                            <PaymentStatusBadge status={payment.status} />
                          </td>
                          <td
                            className={`px-5 py-3.5 text-right text-[13px] font-extrabold tabular-nums ${
                              isRefund ? 'text-red-600' : 'text-ink'
                            }`}
                          >
                            {formatCedi(payment.amount)}
                          </td>
                        </tr>
                      );
                    })}
              </tbody>
            </table>
          </div>

          {!state.loading && state.rows.length === 0 && (
            <div className="p-5">
              <EmptyState
                icon={Receipt}
                title={hasFilters ? 'No payments match these filters' : 'This school has taken no payments yet'}
                description={
                  hasFilters
                    ? 'Try widening the date range or clearing the status filter. A school that collects nothing in a given month is normal, not a fault.'
                    : 'Payments appear here as parents pay by Mobile Money, and as the school records cash, card or bank transfers at the desk.'
                }
              />
            </div>
          )}

          {state.meta?.total > 0 && (
            <Pagination
              meta={state.meta}
              itemLabel="payments"
              onPageChange={(next) => setFilter('page', String(next))}
              onPerPageChange={(next) => {
                setFilter('perPage', String(next));
                setFilter('page', '1');
              }}
            />
          )}
        </Card>
      )}

      {/*
        The gateway the money moved on, stated once. It is on the Overview card as the
        school's configured `gatewayMode`, and this is the same thing seen in the
        data — a school whose rows disagree with its configuration is the exact
        discrepancy an operator opens this tab to find, so it is worth saying the
        comparison is available rather than leaving them to infer it.
      */}
      <Card padding="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
            Configured rail
          </span>
          <Badge tone="slate">{school.payment?.gatewayMode || 'not set'}</Badge>
          <span className="text-[11px] font-semibold text-slate-400">
            Providers on the rows above may differ on payments taken before a change — the rail is
            recorded per payment, not per school.
          </span>
        </div>
      </Card>
    </div>
  );
};

export default SchoolPaymentsTab;