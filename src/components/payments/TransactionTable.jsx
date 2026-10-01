import React from 'react';
import { ArrowDown, ArrowUp, Eye, Receipt, RotateCcw, Search } from 'lucide-react';
import Card from '../dashboard/ui/Card';
import Button from '../common/Button';
import EmptyState from '../dashboard/EmptyState';
import Pagination from '../students/Pagination';
import { PaymentChannelBadge, PaymentStatusBadge } from './PaymentBadges';
import { formatCedis, formatCount } from '../../utils/format';
import { formatGhanaPhone } from '../../utils/ghanaPhone';
import { formatDateTime, paymentTimestamp } from '../../utils/dates';

const AVATAR_TONES = [
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-blue-100 text-blue-700',
  'bg-rose-100 text-rose-700',
  'bg-violet-100 text-violet-700',
];

const initials = (name) =>
  String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');

/**
 * The fee item a payment was for.
 *
 * `description` is free text written by whoever took the payment, so it can be
 * empty on a hand-recorded row. The table then shows the class of thing it was
 * rather than a blank cell — a blank in the middle of a populated row reads as
 * a missing field, and on a payments screen "what was this for?" is a question
 * every single row triggers.
 */
const feeItemFor = (payment) => payment.description || 'School fees';

const COLUMNS = [
  { key: 'paymentId', label: 'Transaction ref & time', sortable: true },
  { key: 'studentName', label: 'Student', sortable: false },
  { key: 'studentClass', label: 'Class', sortable: false },
  { key: 'guardian', label: 'Guardian contact', sortable: false },
  { key: 'channel', label: 'Channel', sortable: false },
  { key: 'description', label: 'Fee item', sortable: false },
  { key: 'amount', label: 'Amount', sortable: true },
  // Not sortable. `paymentsQuerySchema` allow-lists `sortBy` and `status` is not
  // on it, so a click here was a 422 in production — a sort control that fails its
  // own request is worse than no control, and "group by status" is the status
  // filter's job anyway.
  { key: 'status', label: 'Status', sortable: false },
];

/**
 * The transactions table.
 *
 * **Money is right-aligned with `tabular-nums` throughout.** It is the only
 * column a reader compares across rows, and proportional digits make a column of
 * cedi look ragged and measurably slower to scan. Every figure comes from
 * `utils/format`, which takes pesewas — the wire format — so no cell can be a
 * hundred-fold out by being hand-formatted.
 *
 * **A negative amount is a refund, and is shown as one.** `refundPayment` writes
 * the reversal as its own payment row with a negative `amount` rather than
 * mutating the original, so the ledger stays additive and a full reversal shows
 * the original row alongside the row that cancelled it. Rendering the minus in
 * red is what makes that legible; without it a refund looks like a typo.
 */
