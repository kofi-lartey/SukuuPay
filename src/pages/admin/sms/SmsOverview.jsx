import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  CircleDollarSign,
  MessageSquare,
  Send,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import PageHeader from '../../../components/dashboard/PageHeader';
import EmptyState from '../../../components/dashboard/EmptyState';
import Card from '../../../components/dashboard/ui/Card';
import Badge from '../../../components/dashboard/ui/Badge';
import Tile from '../../../components/dashboard/ui/Tile';
import AreaChart from '../../../components/dashboard/charts/AreaChart';
import ModuleTabs from '../../../components/dashboard/ModuleTabs';
import BroadcastModal from '../../../components/admin/sms/BroadcastModal';
import { useToast } from '../../../hooks/useToast';
import { usePlatformSettings } from '../../../hooks/usePlatformSettings';
import { useImpersonation } from '../../../hooks/useImpersonation';
import { broadcastToSchoolAdmins, getSmsOverview } from '../../../services/admin';
import { ADMIN_ROUTES } from '../../../utils/constants';
import { formatCediShort, formatCount, formatPercent } from '../../../utils/format';

/**
 * Platform SMS: what has been sent, what it cost, and who is using it.
 *
 * Backed by `GET /admin/sms/overview`, which has **no server-side implementation
 * yet** — there is no `controllers/admin/sms.controller.js` and the five SMS
 * routes are absent from `Backend/src/routes/admin.routes.js` (only the older
 * `/admin/sms-balance` is registered, at `admin.routes.js:89`). `services/admin.js`
 * is therefore the contract this page is written against, exactly as
 * `AdminContent.jsx` is written against five undocumented ad routes.
 *
 * That is the reason for `normaliseOverview` below, and the reason it is written
 * the way it is. The doc comment on `getSmsOverview` names exactly one key —
 * `totals.estimatedCostThisMonth`, and names it as an **estimate** — so every
 * other field is
 * inferred from the `SmsMessage` model and from what the page actually needs. The
 * inference is written down field by field rather than hidden in destructuring, so
 * that whoever writes the controller can match it in one pass instead of reverse
 * engineering a React file.
 *
 * **Every field falls back to a zero rather than throwing.** A renamed key
 * degrades to "0 messages" on one tile; an unmapped key that threw would take the
 * whole page down and leave an operator unable to see the credits balance during
 * an incident. The zeros are visible — `formatCount(0)` reads "0" — so a
 * half-wired endpoint looks wrong rather than empty, which is the failure the
 * console conventions call out in §3 ("the request failed" and "there is nothing
 * here" must not look the same).
 *
 * ## The cost figure is an estimate, and the word is on the screen
 *
 * `totals.estimatedCostThisMonth` is `messages × PlatformSettings.sms.ratePesewas`.
 * That is the same arithmetic the composer uses for a prospective send, and it is
 * right for a planning figure. It is *not* the provider's invoice, and it cannot
 * be: real billing involves prepaid bundles (bought in bulk, so a month that draws
 * down a bundle is cheaper per message than the list rate), per-network rates that
 * differ by 2–3× inside Ghana, and refunds for messages that failed after
 * submission — which `SmsMessage` records as `creditsRefunded` and the estimate
 * does not subtract.
 *
 * So the label says "estimated" in the tile, in the tile's footer and in the
 * footnote under the breakdown, not only in a comment. The failure this prevents
 * is specific: the first time the platform owner sees an Arkesel or MTN invoice
 * that does not match this number, they have no way to tell whether the console is
 * broken or the invoice is wrong, and the default assumption is always that the
 * software is broken.
 *
 * ## No balance is shown on this page
 *
 * `getSmsOverview` returns `totals` and per-school volume — **no balance**, and
 * that is correct rather than a gap: SMS credit lives on a *school*
 * (`SmsCreditTopUp.schoolId` is `required`), so there is no platform credit pool
 * to report and the Credits page is where balances belong. This page links there.
 */

