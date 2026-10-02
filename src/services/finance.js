import api from './api';
import { toApiError } from './toApiError';

/**
 * Platform money — `/api/admin/finance/*`.
 *
 * Separate from `admin.js` for the same reason `impersonation.js` is separate from
 * it: this is a subject with its own vocabulary (gross, platform amount, net,
 * settled, batch status) and a reader in the middle of a payout needs all of it in
 * one place. Spreading finance calls across the general admin module would put a
 * payout screen's dependencies on either side of it in two unrelated files.
 *
 * **Every amount here is integer pesewas** (1 GHS = 100 pesewas), like every other
 * money figure on this router. `grossAmount`, `netAmount`, `platformAmount` and the
 * ledger's `amount` are all integers, and `utils/format.js` is the only place that
 * turns one into cedi. A component that divides by 100 itself is a component that
 * is wrong by 100 on every school invoice.
 *
 * **Response envelopes are normalised here and nowhere else.** Finance is the
 * third pagination shape in the product; `toPageMeta` below is the shared
 * `{ page, perPage, total, pages }` → `{ page, perPage, total, totalPages }`
 * conversion the shared `Pagination` component expects, so no finance page has to
 * know whether its endpoint called the page size `perPage`, `limit` or `size`.
 */

/**
 * `{ page, perPage, total, pages }` → the `Pagination` component's shape.
 *
 * `totalPages` is computed rather than read because the two upstream keys are
 * `pages` (finance) and never present at all, and a pager rendering "page 1 of
 * undefined" is the failure this hides. Floored at 1 so an empty result reads as
 * "1 page" rather than "page 1 of 0".
 */
const toPageMeta = (page, perPage, total, pages) => {
  const size = Number(perPage) || 20;
  const count = Number(total) || 0;
  return {
    page: Number(page) || 1,
    perPage: size,
    total: count,
    totalPages: Number(pages) || Math.max(1, Math.ceil(count / size)),
  };
};

/** Every ledger `type`. Mirrors the enum on `PlatformLedger.type`. */
export const LEDGER_TYPES = [
  'markup',
  'platform_fee',
  'subscription',
  'sms',
  'gateway_fee',
  'refund',
  'payout',
  'adjustment',
];

/** Disbursement lifecycle. Mirrors the enum on `DisbursementBatch.status`. */
export const DISBURSEMENT_STATUSES = [
  'draft',
  'pending_approval',
  'approved',
  'processing',
  'paid',
  'failed',
  'cancelled',
];

/** Only these can be approved. Mirrors `OPEN_DISBURSEMENT_STATUSES`. */
export const APPROVABLE_DISBURSEMENT_STATUSES = ['pending_approval'];

/**
 * `GET /admin/finance/overview` — the whole money picture in one payload.
 *
 * Returns `cashHeld`, `pendingDisbursements`, `disbursedThisMonth`,
 * `platformRevenueThisMonth`, `bySchool` (the payout worklist) and
 * `reconciliationToday`.
 *
 * **The four headline figures are not the same number and must not be collapsed.**
 * `cashHeld` is money taken from parents and not yet out; `platformRevenue` is what
 * SukuuPay has earned; `pendingDisbursements` is owed to schools; `disbursedThisMonth`
 * has moved. Rendering them as one "collected" figure is the specific mistake this
 * endpoint's shape exists to prevent, so each is a separate named field rather than
 * a `total`.
 */
export const getFinanceOverview = async () => {
  try {
    const { data } = await api.get('/admin/finance/overview');
    return data.data || {};
  } catch (error) {
    throw toApiError(error, 'The finance overview could not be loaded.');
  }
};

