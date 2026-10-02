import api from './api';
import { toApiError } from './toApiError';

/**
 * Platform console data access — `/api/admin/*`.
 *
 * Every route in `Backend/src/routes/admin.routes.js`, and nothing else. That
 * router carries `authenticate` + `authorize("super_admin")` at the router level
 * (`admin.routes.js:37`), so every function here is reachable only by a
 * `super_admin`; the client's `AdminGuard` is the polite version of that, not the
 * enforcement.
 *
 * The path here matches the API's base path exactly, so a route in this file is
 * findable in `admin.routes.js` by name with no translation layer.
 *
 * **Money is integer pesewas on every one of these routes** (1 GHS = 100
 * pesewas) — `totalRevenue`, `platformMarkup`, `pendingPayouts`, `avgPayment`
 * and the `/admin/schools` `paymentVolume` included. Cedis exist only at the
 * moment of display, in `utils/format`.
 *
 * **Two response envelopes, normalised here and nowhere else.** The API is not
 * internally consistent about pagination and there are now *three* shapes in play
 * across the product:
 *
 *   - `GET /admin/schools` → `data` is a bare array, `meta` is
 *     `{ page, perPage, total, pages }`
 *   - `GET /admin/revenue` → `{ data: { summary, filters } }`, no pagination
 *   - `GET /users` → `{ users, pagination: { page, limit, total, pages } }`
 *
 * `components/students/Pagination` takes `{ page, perPage, total, totalPages }`,
 * which is none of the above. This module is the single place that knows, and
 * every list function below returns `{ rows, meta }` in the shape the shared
 * `Pagination` component expects — so a page never has to know whether its
 * endpoint called the page size `perPage`, `limit` or something else.
 */

/** Subscription plans. Mirrors `listAllSchoolsQuerySchema` in admin.validation.js. */
export const SUBSCRIPTION_PLANS = ['trial', 'basic', 'standard', 'premium', 'enterprise'];

/** School lifecycle states. Mirrors the `status` filter on `GET /admin/schools`. */
export const SCHOOL_STATUSES = ['active', 'suspended', 'archived'];

/** `SchoolAd.AD_PLACEMENTS` — where a creative can appear on the public site. */
export const AD_PLACEMENTS = ['auth_aside', 'home_hero', 'dashboard_sidebar'];

/** `SchoolAd.AD_STATUSES`. */
export const AD_STATUSES = ['draft', 'pending', 'approved', 'rejected', 'expired'];

/**
 * `{ page, perPage, total, pages }` → the `Pagination` component's shape.
 *
 * `totalPages` is computed rather than read, because the two upstream keys are
 * `pages` (admin) and never present at all (`users`), and a pager that renders
 * "1 of undefined" is the failure this hides.
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

/**
 * `GET /admin/dashboard` — the console's one headline call.
 *
 * Returns schools by status, users by kind, payments/revenue totals, MTD and YTD,
 * platform markup, pending payouts, the platform SMS balance, and the five most
 * recently created schools.
 *
 * It is an **aggregate** payload, not a time series, and the difference decides
 * what the Overview can honestly draw. There is no platform revenue chart yet and
 * none should be synthesised from these figures — a curve drawn through MTD, YTD
 * and all-time is invented data. All ten `/api/analytics/*` endpoints are
 * school-scoped (`analytics.routes.js:47-112`, every path ends `/:schoolId`), so
 * none of them can serve a platform-wide series either. A platform series needs
 * `GET /admin/revenue/series`, which does not exist.
 */
export const getDashboardKpis = async () => {
  try {
    const { data } = await api.get('/admin/dashboard');
    return data.data || {};
  } catch (error) {
    throw toApiError(error, 'The platform figures could not be loaded.');
  }
};

/**
 * `GET /admin/schools` — every school on the platform, with per-school counts.
 *
 * Filters: `status`, `region`, `plan`, `search`, plus `sortBy`
 * (`name` | `createdAt` | `schoolCode` | `region` | `status`) and `sortOrder`.
 * Each row carries `studentCount`, `staffCount` and `paymentVolume` (pesewas),
 * so the list does not need a request per row.
 */
export const listSchools = async ({
  page = 1,
  perPage = 20,
  status = '',
  region = '',
  plan = '',
  search = '',
  sortBy = 'createdAt',
  sortOrder = 'desc',
} = {}) => {
  try {
    const { data } = await api.get('/admin/schools', {
      params: { page, perPage, status: status || undefined, region: region || undefined, plan: plan || undefined, search: search || undefined, sortBy, sortOrder },
    });
    return {
      rows: Array.isArray(data?.data) ? data.data : [],
      meta: toPageMeta(data?.meta?.page, data?.meta?.perPage, data?.meta?.total, data?.meta?.pages),
    };
  } catch (error) {
    throw toApiError(error, 'The schools list could not be loaded.');
  }
};

/**
 * `GET /admin/schools/:id/usage` — one school's counts, payment breakdown and
 * ten most recent audit entries. The drill-down behind a row on the schools list.
 */
