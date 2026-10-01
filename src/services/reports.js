import api from './api';
import { toApiError } from './toApiError';

/**
 * The nine reports, and the catalogue that drives the Reports grid.
 *
 * Every report is one `GET /reports/<name>/:schoolId` returning JSON. Adding
 * `?format=csv` or `?format=excel` to the same call returns a file instead — see
 * `downloadReport`. `?format=pdf` returns a deliberate 501 and is therefore not
 * offered anywhere in this module.
 *
 * ── Why this catalogue is not just nine endpoint names ──
 *
 * Each entry carries what the card needs and what the *response* is honest about,
 * because four of these nine endpoints contain traps that a generic
 * "fetch and render rows" implementation gets wrong:
 *
 * `daily` — its `summary` and `byMethod` are computed from the **current page**,
 *   not the whole result. `meta.total` is the only full count. A card reading
 *   "42 transactions" above a page of 50 is a page count wearing a total's label.
 *
 * `outstanding` — `oldestDueDate` and `daysOutstanding` are `null` on **every
 *   row** unless the request sends a truthy `minAgeDays`. And `0` is falsy, so
 *   `minAgeDays: 0` does not enable them either. The catalogue sends `1` when
 *   ageing is wanted.
 *
 * `class-collections` — `rows[].collected` silently changes meaning: without
 *   date params it is lifetime `student.totalPaid`, with them it is payments
 *   inside the window. Same field, two measures, so the column header has to
 *   change too. `windowSensitive: true` is the flag that drives that.
 *
 * `compliance`, `payment-methods`, `overdue`, `headmaster-monthly` all accept
 *   `academicYear` and/or `term` and then **ignore them** — they are echoed into
 *   `period` and filter nothing. `silentParams` records that so the filter bar
 *   does not offer a control that silently does nothing.
 */
export const REPORTS = [
  {
    key: 'daily',
    name: 'Daily Collection Summary',
    category: 'collections',
    endpoint: 'daily',
    cadence: 'Daily Automatic',
    cadenceTime: '11:59 PM',
    blurb: 'Consolidated breakdown of all mobile money collections, transactions and direct settlement credits received.',
    formats: ['csv', 'excel'],
    // Page-scoped summary. See the note above.
    summaryIsPageScoped: true,
    supports: ['date', 'class', 'paymentMethod', 'status'],
  },
  {
    key: 'term',
    name: 'Term Collection & Revenue Report',
    category: 'collections',
    endpoint: 'term',
    cadence: 'Fiscal Trimester',
    blurb: 'Macro performance for Term 1, 2 and 3 billing cycles against school revenue targets and budget allocations.',
    formats: ['csv', 'excel'],
    supports: ['academicYear', 'term', 'class'],
  },
  {
    key: 'outstanding',
    name: 'Outstanding Balances & Arrears Ledger',
    category: 'arrears',
    endpoint: 'outstanding',
    blurb: 'Itemized debtor aging list by student, class and guardian phone with automated SMS batch recovery.',
    formats: ['csv', 'excel'],
    // Ageing columns only populate with a truthy minAgeDays.
    ageingNeedsMinAgeDays: true,
    supports: ['academicYear', 'class', 'minAmount', 'minAgeDays', 'status', 'sortBy', 'sortOrder'],
  },
  {
    key: 'overdue',
    name: 'Overdue Installments',
    category: 'arrears',
    endpoint: 'overdue',
    blurb: 'Installment plans with at least one tranche past its due date, with days overdue and severity per tranche.',
    formats: ['csv', 'excel'],
    // Accepted and ignored by the API.
    silentParams: ['academicYear', 'term'],
    supports: ['planStatus', 'class', 'severity', 'minDaysOverdue', 'sortBy', 'sortOrder'],
  },
  {
    key: 'compliance',
    name: 'Installment Plan Compliance Report',
    category: 'arrears',
    endpoint: 'compliance',
    blurb: 'Tracks on-time tranche execution, defaults and pending acceptance across every active payment plan.',
    formats: ['csv', 'excel'],
    silentParams: ['academicYear', 'term'],
    supports: ['planStatus', 'class'],
  },
  {
    key: 'payment-methods',
    name: 'Payment Method Breakdown',
    category: 'collections',
    endpoint: 'payment-methods',
    blurb: 'Market share and fee reconciliation between MTN MoMo, Telecel and AT Money.',
    formats: ['csv', 'excel'],
    silentParams: ['academicYear'],
    supports: ['groupBy', 'startDate', 'endDate', 'class'],
  },
  {
    key: 'class-collections',
    name: 'Class-wise Collections & Invoices',
    category: 'collections',
    endpoint: 'class-collections',
    blurb: 'Class by class comparison of fee collection percentage, PTA dues, lab contributions and statutory levies.',
    formats: ['csv', 'excel'],
    silentParams: ['term'],
    // `collected` means two different things depending on the date window.
    windowSensitive: true,
    supports: ['academicYear', 'term', 'startDate', 'endDate', 'sortBy', 'sortOrder'],
  },
  {
    key: 'parent-contacts',
    name: 'Parent & Guardian Directory',
    category: 'institutional',
    endpoint: 'parent-contacts',
    blurb: 'Master export of guardian names, emergency contacts, WhatsApp handles and each student’s outstanding balance.',
    formats: ['csv', 'excel'],
    supports: ['class', 'relationship', 'onlyPrimary', 'onlyWithBalance', 'search', 'sortBy', 'sortOrder'],
  },
  {
    key: 'headmaster-monthly',
    name: 'Headteacher Monthly Summary',
    category: 'institutional',
    endpoint: 'headmaster-monthly',
    blurb: 'High-level visual executive briefing with net margin calculations and cash flow projections.',
    formats: ['csv', 'excel'],
    silentParams: ['academicYear', 'term'],
    supports: ['month', 'includeHeadcount'],
  },
];

