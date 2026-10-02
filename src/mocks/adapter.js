/**
 * The mock axios adapter.
 *
 * Installing a custom adapter means every `src/services/*` file runs completely
 * unmodified — the same code path production uses, with only the transport
 * swapped. That is the only way a mock stays honest: a mock that reimplements
 * the service layer would pass while the real service file was broken.
 *
 * It also emulates the axios response envelope, so response interceptors in
 * `api.js` (auth header injection, 401 refresh) execute exactly as they do in
 * production.
 */

import { getScenarioId, getDb, logRequest } from './db';
import { getScenario } from './scenarios';
import { MockError, ROUTES } from './handlers';

  const baseUrl = () => import.meta.env?.VITE_API_BASE_URL || 'https://sukuupay-backend.onrender.com/api';

/** The API's path prefix, e.g. `/api` for a base URL of `http://host/api`. */
const basePath = () => {
  try {
    const pathname = new URL(baseUrl()).pathname;
    return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  } catch {
    return '';
  }
};

/**
 * Reduces a request URL to a bare path like `/schools/abc`.
 *
 * Two shapes arrive here. Instance requests (`api.get('/auth/me')`) give a
 * relative `url` plus a `baseURL`; the bare-`axios` refresh call in
 * `services/api.js` gives an absolute URL and no baseURL. Both have to land on
 * the same path, and the origin must be stripped *before* the base path is
 * matched — stripping the origin first and then testing `startsWith(baseURL)`
 * never matches, because `baseURL` still contains the origin.
 */
