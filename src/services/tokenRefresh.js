import axios from 'axios';

/**
 * Session refresh, shared by every API client.
 *
 * ## Why this exists
 *
 * The access token is short-lived — `JWT_EXPIRE` defaults to fifteen minutes
 * (`Backend/src/config/env.js`) — and the refresh token is the only thing that
 * can mint a new one. A client that attaches the token but never refreshes it
 * turns every fifteen minutes of ordinary use into a hard failure: a teacher
 * leaves a class's marks half-entered, comes back to the grid, presses "Save
 * all grades", and the server answers `401 {"message":"Access token expired"}`.
 *
 * That is exactly what the teacher portal did. It runs on its own axios
 * instance (`services/teacher/apiClient.js`), whose 401 branch simply re-threw
 * the server's message at the user, while the platform console's client
 * (`services/api.js`) had a refresh branch the teacher client never inherited.
 * Two clients, two answers to the same 401 — and the teacher portal got the
 * wrong one.
 *
 * ## Why one module
 *
 * Because the refresh path is subtle enough that a second copy of it is a
 * second set of bugs:
 *
 * - **The refresh token rotates.** The server stores a hash of the token it
 *   last issued (`issueSession` in `Backend/src/utils/tokens.js`), so a refresh
 *   invalidates the token that performed it. Two clients refreshing at the
 *   same moment — the roster query and the grades save, say — would race, and
 *   the loser would present a token the server has already forgotten and be
 *   told the session was revoked. Hence the single in-flight refresh below:
 *   concurrent callers share one request.
 * - **A failed refresh is not the same as a dead session.** A refresh that
 *   never reached the server proves nothing about the session, and throwing
 *   the session away on a two-second signal loss costs a teacher the marks
 *   they had not saved yet. Only a refresh the server actually answered ends
 *   the session.
 *
 * ## Where the tokens live
 *
 * `localStorage` under `auth_token` and `refresh_token` — the keys
 * `services/auth.js` writes on login and `services/teacher/apiClient.js`
 * reads. `sessionStorage` is read as a fallback for a session deliberately
 * kept out of `localStorage` (a shared staff-room handset), and is mirrored
 * rather than replaced so such a session stays ephemeral.
 */

/**
 * The API root.
 *
 * Optional-chained on `import.meta.env` itself, not just on the property, for
 * the same reason `utils/googleIdentity.js` does it: Vite replaces
 * `import.meta.env` at build time, but a bare property access throws
 * `TypeError` under a bundler-less import — which is what `node --test` is.
 */
const API_BASE_URL =
  import.meta.env?.VITE_API_BASE_URL || 'https://sukuupay-backend.onrender.com/api';

export const ACCESS_TOKEN_KEY = 'auth_token';
export const REFRESH_TOKEN_KEY = 'refresh_token';

/** A storage area, or null where there is none (Node, private mode, SSR). */
const store = (name) => {
  try {
    return globalThis[name] || null;
  } catch {
    return null;
  }
};

/** The first non-empty value of `key`, `localStorage` first then `sessionStorage`. */
export const readToken = (key) => {
  for (const name of ['localStorage', 'sessionStorage']) {
    const value = store(name)?.getItem?.(key);
    if (value) return value;
  }
  return null;
};

/**
 * Writes a token, mirroring it into `sessionStorage` only if that store
 * already held one.
 *
 * `localStorage` is written unconditionally because that is where
 * `services/auth.js` puts the tokens it issues at login. `sessionStorage` is
 * only updated when it was already in use, so a session that was deliberately
 * kept ephemeral does not gain a persistent twin by being refreshed.
 */
const writeToken = (key, value) => {
  store('localStorage')?.setItem?.(key, value);
  const session = store('sessionStorage');
  if (session?.getItem?.(key)) session.setItem(key, value);
};

/**
 * Ends the session: the tokens go, and the browser is sent to the login page.
 *
 * A full page navigation rather than a router push, because the cached
 * identity in `AuthContext` is stale by definition once the session it came
 * from is gone, and re-running the guards from scratch is the honest way to
 * find out where this account actually belongs.
 */
export const clearSession = () => {
  for (const name of ['localStorage', 'sessionStorage']) {
    const area = store(name);
    area?.removeItem?.(ACCESS_TOKEN_KEY);
    area?.removeItem?.(REFRESH_TOKEN_KEY);
  }

  if (typeof window !== 'undefined' && window.location?.pathname) {
    const path = window.location.pathname;
    // Student sessions live under /student and authenticate against the student
    // login page; sending a student to the staff login (or vice-versa) is what
    // produced the redirect loop when a session was cleared mid-flight.
    const loginPath = path.startsWith('/student') ? '/student/login' : '/login';
    if (path !== loginPath) {
      window.location.href = loginPath;
    }
  }
};

/**
 * The one refresh in flight, shared by every caller that needs one.
 *
 * `null` means no refresh is running. A promise means one is, and everybody
 * who arrives while it runs gets that same promise — so the rotating refresh
 * token is only ever spent once.
 */
let pendingRefresh = null;

/**
 * Mints a new access token and stores it.
 *
 * Resolves with the new access token. Rejects when the session is genuinely
 * gone (the server refused the refresh token), in which case the session has
 * already been cleared; and when the refresh could not reach the server at
 * all, in which case the session is deliberately left alone.
 */
export const refreshAccessToken = () => {
  if (pendingRefresh) return pendingRefresh;

  const refreshToken = readToken(REFRESH_TOKEN_KEY);

  if (!refreshToken) {
    const failure = new Error('Your session has expired. Please sign in again.');
    failure.status = 401;
    clearSession();
    return Promise.reject(failure);
  }

  pendingRefresh = axios
    .post(`${API_BASE_URL}/auth/refresh`, { refreshToken }, { timeout: 20000 })
    .then((response) => {
      const tokens = response.data?.tokens || {};

      if (!tokens.accessToken) {
        throw new Error('Token refresh failed');
      }

      writeToken(ACCESS_TOKEN_KEY, tokens.accessToken);
      if (tokens.refreshToken) writeToken(REFRESH_TOKEN_KEY, tokens.refreshToken);

      return tokens.accessToken;
    })
    .catch((error) => {
      /*
       * A response means the server answered, and the server is the authority
       * on the session: a revoked, expired or rotated-away refresh token all
       * end it here.
       *
       * No response at all means the request never landed — a dead network, a
       * timeout, a captive portal. Dropping the session for that would throw
       * away a teacher's unsaved marks because the handset lost signal, so
       * the error is passed through with the session intact and the caller
       * can ask the user to try again.
       */
      if (!error.response) throw error;

      clearSession();

      const failure = new Error(
        error.response?.data?.message || 'Your session has expired. Please sign in again.'
      );
      failure.status = error.response?.status;
      throw failure;
    })
    .finally(() => {
      pendingRefresh = null;
    });

  return pendingRefresh;
};

export default refreshAccessToken;
