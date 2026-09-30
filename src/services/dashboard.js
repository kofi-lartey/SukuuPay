import api from './api';
import { toApiError } from './toApiError';

/**
 * Dashboard data access.
 *
 * Every card on the Overview maps to one of the endpoints below. The mapping is
 * written out here, including the three regions that have **no** backing
 * endpoint yet, so whoever wires the Overview for real knows exactly which parts
 * are ready and which need server work first. Those three are called out on the
 * page itself too — a card silently rendering fixtures is the failure mode this
 * module exists to prevent.
 *
 * Nothing in this file is used by the Overview yet: `useDashboardOverview`
 * currently serves `data/dashboardDemo.js` and labels every card as demo. This
 * file is the seam it will switch to.
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
 * NOTE: `GET /admin/sms-balance` is the only balance route and it sits behind
 * `authorize('super_admin')` — it reports the *platform's* master credit, not a
 * school's, so it is doubly wrong for this pill. A school-scoped balance
 * (`GET /sms/balance/:schoolId` or a field on the School model) has to exist
 * before the pill can show a real number. `services/sms.js` already documents a
 * school admin being refused this for the same reason.
 */
export const getSmsCredit = async (schoolId) => {
  throw new Error('A school-scoped SMS balance endpoint does not exist yet.');
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
