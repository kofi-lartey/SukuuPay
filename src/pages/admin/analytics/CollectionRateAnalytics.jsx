import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Info, RefreshCw, Scale, ServerCrash } from 'lucide-react';
import PageHeader from '../../../components/dashboard/PageHeader';
import Card from '../../../components/dashboard/ui/Card';
import Badge from '../../../components/dashboard/ui/Badge';
import EmptyState from '../../../components/dashboard/EmptyState';
import StackedBar from '../../../components/dashboard/charts/StackedBar';
import ProgressBar from '../../../components/dashboard/charts/ProgressBar';
import AnalyticsTabs, { DateRangeField } from './AnalyticsControls';
import { rateIsDefined } from './analyticsShared';
import { getCollectionRateAnalytics } from '../../../services/admin';
import { formatCedi, formatCediShort, formatCount, formatPercent } from '../../../utils/format';

/**
 * Owed against collected, by term, across every school.
 *
 * `GET /admin/analytics/collection-rate`. The measurement is a **position**, not a flow:
 * `owed` is the face value of every live `PaymentPlan` whose term overlaps the window, and
 * `applied` is what has actually been applied to those plans' installments
 * (`analytics.service.js:1223-1256`). Both are read from the same plans at the same
 * moment, which is what makes their ratio a real rate.
 *
 * **The denominator rule is stated on the screen, in these words, and that is the most
 * important sentence on this page.**
 *
 * A school with **no payment plan for a term is not owed** — it is excluded from the
 * denominator, and the count of them is returned as `schoolsWithRosterButNoPlan`. The
 * alternative is to treat them as fully paid, which flatters the figure in the most
 * flattering direction available: every school that never created a plan contributes a
 * perfect record to a rate it was never eligible for. On a per-term basis that is the
 * largest and generally the most successful cohort — schools that collect at the
 * counter — so the reported rate would be materially higher than reality and there would
 * be no way to tell from the number alone.
 *
 * The other half of the rule is equally load-bearing and equally invisible: collections
 * are also restricted to schools that have a plan in the window. Otherwise a school paying
 * through a pay link with no plan contributes to the numerator while being absent from
 * the denominator, and the platform rate can exceed 100% — a number that is
 * arithmetically reachable here and means nothing.
 *
 * `collectedInWindow` is reported beside the rate and is **never divided by `owed`**. It
 * is a flow of money that parents paid inside the window, measured against a position
 * that does not change when the window moves. A school that billed in September and is
 * still collecting in January would otherwise read as catastrophically delinquent.
 */
