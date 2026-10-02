import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRightLeft,
  Building2,
  CheckCheck,
  HandCoins,
  PiggyBank,
  Plus,
  RotateCcw,
  Scale,
  Wallet,
} from 'lucide-react';
import PageHeader from '../../../components/dashboard/PageHeader';
import EmptyState from '../../../components/dashboard/EmptyState';
import Card from '../../../components/dashboard/ui/Card';
import Badge from '../../../components/dashboard/ui/Badge';
import Tile, { CediValue } from '../../../components/dashboard/ui/Tile';
import AreaChart from '../../../components/dashboard/charts/AreaChart';
import ApproveBatchModal from '../../../components/admin/finance/ApproveBatchModal';
import CreateBatchModal from '../../../components/admin/finance/CreateBatchModal';
import {
  DISBURSEMENT_LABEL,
  DISBURSEMENT_TONE,
  periodLabel,
  shiftIsoDay,
  weeklyDisbursementSeries,
} from '../../../components/admin/finance/financeVocabulary';
import { useToast } from '../../../hooks/useToast';
import {
  approveDisbursement,
  createDisbursement,
  getFinanceOverview,
  getReconciliation,
  listDisbursements,
} from '../../../services/finance';
import { ADMIN_ROUTES } from '../../../utils/constants';
import { formatCedi, formatCediShort, formatCount } from '../../../utils/format';

/** How many weeks the trend chart plots. Eight is one working month plus change. */
const TREND_WEEKS = 8;

/**
 * `/admin/finance` — the money picture, in four figures that are not one figure.
 *
 * ### The headline row exists to prevent a specific mistake
 *
 * The obvious way to render this payload is one big number labelled "Collected",
 * because that is what a payments dashboard does and it is the thing an operator
 * expects to see. It is also the one number that cannot be honest here, because
 * four different amounts are in flight at once and they belong to different
 * parties:
 *
 *   - **`cashHeld`** — markup and fees taken from parents and not yet swept into an
 *     account. The platform's own accrued revenue. It is *not* the float.
 *   - **`platformRevenueThisMonth`** — what SukuuPay has earned this month. Earned
 *     is not the same as in hand: most of it is the first figure waiting on a
 *     payout.
 *   - **`pendingDisbursements`** — net amounts owed to schools across open
 *     batches. This money was collected from parents but belongs to somebody else.
 *   - **`disbursedThisMonth`** — what has actually moved, keyed on `processedAt`
 *     rather than `createdAt`, because a batch built in March and paid in April is
 *     an April disbursement (`disbursements.service.js:1042-1050`).
 *
 * Adding any two of those produces a number with no owner. `cashHeld +
 * pendingDisbursements` in particular is the tempting one — it is the total in the
 * gateway account — and it is the one that most overstates what the platform can
 * spend, because the second half is not its to spend. `services/finance.js:71-84`
 * names four separate fields rather than a `total` for exactly this reason, and
 * this row is where that decision has to be honoured.
 *
 * ### Three requests, three independent states
 *
 * The overview payload, the pending queue and today's reconciliation are three
 * calls with three failure modes, and they are kept separate rather than merged
 * into one object — `AdminOverview.jsx` states the same rule from the other side:
 * a failed request that is treated as zero is how a live screen shows a school
 * that does not exist. A failure here blanks its own card and says what it was.
 *
 * ### The trend chart is bucketed from real batches, and says so
 *
 * **There is no disbursement time-series endpoint.** `getFinanceOverview` returns
 * month-to-date aggregates and a ten-school worklist; every `/api/analytics/*`
 * route is school-scoped. Rather than draw a curve through two aggregates —
 * invented data wearing a chart's clothes — the chart buckets the batches the
 * queue endpoint returns, keyed on `processedAt`, over eight weeks
 * (`weeklyDisbursementSeries`). That has two honest limits, and both are printed
 * under the chart rather than left in a comment:
 *
 *   1. the queue's `from`/`to` filters **`createdAt`**, so a batch built before the
 *      window and paid inside it is never fetched and cannot be counted;
 *   2. the queue is paged at 200, so a platform with more than 200 batches in the
 *      window plots the most recent 200 and says how many it is missing.
 *
 * A week with no disbursement is an explicit `0`, never an omitted point, so it
 * renders as a dip rather than a straight line across the hole that reads as
 * steady progress.
 *
 * ### "Awaiting approval" and the bulk confirm
 *
 * Approving is a confirmed dialog and not a toast, for the reasons in
 * `ApproveBatchModal` — but the bulk case has its own problem, which the dialog
 * states: **there is no server-side bulk endpoint.** `approveDisbursement` is
 * per-batch, so "approve all" is N sequential requests and can only ever be
 * partially complete. A run where 11 of 12 batches were approved and one was
 * refused is not a failure to be retried wholesale; re-running it would ask for a
 * second approval of eleven batches that no longer accept one. So the handler
 * reports each refusal by batch number and the dialog stays open with them listed.
 *
 * **And nothing moves.** No payout provider is wired, so approving stamps
 * `approved` with no reference and leaves the ledger unsettled. The dialog says so
 * before the button; the success toast says it again after, because the toast is
 * what the operator reads when they come back to this screen in an hour.
 */