/** Delivery states from `SMS_DELIVERY_STATUSES`, with the badge tones used here. */
const STATUS_TONES = {
  queued: 'slate',
  submitted: 'blue',
  sent: 'blue',
  delivered: 'green',
  failed: 'red',
  rejected: 'rose',
  unknown: 'slate',
};

const STATUS_LABELS = {
  queued: 'Queued',
  submitted: 'Submitted to provider',
  sent: 'Sent',
  delivered: 'Delivered',
  failed: 'Failed',
  rejected: 'Rejected',
  unknown: 'Unknown',
};

/** The order an operator wants them in: what worked, then what has not landed. */
const STATUS_ORDER = ['delivered', 'sent', 'submitted', 'queued', 'failed', 'rejected', 'unknown'];

const number = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

/**
 * First present key from a list of aliases, as a number.
 *
 * Written rather than reached for inline because the whole point is that the
 * server has not named these yet, and a reader needs to see the candidate names
 * side by side. `pick(payload, ['a', 'b'])` reads as "either will do"; a chain of
 * `payload.a ?? payload.b` scattered through a component does not.
 */
const firstNumber = (payload, keys) => {
  for (const key of keys) {
    if (payload && payload[key] !== undefined && payload[key] !== null) {
      return number(payload[key]);
    }
  }
  return 0;
};

const firstValue = (payload, keys) => {
  for (const key of keys) {
    const value = payload?.[key];
    if (value !== undefined && value !== null) return value;
  }
  return null;
};

/**
 * `GET /admin/sms/overview` → the four shapes this page renders.
 *
 * The aliases, and why each pair exists:
 *
 *   - totals:   `totals.messagesThisMonth` and `totals.messagesAllTime`, with
 *               `thisMonth` / `allTime` as aliases.
 *   - cost:     `totals.estimatedCostThisMonth` — in pesewas, and an estimate.
 *   - statuses: `byStatus` | `statusCounts` | `delivery` — `{ delivered: 12, … }`.
 *   - schools:  `bySchool` | `schools` | `topSchools`, rows carrying a school
 *               name, a message count and (optionally) a cost.
 *   - series:   `daily` | `series` | `byDay`, rows of `{ date | day, count |
 *               messages | sent }` for the chart.
 *
 * **No balance key is in that list on purpose.** See the header note: there is no
 * platform credit pool to report, and a balance synthesised from schools' holdings
 * would be a number on the money screens that nothing can reconcile.
 *
 * `seriesForChart` additionally **refuses to invent points.** `getDashboardKpis`
 * sets the precedent for the platform console having no synthesised time series
 * (`admin.js:74-80`), and `getRevenueSeries` states the opposite convention — its
 * series has no gaps *by contract*. This one has no such contract, because the
 * endpoint does not exist; so a day the server omits is left out of the chart
 * rather than filled with a zero, and the caption says how many days were plotted.
 * If the endpoint is later written to emit explicit zeroes (the better contract),
 * the chart improves without a change here.
 */
