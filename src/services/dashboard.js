import api from './api';
import { toApiError } from './toApiError';

/**
 * Dashboard data access.
 *
 * Every card on the Overview maps to one of the endpoints below. The mapping is
 * written out here, including the three regions that have **no** backing
 * endpoint yet, so whoever wires the Overview for real knows exactly which parts
 * are ready and which need server work first. Those three are called out on the
 * page itself too — a card rendering invented figures is the failure mode this
 * module exists to prevent, and it is the one that just happened.
 *
 * `useDashboardOverview` consumes `getStudentStats`-equivalent data,
 * `listRecentPayments`, `getPaymentMethods` and `getOutstanding`; the three that
 * throw are read by the cards as "not available yet" and render an empty state.
 */

/** `GET /reports/term/:schoolId` — the headline collection figures. */
export const getTermSummary = async (schoolId) => {
  try {
    const { data } = await api.get(`/reports/term/${schoolId}`);
    return data.data || data;
  } catch (error) {
    throw toApiError(error, 'The term summary could not be loaded.');
  }
};

/** `GET /reports/outstanding/:schoolId` — who still owes, driving the SMS card. */
export const getOutstanding = async (schoolId) => {
  try {
    const { data } = await api.get(`/reports/outstanding/${schoolId}`);
    return data.data || data;
  } catch (error) {
    throw toApiError(error, 'Outstanding balances could not be loaded.');
  }
};

/** `GET /reports/payment-methods/:schoolId` — the Payment Channels card. */
export const getPaymentMethods = async (schoolId) => {
  try {
    const { data } = await api.get(`/reports/payment-methods/${schoolId}`);
    return data.data || data;
  } catch (error) {
    throw toApiError(error, 'Payment channels could not be loaded.');
  }
};

/**
 * The weekly collections series.
 *
 * NOTE: there is no weekly endpoint. `GET /reports/daily/:schoolId` is the only
 * time-series route, and it takes a date range — so the workable path is to
 * fetch the term's days and bucket them into teaching weeks on the client.
 * Teaching weeks are not fixed seven-day spans, though: Ghanaian schools
 * commonly lose Saturdays to a weekly holiday and reschedule around exams, so
 * "week N" has to be derived from the school calendar in Settings, not from
 * `date % 7`. That is why this function takes the term rather than a range and
 * is still unimplemented — a naive bucket would mislabel every week on the chart.
 */
export const getWeeklyCollections = async (schoolId, term) => {
  throw new Error(
    'Weekly collections are not available yet. See the note on this function: the daily report must be bucketed against the school calendar first.'
  );
};

/**
 * The school's remaining SMS credit, for the topbar pill.
 *
 * Backed by `GET /sms/credits/:schoolId`, which is school-scoped and readable by
 * a bursar. The route this function used to wait for did not need inventing: the
 * one that already existed, `GET /admin/sms-balance`, is behind
 * `authorize('super_admin')` and reports the *platform's* master credit rather
 * than a school's — which is why the pill stayed hidden. Delegating rather than
 * re-fetching keeps the header and the SMS Reminders balance on one number; a
 * pill and a page that can disagree are worse than no pill.
 */
export const getSmsCredit = async (schoolId) => {
  if (!schoolId) throw new Error('A school must be in scope to read its SMS credit.');
  try {
    const { data } = await api.get(`/sms/credits/${schoolId}`);
    return data.data || data;
  } catch (error) {
    throw toApiError(error, 'Your SMS balance could not be loaded.');
  }
};

/**
 * Upcoming installment tranches for the next five days.
 *
 * NOTE: `GET /payment-plans/school/:schoolId/compliance` is the closest route
 * and returns schedule compliance, not a dated list of the next tranches. The
 * list itself has to come from the plans collection filtered on the next due
 * date, which needs either a query on `paymentPlan.routes.js` or an aggregate on
 * the term report.
 */
export const getUpcomingInstallments = async (schoolId) => {
  throw new Error('A dated upcoming-tranches endpoint does not exist yet.');
};

/** `GET /payments` — the Recent MoMo Transactions table. */
export const listRecentPayments = async (params = {}) => {
  try {
    const { data } = await api.get('/payments', { params, timeout: 15000 });
    return {
      // `listPaymentsController` returns `{ success, message, data, meta }` with
      // `data` a bare array — the same unwrap trap `listStudents` documents.
      rows: Array.isArray(data?.data) ? data.data : [],
      meta: data?.meta || null,
    };
  } catch (error) {
    throw toApiError(error, 'Recent payments could not be loaded.');
  }
};

export default {
  getTermSummary,
  getOutstanding,
  getPaymentMethods,
  getWeeklyCollections,
  getSmsCredit,
  getUpcomingInstallments,
  listRecentPayments,
};