export const REPORT_CATEGORIES = [
  { key: 'all', label: 'All Reports' },
  { key: 'collections', label: 'Collections & Revenue' },
  { key: 'arrears', label: 'Compliance & Arrears' },
  { key: 'institutional', label: 'Institutional & GES' },
];

/** The nine calls, in one place so a card never names an endpoint directly. */
export const runReport = async ({ schoolId, endpoint, params } = {}) => {
  try {
    const { data } = await api.get(`/reports/${endpoint}/${schoolId}`, { params });
    // `meta` is returned at BOTH the top level and inside `data`, identically.
    // Read one place and expose one.
    return { ...(data.data || {}), meta: data.meta || data.data?.meta || null };
  } catch (error) {
    throw toApiError(error, 'Could not generate that report.');
  }
};

/**
 * Runs a report and hands the browser the file.
 *
 * Same shape as `exportAuditLogsCsv`, and for the same reason: the file is
 * streamed by the server, so a partial or truncated export is not producible —
 * which for a figure a bursar will reconcile against a bank is the failure that
 * matters most.
 *
 * Only `csv` and `excel` are offered. `?format=pdf` returns 501 with a message
 * saying so, so a PDF button here would be a control whose only outcome is an
 * error.
 */
export const downloadReport = async ({ schoolId, endpoint, format, params } = {}) => {
  try {
    const response = await api.get(`/reports/${endpoint}/${schoolId}`, {
      params: { ...params, format },
      responseType: 'blob',
    });

    const disposition = response.headers?.['content-disposition'] || '';
    const match = /filename="?([^"]+)"?/.exec(disposition);
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const filename = match ? match[1] : `${endpoint}-${stamp}.${format === 'excel' ? 'xlsx' : 'csv'}`;

    const href = URL.createObjectURL(response.data);
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(href), 0);

    return { filename };
  } catch (error) {
    throw toApiError(error, 'Could not export that report.');
  }
};

/**
 * Filters are deliberately absent from the UI.
 *
 * Every one of these enums exists on the API and several of the reports accept
 * them — `status`, `paymentMethod`, `groupBy`, `planStatus`, `severity`,
 * `relationship` — and none is offered on a card. A card generates on the
 * school's current term with the server's own defaults, which is the right
 * default for the common case: a bursar opening "Outstanding balances" wants
 * every debtor, not a filtered subset they did not ask for.
 *
 * They are documented here rather than in a dropdown because the moment one of
 * these is offered it has to come with its label semantics, and the two traps
 * above (`silentParams`, `minAgeDays`) show that the surface needs care rather
 * than a mechanical select per key.
 */
export default { REPORTS, REPORT_CATEGORIES, runReport, downloadReport };
