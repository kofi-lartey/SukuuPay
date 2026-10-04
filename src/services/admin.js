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
  tag = '',
} = {}) => {
  try {
    const { data } = await api.get('/admin/schools', {
      params: {
        page,
        perPage,
        status: status || undefined,
        region: region || undefined,
        plan: plan || undefined,
        search: search || undefined,
        sortBy,
        sortOrder,
        /*
         * `tag` is declared by `listAllSchoolsQuerySchema` and honoured by
         * `listAllSchools`, so it goes to the server rather than being filtered over
         * the loaded page. A tag filter run client-side over 20 rows returns a
         * partial answer that looks like a complete one — and "show me every school
         * tagged at-risk" is precisely the query an operator runs expecting all of
         * them.
         *
         * Deliberately absent: `paymentVolume` and `studentCount` as sort keys. Both
         * are computed aggregates rather than fields, and `sortBy` is a closed
         * allowlist of `name | createdAt | schoolCode | region | status`; offering
         * either would 422.
         */
        tag: tag || undefined,
      },
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
export const reviewSchoolAd = async (
  adId,
  { status, rejectedReason = '', headline, writeup } = {}
) => {
  try {
    // Copy rides along **only when the caller supplies it**, which is the whole point of
    // the destructuring here. `AdminContent` computes `copyChanged` and omits unchanged
    // fields; sending `headline`/`writeup` unconditionally would make the server record
    // `copyEditedByReview` on every approval, and tell every school an administrator
    // rewrote words they did not touch.
    const payload = { status, rejectedReason };
    if (headline !== undefined) payload.headline = headline;
    if (writeup !== undefined) payload.writeup = writeup;

    const { data } = await api.put(`/admin/school-ads/${adId}/approve`, payload);
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

/**
 * `GET /admin/revenue/series` — platform revenue over time, bucketed.
 *
 * `bucket` is `month` or `day` and is sent explicitly rather than left to the
 * server: 30 daily points for "last 30 days" and 24 monthly points for "this year"
 * are different charts, and a caller that let the server choose would get a shape
 * it did not ask for.
 *
 * The series has **no gaps by contract** — a month nobody paid comes back as an
 * explicit `0` rather than being omitted. That is the difference between a chart
 * that dips to the baseline and one that draws a straight line across a month of no
 * revenue and calls it growth, and it is why `RevenueCard` can plot the response
 * directly with no gap handling of its own.
 *
 * Money is pesewas, like every other figure on this router.
 */
export const getRevenueSeries = async ({
  bucket = 'month',
  period = 'ytd',
  startDate,
  endDate,
  plan = '',
  region = '',
} = {}) => {
  try {
    const { data } = await api.get('/admin/revenue/series', {
      params: {
        bucket,
        period,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        plan: plan || undefined,
        region: region || undefined,
      },
    });
    return data.data || { series: [], filters: {}, totals: {} };
  } catch (error) {
    throw toApiError(error, 'The revenue trend could not be loaded.');
  }
};

/**
 * `GET /admin/settings` — platform configuration.
 *
 * The server merges its defaults under whatever is stored, so this returns real
 * values before any settings document exists and there is no "not configured yet"
 * state for the page to handle.
 */
export const getPlatformSettings = async () => {
  try {
    const { data } = await api.get('/admin/settings');
    return data.data || {};
  } catch (error) {
    throw toApiError(error, 'Platform settings could not be loaded.');
  }
};

/**
 * `PUT /admin/settings` — patch platform configuration.
 *
 * A **patch**: send only the keys being changed. The server's schema has every
 * field optional for exactly this reason, so a caller that read the document, edited
 * one flag and wrote the whole thing back cannot blank the settings it did not mean
 * to touch.
 *
 * The response carries `changed` — flat leaf paths with both sides of each — which
 * is the honest record of what the write actually did, and what the activity log
 * entry was built from.
 */
export const updatePlatformSettings = async (patch) => {
  try {
    const { data } = await api.put('/admin/settings', patch);
    return data.data || {};
  } catch (error) {
    throw toApiError(error, 'Platform settings could not be saved.');
  }
};

// ─────────────────────────────────────────────
// Schools — detail, lifecycle and platform overrides
// ─────────────────────────────────────────────

/** `School.subscription.plan`. Mirrors the enum on the model. */
export const PLANS = ['trial', 'basic', 'standard', 'premium', 'enterprise'];

/** `School.subscription.status`. */
export const SUBSCRIPTION_STATUSES = ['active', 'suspended', 'expired', 'cancelled', 'trial'];

/**
 * `School.payment.gatewayMode`.
 *
 * **Not** the `sukuupay | school` pair the platform's own docs use. The model
 * enumerates the *provider* a school routes through, so "which rail did this
 * payment use" is a question about this enum and not about a mode. `manual` is the
 * meaningful distinction for platform reporting: it is the only value that means
 * the school is collecting outside SukuuPay, so the platform took no money and is
 * owed a platform fee instead of a markup.
 */
export const GATEWAY_MODES = ['hubtel', 'arke', 'mnotify', 'manual'];

/** The four per-school capability switches. See `School.featureFlags`. */
export const FEATURE_FLAGS = ['installments', 'idCards', 'whatsapp', 'apiAccess'];

/**
 * `GET /admin/schools/:schoolId` — everything the platform knows about one school.
 *
 * Profile, subscription, payment config (credentials stripped server-side), stats,
 * student count, recent payments, recent students, team, ledger summary, disbursement
 * history, tags, feature flags, internal notes and onboarding state.
 *
 * This is the one school endpoint a school admin cannot read — it includes
 * `internalNotes`, which is written for the platform only. Do not reuse it for the
 * school console; `GET /schools/me` is that path.
 */
export const getSchool = async (schoolId) => {
  if (!schoolId) throw new Error('A school id is required.');
  try {
    const { data } = await api.get(`/admin/schools/${schoolId}`);
    return data.data || {};
  } catch (error) {
    throw toApiError(error, 'That school could not be loaded.');
  }
};

/**
 * `POST /admin/schools` — create a school by hand.
 *
 * Rarely the right tool: self-signup and the onboarding wizard both provision a
 * school already. This exists for the school a customer has paid for and whose
 * administrator will never complete the wizard — a migration from a competitor, or
 * a school with no reliable email.
 */
export const createSchool = async (payload) => {
  try {
    const { data } = await api.post('/admin/schools', payload);
    return data.data || {};
  } catch (error) {
    throw toApiError(error, 'That school could not be created.');
  }
};

/**
 * `PUT /admin/schools/:schoolId` — edit a school's profile.
 *
 * "Any field a school admin cannot" — name, contact details, region, academic
 * config, branding. Deliberately excludes `status`: suspension has its own
 * reason-required endpoint so it is always a separate, confirmed, audited act.
 */
export const updateSchool = async (schoolId, patch) => {
  if (!schoolId) throw new Error('A school id is required.');
  try {
    const { data } = await api.put(`/admin/schools/${schoolId}`, patch);
    return data.data || {};
  } catch (error) {
    throw toApiError(error, 'This school could not be updated.');
  }
};

/**
 * `PUT /admin/schools/:schoolId/markup` — set the percentage skimed per payment.
 *
 * **Affects new payments only.** Payments already collected keep the rate they were
 * charged at, which is why the response returns `warnings` listing how many
 * unsettled payments this change will treat differently. The UI must show that
 * before the write is confirmed, not after: an operator who reads "12 unsettled
 * payments affected" as "these will be repriced" will be wrong about their own
 * action, and the school's ledger will disagree with them.
 */
export const updateMarkup = async (schoolId, platformMarkupPercent) => {
  try {
    const { data } = await api.put(`/admin/schools/${schoolId}/markup`, { platformMarkupPercent });
    return data.data || {};
  } catch (error) {
    throw toApiError(error, 'The markup could not be changed.');
  }
};

/** `PUT /admin/schools/:schoolId/platform-fee` — the Mode B monthly percentage. */
export const updatePlatformFee = async (schoolId, platformFeePercent) => {
  try {
    const { data } = await api.put(`/admin/schools/${schoolId}/platform-fee`, { platformFeePercent });
    return data.data || {};
  } catch (error) {
    throw toApiError(error, 'The platform fee could not be changed.');
  }
};

/**
 * `PUT /admin/schools/:schoolId/gateway-mode` — move a school between rails.
 *
 * Refused with a 409 while the school has open disbursements: money collected on
 * the old rail is still owed on the old rail, and switching providers mid-flight
 * would send it somewhere the school is not expecting.
 */
export const updateGatewayMode = async (schoolId, gatewayMode) => {
  try {
    const { data } = await api.put(`/admin/schools/${schoolId}/gateway-mode`, { gatewayMode });
    return data.data || {};
  } catch (error) {
    throw toApiError(error, 'The gateway mode could not be changed.');
  }
};

/**
 * `PUT /admin/schools/:schoolId/subscription` — plan, fee and period.
 *
 * A patch. The server fills `trialEndsAt` from the platform's trial-days setting
 * when a trial is set without one, and `currentPeriodEnd` a month out when an
 * active plan is set without one — so the console does not have to compute billing
 * periods, which is not its job.
 */
export const updateSubscription = async (schoolId, patch) => {
  try {
    const { data } = await api.put(`/admin/schools/${schoolId}/subscription`, patch);
    return data.data || {};
  } catch (error) {
    throw toApiError(error, 'The subscription could not be changed.');
  }
};

/**
 * `PUT /admin/schools/:schoolId/feature-flags` — per-school capability switches.
 *
 * `whatsapp` and `apiAccess` default **off** server-side and cost real money per
 * conversation and per call. The UI must default them to unchecked on an existing
 * school rather than to whatever `true` looks friendlier — enabling API access by
 * accident is an integration nobody asked for.
 */
export const updateFeatureFlags = async (schoolId, flags) => {
  try {
    const { data } = await api.put(`/admin/schools/${schoolId}/feature-flags`, flags);
    return data.data || {};
  } catch (error) {
    throw toApiError(error, 'The feature flags could not be changed.');
  }
};

/** `PUT /admin/schools/:schoolId/tags` — replaces the whole label array. */
export const updateSchoolTags = async (schoolId, tags) => {
  try {
    const { data } = await api.put(`/admin/schools/${schoolId}/tags`, { tags });
    return data.data || {};
  } catch (error) {
    throw toApiError(error, 'The tags could not be saved.');
  }
};

/**
 * `PUT /admin/schools/:schoolId/notes` — the platform-only internal note.
 *
 * Nothing in the school console reads this, which is the point of it. The label in
 * the UI has to say so too: an owner who believes the bursar can see it will not
 * write anything they would not want read aloud in a staff meeting.
 */
export const updateInternalNotes = async (schoolId, internalNotes) => {
  try {
    const { data } = await api.put(`/admin/schools/${schoolId}/notes`, { internalNotes });
    return data.data || {};
  } catch (error) {
    throw toApiError(error, 'The notes could not be saved.');
  }
};

/**
 * `DELETE /admin/schools/:schoolId` — archive.
 *
 * **A soft delete.** The school becomes `status: 'archived'` with `deletedAt` set;
 * students, payments and the ledger are untouched. Nothing in the product restores
 * an archived school, so the confirmation dialog has to say it is permanent rather
 * than offering a cancel that implies otherwise.
 */
export const archiveSchool = async (schoolId) => {
  if (!schoolId) throw new Error('A school id is required.');
  try {
    const { data } = await api.delete(`/admin/schools/${schoolId}`);
    return data.data || {};
  } catch (error) {
    throw toApiError(error, 'This school could not be archived.');
  }
};

// ─────────────────────────────────────────────
// Users across every school
// ─────────────────────────────────────────────

/**
 * Every role an admin may *assign*.
 *
 * **Deliberately omits `super_admin`.** There is exactly one platform owner,
 * provisioned from the environment by `Backend/src/boot/ensureSuperAdmin.js`, and
 * no endpoint may create or promote one — `Backend/tests/platformOwner.test.js`
 * enforces it. This list mirrors `ASSIGNABLE_ROLES` in
 * `Backend/src/validators/userValidators.js`, which is the server's copy of the
 * same rule; they must agree, or a role this UI offers is one the API rejects.
 */
export const ASSIGNABLE_ROLES = ['school_admin', 'accountant', 'teacher', 'viewer'];

/** Every status a user account can hold. */
export const USER_STATUSES = ['active', 'invited', 'suspended', 'deactivated'];

/**
 * `GET /admin/users` — every account on the platform.
 *
 * Distinct from `listPlatformUsers` above, which calls `GET /users` and relies on a
 * super admin's null `schoolId` making that route platform-wide. This one is the
 * console's own endpoint and is what the users screen uses, because it returns the
 * school *name* alongside each row — `GET /users` populates only the id, so the
 * table would be a column of ids.
 *
 * `search` covers name, email and phone, which is what an operator actually has: a
 * name off a support call, or a phone number off an SMS that did not arrive.
 */
export const listAllUsers = async ({
  page = 1,
  perPage = 20,
  role = '',
  schoolId = '',
  status = '',
  search = '',
} = {}) => {
  try {
    const { data } = await api.get('/admin/users', {
      params: {
        page,
        perPage,
        role: role || undefined,
        schoolId: schoolId || undefined,
        status: status || undefined,
        search: search || undefined,
      },
    });
    return {
      rows: Array.isArray(data?.data) ? data.data : [],
      meta: toPageMeta(data?.meta?.page, data?.meta?.perPage, data?.meta?.total, data?.meta?.pages),
    };
  } catch (error) {
    throw toApiError(error, 'The user list could not be loaded.');
  }
};

/** `GET /admin/users/:userId` — one account, its school and its activity. */
export const getUser = async (userId) => {
  if (!userId) throw new Error('A user id is required.');
  try {
    const { data } = await api.get(`/admin/users/${userId}`);
    return data.data || {};
  } catch (error) {
    throw toApiError(error, 'That user could not be loaded.');
  }
};

/**
 * `PUT /admin/users/:userId/role` — change somebody's role.
 *
 * The server refuses `super_admin` as an input, refuses changing the platform
 * owner's own role, and refuses a caller changing their own. All three are
 * invariants, not UI decisions — this function exists so the form has one place to
 * call, not because the guard belongs here.
 */
export const updateUserRole = async (userId, role) => {
  try {
    const { data } = await api.put(`/admin/users/${userId}/role`, { role });
    return data.data || {};
  } catch (error) {
    throw toApiError(error, 'That role could not be changed.');
  }
};

/**
 * `PUT /admin/users/:userId/status` — suspend, reactivate or deactivate.
 *
 * `suspended` takes effect on the user's next request without waiting for their
 * token to expire (`Backend/src/middleware/authenticate.js`), so this is an
 * immediate cut-off rather than a scheduled one.
 */
export const updateUserStatus = async (userId, status) => {
  try {
    const { data } = await api.put(`/admin/users/${userId}/status`, { status });
    return data.data || {};
  } catch (error) {
    throw toApiError(error, 'That account status could not be changed.');
  }
};

/**
 * `POST /admin/users/:userId/reset-password` — send a reset link.
 *
 * Returns `resetToken` **in development only**; in production the key is absent from
 * the response entirely rather than null. A password displayed in a console is a
 * password in a screenshot, and a UI that renders an input for a field the server
 * omits invites somebody to paste a placeholder into it.
 *
 * **This mints a link, not a credential.** It reuses `POST /auth/forgot-password`'s
 * flow, so the reset token is hashed into `passwordResetToken` and
 * `authController.resetPassword` revokes at redemption. Deliberately does *not* set
 * `defaultPassword` as well: two live credentials on one account, with no way to
 * tell which was used, is worse than a slightly slower sign-in.
 */
export const resetUserPassword = async (userId) => {
  try {
    const { data } = await api.post(`/admin/users/${userId}/reset-password`);
    return data.data || {};
  } catch (error) {
    throw toApiError(error, 'A password reset could not be sent.');
  }
};

/** `POST /admin/users/:userId/resend-verification` — re-send the email OTP. */
export const resendVerification = async (userId) => {
  try {
    const { data } = await api.post(`/admin/users/${userId}/resend-verification`);
    return data.data || {};
  } catch (error) {
    throw toApiError(error, 'The verification email could not be sent.');
  }
};

// ─────────────────────────────────────────────
// Payments across every school
// ─────────────────────────────────────────────

/** `Payment.status`. */
export const PAYMENT_STATUSES = ['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded'];

/** `Payment.provider` — the rail the payment actually went through. */
export const PAYMENT_PROVIDERS = ['hubtel', 'arke', 'mnotify', 'manual', 'mtn'];

/** `Payment.momoNetwork`. */
export const PAYMENT_NETWORKS = ['MTN', 'VODAFONE', 'AIRTELTELIGO', 'UNKNOWN'];

/**
 * `GET /admin/payments` — every payment on the platform.
 *
 * Returns `{ rows, meta, totals }` where `totals` is the sum over the matched set,
 * so the figure above the table describes the filter above it too.
 *
 * Amounts are pesewas. Note that a refund is a **separate row with a negative
 * amount**, not a flag on the original — so a school's collected total is the sum
 * of both, and a list filtered to `completed` will not include refunds. Summing
 * `completed` and calling it "what the school collected" overstates it.
 */
export const listAllPayments = async ({
  page = 1,
  perPage = 20,
  schoolId = '',
  status = '',
  network = '',
  gateway = '',
  from = '',
  to = '',
} = {}) => {
  try {
    const { data } = await api.get('/admin/payments', {
      params: {
        page,
        perPage,
        schoolId: schoolId || undefined,
        status: status || undefined,
        network: network || undefined,
        gateway: gateway || undefined,
        from: from || undefined,
        to: to || undefined,
      },
    });
    return {
      rows: Array.isArray(data?.data) ? data.data : [],
      totals: data?.data?.totals || data?.totals || { amount: 0, count: 0 },
      meta: toPageMeta(data?.meta?.page, data?.meta?.perPage, data?.meta?.total, data?.meta?.pages),
    };
  } catch (error) {
    throw toApiError(error, 'The payments list could not be loaded.');
  }
};

/**
 * `GET /admin/payments/:paymentId` — one payment in full.
 *
 * Carries the split actually charged (`feesBreakdown`), the platform's *current*
 * recomputed markup for comparison, the disbursement batch it belongs to, and the
 * ledger entries it produced. The two markups are both shown on purpose: they differ
 * exactly when a school's rate changed after this payment, and seeing that beside
 * the row is the only way to explain a discrepancy a school reports.
 */
export const getPayment = async (paymentId) => {
  if (!paymentId) throw new Error('A payment id is required.');
  try {
    const { data } = await api.get(`/admin/payments/${paymentId}`);
    return data.data || {};
  } catch (error) {
    throw toApiError(error, 'That payment could not be loaded.');
  }
};

/**
 * `POST /admin/payments/:paymentId/refund` — return money to a parent.
 *
 * `reason` is required (10 characters minimum) and it is what the parent is told and
 * what support is quoted. The dialog must be a dialog, not a confirm button.
 *
 * The reversal is written as its own `Payment` with a **negative** amount, so the
 * ledger stays additive and a full refund appears beside the original row that
 * cancelled it. A refund does not edit history — see `models/PlatformLedger.js`.
 */
export const refundPayment = async (paymentId, { amount, reason }) => {
  try {
    const { data } = await api.post(`/admin/payments/${paymentId}/refund`, { amount, reason });
    return data.data || {};
  } catch (error) {
    throw toApiError(error, 'That payment could not be refunded.');
  }
};

/**
 * `GET /admin/payments/stats` — aggregates over a window.
 *
 * `groupBy` is `day|week|month` and is sent explicitly rather than left to the
 * server, for the same reason `getRevenueSeries` sends its bucket: 30 daily points
 * and 24 monthly points are different charts, and a caller that let the server pick
 * would get a shape it did not ask for.
 *
 * **The series has no gaps by contract.** A day nobody paid in comes back as an
 * explicit `0`, not as an omitted point — otherwise the client draws a straight line
 * across the hole and presents a day of no collections as steady growth.
 */
export const getPaymentStats = async ({ groupBy = 'day', from = '', to = '', schoolId = '' } = {}) => {
  try {
    const { data } = await api.get('/admin/payments/stats', {
      params: {
        groupBy,
        from: from || undefined,
        to: to || undefined,
        schoolId: schoolId || undefined,
      },
    });
    return data.data || { series: [], byStatus: [], byProvider: [], byNetwork: [] };
  } catch (error) {
    throw toApiError(error, 'Payment statistics could not be loaded.');
  }
};

// ─────────────────────────────────────────────
// SMS
// ─────────────────────────────────────────────

/**
 * `GET /admin/sms/overview` — totals, cost and the per-school breakdown.
 *
 * `costThisMonth` is **an estimate**: messages × `PlatformSettings.sms.ratePesewas`.
 * The provider's invoice will not match it exactly (bundles, per-network rates,
 * failed-message refunds), so the label in the UI must say "estimated" or the first
 * real invoice will read as a discrepancy nobody can explain.
 */
export const getSmsOverview = async () => {
  try {
    const { data } = await api.get('/admin/sms/overview');
    return data.data || {};
  } catch (error) {
    throw toApiError(error, 'The SMS overview could not be loaded.');
  }
};

/** `GET /admin/sms/credits` — the master balance and its per-school breakdown. */
export const getSmsCredits = async () => {
  try {
    const { data } = await api.get('/admin/sms/credits');
    return data.data || {};
  } catch (error) {
    throw toApiError(error, 'SMS credits could not be loaded.');
  }
};

/**
 * `POST /admin/sms/credits/topup` — record a credit purchase.
 *
 * **Records, it does not pay.** There is no payment integration for SMS credit in
 * this product, so this writes a `SmsCreditTopUp` row. With `schoolIds` it credits
 * those schools; without them it records a platform-level credit note that credits
 * nobody. The dialog has to say which one is happening.
 */
export const recordSmsCreditTopUp = async ({ amount, provider, schoolIds = [] }) => {
  try {
    const { data } = await api.post('/admin/sms/credits/topup', { amount, provider, schoolIds });
    return data.data || {};
  } catch (error) {
    throw toApiError(error, 'The credit top-up could not be recorded.');
  }
};

/** `GET /admin/sms/logs` — message history with delivery status. */
export const listSmsLogs = async ({
  page = 1,
  perPage = 20,
  schoolId = '',
  status = '',
  from = '',
  to = '',
} = {}) => {
  try {
    const { data } = await api.get('/admin/sms/logs', {
      params: {
        page,
        perPage,
        schoolId: schoolId || undefined,
        status: status || undefined,
        from: from || undefined,
        to: to || undefined,
      },
    });
    return {
      rows: Array.isArray(data?.data) ? data.data : [],
      meta: toPageMeta(data?.meta?.page, data?.meta?.perPage, data?.meta?.total, data?.meta?.pages),
    };
  } catch (error) {
    throw toApiError(error, 'SMS history could not be loaded.');
  }
};

/**
 * `POST /admin/sms/broadcast` — message every school's administrators.
 *
 * Recipients are `school_admin` accounts only, and only for schools that are active
 * and not archived. The server refuses above 500 recipients with the count in the
 * message, and the dialog should show the resolved count before the send — this is
 * metered SMS to real phones from a real provider, and a mis-targeted broadcast
 * cannot be recalled.
 */
export const broadcastToSchoolAdmins = async ({ targetAudience, schoolIds = [], message }) => {
  try {
    const { data } = await api.post('/admin/sms/broadcast', {
      targetAudience,
      schoolIds,
      message,
    });
    return data.data || {};
  } catch (error) {
    throw toApiError(error, 'The broadcast could not be sent.');
  }
};

// ─────────────────────────────────────────────
// Announcements
// ─────────────────────────────────────────────

/** `PlatformAnnouncement.severity`. */
export const ANNOUNCEMENT_SEVERITIES = ['info', 'warning', 'critical'];

/** `PlatformAnnouncement.targetAudience`. */
export const ANNOUNCEMENT_AUDIENCES = ['all_schools', 'selected_schools', 'all_admins'];

/** `GET /admin/announcements` — `active=true` returns only what is live now. */
export const listAnnouncements = async ({ page = 1, perPage = 20, active = '' } = {}) => {
  try {
    const { data } = await api.get('/admin/announcements', {
      params: { page, perPage, active: active === '' || active === undefined ? undefined : active },
    });
    return {
      rows: Array.isArray(data?.data) ? data.data : [],
      meta: toPageMeta(data?.meta?.page, data?.meta?.perPage, data?.meta?.total, data?.meta?.pages),
    };
  } catch (error) {
    throw toApiError(error, 'Announcements could not be loaded.');
  }
};

/**
 * `POST /admin/announcements` — write and schedule a notice.
 *
 * `targetSchoolIds` is required when `targetAudience` is `selected_schools` and
 * forbidden otherwise. The UI's audience selector should therefore show the school
 * picker **only** for `selected_schools` rather than leaving it visible-but-ignored,
 * which reads as a broken control.
 */
export const createAnnouncement = async (payload) => {
  try {
    const { data } = await api.post('/admin/announcements', payload);
    return data.data || {};
  } catch (error) {
    throw toApiError(error, 'The announcement could not be created.');
  }
};

export const getAnnouncement = async (announcementId) => {
  if (!announcementId) throw new Error('An announcement id is required.');
  try {
    const { data } = await api.get(`/admin/announcements/${announcementId}`);
    return data.data || {};
  } catch (error) {
    throw toApiError(error, 'That announcement could not be loaded.');
  }
};

export const updateAnnouncement = async (announcementId, patch) => {
  try {
    const { data } = await api.put(`/admin/announcements/${announcementId}`, patch);
    return data.data || {};
  } catch (error) {
    throw toApiError(error, 'The announcement could not be updated.');
  }
};

/**
 * `DELETE /admin/announcements/:announcementId` — withdraw.
 *
 * Sets `isActive: false`. **It does not hard-delete**, and that is the point: a
 * notice schools have already been shown cannot be un-read, and removing the row
 * would destroy the record that it was ever published.
 */
export const deleteAnnouncement = async (announcementId) => {
  try {
    const { data } = await api.delete(`/admin/announcements/${announcementId}`);
    return data.data || {};
  } catch (error) {
    throw toApiError(error, 'The announcement could not be withdrawn.');
  }
};

// ─────────────────────────────────────────────
// Audit log
// ─────────────────────────────────────────────

/**
 * `GET /admin/audit-logs` — the platform-wide trail.
 *
 * **The only read in the product that crosses schools**, which is why it lives
 * behind `authorize('super_admin')` rather than behind a per-school filter.
 *
 * `action` validates against `AUDIT_ACTION_VALUES` on the server, which is derived
 * from `AUDIT_ACTIONS` — the same array that is the `AuditLog.action` enum. An
 * action this UI offers is therefore always writable by the code that performs it.
 */
export const listAuditLogs = async ({
  page = 1,
  perPage = 20,
  schoolId = '',
  userId = '',
  action = '',
  entity = '',
  from = '',
  to = '',
} = {}) => {
  try {
    const { data } = await api.get('/admin/audit-logs', {
      params: {
        page,
        perPage,
        schoolId: schoolId || undefined,
        userId: userId || undefined,
        action: action || undefined,
        entity: entity || undefined,
        from: from || undefined,
        to: to || undefined,
      },
    });
    return {
      rows: Array.isArray(data?.data) ? data.data : [],
      meta: toPageMeta(data?.meta?.page, data?.meta?.perPage, data?.meta?.total, data?.meta?.pages),
    };
  } catch (error) {
    throw toApiError(error, 'The audit log could not be loaded.');
  }
};

/** `GET /admin/audit-logs/user/:userId` — everything one account has done. */
export const getUserAuditTrail = async (userId, { page = 1, perPage = 20 } = {}) => {
  try {
    const { data } = await api.get(`/admin/audit-logs/user/${userId}`, {
      params: { page, perPage },
    });
    return {
      rows: Array.isArray(data?.data) ? data.data : [],
      meta: toPageMeta(data?.meta?.page, data?.meta?.perPage, data?.meta?.total, data?.meta?.pages),
    };
  } catch (error) {
    throw toApiError(error, 'That account’s history could not be loaded.');
  }
};

/**
 * `GET /admin/audit-logs/:id` — one entry, with what happened around it.
 *
 * **A real read.** The detail screen was fetching the newest 200 rows and picking
 * the matching one out of the list, which works for a click-through from the first
 * page and silently fails for everything else: an entry older than the 200 most
 * recent comes back "not found", and "not found" for a row the operator can see is an
 * answer that looks exactly like deletion.
 *
 * `surrounding` is the ±5 second window either side of this entry. An operator
 * reading one change almost always wants to know what it was adjacent to — a
 * suspension is meaningless without the settings write that preceded it — so it
 * travels with the entry rather than being a second request.
 */
export const getAuditLog = async (auditLogId) => {
  if (!auditLogId) throw new Error('An audit log id is required.');
  try {
    const { data } = await api.get(`/admin/audit-logs/${auditLogId}`);
    return {
      log: data?.data || null,
      surrounding: Array.isArray(data?.meta?.surrounding) ? data.meta.surrounding : [],
      window: data?.meta?.window || null,
    };
  } catch (error) {
    throw toApiError(error, 'That audit entry could not be loaded.');
  }
};

/**
 * `GET /admin/audit-logs/impersonation/:sessionId` — what was done inside a session.
 *
 * Matches on `meta.impersonationSessionId`, which is why platform actions written
 * while impersonating must always populate it — an entry with a null `meta` is
 * invisible on this screen, and that screen is the whole justification for
 * recording impersonations at all.
 */
export const getImpersonationAudit = async (sessionId, { page = 1, perPage = 50 } = {}) => {
  try {
    const { data } = await api.get(`/admin/audit-logs/impersonation/${sessionId}`, {
      params: { page, perPage },
    });

    /*
     * Hand-rolled `meta`, not `toPageMeta`.
     *
     * This endpoint does **not** return the `{ page, perPage, total, pages }` envelope
     * the paged lists use. It returns `{ session, data, meta: { returned, limit, note } }`
     * — `returned` is how many entries came back, `limit` is the cap, and `note`
     * explains the cap. Handing `toPageMeta` four keys that do not exist produced
     * `total: 0` on every call, so the screen rendered no pager and no indication
     * that the history had been truncated.
     *
     * Read explicitly, and pass the rest through so the caller can say "showing the
     * first N of M" — an audit history that silently stops at the cap is worse than
     * one that admits it.
     */
    const meta = data?.meta || {};
    return {
      session: data?.data?.session || null,
      rows: Array.isArray(data?.data?.data) ? data.data.data : [],
      meta: {
        returned: Number(meta.returned) || 0,
        limit: Number(meta.limit) || perPage,
        truncated: Boolean(meta.truncated),
        note: meta.note || null,
        page: 1,
        perPage,
        total: Number(meta.returned) || 0,
        totalPages: 1,
      },
    };
  } catch (error) {
    throw toApiError(error, 'That session’s activity could not be loaded.');
  }
};

// ─────────────────────────────────────────────
// Health
// ─────────────────────────────────────────────

/**
 * `GET /admin/health` — every dependency, one payload.
 *
 * Each dependency reports `ok | degraded | down` **individually**, and that
 * granularity is the reason this is one endpoint: a screen where the database is
 * down blanks out entirely is a screen that cannot tell you it is the database.
 *
 * Overall `status` is `down` only when a *required* dependency is down — MongoDB.
 * A platform out of SMS credit is `degraded`, not `down`, because parents can still
 * pay. The UI must colour the two differently or an operator will treat a cosmetic
 * problem as an outage.
 */
export const getSystemHealth = async () => {
  try {
    const { data } = await api.get('/admin/health');
    return data.data || {};
  } catch (error) {
    throw toApiError(error, 'System health could not be loaded.');
  }
};

/** `GET /admin/health/jobs` — cron schedule, last run, next run, status. */
export const getJobRuns = async () => {
  try {
    const { data } = await api.get('/admin/health/jobs');
    return data.data || { jobs: [] };
  } catch (error) {
    throw toApiError(error, 'Scheduled job status could not be loaded.');
  }
};

/**
 * `GET /admin/health/errors` — recent errors.
 *
 * **In-process only.** There is no durable error store in this codebase, so this is
 * a bounded in-memory buffer on the instance that served the request: it shows what
 * happened on *this* instance and is empty after a restart or on a sibling. The
 * error panel has to say so — presented without that caveat it reads as the
 * platform's complete error history, and "there were no errors" would then be a
 * claim about the whole platform when it is a claim about one process.
 */
export const getRecentErrors = async ({ from = '', to = '', limit = 50 } = {}) => {
  try {
    const { data } = await api.get('/admin/health/errors', {
      params: { from: from || undefined, to: to || undefined, limit },
    });
    /*
     * `scope`, `durable` and `limitations[]` are forwarded rather than dropped.
     *
     * They are the only statement this platform can make about the completeness of
     * its own error history, and they live in the envelope's `meta` rather than
     * beside the errors. A panel that showed the list without them would render
     * "no recent errors" as a claim about the platform when it is a claim about one
     * in-process buffer — and "there have been no errors" is exactly the reading a
     * blank list invites.
     */
    return {
      ...(data?.data || {}),
      meta: data?.meta || { scope: 'process', durable: false },
    };
  } catch (error) {
    throw toApiError(error, 'Recent errors could not be loaded.');
  }
};

/** `GET /admin/health/queue` — background job queue depth. */
export const getQueueDepth = async () => {
  try {
    const { data } = await api.get('/admin/health/queue');
    return data.data || {};
  } catch (error) {
    throw toApiError(error, 'Queue depth could not be loaded.');
  }
};

/**
 * `POST /admin/health/maintenance-mode` — take the platform quiet.
 *
 * `{ enabled, message }`, adapted server-side onto the three-state
 * `maintenance.mode` (`off | readonly | on`). `enabled: true` moves an `off` platform
 * to **`readonly`** — every read open, every write refused — because that is the
 * state in which a schema migration is safe, and it is the one an operator
 * turning this on during a deploy almost always wants.
 *
 * A message is **required** when enabling. A platform-wide lockout with nothing
 * shown to users is worse than the outage it was meant to manage.
 */
export const setMaintenanceMode = async ({ enabled, message = '' }) => {
  try {
    // `PUT`, not `POST`, and at `/health/maintenance` rather than
    // `/health/maintenance-mode`. The brief this was written from assumed a POST and
    // a longer path; the backend settled on a `PUT` because the body describes the
    // *whole* maintenance state (mode and message together) rather than adding
    // something to it.
    const { data } = await api.put('/admin/health/maintenance', { enabled, message });
    return data.data || {};
  } catch (error) {
    throw toApiError(error, 'Maintenance mode could not be changed.');
  }
};

// ─────────────────────────────────────────────
// Settings sub-resources
// ─────────────────────────────────────────────

/**
 * `PUT /admin/settings/commission` — the two percentages SukuuPay takes.
 *
 * Its own endpoint rather than part of the general settings write because "save
 * settings" and "change what we earn" are different decisions and deserve different
 * confirmation. Returns the same `changed` diff shape as `updatePlatformSettings`.
 */
export const updateCommission = async ({ defaultMarkupPercent, defaultPlatformFeePercent }) => {
  try {
    const { data } = await api.put('/admin/settings/commission', {
      defaultMarkupPercent,
      defaultPlatformFeePercent,
    });
    return data.data || {};
  } catch (error) {
    throw toApiError(error, 'The commission could not be changed.');
  }
};

/**
 * `PUT /admin/settings/disbursement` — payout schedule, and whether it self-approves.
 *
 * `autoApprove` is the most consequential boolean in this product: it is the
 * difference between a payout run needing one human click and money leaving the
 * platform unattended. It is off by default and the confirm dialog must name it as
 * what it is rather than presenting it as another schedule field.
 */
export const updateDisbursementSettings = async ({ frequency, dayOfWeek, autoApprove }) => {
  try {
    const { data } = await api.put('/admin/settings/disbursement', {
      frequency,
      dayOfWeek,
      autoApprove,
    });
    return data.data || {};
  } catch (error) {
    throw toApiError(error, 'The disbursement settings could not be saved.');
  }
};

// ─────────────────────────────────────────────
// Analytics
// ─────────────────────────────────────────────

/**
 * `GET /admin/overview` — the console's headline payload.
 *
 * The platform-wide counterpart to `getDashboardKpis` above, which aggregates
 * payments only. This one adds MRR, ARR, churn and growth, all of which are
 * properties of the *subscription* base rather than of any single payment — which
 * is why they could not be derived from the older endpoint.
 *
 * ARR is a projection (`MRR × 12`), not a measurement, and the UI should render it
 * with that framing. Every SaaS ARR figure is a projection; the ones that do not say
 * so are the ones that mislead.
 */
export const getAdminOverview = async () => {
  try {
    const { data } = await api.get('/admin/overview');
    return data.data || {};
  } catch (error) {
    throw toApiError(error, 'The platform overview could not be loaded.');
  }
};

/**
 * `GET /admin/analytics/revenue` — revenue over time, split by source.
 *
 * Split by `type` (markup / platform fee / subscription / sms) rather than by a
 * single total, because "where does the money come from" is the question a platform
 * owner's revenue screen exists to answer and one undifferentiated line cannot.
 *
 * **No gaps in the series**, same contract as `getRevenueSeries`.
 */
export const getRevenueAnalytics = async ({ from = '', to = '', groupBy = 'day' } = {}) => {
  try {
    const { data } = await api.get('/admin/analytics/revenue', {
      params: { from: from || undefined, to: to || undefined, groupBy },
    });
    return data.data || { series: [], totals: {}, byType: [] };
  } catch (error) {
    throw toApiError(error, 'Revenue analytics could not be loaded.');
  }
};

/**
 * `GET /admin/analytics/schools` — signups, churn and activation.
 *
 * `activationRate` is schools with `onboardingCompletedAt` set ÷ schools created in
 * the window. Schools that signed up and never onboarded are the denominator's
 * entire point: without them the rate describes only the schools that already
 * succeeded.
 */
export const getSchoolsAnalytics = async ({ from = '', to = '' } = {}) => {
  try {
    const { data } = await api.get('/admin/analytics/schools', {
      params: { from: from || undefined, to: to || undefined },
    });
    return data.data || {};
  } catch (error) {
    throw toApiError(error, 'School analytics could not be loaded.');
  }
};

/**
 * Read the row list out of an analytics payload, whichever key it arrived under.
 *
 * The analytics service names its list `schools` on some endpoints (`at-risk`,
 * `top-schools`) and returns other shapes elsewhere, because each aggregation has a
 * different natural name for the thing it ranked. That is fine on the wire and a
 * trap in a component: `AtRiskCard` read `data.rows`, got `undefined`, and rendered
 * a permanently empty panel — with no error anywhere, because `[]` renders
 * perfectly.
 *
 * Normalising here means a component asks for `rows` once and cannot be wrong about
 * the key. Both spellings are accepted so the service can be tidied without a
 * frontend release.
 */
const normaliseSchoolList = (payload) => {
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.schools)
      ? payload.schools
      : Array.isArray(payload?.rows)
        ? payload.rows
        : [];
  return list;
};

/** `GET /admin/analytics/usage` — SMS, imports, payments, activity. */
export const getUsageAnalytics = async () => {
  try {
    const { data } = await api.get('/admin/analytics/usage');
    return data.data || {};
  } catch (error) {
    throw toApiError(error, 'Usage analytics could not be loaded.');
  }
};

/**
 * `GET /admin/analytics/collection-rate` — owed versus collected, by term.
 *
 * A school with no payment plan for a term counts as **not owed**, not as fully
 * paid. The alternative silently flatters the figure by excluding every school that
 * never created a plan, which is the largest and most successful cohort on a
 * per-term basis.
 */
export const getCollectionRateAnalytics = async ({ from = '', to = '' } = {}) => {
  try {
    const { data } = await api.get('/admin/analytics/collection-rate', {
      params: { from: from || undefined, to: to || undefined },
    });
    return data.data || {};
  } catch (error) {
    throw toApiError(error, 'Collection-rate analytics could not be loaded.');
  }
};

/**
 * `GET /admin/analytics/gateway-mix` — platform rail versus the school's own.
 *
 * Derived from `School.payment.gatewayMode`, whose only meaningful distinction for
 * this report is `manual` (the school collects outside SukuuPay, so the platform
 * earns a platform fee rather than a markup) versus everything else.
 */
export const getGatewayMixAnalytics = async ({ from = '', to = '' } = {}) => {
  try {
    const { data } = await api.get('/admin/analytics/gateway-mix', {
      params: { from: from || undefined, to: to || undefined },
    });
    return data.data || {};
  } catch (error) {
    throw toApiError(error, 'Gateway-mix analytics could not be loaded.');
  }
};

/** `GET /admin/analytics/top-schools?metric=revenue|students|payments`. */
export const getTopSchools = async ({ metric = 'revenue', limit = 10 } = {}) => {
  try {
    const { data } = await api.get('/admin/analytics/top-schools', { params: { metric, limit } });
    return { rows: normaliseSchoolList(data?.data) };
  } catch (error) {
    throw toApiError(error, 'Top schools could not be loaded.');
  }
};

/**
 * `GET /admin/analytics/at-risk-schools` — who needs chasing.
 *
 * `reasons` is an array, and it must be rendered as a list. One school with no
 * payments and 400 students is an operational problem; one with no payments and no
 * students never onboarded. A single boolean collapses the first two, and the
 * operator chasing an onboarded school for non-payment is a support call that wastes
 * both their time.
 */
export const getAtRiskSchools = async () => {
  try {
    const { data } = await api.get('/admin/analytics/at-risk-schools');
    return { rows: normaliseSchoolList(data?.data) };
  } catch (error) {
    throw toApiError(error, 'At-risk schools could not be loaded.');
  }
};

// ─────────────────────────────────────────────
// Reports
// ─────────────────────────────────────────────

/**
 * The report types `GET /admin/reports/export` accepts.
 *
 * **Snake case, and that is the server's spelling.** `ADMIN_REPORT_TYPES` in
 * `Backend/src/validations/admin.analytics.validation.js` is
 * `platform_revenue | school_performance | growth | churn`, and
 * `reportExportQuerySchema` rejects anything else — so `platform-revenue` produced a
 * 422 whose message listed the four values it wanted, which is a worse way to learn
 * this than a constant that was right the first time.
 *
 * Mirrors the backend array; `validate` in `middleware/validate.js` runs with
 * `stripUnknown: true`, so an unmatched value is not silently accepted either.
 */
export const REPORT_TYPES = [
  'platform_revenue',
  'school_performance',
  'growth',
  'churn',
];

/** `platform_revenue` → `platform-revenue`, for the downloaded filename only. */
const reportSlug = (type) => String(type).replace(/_/g, '-');

const fetchReport = async (path, params) => {
  const { data } = await api.get(path, { params });
  return data?.data || {};
};

/** `GET /admin/reports/platform-revenue` — totals and the split by source. */
export const getPlatformRevenueReport = async ({ from = '', to = '' } = {}) =>
  fetchReport('/admin/reports/platform-revenue', { from: from || undefined, to: to || undefined });

/** `GET /admin/reports/school-performance` — one row per school. */
export const getSchoolPerformanceReport = async ({ from = '', to = '' } = {}) =>
  fetchReport('/admin/reports/school-performance', { from: from || undefined, to: to || undefined });

/** `GET /admin/reports/growth` — new schools, new students, revenue trend. */
export const getGrowthReport = async ({ from = '', to = '' } = {}) =>
  fetchReport('/admin/reports/growth', { from: from || undefined, to: to || undefined });

/** `GET /admin/reports/churn` — schools that went inactive in the window. */
export const getChurnReport = async ({ from = '', to = '' } = {}) =>
  fetchReport('/admin/reports/churn', { from: from || undefined, to: to || undefined });

/**
 * `GET /admin/reports/export/:type?format=csv|xlsx|pdf` — download a report.
 *
 * A browser download, so a raw `fetch` with `Authorization` rather than the axios
 * instance: axios would try to JSON-parse a CSV and throw on success.
 *
 * The export is audited server-side with `admin.export` — it leaves the platform
 * with a copy of the data, so it is recorded like a read that matters.
 */
export const downloadReport = async ({ type, from = '', to = '', format = 'csv' }) => {
  if (!REPORT_TYPES.includes(type)) {
    throw new Error(`Unknown report type "${type}".`);
  }

  /*
   * `type` goes in the **query string**, not the path.
   *
   * The brief's route table said `/reports/export/:type` and this used to build that
   * URL. `exportReportController` destructures `{ type, from, to, format }` out of
   * `req.query` and `reportExportQuerySchema` declares `type` there, so the path
   * segment produced a URL that looked right and a 422 saying `type` was required —
   * the hardest kind of wrong to spot, because the request clearly reached the right
   * endpoint.
   */
  const params = new URLSearchParams({ type, format });
  if (from) params.set('from', from);
  if (to) params.set('to', to);

  const token = localStorage.getItem('auth_token');
  const response = await fetch(`${api.defaults.baseURL}/admin/reports/export?${params}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    throw new Error(
      response.status === 401
        ? 'Your session expired. Sign in again to export this report.'
        : // A 500 here is a serialiser that failed on a malformed payload, not a
          // missing format — `pdf`, `csv` and `xlsx` are all supported. Kept
          // separate from the generic message so a support ticket says something
          // useful.
          response.status === 500
          ? 'The report could not be serialised. Try a narrower date range.'
          : 'That report format is not available on this deployment.'
    );
  }

  const extensions = { csv: 'csv', xlsx: 'xlsx', pdf: 'pdf' };
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  // The slug is hyphenated for the *filename* only. `type` stays snake_case on the
  // wire because that is what the server's enum is.
  anchor.download = `${reportSlug(type)}-${new Date().toISOString().slice(0, 10)}.${extensions[format]}`;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);

  return { type, format };
};

export default {
  SUBSCRIPTION_PLANS,
  PLANS,
  SUBSCRIPTION_STATUSES,
  SCHOOL_STATUSES,
  GATEWAY_MODES,
  FEATURE_FLAGS,
  AD_PLACEMENTS,
  AD_STATUSES,
  ASSIGNABLE_ROLES,
  USER_STATUSES,
  PAYMENT_STATUSES,
  PAYMENT_PROVIDERS,
  PAYMENT_NETWORKS,
  ANNOUNCEMENT_SEVERITIES,
  ANNOUNCEMENT_AUDIENCES,
  REPORT_TYPES,
  getDashboardKpis,
  listSchools,
  getSchoolUsage,
  getSchool,
  createSchool,
  updateSchool,
  updateMarkup,
  updatePlatformFee,
  updateGatewayMode,
  updateSubscription,
  updateFeatureFlags,
  updateSchoolTags,
  updateInternalNotes,
  archiveSchool,
  suspendSchool,
  unsuspendSchool,
  listAllUsers,
  getUser,
  updateUserRole,
  updateUserStatus,
  resetUserPassword,
  resendVerification,
  listPlatformUsers,
  listAllPayments,
  getPayment,
  refundPayment,
  getPaymentStats,
  getSmsOverview,
  getSmsCredits,
  recordSmsCreditTopUp,
  listSmsLogs,
  broadcastToSchoolAdmins,
  listAnnouncements,
  createAnnouncement,
  getAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  listAuditLogs,
  getUserAuditTrail,
  getImpersonationAudit,
  getSystemHealth,
  getJobRuns,
  getRecentErrors,
  getQueueDepth,
  setMaintenanceMode,
  getRevenue,
  getRevenueSeries,
  getPlatformSmsBalance,
  getPlatformSettings,
  updatePlatformSettings,
  updateCommission,
  updateDisbursementSettings,
  getAdminOverview,
  getRevenueAnalytics,
  getSchoolsAnalytics,
  getUsageAnalytics,
  getCollectionRateAnalytics,
  getGatewayMixAnalytics,
  getTopSchools,
  getAtRiskSchools,
  getPlatformRevenueReport,
  getSchoolPerformanceReport,
  getGrowthReport,
  getChurnReport,
  downloadReport,
  listSchoolAds,
  createSchoolAd,
  updateSchoolAd,
  reviewSchoolAd,
  deleteSchoolAd,
};