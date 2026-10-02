import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Clock, RefreshCw, TriangleAlert } from 'lucide-react';
import Card from '../../../components/dashboard/ui/Card';
import Badge from '../../../components/dashboard/ui/Badge';
import EmptyState from '../../../components/dashboard/EmptyState';
import { atRiskReason } from './analyticsShared';
import { ROUTES } from '../../../utils/constants';
import { formatCediShort, formatCount } from '../../../utils/format';

/**
 * The schools that need chasing, with the reasons as a list.
 *
 * **The list is the feature.** `GET /admin/analytics/at-risk-schools` returns
 * `reasons` as an array of independent codes
 * (`Backend/src/services/admin/analytics.service.js:1813-1831`), and each combination
 * calls for a different conversation:
 *
 *   - `no_payment_14d` **and** students ⇒ a live school whose parents have stopped
 *     paying. This is the one that warrants a phone call.
 *   - `no_payment_14d` **and** `zero_students` ⇒ a signup that never started. Nothing was
 *     ever billed because nothing was ever set up, and chasing it about fees is a call
 *     that wastes both the operator's time and the school's.
 *   - `subscription_past_due` ⇒ a billing conversation, not a support one.
 *
 * A single boolean collapses the first two, which is exactly the difference between a
 * list an operator works down and a list they have to think about. So every reason
 * renders as its own item with its own sentence, and the student count is shown next to
 * it — `no_payment_14d` alone reads very differently beside 412 students than beside 0.
 *
 * Three states are handled as three states, never as one empty case:
 * a failed request, a request still in flight, and a genuinely empty list. "Nothing needs
 * chasing" and "the at-risk list could not be loaded" must not render the same screen,
 * because the first is good news and the second is the screen an operator opens *because*
 * something is wrong.
 *
 * **The rows come back under `schools`, not `rows`.** `admin.js`'s `getAtRiskSchools`
 * falls back to `{ rows: [] }` when `data.data` is absent and does not otherwise rename
 * the key, and the endpoint returns `{ schools, summary, meta, definitions }`
 * (`analytics.service.js:1874-1910`). `rows` is read as a fallback so a future service
 * that does normalise to `rows` keeps working, and the array actually present is the one
 * rendered. This is reported rather than worked around silently: the existing
 * `overview/AtRiskCard.jsx` reads `state.data.rows` and therefore renders empty against
 * the current API.
 */
