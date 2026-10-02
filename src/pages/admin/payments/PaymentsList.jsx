import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Download, Receipt, TriangleAlert } from 'lucide-react';
import PageHeader from '../../../components/dashboard/PageHeader';
import EmptyState from '../../../components/dashboard/EmptyState';
import Pagination from '../../../components/students/Pagination';
import Badge from '../../../components/dashboard/ui/Badge';
import Card from '../../../components/dashboard/ui/Card';
import Tile, { CediValue } from '../../../components/dashboard/ui/Tile';
import { Field, SelectField } from '../../../components/common/FormField';
import SchoolFilterPicker from '../../../components/admin/SchoolFilterPicker';
import { PaymentChannelBadge, PaymentStatusBadge } from '../../../components/payments/PaymentBadges';
import { useToast } from '../../../hooks/useToast';
import {
  PAYMENT_NETWORKS,
  PAYMENT_PROVIDERS,
  PAYMENT_STATUSES,
  listAllPayments,
} from '../../../services/admin';
import { triggerDownload } from '../../../services/finance';
import { toApiError } from '../../../services/toApiError';
import { ROUTES } from '../../../utils/constants';
import { formatCediShort, formatCount } from '../../../utils/format';
import { formatDateTime, paymentTimestamp } from '../../../utils/dates';

/**
 * Every payment taken on the platform, across every school.
 *
 * Backed by `GET /admin/payments`, which returns `{ rows, meta, totals }` where
 * `totals` is summed **over the matched set**. That is the reason the KPI band
 * above the table takes its figure from the response rather than adding up what is
 * on screen: the table is a page, and a page summed into a platform total is the
 * specific error `PaymentKpiRow`'s header warns about for the school console — here
 * it would be worse, because the page spans schools and the arithmetic would read
 * as each school's own total.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **A refund is a row with a negative amount. It is not a flag on the original.**
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * `refundPayment` writes the reversal as its own `Payment` with `amount: -x` and
 * leaves the original exactly as it was — deliberately, so the ledger stays
 * additive (`Backend/src/models/paymentModel.js:64` notes that the model's `amount`
 * validator has no `min` *because* a refund row is written with a negative amount;
 * adding one made every refund 500). Two consequences this screen is built around:
 *
 *   1. **Summing the `completed` rows overstates what a school collected.** A
 *      refund is not `completed`; it is its own row, so a list filtered to
 *      `completed` and added up reports the gross taken, never the net retained.
 *      That is not a rounding nuisance — it is the exact number a school disputes
 *      when they say the bursar kept a refund. So the net figure is shown beside
 *      the gross one, and the reversal count is stated rather than inferred.
 *   2. **The negative row has to be unmistakable.** `TransactionTable` already
 *      handles this for the school console with a `−` prefix and a red tone; the
 *      same treatment is applied here so an operator moving between the two screens
 *      reads one vocabulary. A reversal rendered as a small number in the default
 *      colour is indistinguishable from a mis-keyed amount, and that is a figure
 *      somebody will act on.
 *
 * Filters live in the query string, so a dispute under investigation is a link, and
 * every filter change clears `page` — page 7 of a newly narrowed result set is an
 * empty page, which reads as "the money is missing".
 *
 * **The export is client-side and says so.** There is no payments export endpoint:
 * `REPORT_TYPES` in `services/admin.js` has no payments member and
 * `downloadLedgerCsv` is the ledger, not the transactions. So the button writes the
 * page it is looking at, labelled "this page" in the button itself rather than in a
 * confirmation dialog nobody reads. Writing it with `triggerDownload` rather than
 * three inline lines is deliberate — that helper revokes the object URL (an inline
 * copy that forgets leaks a handle per export), appends the anchor before clicking
 * (Firefox ignores a detached click) and removes it afterwards. See the gap list in
 * the build report: this wants a server-side `/admin/payments/export`.
 */
const PROVIDER_LABELS = {
  hubtel: 'Hubtel',
  arke: 'Arke',
  mnotify: 'MNotify',
  manual: 'Recorded by hand',
  mtn: 'MTN direct',
};

const NETWORK_LABELS = {
  MTN: 'MTN MoMo',
  VODAFONE: 'Vodafone Cash',
  AIRTELTELIGO: 'AT Money',
  UNKNOWN: 'Unidentified',
};

