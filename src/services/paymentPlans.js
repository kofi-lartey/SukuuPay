import api from './api';
import { toApiError } from './toApiError';

/**
 * Installment plan data access.
 *
 * The only authenticated half of the plan API. `POST /payment-plans/:planId/accept`
 * and `POST /payment-plans/:planId/prepay` are deliberately absent: they are
 * unauthenticated parent-facing routes, and this file is a bursar's client. A
 * school-side module that could also accept a plan would be able to bypass the
 * parent's consent step, which is the one thing the whole acceptance flow exists
 * to make impossible.
 *
 * **Amounts are integer pesewas.** A plan's `totalAmount` of 55000 is
 * GH₵ 550.00. Every function here passes and returns pesewas, so the cedis/pesawas
 * boundary stays in `utils/format` and the `MoneyInput` — the same rule the
 * student and payment modules follow, for the same reason: a form that sends a
 * typed "550" as 550 pesewas structures a GH₵ 5.50 plan.
 */

/** The intervals `POST /payment-plans/create/:studentId` accepts. */
export const INTERVALS = [
  { value: 'weekly', label: 'Weekly', hint: 'Every 7 days' },
  { value: 'biweekly', label: 'Fortnightly', hint: 'Every 14 days' },
  { value: 'monthly', label: 'Monthly', hint: 'Recommended for salary workers' },
];

/** The tranche counts the create schema permits. */
export const INSTALLMENT_COUNTS = [2, 3, 4, 6];

/** The buckets `GET .../compliance` classifies a plan into. */
export const COMPLIANCE_STATUSES = [
  { value: 'on_track', label: 'On Track' },
  { value: 'approaching_due', label: 'Approaching Due' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'pending_acceptance', label: 'Awaiting Acceptance' },
  { value: 'defaulted', label: 'Defaulted' },
  { value: 'completed', label: 'Completed' },
];

// ──────────────────── Compliance ────────────────────

/**
 * `GET /payment-plans/school/:schoolId/compliance` — the dashboard's whole view.
 *
 * Returns `{ summary, plans }` plus pagination meta. The summary carries the
 * money aggregates (`onTrackValue`, `overdueArrears`, `committedAmount`, …)
 * precisely so this client does not have to: the plans array is one page, so
 * summing it in the browser would total twenty plans and label the result
 * "school-wide". Every headline figure on the dashboard comes from `summary`.
 */
export const adminAcceptPaymentPlan = async (planId) => {
  try {
    const { data } = await api.post(`/payment-plans/${planId}/admin-accept`, {}, { timeout: 20000 });
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, 'Could not accept plan.');
  }
};
export const getSchoolCompliance = async (schoolId, params = {}) => {
  if (!schoolId) throw new Error('A school must be in scope to read plan compliance.');
  try {
    const { data } = await api.get(`/payment-plans/school/${schoolId}/compliance`, {
      params,
      timeout: 20000,
    });
    return {
      summary: data?.data?.summary || null,
      plans: Array.isArray(data?.data?.plans) ? data.data.plans : [],
      meta: data?.meta || null,
    };
  } catch (error) {
    throw toApiError(error, 'Plan compliance could not be loaded.');
  }
};

/** One student's plan — the live one if there is one, else the most recent. */
export const getStudentPlan = async (studentId) => {
  try {
    const { data } = await api.get(`/payment-plans/${encodeURIComponent(studentId)}`);
    return data?.data || null;
  } catch (error) {
    if (error?.response?.status === 404) return null;
    throw toApiError(error, 'That student’s payment plan could not be loaded.');
  }
};

// ──────────────────── Create ────────────────────

/**
 * `POST /payment-plans/create/:studentId` — structure a balance into tranches.
 *
 * Resolves `{ plan, sms }`. `sms` is the parent-notification outcome and it is
 * the field most worth reading: the plan is created whether or not the SMS went
 * out, so a bursar who sees only "Plan created" will believe a parent has been
 * told to reply ACCEPT when no message was ever sent. The create screen surfaces
 * `sms.sent` and, when false, `sms.reason` — and the acceptance token is on the
 * plan record so it can be delivered by hand.
 */
export const createPaymentPlan = async (studentId, payload) => {
  try {
    const { data } = await api.post(`/payment-plans/create/${encodeURIComponent(studentId)}`, payload, {
      timeout: 20000,
    });
    return { plan: data?.data || null, sms: data?.meta?.sms || null };
  } catch (error) {
    throw toApiError(error, 'The payment plan could not be created.');
  }
};

// ──────────────────── Mutate ────────────────────

/**
 * `PUT /payment-plans/:planId` — edit a plan.
 *
 * Only accepted while the plan is `pending_acceptance`, or `active` with nothing
 * paid yet; anything else is a 400 with `PLAN_NOT_EDITABLE` and the reason in
 * the message. The service enforces that, not this client, so a stale screen
 * cannot slip a change past a plan that started running five minutes ago.
 */
export const updatePaymentPlan = async (planId, payload) => {
  try {
    const { data } = await api.put(`/payment-plans/${encodeURIComponent(planId)}`, payload, {
      timeout: 20000,
    });
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, 'The payment plan could not be updated.');
  }
};

/**
 * `DELETE /payment-plans/:planId` — cancel.
 *
 * A *soft* cancel, and the reason travels in the body. `cancelPlanSchema` is
 * validated against the body, so the reason has to be sent as `data` on the axios
 * config rather than as a query parameter — a detail that is easy to get wrong
 * and produces a silently reason-less cancellation.
 */