export const getSchoolUsage = async (schoolId) => {
  if (!schoolId) throw new Error('A school id is required.');
  try {
    const { data } = await api.get(`/admin/schools/${schoolId}/usage`);
    return data.data || {};
  } catch (error) {
    throw toApiError(error, 'This school’s usage could not be loaded.');
  }
};

/**
 * `PUT /admin/schools/:id/suspend` — suspends the school **and every user in
 * it** (`MODULES_13_TO_17.md:1585`: `suspendSchool` cascades `status` to all the
 * school's `User` documents).
 *
 * `reason` is required, 10–500 characters. That cascade is the whole reason this
 * is a confirmed, reasoned action in the UI rather than a row button: one click
 * signs out an entire school's staff, and the reason is what they are told.
 */
export const suspendSchool = async (schoolId, reason) => {
  try {
    const { data } = await api.put(`/admin/schools/${schoolId}/suspend`, { reason });
    return data.data || {};
  } catch (error) {
    throw toApiError(error, 'This school could not be suspended.');
  }
};

/** `PUT /admin/schools/:id/unsuspend` — restores the school and its users. */
export const unsuspendSchool = async (schoolId) => {
  try {
    const { data } = await api.put(`/admin/schools/${schoolId}/unsuspend`);
    return data.data || {};
  } catch (error) {
    throw toApiError(error, 'This school could not be unsuspended.');
  }
};

/**
 * `GET /admin/revenue` — platform-wide aggregation for a period.
 *
 * `period` is one of `all` | `mtd` | `ytd` | `last30`, and `startDate`/`endDate`
 * intersect with it when both are given. Also accepts `plan` and `region`.
 *
 * Returns a `summary` and echoes the `filters` it applied. It is totals only —
 * see `getDashboardKpis` on why there is no platform time series yet.
 */
export const getRevenue = async ({ period = 'all', startDate, endDate, plan = '', region = '' } = {}) => {
  try {
    const { data } = await api.get('/admin/revenue', {
      params: {
        period,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        plan: plan || undefined,
        region: region || undefined,
      },
    });
    return data.data || { summary: {}, filters: {} };
  } catch (error) {
    throw toApiError(error, 'Platform revenue could not be loaded.');
  }
};

/**
 * `GET /admin/sms-balance` — the platform's aggregate SMS credit.
 *
 * This is the **master** balance across all schools, not any school's own. That
 * distinction is load-bearing: `DashboardLayout` refused to show this figure in
 * the school shell for exactly this reason, and it is the reason the platform
 * console's Overview shows it while no school header ever will.
 */
export const getPlatformSmsBalance = async () => {
  try {
    const { data } = await api.get('/admin/sms-balance');
    return data.data || {};
  } catch (error) {
    throw toApiError(error, 'The platform SMS balance could not be loaded.');
  }
};

/**
 * `GET /users` — **the platform-wide user list**, already.
 *
 * Worth reading `userController.listUsers` before assuming a new endpoint is
 * needed: for a `super_admin`, `targetSchoolId = query.schoolId || req.user.schoolId`,
 * and a platform admin's `schoolId` is `null` — so the `query.schoolId` filter is
 * never applied and the query returns **every user on the platform**. That is the
 * list the console needs, and no server change is required.
 *
 * The flip side is why this function exists rather than a bare `listUsers` call:
 * an unfiltered platform-wide query has to be a deliberate, labelled choice, so
 * `schoolId` is an explicit parameter here and the Schools filter in the UI is
 * explicit about when it is not applied.
 *
 * Envelope note: this route is the *third* pagination shape in the product —
 * `{ users, pagination: { page, limit, total, pages } }`. It is normalised to
 * `{ rows, meta }` below like every other list here.
 */
export const listPlatformUsers = async ({ page = 1, perPage = 50, role = '', status = '', schoolId = '' } = {}) => {
  try {
    const { data } = await api.get('/users', {
      params: {
        page,
        limit: perPage,
        role: role || undefined,
        status: status || undefined,
        // Sent as an empty string rather than omitted: `super_admin` reading
        // `schoolId=''` still resolves to `req.user.schoolId` (null), so the
        // behaviour is identical — but sending it makes the scope visible in the
        // network tab instead of implied by its absence.
        schoolId: schoolId || undefined,
      },
    });
    const pagination = data?.pagination || {};
    return {
      rows: Array.isArray(data?.users) ? data.users : [],
      meta: toPageMeta(pagination.page, pagination.limit, pagination.total, pagination.pages),
    };
  } catch (error) {
    throw toApiError(error, 'The user list could not be loaded.');
  }
};