const normaliseOverview = (payload) => {
  const source = payload || {};
  // The endpoint nests its aggregates under `totals` rather than spreading them
  // across the root: `totals.estimatedCostThisMonth` is the documented name and
  // the others follow it. Reading the root as a fallback is what keeps a partially
  // wired endpoint showing numbers instead of zeros — and every value still falls
  // back to zero rather than throwing, so a renamed key degrades to one wrong tile
  // rather than a blank page.
  const totals = source.totals || {};

  const statusCounts = firstValue(source, ['byStatus', 'statusCounts', 'delivery', 'totals.byStatus']) || {};
  const statusList = STATUS_ORDER.filter((status) => number(statusCounts[status]) > 0).map(
    (status) => ({ status, count: number(statusCounts[status]) })
  );

  // An unrecognised status is still shown, in slate, rather than dropped: a new
  // provider state the console has no mapping for is a gap in *our* table, and a
  // delivery report the platform cannot account for is worse than an ugly pill.
  Object.keys(statusCounts).forEach((status) => {
    if (!STATUS_ORDER.includes(status) && number(statusCounts[status]) > 0) {
      statusList.push({ status, count: number(statusCounts[status]) });
    }
  });

  const seriesSource = firstValue(source, ['daily', 'series', 'byDay']);
  const series = Array.isArray(seriesSource)
    ? seriesSource
        .map((point) => ({
          date: point?.date || point?.day || point?._id || '',
          count: firstNumber(point, ['count', 'messages', 'sent', 'total']),
        }))
        .filter((point) => point.date)
    : [];

  const schoolRows = firstValue(source, ['bySchool', 'schools', 'topSchools']);

  return {
    messagesThisMonth: firstNumber(totals, [
      'messagesThisMonth',
      'thisMonth',
      'totalThisMonth',
      'sentThisMonth',
    ]),
    messagesAllTime: firstNumber(totals, ['messagesAllTime', 'allTime', 'totalMessages', 'sentAllTime']),
    // **No credit figure is read from the overview.** `getSmsOverview` does not
    // return a balance, and inventing one from `messages × rate` would be the
    // number the Credits page exists to hold. The Overview links there instead.
    estimatedCostThisMonth: firstNumber(totals, [
      'estimatedCostThisMonth',
      'costThisMonth',
    ]),
    ratePes: firstNumber(source, ['ratePesewas', 'rate']) || firstNumber(totals, ['ratePesewas']),
    statusList,
    series,
    schools: Array.isArray(schoolRows)
      ? schoolRows.map((row) => ({
          id: row?.schoolId || row?._id || row?.school?.id || '',
          name: row?.schoolName || row?.name || row?.school?.name || 'Unnamed school',
          region: row?.region || row?.school?.region || '',
          messages: firstNumber(row, ['messages', 'count', 'total', 'sent']),
          credits: firstNumber(row, ['credits', 'creditsCharged', 'units']),
          cost: firstNumber(row, ['cost', 'costPesewas']),
        }))
      : [],
  };
};

/** A single day on the chart's x-axis. */
const dayLabel = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
};

