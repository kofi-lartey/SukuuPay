import React from 'react';
import { Link } from 'react-router-dom';
import { Building2, Trophy, Wallet } from 'lucide-react';
import Card from '../../../components/dashboard/ui/Card';
import Badge from '../../../components/dashboard/ui/Badge';
import EmptyState from '../../../components/dashboard/EmptyState';
import { ROUTES } from '../../../utils/constants';
import { formatCediShort, formatCount } from '../../../utils/format';

/**
 * Batches waiting for a payout decision.
 *
 * The only Overview panel that can move money, and it is built for that:
 *
 *   - it fetches **every** `pending_approval` batch (the page size is the queue, not
 *     a viewport), because a payout queue showing 20 of 200 pending batches invites
 *     exactly the wrong confidence about how much money is actually waiting;
 *   - it shows the **net** figure per row — what the school receives — because that
 *     is the number an operator is about to be responsible for releasing, and
 *     `grossAmount` beside it is the school's money, not theirs;
 *   - it **approves nothing from here.** The panel links to the Finance screen.
 *     Approving a payout is a confirmed dialog naming the school, the batch and the
 *     cedi, and building that inline here would put a one-click money action in a
 *     dashboard panel that gets rendered on a timer.
 *
 * The total at the top is the sum of the rows shown, labelled as such, rather than a
 * separately-fetched "total pending" — which would be a second number that could
 * disagree with the table underneath it, and the disagreement would be invisible.
 */
const DisbursementQueueCard = ({ state }) => {
  const rows = state?.data?.rows || [];
  const netTotal = rows.reduce((sum, row) => sum + (Number(row.netAmount) || 0), 0);

  return (
    <Card padding="p-5" className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-extrabold tracking-tight text-ink">
            Payouts awaiting approval
          </h2>
          <p className="mt-1 text-[12px] font-medium leading-snug text-slate-500">
            School money collected and not yet released.
          </p>
        </div>
        {rows.length > 0 && (
          <Badge tone="amber">
            {formatCount(rows.length)} batch{rows.length === 1 ? '' : 'es'}
          </Badge>
        )}
      </div>

      {rows.length > 0 && (
        <p className="mt-3 flex items-baseline gap-1.5 rounded-xl bg-amber-50 px-3 py-2">
          <Wallet className="h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
          <span className="text-[11px] font-extrabold uppercase tracking-wide text-amber-700">
            Net waiting
          </span>
          <span className="ml-auto text-[15px] font-extrabold text-amber-900">
            {formatCediShort(netTotal)}
          </span>
        </p>
      )}

      <div className="mt-3 flex-1">
        {state?.loading ? (
          <div className="space-y-2">
            {[0, 1].map((row) => (
              <div key={row} className="h-11 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : state?.error ? (
          <p className="rounded-xl bg-red-50 px-3 py-2.5 text-[12px] font-bold leading-snug text-red-700">
            {state.error.message || 'The payout queue could not be loaded.'}
          </p>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="Nothing waiting"
            description="Every collected payment has been released to its school."
          />
        ) : (
          <ul className="space-y-1.5">
            {rows.slice(0, 5).map((batch) => (
              <li
                key={batch._id}
                className="flex items-center justify-between gap-3 rounded-xl px-2 py-2 hover:bg-slate-50"
              >
                <span className="min-w-0">
                  <Link
                    to={`${ROUTES.ADMIN_FINANCE}/disbursements/${batch._id}`}
                    className="block truncate text-[13px] font-extrabold text-ink hover:text-brand-700"
                  >
                    {batch.schoolName || batch.school?.name || batch.schoolId}
                  </Link>
                  <span className="block truncate text-[11px] font-semibold text-slate-400">
                    {batch.batchNumber} · {formatCount(batch.paymentCount || 0)} payments
                  </span>
                </span>
                <span className="shrink-0 text-[13px] font-extrabold text-ink">
                  {formatCediShort(batch.netAmount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Link
        to={`${ROUTES.ADMIN_FINANCE}/disbursements`}
        className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-[12px] font-extrabold text-slate-700 transition-colors hover:bg-slate-50"
      >
        <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
        Open the finance console
      </Link>
    </Card>
  );
};

/**
 * The five schools earning the most.
 *
 * Ranked by revenue with the **net** figure labelled as collected, and MRR beside
 * it rather than instead of it. The two answer different questions: revenue is what
 * has already happened through this platform, MRR is what the school owes going
 * forward. A school high on one and absent from the other is the interesting case —
 * a large one-time payment from a school whose subscription is lapsed — and a
 * single column cannot show it.
 */
export const TopSchoolsCard = ({ state }) => {
  const rows = state?.data?.rows || state?.data?.schools || [];

  return (
    <Card padding="p-5" className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-extrabold tracking-tight text-ink">
            Top schools by revenue
          </h2>
          <p className="mt-1 text-[12px] font-medium leading-snug text-slate-500">
            All time, through this platform.
          </p>
        </div>
        <Trophy className="h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
      </div>

      <div className="mt-4 flex-1">
        {state?.loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((row) => (
              <div key={row} className="h-9 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : state?.error ? (
          <p className="rounded-xl bg-red-50 px-3 py-2.5 text-[12px] font-bold leading-snug text-red-700">
            {state.error.message || 'Top schools could not be loaded.'}
          </p>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No revenue yet"
            description="No school has collected through the platform."
          />
        ) : (
          <ol className="space-y-1">
            {rows.slice(0, 5).map((school, index) => (
              <li key={school._id} className="flex items-center gap-3 rounded-xl px-2 py-2">
                <span className="w-4 shrink-0 text-center text-[12px] font-extrabold text-slate-300">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <Link
                    to={`${ROUTES.ADMIN_SCHOOLS}/${school._id}`}
                    className="block truncate text-[13px] font-extrabold text-ink hover:text-brand-700"
                  >
                    {school.name}
                  </Link>
                  <span className="block truncate text-[11px] font-semibold text-slate-400">
                    {school.region}
                    {school.plan ? ` · ${school.plan}` : ''}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-[13px] font-extrabold text-ink">
                    {formatCediShort(school.revenue ?? school.value ?? 0)}
                  </span>
                  {school.mrr ? (
                    <span className="block text-[11px] font-semibold text-slate-400">
                      MRR {formatCediShort(school.mrr)}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Card>
  );
};

export default DisbursementQueueCard;