/**
 * `GET /admin/finance/ledger` — the platform's income, entry by entry.
 *
 * Returns `{ rows, meta, totals }`. `totals` is the sum over the **matched** set,
 * not the whole collection — so the figure under the table describes the filter
 * above it. That is the whole reason it travels with the page rather than being a
 * second request: two requests can straddle a payment and disagree, and then the
 * total does not match the rows it is a total of.
 *
 * `amount` is signed: positive credits the platform, negative debits it. A refund
 * row is negative and must not be filtered out of a "what did we earn" view by
 * virtue of being a refund — it is a reversal of something that was counted.
 */
export const listLedgerEntries = async ({
  page = 1,
  perPage = 20,
  schoolId = '',
  type = '',
  settled = '',
  from = '',
  to = '',
} = {}) => {
  try {
    const { data } = await api.get('/admin/finance/ledger', {
      params: {
        page,
        perPage,
        schoolId: schoolId || undefined,
        type: type || undefined,
        // Tri-state: `''` means "no filter", `'true'`/`'false'` mean settled or not.
        // Sent as a string because there is no way to express "either" with a
        // boolean, and defaulting it to `false` would silently hide every settled
        // entry — which is the majority.
        settled: settled === '' || settled === undefined ? undefined : settled,
        from: from || undefined,
        to: to || undefined,
      },
    });

    /*
     * `totals` lives in **`meta`**, not in `data`.
     *
     * The service returns it at both levels and the controller forwards only
     * `result.meta`, so the wire shape is `{ data: [...], meta: { page, perPage,
     * total, pages, totals } }`. Reading `data.totals` returns `undefined` on an
     * array — which is not a crash, so the failure was a screen printing GH₵ 0.00
     * above a populated table.
     */
    return {
      rows: Array.isArray(data?.data) ? data.data : [],
      totals: data?.meta?.totals || { netAmount: 0, creditAmount: 0, debitAmount: 0, entryCount: 0 },
      meta: toPageMeta(data?.meta?.page, data?.meta?.perPage, data?.meta?.total, data?.meta?.pages),
    };
  } catch (error) {
    throw toApiError(error, 'The platform ledger could not be loaded.');
  }
};

/**
 * `GET /admin/finance/ledger/export` — CSV download.
 *
 * A browser download, so this is a raw `fetch` with `Authorization` rather than the
 * axios instance: axios would try to JSON-parse a CSV and throw on success. The
 * 401 path is handled explicitly because an expired token mid-download would
 * otherwise produce a file containing the text "Authentication required" and a
 * perfectly plausible-looking CSV header.
 *
 * Capped server-side at `LIMITS.AUDIT_LOG_CSV_CAP`; the response header
 * `x-export-truncated` says when the cap was hit, and the caller should say so too.
 */