const TransactionTable = ({
  rows,
  loading,
  error,
  meta,
  filters,
  onSort,
  onPageChange,
  onPerPageChange,
  onOpenDetail,
  onViewReceipt,
  onRefund,
  onClearFilters,
  hasFilters,
  canRefund,
}) => {
  const toggleSort = (key) => {
    if (!key) return;
    if (filters.sortBy === key) {
      onSort({ sortBy: key, sortOrder: filters.sortOrder === 'asc' ? 'desc' : 'asc' });
    } else {
      onSort({ sortBy: key, sortOrder: 'desc' });
    }
  };

  if (error) {
    return (
      <Card padding="p-0">
        <div className="p-5">
          <p className="text-sm font-bold text-red-700">{error.message}</p>
        </div>
      </Card>
    );
  }

  if (!loading && !rows.length) {
    return (
      <EmptyState
        icon={Search}
        title={hasFilters ? 'No transactions match these filters' : 'No payments recorded yet'}
        description={
          hasFilters
            ? 'Try widening the period, channel or class. A filter that matches nothing usually means the school has not collected that way yet, not that the data is missing.'
            : 'Payments appear here as parents pay by Mobile Money, and as you record cash, card or bank transfers at the desk.'
        }
        action={
          hasFilters && (
            <Button variant="secondary" onClick={onClearFilters}>
              Clear filters
            </Button>
          )
        }
      />
    );
  }

  return (
    <Card padding="p-0" className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[72rem] border-collapse text-left">
          <caption className="sr-only">
            Payment transactions. {meta?.total ? formatCount(meta.total) : 0} transactions.
          </caption>
          <thead>
            <tr className="bg-slate-50">
              {COLUMNS.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={
                    filters.sortBy === column.key
                      ? filters.sortOrder === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                  className={`whitespace-nowrap px-4 py-3 text-[11px] font-extrabold uppercase tracking-wide text-slate-500 ${
                    column.key === 'amount' ? 'text-right' : ''
                  }`}
                >
                  {column.sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(column.key)}
                      className={`inline-flex items-center gap-1 transition-colors hover:text-ink ${
                        column.key === 'amount' ? 'flex-row-reverse' : ''
                      }`}
                    >
                      {column.label}
                      {filters.sortBy === column.key &&
                        (filters.sortOrder === 'asc' ? (
                          <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                        ))}
                    </button>
                  ) : (
                    column.label
                  )}
                </th>
              ))}

              <th
                scope="col"
                className="w-28 px-4 py-3 text-right text-[11px] font-extrabold uppercase tracking-wide text-slate-500"
              >
                Actions
              </th>
            </tr>
          </thead>

          <tbody>
            {loading
              ? Array.from({ length: 6 }).map((_, index) => (
                  <tr key={`skeleton-${index}`} className="border-t border-slate-100">
                    <td colSpan={COLUMNS.length + 1} className="px-4 py-4">
                      <div className="h-6 animate-pulse rounded bg-slate-100" />
                    </td>
                  </tr>
                ))
              : rows.map((payment, index) => {
                  const id = String(payment._id || payment.paymentId);
                  const student = payment.studentId || {};
                  const guardian = (student.parents || [])[0] || null;
                  const isRefund = Number(payment.amount) < 0;

                  return (
                    <tr
                      key={id}
                      className="border-t border-slate-100 transition-colors hover:bg-slate-50/70"
                    >
                      <th scope="row" className="px-4 py-3 font-normal">
                        <button
                          type="button"
                          onClick={() => onOpenDetail(payment)}
                          className="text-left"
                        >
                          <span className="block whitespace-nowrap text-[13px] font-extrabold text-ink hover:text-brand-700">
                            {payment.paymentId}
                          </span>
                          <span className="block whitespace-nowrap text-[11px] font-semibold text-slate-500">
                            {formatDateTime(paymentTimestamp(payment))}
                          </span>
                        </button>
                      </th>

                      <td className="px-4 py-3">
                        <span className="flex items-center gap-3">
                          <span
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold ${
                              AVATAR_TONES[index % AVATAR_TONES.length]
                            }`}
                            aria-hidden="true"
                          >
                            {initials(student.studentName)}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-[13px] font-extrabold text-ink">
                              {student.studentName || 'Unknown student'}
                            </span>
                            <span className="block text-[11px] font-semibold text-slate-500">
                              {student.studentId || '—'}
                            </span>
                          </span>
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-4 py-3">
                        {student.studentClass ? (
                          <span className="inline-block rounded-md bg-slate-100 px-2 py-1 text-[12px] font-extrabold text-slate-700">
                            {student.studentClass}
                          </span>
                        ) : (
                          <span className="text-[12px] font-semibold text-slate-400">—</span>
                        )}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3">
                        {guardian ? (
                          <>
                            <span className="block text-[13px] font-bold text-ink">
                              {guardian.parentName}
                            </span>
                            {/* Formatted, not masked. Unlike the roster, this row
                                is the transaction record: a bursar chasing a
                                failed MoMo callback calls the number from here,
                                and the row is opened by one named person at a
                                time. */}
                            <span className="block text-[11px] font-semibold tabular-nums text-slate-500">
                              {formatGhanaPhone(guardian.phone)}
                            </span>
                          </>
                        ) : (
                          <span className="text-[12px] font-semibold text-slate-400">—</span>
                        )}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3">
                        <PaymentChannelBadge
                          network={payment.momoNetwork}
                          paymentMethod={payment.paymentMethod}
                        />
                      </td>

                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-700">
                          <span
                            className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                              isRefund ? 'bg-red-400' : 'bg-emerald-500'
                            }`}
                            aria-hidden="true"
                          />
                          <span className="line-clamp-1" title={feeItemFor(payment)}>
                            {feeItemFor(payment)}
                          </span>
                        </span>
                      </td>

                      <td
                        className={`whitespace-nowrap px-4 py-3 text-right text-[13px] font-extrabold tabular-nums ${
                          isRefund ? 'text-red-600' : 'text-ink'
                        }`}
                      >
                        {isRefund ? `−${formatCedis(Math.abs(payment.amount))}` : formatCedis(payment.amount)}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3">
                        <PaymentStatusBadge status={payment.status} />
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => onViewReceipt(payment)}
                            aria-label={`View the receipt for ${payment.paymentId}`}
                            title="View receipt"
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-brand-700"
                          >
                            <Receipt className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenDetail(payment)}
                            aria-label={`Open the details of ${payment.paymentId}`}
                            title="View details"
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-brand-700"
                          >
                            <Eye className="h-4 w-4" aria-hidden="true" />
                          </button>
                          {canRefund && payment.status === 'completed' && (
                            <button
                              type="button"
                              onClick={() => onRefund(payment)}
                              aria-label={`Refund ${payment.paymentId}`}
                              title="Refund this payment"
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                            >
                              <RotateCcw className="h-4 w-4" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>

      {meta?.total > 0 && (
        <Pagination
          meta={meta}
          onPageChange={onPageChange}
          onPerPageChange={onPerPageChange}
          itemLabel="transactions"
        />
      )}
    </Card>
  );
};

export default TransactionTable;