const AtRiskSchoolsPanel = ({ state }) => {
  const rows = state?.data?.schools || state?.data?.rows || [];
  const summary = state?.data?.summary || {};
  const total = Number(summary.atRiskSchools) || rows.length;
  const threshold = Number(state?.data?.noPaymentThresholdDays) || 14;

  return (
    <Card padding="p-5" className="flex h-full flex-col">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-extrabold tracking-tight text-ink">
            Schools that need chasing
          </h2>
          <p className="mt-1 text-[12px]/[18px] font-medium text-slate-500">
            {`No completed payment in ${threshold}+ days, a lapsed subscription, or an empty roster. Each school lists every condition it met.`}
          </p>
        </div>
        {total > 0 && <Badge tone={total > 5 ? 'red' : 'amber'}>{formatCount(total)}</Badge>}
      </div>

      {/*
        The counts, so the panel says which of the three conditions is the dominant one
        before the operator starts reading rows. Without it a list of 30 badges is 30
        facts and no pattern.
      */}
      {total > 0 && summary.byReason && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {Object.entries(summary.byReason).map(([code, count]) => (
            <Badge key={code} tone={atRiskReason(code).tone}>
              {`${atRiskReason(code).label}: ${formatCount(count)}`}
            </Badge>
          ))}
          {summary.neverPaid !== undefined && (
            <Badge tone="slate">{`Never took a payment: ${formatCount(summary.neverPaid)}`}</Badge>
          )}
        </div>
      )}

      <div className="mt-4 flex-1">
        {state?.loading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="h-16 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : state?.error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5">
            <p className="text-[12px] font-extrabold leading-snug text-red-700">
              The at-risk list could not be loaded.
            </p>
            <p className="mt-1 text-[12px]/[17px] font-semibold leading-snug text-red-700/90">
              {state.error.message || 'The request did not complete.'}
            </p>
            {state.onRetry && (
              <button
                type="button"
                onClick={state.onRetry}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-[12px] font-extrabold text-red-700 shadow-sm transition-colors hover:bg-red-100"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                Try again
              </button>
            )}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={AlertTriangle}
            title="Nothing needs chasing"
            description="Every live school has collected recently, is current, and has students on its roster."
          />
        ) : (
          <ul className="space-y-2.5">
            {rows.map((school) => (
              <li key={school.schoolId || school._id}>
                <Link
                  to={`${ROUTES.ADMIN_SCHOOLS}/${school.schoolId || school._id}`}
                  className="block rounded-xl border border-slate-200 px-3.5 py-3 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <span className="min-w-0 text-[13px] font-extrabold text-ink">
                      {school.name}
                    </span>
                    <span className="shrink-0 text-[11px] font-bold text-slate-400">
                      {formatCount(school.studentCount)} students
                    </span>
                  </div>

                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-semibold text-slate-400">
                    {school.schoolCode && (
                      <span className="font-mono">{school.schoolCode}</span>
                    )}
                    {school.region && <span>{school.region}</span>}
                    {school.plan && <span>· {school.plan}</span>}
                    {Number(school.mrr) > 0 && (
                      <span>· {formatCediShort(school.mrr)}/mo</span>
                    )}
                  </div>

                  {/*
                    The reasons, as a list with the sentence that makes each one
                    actionable. The word "and" is load-bearing between them — a school
                    meeting two conditions is not one problem twice, it is a school in a
                    worse position than one meeting either.
                  */}
                  <ul className="mt-2 space-y-1">
                    {(school.reasons || []).map((code) => {
                      const reason = atRiskReason(code);
                      return (
                        <li key={code} className="flex items-start gap-2">
                          <Badge tone={reason.tone} className="mt-px shrink-0">
                            {reason.label}
                          </Badge>
                          <span className="text-[11px]/[16px] font-medium text-slate-500">
                            {reason.meaning}
                          </span>
                        </li>
                      );
                    })}
                    {(school.reasons || []).length > 1 && (
                      <li className="text-[11px]/[16px] font-semibold text-amber-700">
                        Every condition above was met at once — this school needs a person,
                        not a reminder.
                      </li>
                    )}
                  </ul>

                  {/*
                    `daysSinceLastPayment` is `null` when the school has *never* taken a
                    payment (`analytics.service.js:1822`), and that is a different fact
                    from "0 days ago". Rendering "0 days ago" for a school that has never
                    collected a cedi would be a plain falsehood, so the null branch says
                    what it is.
                  */}
                  <p className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
                    <Clock className="w-3 h-3" aria-hidden="true" />
                    {school.lastPaymentAt
                      ? `Last payment ${new Date(school.lastPaymentAt).toLocaleDateString('en-GB')} · ${formatCount(school.daysSinceLastPayment)} days ago`
                      : 'Has never taken a completed payment'}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/*
        `meta.truncated` is reported rather than implied. The endpoint caps the list at
        `MAX_PER_PAGE` and says so in `meta`; a panel that silently showed 100 of 214
        would read as the whole picture, and "only 100 schools are in trouble" is a
        materially different claim from "these are the 100 worst".
      */}
      {state?.data?.meta?.truncated && (
        <p className="mt-3 flex items-start gap-2 text-[11px]/[16px] font-semibold text-amber-700">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            This list is capped. {formatCount(state.data.meta.total)} schools matched and the
            first {formatCount(rows.length)} are shown, most severe first.
          </span>
        </p>
      )}
    </Card>
  );
};

export default AtRiskSchoolsPanel;