const FinanceOverview = () => {
  const toast = useToast();
  const [reloadKey, setReloadKey] = useState(0);
  const [approveTargets, setApproveTargets] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);

  const [overview, setOverview] = useState({ data: null, loading: true, error: null });
  const [queue, setQueue] = useState({ rows: [], meta: null, loading: true, error: null });
  const [day, setDay] = useState({ data: null, loading: true, error: null });
  const [trend, setTrend] = useState({ rows: [], total: 0, loading: true, error: null });

  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

  // The overview payload.
  useEffect(() => {
    let active = true;
    setOverview((current) => ({ ...current, loading: true, error: null }));
    getFinanceOverview()
      .then((data) => active && setOverview({ data, loading: false, error: null }))
      .catch((error) => active && setOverview({ data: null, loading: false, error }));
    return () => {
      active = false;
    };
  }, [reloadKey]);

  /*
   * The approval queue, and the trend's source, in one call.
   *
   * Two requests rather than one, deliberately: the queue is filtered to
   * `pending_approval` (a worklist — "what money is waiting to go out") while the
   * trend needs every status, because a weekly *disbursement* chart that omitted
   * `paid` would plot nothing at all. Merging them would mean either an
   * "awaiting approval" table full of `paid` rows or a chart of nothing.
   */
  useEffect(() => {
    let active = true;
    setQueue((current) => ({ ...current, loading: true, error: null }));
    setTrend((current) => ({ ...current, loading: true, error: null }));

    const from = shiftIsoDay(new Date().toISOString().slice(0, 10), -7 * TREND_WEEKS);

    listDisbursements({ status: 'pending_approval', perPage: 200 })
      .then((result) =>
        active &&
        setQueue({ rows: result.rows, meta: result.meta, loading: false, error: null })
      )
      .catch((error) => active && setQueue({ rows: [], meta: null, loading: false, error }));

    listDisbursements({ from, perPage: 200 })
      .then((result) =>
        active &&
        setTrend({
          rows: result.rows,
          total: Number(result.meta?.total) || 0,
          loading: false,
          error: null,
        })
      )
      .catch((error) => active && setTrend({ rows: [], total: 0, loading: false, error }));

    return () => {
      active = false;
    };
  }, [reloadKey]);

  // Today's reconciliation, for the provider breakdown the overview payload has no
  // aggregate for. `matched`/`unmatched` come from the overview's own
  // `reconciliationToday`; `byGateway` only exists on this endpoint.
  useEffect(() => {
    let active = true;
    setDay((current) => ({ ...current, loading: true, error: null }));
    getReconciliation()
      .then((data) => active && setDay({ data, loading: false, error: null }))
      .catch((error) => active && setDay({ data: null, loading: false, error }));
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const data = overview.data || {};

  const series = useMemo(() => weeklyDisbursementSeries(trend.rows, TREND_WEEKS), [trend.rows]);
  const peakIndex = useMemo(() => {
    let best = -1;
    series.forEach((point, index) => {
      if (point.value > 0 && (best === -1 || point.value > series[best].value)) best = index;
    });
    return best;
  }, [series]);

  const trendMissing = Math.max(0, trend.total - trend.rows.length);

  /**
   * Approve a set of batches, one request each, and report per batch.
   *
   * Sequential on purpose, not `Promise.all`: `Promise.all` rejects on the first
   * failure and would abandon the rest mid-flight, leaving the operator unable to
   * tell which batches were approved. Sequential also means each request completes
   * before the next begins, so two approvals for the same batch cannot race into
   * the 409 the server would have refused one of them with.
   *
   * `{ ok, error }`, never a throw — the dialog branches on the result and stays
   * open with the failures named.
   */
  const confirmApprove = useCallback(
    async (batches) => {
      const failures = [];
      let approved = 0;
      let sent = 0;

      for (const batch of batches) {
        try {
          const updated = await approveDisbursement(batch._id);
          approved += 1;

          /*
           * `sent` counted from the *returned* batch, not assumed.
           *
           * `services/finance.js` returns `data.data || {}`, which drops the
           * response's `meta.payoutProviderWired` — the one field that says
           * whether a transfer was attempted. What survives is `payoutReference`,
           * and it is the better signal anyway: the server writes it only from a
           * provider's own transfer id, so a null reference is positive evidence
           * that nothing moved. Anything else would be inferring movement from a
           * status word.
           */
          if (updated?.payoutReference) sent += 1;
        } catch (error) {
          failures.push({
            id: batch._id,
            batchNumber: batch.batchNumber,
            error: error.message || 'Refused by the server.',
          });
        }
      }

      if (failures.length === 0) {
        toast.success(
          sent === batches.length
            ? `${formatCount(batches.length)} payouts sent.`
            : `${formatCount(batches.length)} batches approved. No payout provider is wired, so the money has not moved — it stays held until one is.`
        );
        refresh();
        return { ok: true };
      }

      toast.warning(
        `${formatCount(approved)} approved, ${formatCount(failures.length)} refused. Nothing was rolled back.`
      );
      refresh();
      return {
        ok: false,
        error: `${formatCount(approved)} of ${formatCount(batches.length)} were approved. The rest were refused — see the list below, and check each one rather than running this again.`,
        failures,
      };
    },
    [refresh, toast]
  );

  /** Stage a batch. `{ ok, error }` so a 409 leaves the window intact. */
  const confirmCreate = useCallback(
    async ({ schoolId, periodStart, periodEnd }) => {
      try {
        const batch = await createDisbursement({ schoolId, periodStart, periodEnd });
        toast.success(
          `${batch.batchNumber || 'Batch'} staged for ${batch.schoolName || 'the school'} — ${
            batch.paymentCount || 0
          } payment(s) awaiting approval.`
        );
        refresh();
        return { ok: true };
      } catch (error) {
        return { ok: false, error: error.message || 'That batch could not be created.' };
      }
    },
    [refresh, toast]
  );

  const pendingNet = queue.rows.reduce((sum, batch) => sum + (Number(batch.netAmount) || 0), 0);

  return (
    <>
      <PageHeader
        eyebrow="Platform console"
        title="Finance"
        description="What the platform is holding, what it has earned, what it owes schools, and what has already moved."
        actions={
          <>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-3.5 py-2 text-[13px] font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Stage a batch
            </button>
            <button
              type="button"
              onClick={refresh}
              disabled={overview.loading}
              aria-label="Refresh the finance figures"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[13px] font-extrabold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
            >
              <RotateCcw
                className={`h-4 w-4 ${overview.loading ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              Refresh
            </button>
          </>
        }
      />

      {/*
        A failed headline call takes the page over rather than sitting above four
        tiles of zeros. If the overview did not answer, every figure below is
        unknown, and a band of zeros would say "the platform holds nothing" — the
        opposite of the truth, and on a money screen the most dangerous thing this
        page could render. Same rule as `AdminOverview.jsx:59-67`.
      */}
      {overview.error ? (
        <EmptyState
          icon={RotateCcw}
          title="The finance figures could not be loaded"
          description={
            overview.error.message ||
            'The request did not complete. Nothing below is shown rather than shown as zero.'
          }
          action={
            <button
              type="button"
              onClick={refresh}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Try again
            </button>
          }
        />
      ) : (
        <>
          {/* ── The four figures ── */}
          {overview.loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[0, 1, 2, 3].map((tile) => (
                <div key={tile} className="h-[9.5rem] animate-pulse rounded-2xl bg-slate-200/70" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {/*
                The ordering is the sequence an operator works through: what is in
                hand, what that earned, what is owed out of it, and how much has
                actually gone. Adjacent and never summed.
              */}
              <Tile
                label="Cash held"
                icon={Wallet}
                accent
                valueTone="text-brand-700"
                value={<CediValue pesewas={data.cashHeld} tone="text-brand-700" />}
                footer={
                  <p className="text-[11px] font-semibold leading-relaxed text-slate-500">
                    Taken from parents, earned, not yet swept out.{' '}
                    <span className="font-extrabold text-ink">
                      {formatCount(data.cashHeldEntries)}
                    </span>{' '}
                    unsettled ledger {Number(data.cashHeldEntries) === 1 ? 'entry' : 'entries'}.
                  </p>
                }
              />

              <Tile
                label="Platform revenue this month"
                icon={PiggyBank}
                value={<CediValue pesewas={data.platformRevenueThisMonth} />}
                footer={
                  <p className="text-[11px] font-semibold leading-relaxed text-slate-500">
                    Earned in {data.month || 'this month'} across{' '}
                    <span className="font-extrabold text-ink">
                      {formatCount(data.platformRevenueThisMonthEntries)}
                    </span>{' '}
                    revenue {Number(data.platformRevenueThisMonthEntries) === 1 ? 'entry' : 'entries'}.
                  </p>
                }
              />

              <Tile
                label="Owed to schools"
                icon={HandCoins}
                valueTone={Number(data.pendingDisbursements) ? 'text-amber-600' : 'text-ink'}
                value={
                  <CediValue
                    pesewas={data.pendingDisbursements}
                    tone={Number(data.pendingDisbursements) ? 'text-amber-600' : 'text-ink'}
                  />
                }
                footer={
                  <p className="text-[11px] font-semibold leading-relaxed text-slate-500">
                    Promised and not yet sent, across{' '}
                    <span className="font-extrabold text-ink">
                      {formatCount(data.pendingDisbursementCount)}
                    </span>{' '}
                    open {Number(data.pendingDisbursementCount) === 1 ? 'batch' : 'batches'}.
                  </p>
                }
              />

              <Tile
                label="Disbursed this month"
                icon={ArrowRightLeft}
                value={<CediValue pesewas={data.disbursedThisMonth} />}
                footer={
                  <p className="text-[11px] font-semibold leading-relaxed text-slate-500">
                    Actually moved, in {formatCount(data.disbursedThisMonthCount)}{' '}
                    {Number(data.disbursedThisMonthCount) === 1 ? 'batch' : 'batches'}. Keyed on
                    when the payout was processed, not when it was built.
                  </p>
                }
              />
            </div>
          )}

          {/*
            The reason those four are not one number, said in the interface rather
            than only in this comment. `data.cashHeld + data.pendingDisbursements`
            is the number an operator can compute with two keystrokes, and it is
            the wrong one — so the page that renders both halves is where the
            difference between them has to be stated.
          */}
          <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-[12px] font-semibold leading-relaxed text-slate-600">
              <strong className="font-extrabold text-ink">These four are not one number, and must
              not be added.</strong>{' '}
              Cash held is the platform&rsquo;s own money. Owed to schools is money collected from
              parents that belongs to a tenant — together they make up the gateway balance, and
              that total is{' '}
              <strong className="font-extrabold text-ink">
                {formatCedi((Number(data.cashHeld) || 0) + (Number(data.pendingDisbursements) || 0))}
              </strong>
              , of which only the first part is SukuuPay&rsquo;s to spend. Disbursed this month has
              already left.
            </p>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* ── The weekly trend ── */}
            <Card padding="p-5" className="lg:col-span-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-[13px] font-extrabold leading-tight text-ink">
                    Disbursed per week
                  </h2>
                  <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
                    Net amounts paid out, by the week the payout was processed
                  </p>
                </div>
                <span className="text-[11px] font-extrabold text-ink">
                  {formatCediShort(series.reduce((sum, point) => sum + point.value, 0))}
                </span>
              </div>

              {trend.error ? (
                <p className="mt-5 text-[13px] font-semibold text-red-600">
                  {trend.error.message || 'The disbursement trend could not be built.'}
                </p>
              ) : trend.loading ? (
                <div className="mt-5 h-[200px] animate-pulse rounded-xl bg-slate-200/50" />
              ) : (
                <>
                  <div className="mt-4">
                    <AreaChart
                      series={series}
                      formatValue={(value) => formatCedi(value)}
                      formatAxis={(value) => formatCediShort(value)}
                      peakIndex={peakIndex}
                    />
                  </div>

                  {/*
                    The chart's provenance, printed. Three limits an operator would
                    otherwise discover by being wrong: the window filters when a
                    batch was *built*, not when it was paid; the queue is one page;
                    and a week with no payout is drawn as zero rather than omitted.
                  */}
                  <p className="mt-2 text-[10px] font-semibold leading-relaxed text-slate-400">
                    There is no disbursement time-series endpoint, so these are real{' '}
                    {formatCount(trend.rows.length)} batches bucketed by their processing week over
                    the last {TREND_WEEKS} weeks.
                    {trendMissing > 0
                      ? ` ${formatCount(trendMissing)} more batches exist in the window and are not plotted — this is one page, not the whole history.`
                      : ''}{' '}
                    The window filters on when a batch was built, so a batch built earlier and paid
                    inside it is not counted. A week with no payout is shown as zero, not omitted.
                  </p>
                </>
              )}
            </Card>

            {/* ── Reconciliation, today ── */}
            <Card padding="p-5" className="flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-[13px] font-extrabold leading-tight text-ink">
                    Reconciliation today
                  </h2>
                  <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
                    Completed payments carrying a provider reference
                  </p>
                </div>
                <Scale className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              </div>

              {day.error || overview.error ? (
                <p className="mt-5 text-[13px] font-semibold text-red-600">
                  {(day.error || overview.error).message}
                </p>
              ) : day.loading ? (
                <div className="mt-5 space-y-3">
                  <div className="h-8 w-40 animate-pulse rounded-lg bg-slate-200/70" />
                  <div className="h-4 w-full animate-pulse rounded bg-slate-200/70" />
                </div>
              ) : (
                <>
                  <dl className="mt-4 space-y-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-[12px] font-semibold text-slate-600">
                        Matched to a reference
                      </dt>
                      <dd className="text-[13px] font-extrabold tabular-nums text-ink">
                        {formatCount(data.reconciliationToday?.matched)}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-[12px] font-semibold text-slate-600">
                        No reference to match
                      </dt>
                      <dd className="text-[13px] font-extrabold tabular-nums text-amber-700">
                        {formatCount(data.reconciliationToday?.unmatched)}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-2.5">
                      <dt className="text-[12px] font-semibold text-slate-600">
                        Payments taken today
                      </dt>
                      <dd className="text-[13px] font-extrabold tabular-nums text-ink">
                        {formatCedi(day.data?.payments?.totalAmount)}
                      </dd>
                    </div>
                  </dl>

                  {/*
                    The provider breakdown, from the day report — the overview
                    payload has matched/unmatched counts but no way to say *which
                    rails* produced them.

                    A `manual` provider is the reason the copy here is careful.
                    A payment taken as cash outside SukuuPay has no gateway to
                    reconcile against and legitimately carries no reference, so it
                    appears in this list by design and is not an error. Neither is
                    an MTN payment: its reference is `mtnReferenceId`, not
                    `hubtelTransactionId`, so every MTN row is counted unmatched
                    even when it reconciles perfectly against MTN's own statement
                    (`disbursements.service.js:1100-1115`). Calling either a
                    failure would make this number get ignored within a week.
                  */}
                  {Array.isArray(day.data?.payments?.byGateway) &&
                  day.data.payments.byGateway.length > 0 ? (
                    <div className="mt-4 border-t border-slate-100 pt-3">
                      <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        Today&rsquo;s payments by rail
                      </p>
                      <ul className="mt-2 space-y-1.5">
                        {day.data.payments.byGateway.map((row) => (
                          <li
                            key={`${row.provider}-${row.method}`}
                            className="flex items-center justify-between gap-3 text-[12px] font-semibold"
                          >
                            <span className="flex items-center gap-1.5 text-slate-600">
                              <Badge tone={row.provider === 'manual' ? 'slate' : 'brand'}>
                                {row.provider}
                              </Badge>
                              <span className="text-slate-400">{row.method}</span>
                            </span>
                            <span className="tabular-nums text-ink">
                              {formatCount(row.count)} · {formatCediShort(row.amount)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2.5 text-[11px] font-semibold leading-relaxed text-slate-500">
                    A payment with no provider reference is a signal to look at, not a failure. A{' '}
                    <code className="font-mono">manual</code> school collects outside SukuuPay and
                    will never have one, and MTN payments carry their reference under a different
                    field — so both appear here by design. The full day report is on{' '}
                    <Link
                      to={ADMIN_ROUTES.RECONCILIATION}
                      className="font-extrabold text-brand-700 underline-offset-2 hover:underline"
                    >
                      Reconciliation
                    </Link>
                    .
                  </p>
                </>
              )}
            </Card>
          </div>

          {/* ── Awaiting approval ── */}
          <div className="mt-4">
            <Card padding="p-0" className="overflow-hidden">
              <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
                <div>
                  <h2 className="text-[13px] font-extrabold leading-tight text-ink">
                    Awaiting approval
                  </h2>
                  <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
                    {queue.loading
                      ? 'Loading the queue…'
                      : `${formatCount(queue.rows.length)} ${
                          queue.rows.length === 1 ? 'batch' : 'batches'
                        } · ${formatCedi(pendingNet)} owed to schools`}
                  </p>
                </div>

                {/*
                  The bulk action, and why it is a confirm rather than a toast.

                  Approving is the only write in this console that commits a
                  school to being paid, and it is irreversible — the payments are
                  marked disbursed and the ledger settles. So the button opens
                  `ApproveBatchModal`, which names every school, every batch number
                  and the exact total before anything is sent, and disables itself
                  while the request is in flight.

                  What it cannot promise is atomicity. There is no bulk endpoint;
                  this issues one request per batch, so a run can be partly
                  complete and the dialog says so rather than closing over a
                  partial result.
                */}
                <button
                  type="button"
                  onClick={() => setApproveTargets(queue.rows)}
                  disabled={queue.loading || queue.rows.length === 0}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-3.5 py-2 text-[13px] font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
                >
                  <CheckCheck className="h-4 w-4" aria-hidden="true" />
                  Approve all {queue.rows.length > 0 ? formatCount(queue.rows.length) : ''}
                </button>
              </div>

              {queue.error ? (
                <div className="px-5 pb-5">
                  <p className="text-[13px] font-semibold text-red-600">
                    {queue.error.message}
                  </p>
                </div>
              ) : queue.loading ? (
                <div className="space-y-2 px-5 pb-5">
                  {[0, 1, 2].map((row) => (
                    <div key={row} className="h-12 animate-pulse rounded-xl bg-slate-200/70" />
                  ))}
                </div>
              ) : queue.rows.length === 0 ? (
                <div className="px-5 pb-5">
                  <EmptyState
                    icon={CheckCheck}
                    title="Nothing is awaiting approval"
                    description="Every batch built so far has been approved, paid or cancelled. Stage one from a school's collected payments when the next window closes."
                  />
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[46rem] border-collapse text-left">
                      <caption className="sr-only">Disbursement batches awaiting approval</caption>
                      <thead>
                        <tr className="border-y border-slate-100 bg-slate-50/60">
                          <th scope="col" className="px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                            Batch
                          </th>
                          <th scope="col" className="px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                            School
                          </th>
                          <th scope="col" className="px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                            Window
                          </th>
                          <th scope="col" className="px-5 py-3 text-right text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                            Payments
                          </th>
                          <th scope="col" className="px-5 py-3 text-right text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                            School receives
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {queue.rows.map((batch) => (
                          <tr key={batch._id} className="border-b border-slate-50 last:border-0">
                            <td className="px-5 py-3.5">
                              <Link
                                to={ADMIN_ROUTES.DISBURSEMENT_DETAIL.replace(':batchId', batch._id)}
                                className="font-mono text-[12px] font-extrabold text-brand-700 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
                              >
                                {batch.batchNumber}
                              </Link>
                              <span className="mt-0.5 block">
                                <Badge tone={DISBURSEMENT_TONE(batch.status)}>
                                  {DISBURSEMENT_LABEL(batch.status)}
                                </Badge>
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-[13px] font-bold text-ink">
                              {batch.schoolName || 'Unknown school'}
                              {batch.schoolCode ? (
                                <span className="block font-mono text-[11px] font-bold text-slate-400">
                                  {batch.schoolCode}
                                </span>
                              ) : null}
                            </td>
                            <td className="px-5 py-3.5 text-[12px] font-semibold text-slate-600">
                              {periodLabel(batch.periodStart, batch.periodEnd)}
                            </td>
                            <td className="px-5 py-3.5 text-right text-[13px] font-bold tabular-nums text-slate-600">
                              {formatCount(batch.paymentCount)}
                            </td>
                            <td className="px-5 py-3.5 text-right text-[13px] font-extrabold tabular-nums text-ink">
                              {formatCedi(batch.netAmount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <p className="border-t border-slate-100 px-5 py-3 text-[11px] font-semibold leading-relaxed text-slate-400">
                    Approving records the decision and settles nothing — no payout provider is wired,
                    so every batch stays at <code className="font-mono">approved</code> with its
                    ledger unsettled and the money still counted as held.
                  </p>
                </>
              )}
            </Card>
          </div>

          {/* ── Schools owed money ── */}
          <div className="mt-4">
            <Card padding="p-0" className="overflow-hidden">
              <div className="px-5 py-4">
                <h2 className="text-[13px] font-extrabold leading-tight text-ink">
                  Schools owed money
                </h2>
                <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
                  Net owed across open batches, biggest first. The platform&rsquo;s own unsettled
                  share of each school&rsquo;s markup is beside it, because the two are a
                  conversation together.
                </p>
              </div>

              {!overview.loading && Array.isArray(data.bySchool) && data.bySchool.length === 0 ? (
                <div className="px-5 pb-5">
                  <EmptyState
                    icon={Building2}
                    title="No school is owed anything"
                    description="There are no open disbursement batches. Nothing has been collected and held back."
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[38rem] border-collapse text-left">
                    <caption className="sr-only">Schools with money waiting to be paid out</caption>
                    <thead>
                      <tr className="border-y border-slate-100 bg-slate-50/60">
                        <th scope="col" className="px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                          School
                        </th>
                        <th scope="col" className="px-5 py-3 text-right text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                          Owed
                        </th>
                        <th scope="col" className="px-5 py-3 text-right text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                          Open batches
                        </th>
                        <th scope="col" className="px-5 py-3 text-right text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                          Their markup we hold
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.bySchool || []).map((row) => (
                        <tr key={row.schoolId} className="border-b border-slate-50 last:border-0">
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
                          <td className="px-5 py-3.5 text-right text-[13px] font-extrabold tabular-nums text-ink">
                            {formatCedi(row.netOwed)}
                          </td>
                          <td className="px-5 py-3.5 text-right text-[13px] font-bold tabular-nums text-slate-600">
                            {formatCount(row.batchCount)}
                          </td>
                          <td className="px-5 py-3.5 text-right text-[13px] font-bold tabular-nums text-slate-600">
                            {formatCedi(row.platformUnsettled)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/*
                The worklist is capped at ten schools server-side
                (`BY_SCHOOL_LIMIT`) because a screen does not scroll past ten. The
                full queue is the disbursements list, and the number of schools
                with open batches is on the "Owed to schools" tile above — so this
                cap never changes the total, only which schools are named.
              */}
              {Array.isArray(data.bySchool) && data.bySchool.length > 0 ? (
                <p className="border-t border-slate-100 px-5 py-3 text-[11px] font-semibold leading-relaxed text-slate-400">
                  The ten schools with the most waiting. The total above covers every open batch.{' '}
                  <Link
                    to={ADMIN_ROUTES.DISBURSEMENTS}
                    className="font-extrabold text-brand-700 underline-offset-2 hover:underline"
                  >
                    Open the full queue
                  </Link>
                  .
                </p>
              ) : null}
            </Card>
          </div>
        </>
      )}

      <ApproveBatchModal
        open={approveTargets.length > 0}
        batches={approveTargets}
        onClose={() => setApproveTargets([])}
        onConfirm={confirmApprove}
      />

      <CreateBatchModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onConfirm={confirmCreate}
      />
    </>
  );
};

export default FinanceOverview;
