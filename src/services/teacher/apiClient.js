import axios from 'axios';
import { refreshAccessToken } from '../tokenRefresh.js';

/**
 * The teacher portal's API client.
 *
 * Same job as `services/api.js`, kept separate for the same reason the parent
 * portal has its own: the teacher surface is a sibling shell with its own
 * unwrapping contract, and a second interceptor chain is cheaper than the
 * shared one carrying three subtly different error shapes.
 *
 * **`VITE_API_BASE_URL`, not a relative `/api`.** The portal is a school-side
 * surface served as a static build, and nothing proxies `/api` on the deployed
 * origin — a relative base would send every teacher call to the marketing site
 * and 404. This is the same variable, and the same fallback, that
 * `services/api.js` uses, so a deployment that has the backend URL configured
 * for the admin console has it configured for this one too.
 *
 * Authenticated by JWT: the token `AuthContext` stores under `auth_token` is
 * attached to every request. `sessionStorage` is read as well because a
 * short-lived session deliberately kept out of `localStorage` — a shared staff
 * room handset — must not silently drop the header.
 *
 * Response shape from every teacher endpoint:
 *   { success: true, message: string, data: T, meta?: {...} }
 *
 * The interceptor below unwraps that envelope to `response.data`, so a service
 * function's return value is the envelope and callers read `.data`. On error
 * axios throws; the body is folded into a plain Error carrying `.status` and
 * `.code`, so `catch (err) { if (err.status === 403) … }` works at every call
 * site without each one re-deriving it.
 *
 * ## The 401 branch, which is the whole reason this client used to fail
 *
 * The access token lasts fifteen minutes (`JWT_EXPIRE`). This client used to
 * have no answer to an expired token beyond re-throwing the server's
 * `Access token expired` at the user, so a teacher who took a class's marks
 * down and came back to save them found the save impossible — every mark in
 * the column lost to a token's age. The platform console's client refreshed
 * and replayed; this one did not, because it was written as a copy of the
 * console's *unwrapping* and not of its *auth* behaviour.
 *
 * So the 401 branch below refreshes and replays, and the replay is the same
 * request the user asked for: the grades payload is already serialised, so it
 * goes out again exactly as it was. `services/tokenRefresh.js` owns the
 * refresh itself, including the part that matters most here — the refresh
 * token rotates, so concurrent 401s share one refresh rather than racing each
 * other into a revoked session.
 */
const apiClient = axios.create({
  baseURL: import.meta.env?.VITE_API_BASE_URL || 'https://sukuupay-backend.onrender.com/api',
  timeout: 20000,
  headers: { Accept: 'application/json' },
});

// Attach the JWT on every request.
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Unwrap the server's response envelope, and renew the session when it expires.
apiClient.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;

    /*
     * A 401 here is nearly always an expired access token, and the answer is
     * not to tell the teacher to log in again — it is to mint a new token and
     * do the work they asked for.
     *
     * `_retry` is the guard against a loop: a refresh that fails leaves the
     * request unauthorized, and a second attempt would refresh again. One
     * attempt, then the error is the error.
     */
    if (status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const accessToken = await refreshAccessToken();
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        /*
         * `refreshAccessToken` has already ended the session when the server
         * refused the refresh token, and left it alone when the network
         * failed. Either way the refresh error is the more honest one to show
         * than "Access token expired".
         */
        throw refreshError;
      }
    }

    const payload = error.response?.data;
    const err = new Error(payload?.message || error.message || 'Something went wrong');
    err.status = status;
    err.code = payload?.code;
    err.meta = payload?.meta;
    throw err;
  }
);

export default apiClient;