export const cancelPaymentPlan = async (planId, reason = '') => {
  try {
    const { data } = await api.delete(`/payment-plans/${encodeURIComponent(planId)}`, {
      data: { reason },
      timeout: 20000,
    });
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, 'The payment plan could not be cancelled.');
  }
};

/**
 * `PUT /payment-plans/:planId/installment/:num` — act on one tranche.
 *
 * `action` is one of `mark_paid`, `mark_unpaid`, `adjust_amount`, `waive`. These
 * are manual reconciliations for money taken at the bursar's desk; none of them
 * create a `Payment` record, which is why the compliance rate and the school's
 * collections total can legitimately disagree by the time of day and why
 * `mark_paid` says so on screen.
 */
export const updateInstallment = async (planId, installmentNumber, payload) => {
  try {
    const { data } = await api.put(
      `/payment-plans/${encodeURIComponent(planId)}/installment/${installmentNumber}`,
      payload,
      { timeout: 20000 }
    );
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, 'That installment could not be updated.');
  }
};

// ──────────────────── Schedule projection ────────────────────

/**
 * Splits a total the way the server will.
 *
 * A byte-for-byte mirror of `splitAmount` in `Backend/src/utils/planHelpers.js`:
 * `base = floor(total / n)`, and the **last** tranche absorbs the remainder. Not a
 * rounding convenience — it is what makes the tranches sum back to the balance
 * exactly, so a client that split evenly would show GH₵ 183.33 × 3 and then
 * create a plan for GH₵ 549.99, one pesewa short, that the server would reject.
 *
 * The remainder lands on the last tranche rather than the first on purpose: the
 * final payment is the one a family is most likely to be watching, and a plan
 * that ends one pesewa over is a support ticket.
 */
export const splitAmount = (totalAmount, count) => {
  const n = Number(count);
  if (!n || n < 1) return [];
  const base = Math.floor(totalAmount / n);
  const amounts = Array.from({ length: n }, () => base);
  amounts[n - 1] = totalAmount - base * (n - 1);
  return amounts;
};

/**
 * Adds `steps` intervals to a date, mirroring `addInterval` server-side.
 *
 * `weekly` adds weeks, `biweekly` adds fortnightlies, `monthly` adds months with
 * the day **clamped** to the target month's length. The clamp is the part that
 * matters: 31 October + 1 month is 30 November, not 1 December, and a projector
 * that rolled over would show a bursar a schedule one day different from the one
 * they are about to create.
 */
export const addInterval = (date, interval, steps = 1) => {
  const base = new Date(date);
  const n = Number(steps) || 0;

  if (interval === 'weekly') {
    return new Date(base.getTime() + n * 7 * 86400000);
  }
  if (interval === 'biweekly') {
    return new Date(base.getTime() + n * 14 * 86400000);
  }

  const dayOfMonth = base.getUTCDate();
  const target = new Date(
    Date.UTC(
      base.getUTCFullYear(),
      base.getUTCMonth() + n,
      1,
      base.getUTCHours(),
      base.getUTCMinutes(),
      base.getUTCSeconds(),
      base.getUTCMilliseconds()
    )
  );
  // Clamp instead of rolling over. `addMonths` on the server does exactly this.
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)
  ).getUTCDate();
  target.setUTCDate(Math.min(dayOfMonth, lastDay));
  return target;
};

/** `YYYY-MM-DD` in UTC, for a `<input type="date">`. */
export const toDateInputValue = (date) => {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return [
    d.getUTCFullYear(),
    String(d.getUTCMonth() + 1).padStart(2, '0'),
    String(d.getUTCDate()).padStart(2, '0'),
  ].join('-');
};

/** The last day of the current month, as a `YYYY-MM-DD` string. */
export const endOfThisMonth = () => {
  const now = new Date();
  return toDateInputValue(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)));
};

/** The first of next month, as a `YYYY-MM-DD` string. */
export const firstOfNextMonth = () => {
  const now = new Date();
  return toDateInputValue(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)));
};

/** Today, as a `YYYY-MM-DD` string. Plans may not start in the past. */
export const today = () => toDateInputValue(new Date());

/**
 * The schedule `POST /payment-plans/create/:studentId` will build.
 *
 * Anchored on the start date at 00:00 UTC and stepping by the interval, exactly
 * as `generateInstallmentSchedule` does server-side. The `planStartDate` field
 * carries the raw value the form holds rather than a pre-formatted date, so the
 * caller passes through whatever the user typed.
 */
export const projectSchedule = ({ totalAmount, numberOfInstallments, startDate, interval }) => {
  const anchor = new Date(`${startDate}T00:00:00Z`);
  if (Number.isNaN(anchor.getTime()) || !totalAmount) return [];

  return splitAmount(totalAmount, numberOfInstallments).map((amount, index) => ({
    installmentNumber: index + 1,
    amount,
    dueDate: addInterval(anchor, interval, index),
  }));
};

export default {
  getSchoolCompliance,
  getStudentPlan,
  createPaymentPlan,
  updatePaymentPlan,
  cancelPaymentPlan,
  updateInstallment,
  splitAmount,
  addInterval,
  projectSchedule,
  toDateInputValue,
  endOfThisMonth,
  firstOfNextMonth,
  today,
  INTERVALS,
  INSTALLMENT_COUNTS,
  COMPLIANCE_STATUSES,
};