/**
 * Whether a row is a reversal, decided on the sign alone.
 *
 * Not on the status: `refunded` on the *original* means somebody fully reversed it,
 * while the reversal row itself carries whatever status the refund write gave it.
 * The amount's sign is the only field that is true of the row as a row, and it is
 * the one the ledger reads.
 */
const isReversal = (payment) => Number(payment.amount) < 0;

/**
 * Disbursement state, as far as a payment row can report it.
 *
 * `Payment.disbursementBatchId` is the stamp written when a payout batch claims
 * this payment (`paymentModel.js:53`). The batch's own status is not on the row, so
 * the column says "in a batch" rather than inventing a batch state — the finance
 * screen is where a batch's status is read, and a column here that guessed would
 * disagree with it.
 */
const DISBURSEMENT_LABELS = {
  claimed: { tone: 'blue', label: 'In a batch' },
  unclaimed: { tone: 'slate', label: 'Not paid out' },
};

const PaymentsList = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [reloadKey, setReloadKey] = useState(0);
  const [exporting, setExporting] = useState(false);

  const filters = useMemo(
    () => ({
      schoolId: searchParams.get('schoolId') || '',
      status: searchParams.get('status') || '',
      network: searchParams.get('network') || '',
      gateway: searchParams.get('gateway') || '',
      from: searchParams.get('from') || '',
      to: searchParams.get('to') || '',
      page: Number(searchParams.get('page')) || 1,
      perPage: Number(searchParams.get('perPage')) || 20,
    }),
    [searchParams]
  );

  const [state, setState] = useState({ rows: [], meta: null, totals: null, loading: true, error: null });

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: null }));
    listAllPayments(filters)
      .then((result) =>
        active &&
        setState({
          rows: result.rows,
          meta: result.meta,
          totals: result.totals,
          loading: false,
          error: null,
        })
      )
      .catch((error) =>
        active && setState({ rows: [], meta: null, totals: null, loading: false, error })
      );
    return () => {
      active = false;
    };
  }, [filters, reloadKey]);

  /** Any filter change resets to page 1 — page 7 of a new filter set is empty. */
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

  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

  const openDetail = useCallback(
    // From `ROUTES.ADMIN_PAYMENTS`, the single source. `ADMIN_ROUTES.PAYMENT_DETAIL`
    // is a route pattern (`/admin/payments/:paymentId`), not a URL — concatenating
    // it would link to a literal `:paymentId`.
    (payment) => navigate(`${ROUTES.ADMIN_PAYMENTS}/${payment._id || payment.paymentId}`),
    [navigate]
  );

  /**
   * The page's own rows, split into collections and reversals.
   *
   * A page-scoped sum and the page-scoped reversal count, both used **only** to
   * describe the page. `totals` says nothing about refunds — the endpoint's `totals`
   * is `{ amount, count }` with no reversal field — and inventing one from the
   * loaded rows would be the sum-of-the-page error in a different costume. So the
   * reversal tile is labelled "on this page" and the gross/net tiles come from the
   * server, covering the whole matched set.
   */
  const pageReversals = useMemo(() => state.rows.filter(isReversal), [state.rows]);
  const pageCollections = useMemo(() => state.rows.filter((row) => !isReversal(row)), [state.rows]);

  const gross = Number(state.totals?.amount) || 0;
  const matchedCount = Number(state.totals?.count) || 0;
  const hasReversalSign = gross < 0 || pageReversals.length > 0;

  const onExport = useCallback(async () => {
    setExporting(true);
    try {
      if (state.rows.length === 0) {
        toast.error('There is nothing on this page to export.');
        return;
      }

      // Amounts go out as pesewas integers and are labelled as such in the header.
      // A CSV whose money column is divided by 100 for the reader's convenience is a
      // CSV that gets loaded into a spreadsheet as cedi and re-imported as pesewas,
      // and the mistake is invisible in the file itself.
      const header = [
        'payment_id',
        'receipt_number',
        'school',
        'student',
        'student_class',
        'amount_pesewas',
        'status',
        'provider',
        'network',
        'payment_method',
        'disbursement_batch_id',
        'date_accra',
        'is_reversal',
      ];

      const escape = (value) => {
        const text = value === null || value === undefined ? '' : String(value);
        return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
      };

      const lines = state.rows.map((payment) => {
        const student = payment.studentId || {};
        return [
          payment.paymentId,
          payment.receiptNumber,
          payment.schoolId?.name,
          student.studentName,
          student.studentClass,
          // Signed. The sign *is* the reversal, so the export must not flatten it.
          Number(payment.amount) || 0,
          payment.status,
          payment.provider,
          payment.momoNetwork,
          payment.paymentMethod,
          payment.disbursementBatchId,
          formatDateTime(paymentTimestamp(payment)),
          isReversal(payment) ? 'yes' : 'no',
        ]
          .map(escape)
          .join(',');
      });

      const csv = [header.join(','), ...lines].join('\r\n');
      const stamp = new Date().toISOString().slice(0, 10);
      triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `platform-payments-page-${state.meta?.page || 1}-${stamp}.csv`);

      toast.success(
        `Exported the ${formatCount(state.rows.length)} payment${
          state.rows.length === 1 ? '' : 's'
        } on this page. Refunds are included as negative amounts.`
      );
    } catch (error) {
      // `toApiError` for the message shape, though the work here is client-side: it
      // is the same normaliser every service uses, and an export that failed should
      // say why in the same words as a request that failed.
      const wrapped = toApiError(error, 'The export could not be produced.');
      toast.error(wrapped.message);
    } finally {
      setExporting(false);
    }
  }, [state.rows, state.meta, toast]);

  const hasFilters = Boolean(
    filters.schoolId || filters.status || filters.network || filters.gateway || filters.from || filters.to
  );

  return (
    <>
      <PageHeader
        eyebrow="Platform console"
        title="Payments"
        description="Every payment taken on SukuuPay, across every school, with refunds shown as the reversals they are."
        actions={
          <button
            type="button"
            onClick={onExport}
            disabled={exporting || state.rows.length === 0}
            aria-label="Export the payments on this page as a CSV file"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            {exporting ? 'Exporting…' : 'Export this page (CSV)'}
          </button>
        }
      />

      {/*
        The KPI band, in `PaymentKpiRow`'s shape: four tiles, one accent, figures
        from the response. It is written here rather than reused because that
        component's four tiles are the *school console's* four aggregates
        (`totalInflow`, a leading network, the other networks, awaiting
        confirmation) and none of those exist on `/admin/payments`. Feeding it a
        different payload would render four confidently wrong tiles.
      */}
      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          label="Matched value"
          icon={Receipt}
          value={<CediValue pesewas={gross} />}
          accent
          footer={
            <p className="text-[11px] font-semibold text-slate-500">
              {formatCount(matchedCount)} payment{matchedCount === 1 ? '' : 's'} match these filters,
              summed server-side over every row they match — not just this page.
            </p>
          }
        />

        <Tile
          label="Collections on this page"
          icon={Receipt}
          value={formatCount(pageCollections.length)}
          badge={
            hasReversalSign ? (
              <Badge tone="amber" icon={TriangleAlert}>
                Reversals below
              </Badge>
            ) : null
          }
          footer={
            <p className="text-[11px] font-semibold text-slate-500">
              {formatCount(pageCollections.length)} of {formatCount(state.rows.length)} rows on this
              page took money in.
            </p>
          }
        />

        {/*
          The reversal tile. Page-scoped and labelled as such, because `totals` has no
          reversal field and a platform-wide figure cannot be derived from 20 rows
          without being wrong in exactly the way that matters. What it *does* give an
          operator is the thing this screen exists to answer: is there a refund in
          front of me, and which row is it.
        */}
        <Tile
          label="Reversals on this page"
          icon={TriangleAlert}
          value={
            <span className={pageReversals.length ? 'text-red-600' : 'text-emerald-600'}>
              {formatCount(pageReversals.length)}
            </span>
          }
          badge={
            <Badge tone={pageReversals.length ? 'red' : 'green'}>
              {pageReversals.length ? 'Money returned' : 'None in view'}
            </Badge>
          }
          footer={
            <p className="text-[11px] font-semibold text-slate-500">
              Each one is a separate negative row. The original payment is unchanged.
            </p>
          }
        />

        <Tile
          label="Disbursement"
          icon={Receipt}
          value={
            <span className="text-ink">
              {formatCount(state.rows.filter((row) => row.disbursementBatchId).length)}
            </span>
          }
          footer={
            <p className="text-[11px] font-semibold text-slate-500">
              Rows on this page already claimed by a payout batch. Open one for its batch and status.
            </p>
          }
        />
      </div>

      {/*
        The reconciliation warning, stated once and only when it is true. It is the
        single most common way this screen gets misread: filter to `completed`, add
        the column up, report it as what a school collected — and it is the gross,
        because every refund lives on its own non-`completed` row.
      */}
      {hasReversalSign && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
          <p className="text-[12px] font-semibold leading-relaxed text-amber-800">
            A refund is written as its own payment with a negative amount, so filtering to
            &ldquo;completed&rdquo; and adding the column up gives the gross collected, never the net
            retained. To settle a dispute, compare the school&rsquo;s collected total against the sum
            of both signs.
          </p>
        </div>
      )}

      <Card padding="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <SchoolFilterPicker
            label="School"
            value={filters.schoolId}
            onChange={(schoolId) => setFilter('schoolId', schoolId)}
            className="xl:col-span-2"
          />

          <SelectField
            label="Status"
            value={filters.status}
            onChange={(event) => setFilter('status', event.target.value)}
          >
            <option value="">All statuses</option>
            {PAYMENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Network"
            value={filters.network}
            onChange={(event) => setFilter('network', event.target.value)}
          >
            <option value="">All networks</option>
            {PAYMENT_NETWORKS.map((network) => (
              <option key={network} value={network}>
                {NETWORK_LABELS[network] || network}
              </option>
            ))}
          </SelectField>

          {/*
            `gateway`, not `provider`, in the URL — that is the parameter
            `listAllPayments` sends, and the column below is labelled "provider"
            because that is what `Payment.provider` is called on the model. The two
            names for one thing are the API's, not this page's.
          */}
          <SelectField
            label="Gateway"
            value={filters.gateway}
            onChange={(event) => setFilter('gateway', event.target.value)}
          >
            <option value="">All gateways</option>
            {PAYMENT_PROVIDERS.map((provider) => (
              <option key={provider} value={provider}>
                {PROVIDER_LABELS[provider] || provider}
              </option>
            ))}
          </SelectField>

          <Field
            label="From"
            type="date"
            value={filters.from}
            onChange={(event) => setFilter('from', event.target.value)}
          />
          <Field
            label="To"
            type="date"
            value={filters.to}
            onChange={(event) => setFilter('to', event.target.value)}
          />
        </div>

        <p className="mt-3 text-[11px] font-semibold text-slate-400">
          Scope: every school on the platform. Dates are matched inclusively and read as Accra
          dates — Ghana observes no daylight saving, so a window is exact rather than approximate.
        </p>
      </Card>

      <div className="mt-4">
        {state.error ? (
          <EmptyState
            icon={Receipt}
            title="The payments list could not be loaded"
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
        ) : state.loading && state.rows.length === 0 ? (
          <div className="space-y-2">
            {[0, 1, 2, 3, 4].map((row) => (
              <div key={row} className="h-[4.5rem] animate-pulse rounded-2xl bg-slate-200/70" />
            ))}
          </div>
        ) : state.rows.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title={hasFilters ? 'No payments match these filters' : 'No payments on the platform yet'}
            description={
              hasFilters
                ? 'Try widening the dates or clearing a filter. A filter that matches nothing usually means nobody has collected that way yet, not that the data is missing.'
                : 'Payments appear here as parents pay by Mobile Money, and as schools record cash, card or bank transfers.'
            }
          />
        ) : (
          <>
            <Card padding="p-0" className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[70rem] border-collapse text-left">
                  <caption className="sr-only">
                    Payments taken on the platform
                    {state.meta?.total ? `, ${formatCount(state.meta.total)} matching` : ''}
                  </caption>
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/60">
                      {[
                        { label: 'Receipt / payment' },
                        { label: 'School' },
                        { label: 'Student' },
                        { label: 'Amount', right: true },
                        { label: 'Status' },
                        { label: 'Provider' },
                        { label: 'Network' },
                        { label: 'Date' },
                        { label: 'Disbursement' },
                      ].map((column) => (
                        <th
                          key={column.label}
                          scope="col"
                          className={`whitespace-nowrap px-4 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400 ${
                            column.right ? 'text-right' : ''
                          }`}
                        >
                          {column.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {state.rows.map((payment) => {
                      const student = payment.studentId || {};
                      const reversal = isReversal(payment);
                      const claimed = Boolean(payment.disbursementBatchId);
                      const disb = claimed ? DISBURSEMENT_LABELS.claimed : DISBURSEMENT_LABELS.unclaimed;

                      return (
                        <tr
                          key={payment._id || payment.paymentId}
                          onClick={() => openDetail(payment)}
                          className="cursor-pointer border-b border-slate-50 last:border-0 hover:bg-slate-50/60"
                        >
                          {/*
                            A `<tr>` with a click handler is not keyboard reachable, so
                            the reference is also a real button. It duplicates the handler
                            rather than wrapping the row, which would put interactive
                            content inside a clickable row and make Enter fire twice —
                            the same fix `AdminSchools.jsx` documents.
                          */}
                          <td className="px-4 py-3.5">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                openDetail(payment);
                              }}
                              className="block text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
                            >
                              <span className="block whitespace-nowrap font-mono text-[12px] font-extrabold text-ink underline-offset-2 hover:text-brand-700 hover:underline">
                                {payment.paymentId}
                              </span>
                              <span className="block whitespace-nowrap font-mono text-[11px] font-bold text-slate-400">
                                {payment.receiptNumber || 'No receipt number'}
                              </span>
                            </button>
                          </td>

                          <td className="px-4 py-3.5 text-[13px] font-semibold text-slate-600">
                            {payment.schoolId?.name || '—'}
                          </td>

                          <td className="px-4 py-3.5">
                            <span className="block text-[13px] font-bold text-ink">
                              {student.studentName || '—'}
                            </span>
                            {student.studentClass && (
                              <span className="block text-[11px] font-semibold text-slate-400">
                                {student.studentClass}
                              </span>
                            )}
                          </td>

                          {/*
                            The reversal. `−` (U+2212 MINUS SIGN, not a hyphen, so it
                            lines up with the digits) and red, matching
                            `TransactionTable`. `formatCediShort` drops the pesewas,
                            which is right for a column that is compared across rows and
                            wrong for a reconciliation — the exact figure is on the
                            detail screen, and the column header says what it is.

                            A negative here is never a negative *collected* amount: it is
                            a separate row that returned money.
                          */}
                          <td
                            className={`whitespace-nowrap px-4 py-3.5 text-right text-[13px] font-extrabold tabular-nums ${
                              reversal ? 'text-red-600' : 'text-ink'
                            }`}
                          >
                            {reversal
                              ? `−${formatCediShort(Math.abs(Number(payment.amount) || 0))}`
                              : formatCediShort(payment.amount)}
                          </td>

                          <td className="whitespace-nowrap px-4 py-3.5">
                            <PaymentStatusBadge status={payment.status} />
                          </td>

                          <td className="whitespace-nowrap px-4 py-3.5 text-[12px] font-semibold text-slate-600">
                            {PROVIDER_LABELS[payment.provider] || payment.provider || '—'}
                          </td>

                          <td className="whitespace-nowrap px-4 py-3.5">
                            <PaymentChannelBadge
                              network={payment.momoNetwork}
                              paymentMethod={payment.paymentMethod}
                            />
                          </td>

                          <td className="whitespace-nowrap px-4 py-3.5 text-[12px] font-semibold text-slate-600">
                            {formatDateTime(paymentTimestamp(payment))}
                          </td>

                          <td className="whitespace-nowrap px-4 py-3.5">
                            <Badge tone={disb.tone}>{disb.label}</Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>

            <div className="mt-4">
              {/*
                `onPerPageChange` is not optional in practice: `Pagination` wires its
                rows-per-page select unconditionally, so omitting the handler makes
                changing the page size throw on a server that did answer.
              */}
              <Pagination
                meta={state.meta}
                itemLabel="payments"
                onPageChange={(page) => setFilter('page', String(page))}
                onPerPageChange={(perPage) => {
                  setFilter('perPage', String(perPage));
                  setFilter('page', '1');
                }}
              />
            </div>
          </>
        )}
      </div>
    </>
  );
};

export { isReversal };
export default PaymentsList;