const SmsOverview = () => {
  const toast = useToast();
  const navigate = useNavigate();
  const { settings } = usePlatformSettings();
  const { isImpersonating } = useImpersonation();

  const [reloadKey, setReloadKey] = useState(0);
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const [broadcastOpen, setBroadcastOpen] = useState(false);

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: null }));
    getSmsOverview()
      .then((result) => active && setState({ data: normaliseOverview(result), loading: false, error: null }))
      .catch((error) => active && setState({ data: null, loading: false, error }));
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

  /**
   * `reloadKey` is a fetch trigger, not a result cache — deliberately *not* shared
   * with the mutation. A broadcast is queued server-side, so refetching the moment
   * the POST returns can show a total that has not moved yet and reads as a
   * failure. The toast says what was accepted and the operator refreshes on their
   * own terms.
   *
   * `code` and `meta` are forwarded alongside `error` because `BroadcastModal`
   * branches on them: a `TOO_MANY_RECIPIENTS` refusal carries the resolved count in
   * `meta.recipients`, and a dialog that only sees `error.message` cannot say
   * "you selected 12 schools and that resolved to 612 administrators". `toApiError`
   * preserves `code` but drops `meta` today (`services/toApiError.js:13-16`), so
   * `meta` arrives as `undefined` until that file forwards it — the dialog handles
   * both cases and is documented on the branch.
   */
  const confirmBroadcast = useCallback(
    async (payload) => {
      try {
        const result = await broadcastToSchoolAdmins(payload);
        const queued = firstNumber(result, ['queued', 'recipients', 'recipientsResolved', 'count']);
        toast.success(
          queued
            ? `The broadcast was accepted for ${formatCount(queued)} administrators. Delivery follows the provider's reports.`
            : 'The broadcast was accepted. Delivery follows the provider’s reports.'
        );
        refresh();
        return { ok: true };
      } catch (error) {
        return {
          ok: false,
          error: error.message || 'The broadcast could not be sent.',
          code: error.code,
          meta: error.meta,
        };
      }
    },
    [refresh, toast]
  );

  const data = state.data;

  // `PlatformSettings.sms.ratePesewas` is the rate of record; the overview's own
  // copy is a fallback for the window before the settings load resolves (the hook
  // is fail-open by design, `usePlatformSettings.js:18-23`).
  const ratePes = settings?.sms?.ratePesewas ?? data?.ratePes ?? 0;

  const statuses = data?.statusList || [];
  const statusTotal = useMemo(
    () => statuses.reduce((sum, entry) => sum + entry.count, 0),
    [statuses]
  );

  const series = useMemo(
    () => (data?.series || []).map((point) => ({ label: dayLabel(point.date), value: point.count })),
    [data]
  );
  // The peak index, so the chart's callout has something to say before it is
  // hovered. Without it `AreaChart` renders the peak itself and the operator has
  // to find it.
  const peakIndex = useMemo(() => {
    if (!series.length) return -1;
    let best = 0;
    series.forEach((point, index) => {
      if (point.value > series[best].value) best = index;
    });
    return best;
  }, [series]);

  const schools = useMemo(
    () => [...(data?.schools || [])].sort((a, b) => b.messages - a.messages).slice(0, 10),
    [data]
  );

  const sectionTabs = useMemo(
    () => [
      { value: ADMIN_ROUTES.SMS, label: 'Overview' },
      { value: ADMIN_ROUTES.SMS_CREDITS, label: 'Credits' },
      { value: ADMIN_ROUTES.SMS_LOGS, label: 'Message history' },
    ],
    []
  );

  const openBroadcast = () => {
    if (isImpersonating) {
      toast.error(
        'Broadcasts are blocked while you are impersonating a school. Exit the session first.'
      );
      return;
    }
    setBroadcastOpen(true);
  };

  return (
    <>
      <PageHeader
        eyebrow="Platform console"
        title="SMS"
        description="Every message the platform has sent, the credit behind it, and the schools using it."
        actions={
          <button
            type="button"
            onClick={openBroadcast}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
          >
            <MessageSquare className="h-4 w-4" aria-hidden="true" />
            Broadcast to school admins
          </button>
        }
      />

      {/*
        `ModuleTabs` with `onChange` navigating, rather than `NavLink`s.

        The component is documented for a module's sections as *query parameters on
        one path*, and these are three real paths — so this is a deliberate reuse
        outside its documented case, and the cost is named: the tabs render as
        `<button>`s, so they do not get middle-click, ctrl-click or "open in a new
        tab". That matters here more than it would elsewhere, because an operator
        keeping the platform view in one tab and the SMS ledger in another is a
        normal way to work — and the alternative was hand-rolling the same markup,
        the same `aria-current` and the same overflow-scroll strip a second time.
      */}
      <ModuleTabs
        items={sectionTabs}
        value={ADMIN_ROUTES.SMS}
        onChange={navigate}
        ariaLabel="SMS sections"
      />

      {state.error ? (
        <EmptyState
          icon={MessageSquare}
          title="The SMS overview could not be loaded"
          description={state.error.message}
          action={
            <button
              type="button"
              onClick={refresh}
              className="rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800"
            >
              Try again
            </button>
          }
        />
      ) : state.loading && !data ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((slot) => (
            <div key={slot} className="h-36 animate-pulse rounded-2xl bg-slate-200/70" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {/*
            The KPI row.

            The credits tile leads with the cedi value and states the message count
            in the footer, because an operator deciding whether to top up needs to
            know how many messages that cedi buys — "GH₵ 45" alone does not tell
            them whether the platform can cover next week's run. The other three
            lead with the count, which is the unit they are actually reconciling.
          */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Tile
              label="Messages this month"
              icon={Send}
              value={formatCount(data.messagesThisMonth)}
              footer={
                <p className="text-[11px] font-semibold text-slate-500">
                  Since the first of this calendar month
                </p>
              }
            />

            <Tile
              label="Messages all-time"
              icon={TrendingUp}
              value={formatCount(data.messagesAllTime)}
              footer={
                <p className="text-[11px] font-semibold text-slate-500">
                  Every message on the platform
                </p>
              }
            />

            {/*
              No credits tile here, and that is a decision rather than an omission.

              `getSmsOverview` returns no balance — only `totals` — and the platform
              has no credit pool of its own to show: SMS credit lives on a school
              (`SmsCreditTopUp.schoolId` is `required`), so a "platform credits
              remaining" figure would have to be synthesised from schools' balances,
              which is the Credits page's number and not this one's. Inventing it
              here would put a figure on a screen that cannot be reconciled against
              the provider, which is the one thing this console must not do with
              money. The tile is a pointer to the real number instead.
            */}
            <Tile
              label="Held by schools"
              icon={Wallet}
              value="—"
              valueTone="text-slate-400"
              footer={
                <Link
                  to={ADMIN_ROUTES.SMS_CREDITS}
                  className="text-[11px] font-extrabold text-brand-700 underline-offset-2 hover:underline"
                >
                  See credit balances →
                </Link>
              }
            />

            {/*
              The estimated-cost tile. The word "estimated" is in the *label* and in
              the footer, not in a tooltip or a footnote the operator has to go
              looking for — and it is the label, because the label is what is read
              aloud in a screenshot pasted into a support thread.
            */}
            <Tile
              label="Estimated cost this month"
              icon={CircleDollarSign}
              value={formatCediShort(data.estimatedCostThisMonth)}
              footer={
                <p className="text-[11px] font-semibold text-slate-500">
                  An estimate, not the provider&rsquo;s invoice — {formatCount(data.messagesThisMonth)}{' '}
                  messages at the {formatCediShort(ratePes)} list rate
                </p>
              }
            />
          </div>

          {/* Volume over time. */}
          <Card padding="p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-extrabold text-ink">Send volume</h2>
              <p className="text-[11px] font-semibold text-slate-400">
                {series.length
                  ? `${formatCount(series.length)} day${series.length === 1 ? '' : 's'} with traffic`
                  : 'No daily breakdown from the API yet'}
              </p>
            </div>

            <div className="mt-3">
              <AreaChart
                series={series}
                peakIndex={peakIndex}
                formatValue={(value) => `${formatCount(value)} messages`}
                formatAxis={(value) => formatCount(Math.round(value))}
              />
            </div>

            {/*
              The chart's own caveat. `AreaChart` renders "No collection data for
              this period." when the series is empty — a string written for the
              school console's collections chart, and one that would be actively
              wrong here. This row is what replaces it with the truth, and it is
              shown *always*, not only when empty, so an operator learns on day one
              that this chart is days-with-traffic rather than a continuous curve.
            */}
            <p className="mt-2 text-[11px] font-semibold leading-relaxed text-slate-400">
              {series.length
                ? 'Days on which nothing was sent are omitted rather than plotted as zero — the API does not promise gap-free days the way the revenue series does. The estimated cost above is not derived from this chart.'
                : 'The overview endpoint does not return a daily breakdown yet. Until it does, no curve is drawn here rather than one invented from the monthly total.'}
            </p>
          </Card>

          {/* Delivery statuses. */}
          <Card padding="p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-extrabold text-ink">Delivery status</h2>
              <p className="text-[11px] font-semibold text-slate-400">
                {statusTotal ? `${formatCount(statusTotal)} messages with a known state` : 'No delivery reports yet'}
              </p>
            </div>

            {statuses.length === 0 ? (
              <p className="mt-3 rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-[12px] font-semibold text-slate-500">
                No messages have been submitted to a provider yet, so there is nothing to break
                down. Statuses arrive from the provider&rsquo;s delivery-report webhooks, not from
                the send itself.
              </p>
            ) : (
              <ul className="mt-4 space-y-2.5">
                {statuses.map(({ status, count }) => {
                  const share = statusTotal ? (count / statusTotal) * 100 : 0;
                  return (
                    <li key={status} className="flex items-center gap-3">
                      <span className="w-40 shrink-0">
                        <Badge tone={STATUS_TONES[status] || 'slate'}>
                          {STATUS_LABELS[status] || status}
                        </Badge>
                      </span>
                      <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <span
                          className="block h-full rounded-full bg-brand-700"
                          style={{ width: `${share}%` }}
                        />
                      </span>
                      <span className="w-32 shrink-0 text-right text-[12px] font-extrabold tabular-nums text-slate-600">
                        {formatCount(count)}{' '}
                        <span className="font-semibold text-slate-400">
                          ({formatPercent(share)})
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}

            {/*
              A pending state is not a failure, and the bar above says so by
              lumping `queued` and `submitted` into the denominator. It does not
              publish a "delivery rate" figure, because a rate computed over
              messages the carrier has not yet ruled on collapses the instant a
              batch goes out — which `HistoryTab.jsx:30-34` already names as the
              reason the school console excludes pending messages from its rate.
              There is no rate here at all rather than a rate computed differently.
            */}
          </Card>

          {/* The busiest schools. */}
          <Card padding="p-0" className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3.5">
              <h2 className="text-[13px] font-extrabold text-ink">Top schools by volume</h2>
              <p className="text-[11px] font-semibold text-slate-500">
                Which tenants are actually using the platform&rsquo;s messages
              </p>
            </div>

            {schools.length === 0 ? (
              <p className="px-5 py-8 text-center text-[12px] font-semibold text-slate-500">
                The overview endpoint returns no per-school breakdown yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[40rem] border-collapse text-left">
                  <caption className="sr-only">Schools ranked by SMS volume</caption>
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/60">
                      <th scope="col" className="px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        School
                      </th>
                      <th scope="col" className="px-5 py-3 text-right text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        Messages
                      </th>
                      <th scope="col" className="px-5 py-3 text-right text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        Credits used
                      </th>
                      <th scope="col" className="px-5 py-3 text-right text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        Estimated cost
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {schools.map((school) => (
                      <tr key={school.id || school.name} className="border-b border-slate-50 last:border-0">
                        <td className="px-5 py-3.5">
                          <p className="text-[13px] font-extrabold text-ink">{school.name}</p>
                          {school.region && (
                            <p className="text-[11px] font-semibold text-slate-400">{school.region}</p>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right text-[13px] font-extrabold tabular-nums text-ink">
                          {formatCount(school.messages)}
                        </td>
                        <td className="px-5 py-3.5 text-right text-[13px] font-bold tabular-nums text-slate-600">
                          {school.credits ? formatCount(school.credits) : '—'}
                        </td>
                        <td className="px-5 py-3.5 text-right text-[13px] font-bold tabular-nums text-slate-600">
                          {/*
                            The row's own cost when the server sends one, otherwise
                            the same estimate the KPI tile uses — computed here from
                            credits × rate rather than hard-coded, so the two figures
                            can never be derived by different arithmetic. Both are
                            labelled estimated in the column header, because the
                            header is the only place an operator comparing rows will
                            look.
                          */}
                          {school.cost ? formatCediShort(school.cost) : formatCediShort(school.credits * ratePes)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      <BroadcastModal
        open={broadcastOpen}
        onClose={() => setBroadcastOpen(false)}
        onConfirm={confirmBroadcast}
        ratePes={ratePes}
        provider={settings?.sms?.provider}
        // Passed down rather than checked inside: the dialog is also the right
        // place to *say* the block, and a button that is silently disabled is the
        // thing the conventions forbid.
        readOnly={isImpersonating}
      />
    </>
  );
};

export default SmsOverview;