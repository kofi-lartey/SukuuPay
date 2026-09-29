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

  const { flakyRate, slowImport, failSchoolUpdate, failProfile } = scenario.config || {};

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
      match.slice(1).forEach((value, index) => {
        const key = ['token', 'schoolId', 'id'][index] || `param${index}`;
        params[key] = value;
      });
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
    const isPlainObject = result && typeof result === 'object' && !Array.isArray(result);
    const payload = isPlainObject
      ? { success: true, ...result, ...(result.meta ? { meta: result.meta } : {}), data: result.students ?? result }
      : { success: true, data: result };

    return {
      data: payload,
      status: 200,
      statusText: 'OK',
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
