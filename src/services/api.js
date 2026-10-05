import axios from 'axios';

/**
 * The API routes are mounted under `/api` on the server, so the prefix belongs
 * here rather than in every service path.
 *
 * This fallback is the value that actually ships: there is no committed `.env`,
 * and a deployed static build cannot set env vars at build time from a file it
 * does not have. Keep it pointing at the deployed backend.
 */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://sukuupay-backend.onrender.com/api';

const clearSession = () => {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('refresh_token');
  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
};

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    /*
     * A `FormData` body owns its own `Content-Type`, and this is the one place that
     * makes that true for the whole product rather than per call site.
     *
     * Two mistakes meet at this line, and the instance default above is what creates
     * the second one.
     *
     * **A multipart content type is only valid with a boundary parameter**, and the
     * boundary is generated while the body is encoded — nobody can hand-write a correct
     * one. Setting `'Content-Type': 'multipart/form-data'` literally sends a header with
     * no boundary, and busboy rejects the whole body with `Multipart: Boundary not
     * found`: every field is dropped and `req.file` is never set. It survives only
     * because axios deletes the header for a `FormData` body in a browser
     * (`axios.cjs:5159`), so the code is correct by accident of an internal detail
     * rather than by construction. `upload.js`, `settings.js` and `students.js` all did
     * this.
     *
     * **The `application/json` instance default destroys any FormData that is left
     * alone.** `transformRequest` decides what to do with a FormData by reading this
     * header (`axios.cjs:2390`), and with `application/json` still in place it does
     * `JSON.stringify(formDataToJSON(data))` — the request goes out as JSON, every
     * `File` collapses to `{}`, and the server never sees a multipart body at all.
     * `createAdRequest` was the casualty: school ad requests with an uploaded creative
     * sent `{"image":{}}`, so the image was discarded before it left the browser.
     *
     * Deleting the header resolves both, because an absent content type is what axios
     * wants to see in each case: `transformRequest` passes the FormData through
     * untouched, and the browser writes `multipart/form-data` with a correct boundary.
     * `services/parentPay.js` documented this rule for its own call site years before
     * anything enforced it; this line is the enforcement, and it is why a future
     * multipart call cannot reintroduce either bug by forgetting.
     *
     * Checked before the request is built, so `transformRequest` — which runs after the
     * interceptors — sees the deleted header rather than the original.
     */
    if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
      config.headers.delete('Content-Type');
    }

    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Routes an unlinked account back to the provisioning step.
 *
 * The server answers any school-scoped request from an account with no school
 * with `409 SCHOOL_NOT_LINKED` and `action: PROVISION_SCHOOL`, rather than the
 * `403 You do not have access to this school` the service used to return. That
 * 403 is wrong in the most confusing way for a brand-new admin: nothing is being
 * denied to them, they simply have nothing to act on yet.
 *
 * One redirect, guarded. A full page navigation drops the SPA and re-runs the
 * guard from scratch, which is the behaviour we want here — the cached user is
 * stale by definition, since the session that produced the 409 predates
 * whatever changed server-side.
 */
let provisionRedirectIssued = false;

const routeToSchoolProvisioning = () => {
  if (provisionRedirectIssued) return;
  const { pathname } = window.location;
  // Already inside the wizard: the step itself owns the message, and a redirect
  // from `/onboarding/school-profile` to `/onboarding/school-profile` would
  // discard the user's half-typed form.
  if (pathname.startsWith('/onboarding')) return;
  provisionRedirectIssued = true;
  window.location.href = '/onboarding/school-profile';
};

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.data?.code === 'SCHOOL_NOT_LINKED') {
      routeToSchoolProvisioning();
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      /*
       * An ended impersonation, and it must not reach the refresh branch.
       *
       * The impersonation middleware answers a request carrying a dead session
       * with `401 { impersonationEnded: true }` — see
       * `Backend/src/middleware/impersonation.js`. Letting that fall through to the
       * refresh below would be actively wrong twice over: the refresh token was
       * minted for the operator's *real* session, so the replay would be re-issued
       * a full platform token and carry on with platform access that nobody asked
       * for; and the impersonation is over, so the console the operator is sitting
       * in is not the one those tokens belong to.
       *
       * The token is cleared and the app reloads to `/login`, which re-runs the
       * guards from scratch against a clean identity. That is the honest outcome:
       * an impersonation ends by ending the session.
       */
      if (error.response?.data?.impersonationEnded) {
        clearSession();
        return Promise.reject(error);
      }

      originalRequest._retry = true;
      try {
        const refreshToken = localStorage.getItem('refresh_token');
        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
        
        const { accessToken, refreshToken: newRefreshToken } = response.data.tokens || {};
        if (!accessToken) {
          clearSession();
          return Promise.reject(refreshError);
        }

        localStorage.setItem('auth_token', accessToken);
        if (newRefreshToken) localStorage.setItem('refresh_token', newRefreshToken);

        // Replay the original request with the NEW token. This previously read
        // an undefined `token` variable, so every retried request went out as
        // `Bearer undefined`, failed with a second 401, and dropped the user
        // out of the app instead of refreshing transparently.
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        clearSession();
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;