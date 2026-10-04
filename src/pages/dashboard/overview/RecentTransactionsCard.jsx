import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, ScrollText } from 'lucide-react';
import Card from '../../../components/dashboard/ui/Card';
import Badge from '../../../components/dashboard/ui/Badge';
import { ROUTES } from '../../../utils/constants';
import { formatCedis, formatCount } from '../../../utils/format';

/**
 * Two initials from a display name.
 *
 * **Coerces before it calls `.split`.** This function reads a field off a response row,
 * and the row's shape depends on a Mongoose `populate` on the server — so `name` has
 * been a string, a populated object, an ObjectId and `undefined` at different points in
 * this product's life. The version before this one called `name.split(...)` directly,
 * and a populated `studentId` object threw `TypeError: name.split is not a function`,
 * which took the **entire Overview** down with a blank screen. A pure display helper
 * has no business being able to do that.
 *
 * The fallback is `'?'` rather than an empty string, so the avatar keeps its shape and
 * its size — a missing name renders as a visibly unknown avatar rather than a circle
 * that quietly collapses and shifts the row's alignment.
 */
const initials = (name) => {
  const text =
    typeof name === 'string'
      ? name
      : // A populated student object, or `{ _id }` with nothing else on it.
        name && typeof name === 'object'
        ? String(name.studentName || name.studentId || name._id || '')
        : name == null
          ? ''
          : String(name);

  return (
    text
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join('') || '?'
  );
};

const AVATAR_TONES = [
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-blue-100 text-blue-700',
  'bg-rose-100 text-rose-700',
];

/**
 * The most recent settlements.
 *
 * Six rows, not ten. The design's height fits six, and six is also the right
 * answer for the job: this is a "did the money land?" glance, and a longer list
 * would push the charts below it off-screen on a laptop, which is where a bursar
 * will read it. The full set is one click away on Payments rather than two
 * scrolls away here.
 *
 * `amount` is right-aligned and tabular so the column can be scanned vertically
 * — the only column a reader actually compares across rows. `tabular-nums` is
 * load-bearing for that: proportional digits make a column of money look ragged
 * and slower to read than it is.
 */
const RecentTransactionsCard = ({ transactions, totalCount, isDemo }) => (
  <Card padding="p-0" className="overflow-hidden">
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-4 pt-5">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
          <ScrollText className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h3 className="truncate text-base font-extrabold tracking-tight text-ink">
            Recent MoMo Transactions
          </h3>
        </div>
        <Badge tone="slate" className="hidden sm:inline-flex">
          Reconciled Instantly
        </Badge>
      </div>

      <Link
        to={ROUTES.DASHBOARD_PAYMENTS}
        className="inline-flex items-center gap-1 text-[13px] font-extrabold text-brand-700 transition-colors hover:text-brand-800"
      >
        View All ({formatCount(totalCount)})
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </div>

    {/*
      `overflow-x-auto` with `min-w` on the table rather than a hidden overflow:
      a payment reference is 13 characters and truncating it defeats the purpose
      of showing it, so the table scrolls sideways on a narrow screen and the
      rows stay complete.
    */}
    <div className="overflow-x-auto">
      <table className="w-full min-w-[46rem] border-collapse text-left">
        <thead>
          <tr className="bg-slate-50">
            {['Student Name', 'Class', 'Amount', 'Network', 'MoMo Reference', 'Date & Time'].map(
              (heading) => (
                <th
                  key={heading}
                  scope="col"
                  className="whitespace-nowrap px-5 py-2.5 text-[11px] font-extrabold uppercase tracking-wide text-slate-500"
                >
                  {heading}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody>
          {transactions.length === 0 ? (
            /*
             * An explicit empty body rather than zero rows under a header.
             *
             * A `<tbody>` with nothing in it leaves the column headings sitting on an
             * empty grey band, which reads as "the table failed to load" — the exact
             * wrong conclusion for a school whose first payment has simply not happened
             * yet. Spanning all six columns keeps the headings and the explanation in
             * the same visual object.
             */
            <tr>
              <td
                colSpan={6}
                className="px-5 py-10 text-center text-[13px] font-semibold text-slate-500"
              >
                No payments recorded yet.
                <span className="mt-1 block text-[12px] font-medium text-slate-400">
                  They will appear here as parents pay, from the app or at the office.
                </span>
              </td>
            </tr>
          ) : null}

          {transactions.map((txn, index) => (
            <tr
              key={txn.id}
              className="border-t border-slate-100 transition-colors hover:bg-slate-50/70"
            >
              <th scope="row" className="px-5 py-3 font-normal">
                <span className="flex items-center gap-3">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold ${
                      AVATAR_TONES[index % AVATAR_TONES.length]
                    }`}
                    aria-hidden="true"
                  >
                    {initials(txn.studentName)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-extrabold text-ink">
                      {txn.studentName}
                    </span>
                    <span className="block text-[11px] font-semibold text-slate-500">
                      ID: {txn.studentCode}
                    </span>
                  </span>
                </span>
              </th>

              <td className="whitespace-nowrap px-5 py-3 text-[13px] font-semibold text-slate-600">
                {txn.className}
              </td>

              <td className="whitespace-nowrap px-5 py-3 text-right text-[13px] font-extrabold tabular-nums text-ink">
                {formatCedis(txn.amount)}
              </td>

              <td className="px-5 py-3">
                <Badge tone={txn.network} dot>
                  {txn.networkLabel}
                </Badge>
              </td>

              <td className="whitespace-nowrap px-5 py-3 text-[12px] font-semibold text-slate-500">
                {txn.reference}
              </td>

              <td className="whitespace-nowrap px-5 py-3">
                <span className="block text-[12px] font-bold text-slate-700">{txn.dateLabel}</span>
                <span className="block text-[11px] font-semibold text-slate-400">
                  {txn.timeLabel}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    {isDemo && (
      <p className="border-t border-slate-100 px-5 py-3 text-[11px] font-semibold text-slate-400">
        Demo data. Backed by GET /payments once wired.
      </p>
    )}
  </Card>
);

export default RecentTransactionsCard;