const CollectionRateAnalytics = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [reloadKey, setReloadKey] = useState(0);

  const from = searchParams.get('from') || '';
  const to = searchParams.get('to') || '';

  const setFilter = useCallback(
    (key, value) => {
      setSearchParams(
        (current) => {
          const params = new URLSearchParams(current);
          if (!value) params.delete(key);
          else params.set(key, value);
          return params;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const [state, setState] = useState({ data: null, loading: true, error: null });

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: null }));
    getCollectionRateAnalytics({ from, to })
      .then((data) => active && setState({ data, loading: false, error: null }))
      .catch((error) => active && setState({ data: null, loading: false, error }));
    return () => {
      active = false;
    };
  }, [from, to, reloadKey]);

  const data = state.data || {};
  const totals = data.totals || {};
  const byTerm = Array.isArray(data.byTerm) ? data.byTerm : [];

  const rateDefined = rateIsDefined(totals.collectionRatePercent);
  const withoutPlan = Number(totals.schoolsWithRosterButNoPlan) || 0;

  const termSegments = (term) => [
    { key: 'applied', label: 'Applied', value: Number(term.applied) || 0, className: 'bg-brand-700' },
    { key: 'outstanding', label: 'Outstanding', value: Number(term.outstanding) || 0, className: 'bg-amber-500' },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Platform console"
        title="Collection rate"
        description="What schools billed against what parents have paid, term by term, across the whole platform."
        actions={
          <button
            type="button"
            onClick={() => setReloadKey((key) => key + 1)}
            disabled={state.loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[13px] font-extrabold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
          >
            <RefreshCw className={`h-4 w-4 ${state.loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            Refresh
          </button>
        }
      />

      <AnalyticsTabs />

      <Card padding="p-4">
        <DateRangeField from={from} to={to} onChange={setFilter} idPrefix="collection-rate" />
      </Card>

      {/*
        The denominator rule, above the numbers and not in a tooltip.

        This is the single most consequential sentence on the screen. Without it the rate
        reads as a straightforward collection figure and an operator will quote it — to a
        school, to an investor, in a board deck — as a fact about how well the platform
        collects, when it is a fact about how well schools that issue installment plans
        collect. `Info` rather than a warning triangle on purpose: the number is not wrong,
        it is conditional, and the condition is what has to be visible.
      */}
      <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50/70 px-5 py-4">
        <p className="flex items-start gap-2.5 text-[13px]/[20px] font-extrabold text-sky-900">
          <Scale className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>How the rate is counted</span>
        </p>
        <ul className="mt-2 space-y-1.5 pl-7 text-[12px]/[19px] font-semibold text-sky-900/85">
          <li className="list-disc">
            <strong>Owed</strong> is the face value of every live payment plan whose term
            overlaps this window — not money billed inside the window.
          </li>
          <li className="list-disc">
            <strong>A school with no payment plan for a term is not owed, and is not counted
            as fully paid.</strong> It has issued no invoice, so there is nothing to collect;
            it is excluded from the denominator entirely.
            {withoutPlan > 0 && (
              <>
                {' '}
                <span className="font-extrabold">
                  {`That is ${formatCount(withoutPlan)} ${
                    withoutPlan === 1 ? 'school' : 'schools'
                  } with students and no plan in this window`}
                </span>
                , and they are the ones this rate says nothing about.
              </>
            )}
          </li>
          <li className="list-disc">
            <strong>Collections counted here are from schools with a plan in the window.</strong>{' '}
            Without that restriction a school paying through a pay link would add to the
            numerator while being absent from the denominator, and the rate could exceed
            100%.
          </li>
          <li className="list-disc">
            <strong>Money collected inside the window is reported separately</strong> and is
            never divided by what is owed. It is a flow; what is owed is a position.
          </li>
        </ul>
      </div>

      {state.error ? (
        <div className="mt-4">
          <EmptyState
            icon={ServerCrash}
            title="Collection-rate analytics could not be loaded"
            description={state.error.message || 'The request did not complete.'}
            action={
              <button
                type="button"
                onClick={() => setReloadKey((key) => key + 1)}
                className="rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
              >
                Try again
              </button>
            }
          />
        </div>
      ) : state.loading ? (
        <div className="mt-4 space-y-4">
          <div className="h-32 animate-pulse rounded-2xl bg-slate-200/70" />
          <div className="h-64 animate-pulse rounded-2xl bg-slate-200/70" />
        </div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Card padding="p-5">
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                Owed
              </p>
              <p className="mt-2 text-[28px] font-extrabold leading-none tracking-tight text-ink">
                {formatCediShort(totals.owed)}
              </p>
              <p className="mt-1.5 text-[10px]/[15px] font-semibold text-slate-400">
                {`${formatCount(totals.terms)} terms in scope`}
              </p>
            </Card>

            <Card padding="p-5">
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                Applied
              </p>
              <p className="mt-2 text-[28px] font-extrabold leading-none tracking-tight text-ink">
                {formatCediShort(totals.applied)}
              </p>
              <p className="mt-1.5 text-[10px]/[15px] font-semibold text-slate-400">
                Money actually applied to plan installments
              </p>
            </Card>

            <Card padding="p-5">
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                Outstanding
              </p>
              <p className="mt-2 text-[28px] font-extrabold leading-none tracking-tight text-amber-700">
                {formatCediShort(totals.outstanding)}
              </p>
              <p className="mt-1.5 text-[10px]/[15px] font-semibold text-slate-400">
                Owed minus applied, floored at zero
              </p>
            </Card>

            <Card padding="p-5" accent>
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                Collection rate
              </p>
              <p className="mt-2 text-[28px] font-extrabold leading-none tracking-tight text-ink">
                {rateDefined ? formatPercent(totals.collectionRatePercent) : '—'}
              </p>
              <p className="mt-1.5 text-[10px]/[15px] font-semibold text-slate-400">
                {rateDefined
                  ? `over ${formatCount(totals.schoolsWithPlans)} schools with plans`
                  : 'Nothing is owed in this window, so there is no rate'}
              </p>
            </Card>
          </div>

          <Card padding="p-5" className="mt-4">
            <h2 className="text-[15px] font-extrabold tracking-tight text-ink">
              Applied against owed
            </h2>
            <p className="mt-1 text-[12px]/[18px] font-medium text-slate-500">
              {rateDefined
                ? `${formatPercent(totals.collectionRatePercent)} of what schools have billed has been paid.`
                : 'Nothing was billed in this window, so there is no rate to show. That is a real zero, not a missing reading.'}
            </p>

            <div className="mt-4">
              <ProgressBar
                value={totals.collectionRatePercent || 0}
                label="Share of billed amount applied to installments"
                barClassName={
                  rateDefined && totals.collectionRatePercent < 60 ? 'bg-amber-500' : 'bg-brand-600'
                }
              />
            </div>

            {/*
              The two flows, kept apart on purpose. `collectedInWindow` is every completed
              payment dated inside the window, including from schools with no plan here;
              the narrower figure is the one whose schools are in the denominator. Printing
              both, labelled, is what stops a reader dividing the wrong one by `owed` and
              getting a number that moves whenever they change the date range.
            */}
            <dl className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-3">
                <dt className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                  Collected in window
                </dt>
                <dd className="mt-1 text-[15px] font-extrabold text-ink">
                  {formatCedi(totals.collectedInWindow)}
                </dd>
                <dd className="mt-0.5 text-[10px]/[15px] font-semibold text-slate-400">
                  {`${formatCount(totals.paymentsInWindow)} completed payments, all schools`}
                </dd>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <dt className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                  From schools with plans
                </dt>
                <dd className="mt-1 text-[15px] font-extrabold text-ink">
                  {formatCedi(totals.collectedInWindowFromSchoolsWithPlans)}
                </dd>
                <dd className="mt-0.5 text-[10px]/[15px] font-semibold text-slate-400">
                  The only figure whose schools are in the rate&rsquo;s denominator
                </dd>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <dt className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                  Roster, no plan
                </dt>
                <dd className="mt-1 text-[15px] font-extrabold text-ink">{formatCount(withoutPlan)}</dd>
                <dd className="mt-0.5 text-[10px]/[15px] font-semibold text-slate-400">
                  Schools with students and nothing to collect
                </dd>
              </div>
            </dl>
          </Card>

          <Card padding="p-0" className="mt-4 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
              <div>
                <h2 className="text-[13px] font-extrabold text-ink">By term</h2>
                <p className="mt-0.5 text-[11px]/[16px] font-semibold text-slate-500">
                  A term with no plan anywhere is absent from this table entirely — it is not
                  owed, so there is nothing to report against it.
                </p>
              </div>
              <Badge tone="slate">{formatCount(byTerm.length)} terms</Badge>
            </div>

            {byTerm.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  icon={Scale}
                  title="No term is owed in this window"
                  description="Either no school has a live payment plan overlapping these dates, or no plan has an installment in them. Widen the date range to see a term."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[56rem] border-collapse text-left">
                  <caption className="sr-only">
                    Owed, applied and outstanding for each academic term
                  </caption>
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/60">
                      <th scope="col" className="px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        Term
                      </th>
                      <th scope="col" className="px-5 py-3 text-right text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        Schools
                      </th>
                      <th scope="col" className="px-5 py-3 text-right text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        Students
                      </th>
                      <th scope="col" className="px-5 py-3 text-right text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        Owed
                      </th>
                      <th scope="col" className="px-5 py-3 text-right text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        Applied
                      </th>
                      <th scope="col" className="px-5 py-3 text-right text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        Outstanding
                      </th>
                      <th scope="col" className="px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        Rate
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {byTerm.map((term) => (
                      <tr key={term.key} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                        <td className="px-5 py-3.5">
                          <span className="block text-[13px] font-extrabold text-ink">
                            {term.term || 'No term set'}
                          </span>
                          <span className="block text-[11px] font-semibold text-slate-400">
                            {term.academicYear || 'No academic year'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right text-[13px] font-bold tabular-nums text-slate-600">
                          {formatCount(term.schools)}
                        </td>
                        <td className="px-5 py-3.5 text-right text-[13px] font-bold tabular-nums text-slate-600">
                          {formatCount(term.students)}
                        </td>
                        <td className="px-5 py-3.5 text-right text-[13px] font-bold tabular-nums text-slate-600">
                          {formatCedi(term.owed)}
                        </td>
                        <td className="px-5 py-3.5 text-right text-[13px] font-extrabold tabular-nums text-ink">
                          {formatCedi(term.applied)}
                        </td>
                        <td className="px-5 py-3.5 text-right text-[13px] font-extrabold tabular-nums text-amber-700">
                          {formatCedi(term.outstanding)}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="w-40">
                            <StackedBar segments={termSegments(term)} />
                            <p className="mt-1.5 text-right text-[11px] font-extrabold tabular-nums text-slate-600">
                              {rateIsDefined(term.collectionRatePercent)
                                ? formatPercent(term.collectionRatePercent)
                                : '—'}
                            </p>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {data.definitions && (
            <p className="mt-4 flex items-start gap-2 text-[11px]/[17px] font-medium text-slate-500">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>
                {data.definitions.owed} {data.definitions.applied} {data.definitions.collectionRatePercent}
              </span>
            </p>
          )}
        </>
      )}
    </>
  );
};

export default CollectionRateAnalytics;