/**
 * `GET /admin/school-ads` — the cross-placement moderation queue.
 *
 * Accepts only `placement`, `status`, `page` and `perPage`. There is deliberately
 * **no `search` param**: `listSchoolAdsQuerySchema` is shared with the public
 * slider, and a default there would hide every other placement from the queue —
 * which is also why the UI must send no placement at all to see the whole queue.
 * There is no free-text search over creatives, so the moderation page filters by
 * status and placement and nothing else.
 *
 * NOTE: these five routes are **undocumented** — Module 18 of
 * `Backend/docs/MODULES_13_TO_17.md` stops at `/admin/schools/:id/unsuspend` —
 * so this module is currently the only written record of their contract. That is
 * worth closing, not relying on.
 */
export const listSchoolAds = async ({ page = 1, perPage = 20, status = '', placement = '' } = {}) => {
  try {
    const { data } = await api.get('/admin/school-ads', {
      params: {
        page,
        perPage,
        status: status || undefined,
        placement: placement || undefined,
      },
    });
    return {
      rows: Array.isArray(data?.data) ? data.data : [],
      meta: toPageMeta(data?.meta?.page, data?.meta?.perPage, data?.meta?.total, data?.meta?.pages),
    };
  } catch (error) {
    throw toApiError(error, 'The content queue could not be loaded.');
  }
};

/**
 * `POST /admin/school-ads` — submit a creative. Filed `pending`.
 *
 * `multipart/form-data` through `uploadSchoolAd` (multer → Cloudinary), so the
 * body is a `FormData`, not JSON — the service layer's `Content-Type:
 * application/json` default would otherwise serialise the file's `[object File]`
 * and the server would reject a body it never parsed.
 *
 * The body shape is `createSchoolAdSchema`: `schoolId` (may be empty/null),
 * `schoolName`, `headline` (4–60 chars — it renders in the auth sidebar, so it is
 * short on purpose), `imageUrl`, `imageAlt` (required, and it is the only thing
 * describing the creative to a screen reader), `linkUrl` (**https only** —
 * `javascript:` here would put an XSS sink on every login page), `placement`, a
 * required `endsAt` in the future, and `sortWeight` (−100…100).
 */
export const createSchoolAd = async (formData) => {
  try {
    const { data } = await api.post('/admin/school-ads', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data.data || {};
  } catch (error) {
    throw toApiError(error, 'This creative could not be submitted.');
  }
};

/**
 * `PUT /admin/school-ads/:adId` — edit copy, dates, weight, or swap the creative.
 *
 * Note what this cannot do: `updateSchoolAdSchema` **deliberately omits `status`
 * and `rejectedReason`**, so an edit can never self-approve. A UI offering a
 * status dropdown on an edit form would be offering something the API silently
 * discards — the creative would stay `pending` and the operator would believe it
 * had gone live. Status changes go through `reviewSchoolAd` and nowhere else.
 *
 * `.min(1)` on the schema: an edit with no changed fields is a 422, not a no-op.
 */
export const updateSchoolAd = async (adId, formData) => {
  try {
    const { data } = await api.put(`/admin/school-ads/${adId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data.data || {};
  } catch (error) {
    throw toApiError(error, 'This creative could not be updated.');
  }
};

/**
 * `PUT /admin/school-ads/:adId/approve` — the **only** call that can change an
 * ad's status (`admin.routes.js:106`).
 *
 * A review, not a boolean: `approveSchoolAdSchema` takes `status:
 * 'approved' | 'rejected'` and requires a `rejectedReason` whenever the decision
 * is `rejected`. That requirement is the feature — the reason is what the school
 * is told, so "rejected" with nothing to say is not an available action.
 *
 * The route is named `/approve` while the decision lives in the body. That
 * mismatch is exactly how a queue ends up with a Reject button that approves
 * things, so the two are named apart here: `reviewSchoolAd` takes a decision,
 * `approveSchoolAd` does not exist.
 */
export const reviewSchoolAd = async (adId, { status, rejectedReason = '' } = {}) => {
  try {
    const { data } = await api.put(`/admin/school-ads/${adId}/approve`, { status, rejectedReason });
    return data.data || {};
  } catch (error) {
    throw toApiError(error, 'This creative could not be reviewed.');
  }
};

/**
 * `DELETE /admin/school-ads/:adId` — soft delete, and it **purges the Cloudinary
 * asset**. Not recoverable by the platform: the school that submitted the
 * creative cannot re-submit it. The confirmation dialog has to say so.
 */
export const deleteSchoolAd = async (adId) => {
  try {
    const { data } = await api.delete(`/admin/school-ads/${adId}`);
    return data.data || {};
  } catch (error) {
    throw toApiError(error, 'This creative could not be deleted.');
  }
};

export default {
  SUBSCRIPTION_PLANS,
  SCHOOL_STATUSES,
  AD_PLACEMENTS,
  AD_STATUSES,
  getDashboardKpis,
  listSchools,
  getSchoolUsage,
  suspendSchool,
  unsuspendSchool,
  getRevenue,
  getPlatformSmsBalance,
  listPlatformUsers,
  listSchoolAds,
  createSchoolAd,
  updateSchoolAd,
  reviewSchoolAd,
  deleteSchoolAd,
};