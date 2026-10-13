import axios from 'axios';

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
 */
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'https://sukuupay-backend.onrender.com/api',
  timeout: 20000,
  headers: { Accept: 'application/json' },
});

// Attach the JWT on every request.
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Unwrap the server's response envelope.
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const payload = error.response?.data;
    const err = new Error(payload?.message || error.message || 'Something went wrong');
    err.status = error.response?.status;
    err.code = payload?.code;
    err.meta = payload?.meta;
    throw err;
  }
);

export default apiClient;