export const downloadLedgerCsv = async ({ from = '', to = '', schoolId = '' } = {}) => {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  if (schoolId) params.set('schoolId', schoolId);

  const token = localStorage.getItem('auth_token');
  const base = api.defaults.baseURL;

  const response = await fetch(`${base}/admin/finance/ledger/export?${params}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    throw new Error(
      response.status === 401
        ? 'Your session expired. Sign in again to export the ledger.'
        : 'The ledger export could not be produced.'
    );
  }

  const truncated = response.headers.get('x-export-truncated') === 'true';
  const blob = await response.blob();
  triggerDownload(blob, `platform-ledger-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv');

  return { truncated };
};

/**
 * `GET /admin/finance/disbursements` — the payout queue.
 *
 * Defaults to the open statuses rather than to everything, because the screen this
 * backs is a worklist: "what money is waiting to go out". The owner's first question
 * is never "show me last year's settled payouts" — that is the archive, one filter
 * away.
 */
export const listDisbursements = async ({
  page = 1,
  perPage = 20,
  status = '',
  schoolId = '',
  from = '',
  to = '',
} = {}) => {
  try {
    const { data } = await api.get('/admin/finance/disbursements', {
      params: {
        page,
        perPage,
        status: status || undefined,
        schoolId: schoolId || undefined,
        from: from || undefined,
        to: to || undefined,
      },
    });
    return {
      rows: Array.isArray(data?.data) ? data.data : [],
      meta: toPageMeta(data?.meta?.page, data?.meta?.perPage, data?.meta?.total, data?.meta?.pages),
    };
  } catch (error) {
    throw toApiError(error, 'Disbursements could not be loaded.');
  }
};

/**
 * `GET /admin/finance/disbursements/:batchId` — one payout in full.
 *
 * Returns the batch, its `paymentIds` with the payments resolved, the split
 * `breakdown`, and the `PlatformLedger` entries it produced. The breakdown is
 * stored on the batch rather than recomputed, so it still shows the markup rate
 * that applied *when it was approved* — which is the only version that explains the
 * figure.
 */
export const getDisbursement = async (batchId) => {
  if (!batchId) throw new Error('A batch id is required.');
  try {
    const { data } = await api.get(`/admin/finance/disbursements/${batchId}`);
    return data.data || {};
  } catch (error) {
    throw toApiError(error, 'That disbursement could not be loaded.');
  }
};

/**
 * `POST /admin/finance/disbursements/create` — build a batch for a window.
 *
 * **POST to the collection, not to `/create`.** There is no `/create` sub-path:
 * building a batch is a `POST` to `/admin/finance/disbursements`, which is also
 * where `GET` lists them. The brief this was written from assumed `/create`; the
 * backend says otherwise, and a client calling the assumed path gets a 404 that
 * reads like the whole feature is missing.
 *
 * Refuses with a 409 when the school has no completed payments in the window, and
 * refuses when a batch already exists for the same window (the server's unique index
 * on `{schoolId, periodStart, periodEnd}` is the backstop). "Approve All" is not a
 * shortcut past either: a batch that does not exist cannot be approved, and one
 * that exists twice would pay the school twice.
 */
export const createDisbursement = async ({ schoolId, periodStart, periodEnd }) => {
  try {
    const { data } = await api.post('/admin/finance/disbursements', {
      schoolId,
      periodStart,
      periodEnd,
    });
    return data.data || {};
  } catch (error) {
    throw toApiError(error, 'That disbursement batch could not be created.');
  }
};

/**
 * `POST /admin/finance/disbursements/:batchId/approve` — release the money.
 *
 * **The one call in the console that moves a school's money without asking the
 * school.** It is `POST` and not `PUT` because it is an action on a resource, not
 * an edit of its fields, and because a `PUT` that is not idempotent is a lie about
 * what retries do.
 *
 * The server refuses a second approval of the same batch (409), so a double-click
 * cannot pay twice — but `disabled` on the button is still the honest first line,
 * because the refusal arrives after the operator has already been told something
 * went wrong.
 *
 * **Returns `payoutProviderWired`, and the caller must not ignore it.** No payout
 * provider is wired on this deployment, so approval parks the batch at `approved`
 * with `payoutReference: null` and the ledger unsettled; `paid` is never fabricated,
 * because that pair is the proof-of-payment every downstream reconciliation reads.
 * A screen that rendered a bare "approved" would tell the operator a transfer had
 * happened. The flag is passed up precisely so it can say it did not.
 */
export const approveDisbursement = async (batchId) => {
  if (!batchId) throw new Error('A batch id is required.');
  try {
    const { data } = await api.post(`/admin/finance/disbursements/${batchId}/approve`);
    return {
      // `data.meta` is the envelope's meta block; the batch itself is the payload.
      batch: data?.data || null,
      message: data?.message || '',
      payoutProviderWired: data?.meta?.payoutProviderWired !== false,
    };
  } catch (error) {
    throw toApiError(error, 'That disbursement could not be approved.');
  }
};

/**
 * `POST /admin/finance/disbursements/:batchId/retry` — try a failed payout again.
 *
 * Re-uses the same batch rather than creating another one for the same payments,
 * because two batches over one window would pay the school twice. Only valid from
 * `failed`; the server refuses every other state with a 409 that names the current
 * one.
 */
export const retryDisbursement = async (batchId) => {
  if (!batchId) throw new Error('A batch id is required.');
  try {
    const { data } = await api.post(`/admin/finance/disbursements/${batchId}/retry`);
    return data.data || {};
  } catch (error) {
    throw toApiError(error, 'That disbursement could not be retried.');
  }
};

/**
 * `GET /admin/finance/reconciliation` — a day's payments against the ledger.
 *
 * Defaults to today. `matched` counts payments carrying a provider transaction
 * reference; `unmatched` counts those without. An unmatched payment is a signal,
 * not a failure — a `manual` provider legitimately has no reference — so the
 * response names the provider breakdown rather than presenting one number.
 */
export const getReconciliation = async ({ date = '' } = {}) => {
  try {
    const { data } = await api.get('/admin/finance/reconciliation', {
      params: { date: date || undefined },
    });
    return data.data || {};
  } catch (error) {
    throw toApiError(error, 'Reconciliation could not be loaded.');
  }
};

/**
 * `GET /admin/finance/invoices` — monthly platform fees for Mode B schools.
 *
 * **Computed, not stored.** There is no invoice collection in this codebase: a row
 * is derived on read from the `PlatformLedger` entries of that school for that
 * month. Two consequences the UI must respect and must not paper over:
 *
 *   - there is no invoice number, so a row is not a durable artefact and cannot be
 *     quoted in a dispute — which is why the status column says `due`/`paid` and
 *     nothing more specific;
 *   - a month with no ledger entries yields no row at all, not a zero row. A school
 *     with no charges is absent from the list, not listed as owing nothing.
 *
 * **`month` is required** (`YYYY-MM`) and defaults to the current month here rather
 * than to "all time", because a derived-on-read invoice for an unbounded range is
 * either an unbounded scan or a silently truncated one. The console pairs this with
 * a month picker; the default is what that picker starts on.
 */
export const listInvoices = async ({
  page = 1,
  perPage = 20,
  schoolId = '',
  status = '',
  month = '',
} = {}) => {
  // `new Date()` in Accra, formatted as the server's `YYYY-MM` expects. Built from
  // the local parts rather than `toISOString()`, which is UTC and would be the
  // previous month for any request made on the 1st before 08:00 GMT.
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  try {
    const { data } = await api.get('/admin/finance/invoices', {
      params: {
        page,
        perPage,
        month: month || currentMonth,
        schoolId: schoolId || undefined,
        status: status || undefined,
      },
    });
    return {
      rows: Array.isArray(data?.data) ? data.data : [],
      totals: data?.meta?.totals || {
        subscriptionFee: 0,
        platformFee: 0,
        total: 0,
        paid: 0,
        due: 0,
      },
      // Echoed back so the screen can label itself "Invoices for March 2026" rather
      // than leaving the operator wondering which month they are looking at.
      month: data?.meta?.month || month || currentMonth,
      meta: toPageMeta(data?.meta?.page, data?.meta?.perPage, data?.meta?.total, data?.meta?.pages),
    };
  } catch (error) {
    throw toApiError(error, 'Invoices could not be loaded.');
  }
};

/**
 * Save a blob to disk under a filename.
 *
 * Shared by every download here because the three lines it replaces are easy to get
 * subtly wrong: the object URL is revoked (or the tab leaks a handle per export),
 * the anchor is appended before clicking (Firefox ignores a detached click), and
 * the anchor is removed afterwards (it does not navigate the page).
 */
export const triggerDownload = (blob, filename, type = 'application/octet-stream') => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
  void type;
};

export default {
  LEDGER_TYPES,
  DISBURSEMENT_STATUSES,
  APPROVABLE_DISBURSEMENT_STATUSES,
  getFinanceOverview,
  listLedgerEntries,
  downloadLedgerCsv,
  listDisbursements,
  getDisbursement,
  createDisbursement,
  approveDisbursement,
  retryDisbursement,
  getReconciliation,
  listInvoices,
  triggerDownload,
};