const toPath = (config) => {
  const raw = config.url || '';
  const absolute = /^https?:\/\//i.test(raw)
    ? raw
    : `${config.baseURL || baseUrl()}${raw.startsWith('/') ? '' : '/'}${raw}`;

  let path = absolute.replace(/^https?:\/\/[^/]+/i, '');
  const prefix = basePath();
  if (prefix && path.startsWith(prefix)) path = path.slice(prefix.length);

  const [withoutQuery] = path.split('?');
  return withoutQuery.startsWith('/') ? withoutQuery : `/${withoutQuery}`;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Scenario-driven failure and latency.
 *
 * Failures are injected *before* route matching so they can simulate the
 * network being down, and *after* it so a specific endpoint can be broken
 * without breaking everything else.
 */
const applyScenario = async (method, path) => {
  // `getScenarioId()` returns the id; the behaviour flags live on the scenario
  // definition, so both are needed.
  const scenario = getScenario(getScenarioId());
  const base = scenario.config?.latencyMs ?? 0;

  if (scenario.config?.offline) {
    // `ERR_NETWORK` is what axios produces when the request never reaches a
    // server — the same shape `api.js` sees for a dead backend.
    throw new MockError(0, 'Network Error', 'ERR_NETWORK');
  }
  if (base) await sleep(base + Math.random() * (base * 0.4));

  const { flakyRate, slowImport, failSchoolUpdate, failProfile, forceSchoolEmailTaken, failProvision } =
    scenario.config || {};

  if (flakyRate && Math.random() < flakyRate) {
    throw new MockError(500, 'Internal server error', 'INTERNAL_ERROR');
  }
  if (slowImport && path === '/students/bulk') {
    await sleep(4000);
  }
  if (failSchoolUpdate && method.toUpperCase() === 'PUT' && path.startsWith('/schools/')) {
    throw new MockError(409, 'Another bursar is editing this school. Try again.', 'CONFLICT');
  }
  if (failProfile && method.toUpperCase() === 'PUT' && /^\/schools\/[^/]+$/.test(path)) {
    throw new MockError(422, '"name" length must be at least 2 characters long', 'VALIDATION_ERROR');
  }

  // Injected before the handler so `POST /schools/me` behaves as it would for a
  // second bursar of an already-registered school. Step 1 branches on this code,
  // and a mock that only ever produced success would never open the join sheet.
  if (forceSchoolEmailTaken && method.toUpperCase() === 'POST' && path === '/schools/me') {
    throw new MockError(
      409,
      'A school with this email is already registered. Enter your school code to join it instead.',
      'SCHOOL_ALREADY_REGISTERED'
    );
  }
  if (failProvision && method.toUpperCase() === 'POST' && path === '/schools/me') {
    throw new MockError(422, '"address" length must be at least 5 characters long', 'VALIDATION_ERROR');
  }
};

/** Pulls the bearer token out of the header the request interceptor set. */
const bearerToken = (config) => {
  const raw = config.headers?.Authorization || config.headers?.authorization;
  return typeof raw === 'string' && raw.startsWith('Bearer ') ? raw.slice(7) : null;
};

const parseBody = (config) => {
  if (!config.data) return undefined;
  if (typeof config.data === 'string') {
    try {
      return JSON.parse(config.data);
    } catch {
      return config.data;
    }
  }
  return config.data;
};

/** Minimal query-string extraction; the handlers only ever read flat keys. */
const parseQuery = (url = '') => {
  const index = url.indexOf('?');
  if (index === -1) return {};
  return Object.fromEntries(new URLSearchParams(url.slice(index + 1)));
};

/**
 * Parses a multipart body far enough to extract path params. The real handlers
 * read `:token` segments, and those arrive as `.../reset-password/<token>` in
 * the path, not in the form body — so only the path needs unpacking here.
 */
const extractParams = (path) => {
  const match = path.match(/\/([^/]+)$/);
  return match ? { id: match[1], token: match[1], schoolId: match[1], userId: match[1] } : {};
};

const resolveRoute = (method, path) => {
  const upper = method.toUpperCase();
  for (const [routeMethod, pattern, handler] of ROUTES) {
    if (routeMethod !== upper) continue;
    const match = path.match(pattern);
    if (match) {
      const params = { ...extractParams(path) };
      if (match.groups) {
        // Named groups win when a route declares them.
        //
        // The positional fallback below names the *first* segment `token` no
        // matter what it actually is, which is right for `/pay/:token` and wrong
        // for every other single-segment route. A route like
        // `/cohorts/detail/(?<cohortId>[^/]+)` then reads
        // `params.cohortId`, and a handler that asks for a key that does not
        // exist gets `undefined` — which is how the cohort detail handler
        // received no id at all and rejected a perfectly valid `cohort_2025`.
        Object.assign(params, match.groups);
      } else {
        match.slice(1).forEach((value, index) => {
          const key = ['token', 'schoolId', 'id'][index] || `param${index}`;
          params[key] = value;
        });
      }
      return { handler, params };
    }
  }
  return null;
};

export const mockAdapter = async (config) => {
  const method = config.method || 'get';
  const path = toPath(config);
  const at = Date.now();

  try {
    await applyScenario(method, path);

    /*
     * Maintenance mode, applied before route resolution.
     *
     * On the real server this is `middleware/maintenance.js`, mounted on `/api`
     * between `healthRoute` and every other router. The mock has no middleware chain,
     * so the rule is reproduced at the one point every request passes through — and
     * it is worth reproducing, because without it an operator toggling
     * `maintenance.mode` in the platform console would watch a switch do nothing.
     *
     * The exemptions and method rules are copied, not approximated: `/api/health`
     * stays reachable because the keep-alive probe hits it, and `readonly` refuses
     * writes while letting reads through.
     *
     * `/api/webhooks/*` is deliberately **not** exempted here, because the real guard
     * does not exempt it either — providers are configured against a root URL that
     * never reaches this adapter. Mocking an exemption the server does not have would
     * hide a genuine difference.
     *
     * `/api/admin/settings` **is** exempted, because the real guard exempts it. Without
     * that, maintenance mode is a one-way door: turning it on refuses every write,
     * including the one that would turn it off.
     */
    const { getMockPlatformSettings } = await import('./handlers.js');
    const maintenance = getMockPlatformSettings().maintenance || {};
    if (maintenance.mode && maintenance.mode !== 'off') {
      const cleanPath = path.replace(/\/$/, '') || '/';
      const isRead = ['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
      const exempt =
        cleanPath === '/api/health' ||
        cleanPath === '/health' ||
        // `toPath` returns whatever the client's baseURL produces, so this may or
        // may not carry the `/api` prefix depending on `VITE_API_BASE_URL`. Matching
        // the suffix rather than an exact string keeps the exemption working in both
        // shapes — and an exemption that silently stops matching in the mock is
        // exactly how a one-way door gets reintroduced unnoticed.
        cleanPath.endsWith('/admin/settings');

      if (!exempt && (maintenance.mode === 'on' || !isRead)) {
        throw new MockError(
          503,
          maintenance.message ||
            (maintenance.mode === 'readonly'
              ? 'SukuuPay is in maintenance mode. You can read everything as normal, but changes are paused.'
              : 'SukuuPay is down for maintenance. Please try again shortly.'),
          maintenance.mode === 'readonly' ? 'MAINTENANCE_READONLY' : 'MAINTENANCE_MODE'
        );
      }
    }

    const route = resolveRoute(method, path);
    if (!route) {
      // An unrouted call is a real finding, not a shrug: it means the frontend
      // calls an endpoint the mock does not know about, which is exactly the
      // kind of drift this environment exists to surface.
      const message = `[mock] No handler for ${method.toUpperCase()} ${path}`;
      if (import.meta.env?.DEV) console.warn(message);
      throw new MockError(404, message, 'MOCK_ROUTE_NOT_FOUND');
    }

    const token = bearerToken(config);
    const user = token ? getDb().sessions.get(token)?.userId : null;
    const resolvedUser = user ? getDb().users.find((u) => u._id === user) : null;

    const result = await route.handler({
      method: method.toUpperCase(),
      path,
      params: route.params,
      // A custom adapter receives `config.params` still unserialised — axios
      // only builds the query string in its own xhr/http adapters. Reading the
      // URL alone therefore dropped `perPage`, `page`, `sortBy`, `search`,
      // `class` and `status`, so every list endpoint silently fell back to its
      // defaults (20 rows, unsorted). Merge both sources.
      query: { ...parseQuery(config.url || ''), ...(config.params || {}) },
      body: parseBody(config),
      data: config.data,
      headers: config.headers,
      user: resolvedUser,
      token,
    });

    logRequest({ method: method.toUpperCase(), path, status: 200, ok: true, at });

    // Three response shapes coexist in this codebase and the mock must satisfy
    // all of them, or a service silently reads `undefined`:
    //   - `services/auth.js` reads `data.user` / `data.tokens` at the top level,
    //     because the real auth controller returns them there;
    //   - `services/school.js` and friends read `data.data?.school`, because the
    //     real controllers wrap their payload in `data`;
    //   - `GET /students` returns `data` as a bare ARRAY alongside a top-level
    //     `meta`, exactly as `student.controller.js` does. Handlers therefore
    //     return `{ students, meta }` and `meta` is hoisted here.
    //
    // This envelope is deliberately built from the real controllers' shapes, not
    // from what the services happen to read today. A mock that mirrors the
    // frontend instead of the backend hides response-shape bugs — which is
    // exactly what `data.data?.students` in `services/students.js` was: green
    // against the mock, an always-empty list in production.
    // An explicit escape hatch for a handler whose payload legitimately contains
    // a `students` key that must NOT be hoisted — the cohort detail returns
    // `{ cohort, honorsBreakdown, students }` and `students` there is a field of
    // the response, not the response itself. `result.students ?? result` would
    // otherwise replace the whole payload with that array and the client would
    // read `undefined` for `cohort`.
    // ── A response that IS a file ──
    //
    // A CSV download is not a JSON body, and the service that fetches one knows
    // it: `exportStudents` and `exportPayments` both ask for
    // `responseType: 'blob'`, read the filename out of `Content-Disposition` and
    // pass `response.data` straight to `URL.createObjectURL`. A handler returning
    // an ordinary object put a plain object there, so the download threw a
    // TypeError against a request the mock had answered 200 — a broken button
    // whose only visible symptom was a console error.
    //
    // `__file` is how a handler says "this response is a Blob with these
    // headers". `Blob` is global in the browser and in Node 18+, so the same
    // path works under the mockcheck harness.
    const file = result && typeof result === 'object' ? result.__file : undefined;
    if (file) {
      const type = file.mimeType || 'application/octet-stream';
      return {
        data: new Blob([file.body], { type }),
        status: 200,
        statusText: 'OK',
        headers: {
          'content-type': type,
          'content-disposition': `attachment; filename="${file.filename}"`,
        },
        config,
      };
    }

    // `__text` is `__file` for a response whose body is text the client reads as
    // text. The ID card batch preview is the case: the server sends
    // `text/html; charset=utf-8`, and the service asks for `responseType: 'text'`
    // precisely so the markup is not run through a JSON transform.
    //
    // `__file` would also "work" for the mock — it builds a Blob — but then
    // `response.data` is a Blob rather than the string the real endpoint
    // delivers, so the service's `typeof html === 'string'` check fails and the
    // preview cannot be shown. A mock that hands back a different *type* than
    // the API is worse than one that hands back the wrong content, because the
    // client branches on the type.
    const text = result && typeof result === 'object' ? result.__text : undefined;
    if (text) {
      const type = text.mimeType || 'text/plain; charset=utf-8';
      return {
        data: text.body,
        status: text.status ?? 200,
        statusText: 'OK',
        headers: {
          'content-type': type,
          'content-disposition': `attachment; filename="${text.filename || 'response'}"`,
        },
        config,
      };
    }

    const raw = result && typeof result === 'object' ? result.__raw : undefined;
    // The other half of the envelope problem, and `__raw`'s sibling: a
    // controller that returns `data` as a bare ARRAY with its count in `meta`
    // (`listPaymentsController` does, and so does `student.controller.js`).
    //
    // The hoisting rule below can only produce that for a key literally named
    // `students`, so the payments handler's `{ payments, meta }` arrived as
    // `data: { payments, meta }` — an object where `services/payments.js`
    // expects an array, and its `Array.isArray(data?.data) ? … : []` guard
    // turned that into an empty table sitting next to a `meta.total` that said
    // otherwise. `__rows` names the array, so a second collection does not need
    // its own special case here.
    const rows = result && typeof result === 'object' ? result.__rows : undefined;

    const isPlainObject = result && typeof result === 'object' && !Array.isArray(result);
    // `__raw` opts out of the `{ ...result }` spread so the handler's own object
    // is the payload — which is how a `{ data, meta }` controller response is
    // reproduced. It has to carry `meta` across too: the raw path used to drop it
    // entirely, so a handler modelled on `createPaymentPlanController` (a plan in
    // `data` and the parent-notification result in `meta`) had no way to express
    // both, and its `meta.sms` came back `undefined` on the client.
    const meta = result && typeof result === 'object' ? result.meta : undefined;

    const payload = raw
      ? { success: true, data: raw, ...(meta ? { meta } : {}) }
      : rows !== undefined
      ? { success: true, data: rows, ...(meta ? { meta } : {}) }
      : isPlainObject
      ? { success: true, ...result, ...(meta ? { meta } : {}), data: result.students ?? result }
      : { success: true, data: result };

    // `__status` sets a successful non-200 code.
    //
    // The adapter answers 200 for every successful handler, which is right for
    // the CRUD surface but wrong for the two places where the *status code is
    // the message*: `POST /id-cards/batch` answers 202 because a background job
    // now owns the work, and the batch preview answers 202 with
    // `{ status: "pending" }` until the file exists. Both clients branch on the
    // code — the preview service reads `error.response.status === 202`, and the
    // studio's poll loop treats it as "still working, retry".
    //
    // Forcing those to 200 would make the mock disagree with the real API in
    // the one place where getting it wrong looks like the app working: the
    // studio would take its "ready" branch on a pending batch and try to
    // download a file that does not exist.
    const status = result && typeof result === 'object' ? result.__status ?? 200 : 200;

    return {
      data: payload,
      status,
      statusText: status === 200 ? 'OK' : 'Accepted',
      headers: {},
      config,
    };
  } catch (error) {
    const status = error.status ?? 500;
    if (import.meta.env?.DEV) {
      // eslint-disable-next-line no-console
      console.debug(`[mock] ${method.toUpperCase()} ${path} -> ${status} ${error.message}`);
    }
    logRequest({ method: method.toUpperCase(), path, status, ok: false, message: error.message, at });
    return Promise.reject(
      Object.assign(error, {
        config,
        isAxiosError: true,
        response: {
          data: {
            success: false,
            message: error.message,
            code: error.code,
            errors: error.errors,
            // Some failures carry extra machine-readable fields — notably the
            // partial signup, which sets `emailSent: false`. Spread them so the
            // mocked error body matches the real one field for field.
            ...(error.extra || {}),
          },
          status,
          statusText: status === 200 ? 'OK' : 'Error',
          headers: {},
          config,
        },
      })
    );
  }
};

export default mockAdapter;
