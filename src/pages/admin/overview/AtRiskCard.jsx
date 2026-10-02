import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowUpRight, Building2, Clock } from 'lucide-react';
import Card from '../../../components/dashboard/ui/Card';
import Badge from '../../../components/dashboard/ui/Badge';
import EmptyState from '../../../components/dashboard/EmptyState';
import { ROUTES } from '../../../utils/constants';
import { formatCediShort, formatCount } from '../../../utils/format';

/**
 * The schools that need chasing.
 *
 * **Rendered as a list of reasons, not a flag, because that is the whole value of
 * the endpoint.** `GET /admin/analytics/at-risk-schools` returns three independent
 * conditions — no payment in 14+ days, a subscription past due, zero students — and
 * they mean completely different things:
 *
 *   - no payments **and** students ⇒ something is broken in their collection flow.
 *     This is the interesting one and the only one that warrants a phone call.
 *   - no payments **and** no students ⇒ the school signed up and never onboarded.
 *     Chasing them about fees would be nonsense.
 *   - subscription past due ⇒ this is a billing conversation, not a support one.
 *
 * A single boolean collapses the first two, and the operator chasing an onboarded
 * school for non-payment is a support call that wastes both their time.
 *
 * Capped at six rows with a "view all" link rather than paginated: this is a
 * Dashboard panel, and a pager in a 300px-tall card is furniture. The full list and
 * the total live on the analytics screen.
 */
const REASON_LABELS = {
  no_recent_payments: 'No payment in 14+ days',
  subscription_past_due: 'Subscription past due',
  no_students: 'No students',
};

const AtRiskCard = ({ state }) => {
  const rows = state?.data?.rows || [];
  const total = Number(state?.data?.total) || rows.length;

  return (
    <Card padding="p-5" className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-extrabold tracking-tight text-ink">Needs attention</h2>
          <p className="mt-1 text-[12px] font-medium leading-snug text-slate-500">
            Schools with no recent payments, a lapsed subscription, or no students.
          </p>
        </div>
        {total > 0 && <Badge tone={total > 5 ? 'red' : 'amber'}>{formatCount(total)}</Badge>}
      </div>

      <div className="mt-4 flex-1">
        {state?.loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((row) => (
              <div key={row} className="h-11 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : state?.error ? (
          <p className="rounded-xl bg-red-50 px-3 py-2.5 text-[12px] font-bold leading-snug text-red-700">
            {state.error.message || 'At-risk schools could not be loaded.'}
          </p>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="Nothing needs chasing"
            description="Every active school collected recently, is current, and has students."
          />
        ) : (
          <ul className="space-y-2">
            {rows.slice(0, 6).map((school) => (
              <li key={school._id}>
                <Link
                  to={`${ROUTES.ADMIN_SCHOOLS}/${school._id}`}
                  className="flex items-start gap-2.5 rounded-xl px-2 py-2 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
                >
                  <AlertTriangle
                    className="mt-0.5 h-4 w-4 shrink-0 text-amber-500"
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-extrabold text-ink">
                      {school.name}
                    </span>
                    <span className="mt-1 flex flex-wrap gap-1">
                      {(school.reasons || []).map((reason) => (
                        <Badge key={reason} tone="slate">
                          {REASON_LABELS[reason] || reason}
                        </Badge>
                      ))}
                    </span>
                    {school.lastPaymentAt && (
                      <span className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-slate-400">
                        <Clock className="h-3 w-3" aria-hidden="true" />
                        Last payment {new Date(school.lastPaymentAt).toLocaleDateString('en-GB')}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {total > rows.slice(0, 6).length && (
        <Link
          to={ROUTES.ADMIN_ANALYTICS}
          className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-[12px] font-extrabold text-slate-700 transition-colors hover:bg-slate-50"
        >
          View all {formatCount(total)}
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      )}
    </Card>
  );
};

export default AtRiskCard;