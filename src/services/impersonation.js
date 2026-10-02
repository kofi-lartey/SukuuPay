import api from './api';
import { toApiError } from './toApiError';

/**
 * Impersonation data access — `/api/admin/impersonate/*`.
 *
 * Kept separate from `admin.js` because impersonation is not a page, it is a
 * *mode*: the token these calls return replaces the one every other service uses,
 * so the module that swaps tokens has to be small enough to read at a glance. Every
 * other admin function is a plain request against whatever token is in storage,
 * and none of them need to know how that token came to be.
 *
 * **How the token swap works, and why it lives in `auth_token`.**
 * `api`'s request interceptor reads `auth_token` from localStorage on every
 * request, so replacing that one value switches the whole client over. There is no
 * second axios instance and no per-request header here, which means there is no
 * code path where a console request silently goes out on the wrong token.
 *
 * The consequence to respect: an impersonated tab is impersonated. The platform
 * owner cannot read their own mail in the same tab, and the only way out is the
 * banner. That is not a limitation to work around — it is the feature. A console
 * that could hold a platform token *and* an impersonated one at once would be a
 * console in which a support session could quietly become a platform session.
 */

/** Where the impersonation token is kept while a session is open. */
export const IMPERSONATION_TOKEN_KEY = 'admin_impersonation_token';

/**
 * The token the platform owner is currently using, or null.
 *
 * Read through a helper rather than inlined at each call site so the banner, the
 * hook and the layout cannot disagree about whether an impersonation is open —
 * the failure being a console that shows a school's data with no way back.
 */
export const getActiveImpersonationToken = () =>
  localStorage.getItem(IMPERSONATION_TOKEN_KEY);

/** The `{ school, sessionId, reason }` pair the banner renders, or null. */
export const getActiveImpersonation = () => {
  const raw = localStorage.getItem(`${IMPERSONATION_TOKEN_KEY}_meta`);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    // A corrupt value must not be fatal: drop it and report no impersonation. The
    // server is the authority either way — this is only what the banner shows.
    localStorage.removeItem(`${IMPERSONATION_TOKEN_KEY}_meta`);
    return null;
  }
};

const storeImpersonation = (token, meta) => {
  localStorage.setItem(IMPERSONATION_TOKEN_KEY, token);
  localStorage.setItem(`${IMPERSONATION_TOKEN_KEY}_meta`, JSON.stringify(meta ?? {}));
};

const clearStoredImpersonation = () => {
  localStorage.removeItem(IMPERSONATION_TOKEN_KEY);
  localStorage.removeItem(`${IMPERSONATION_TOKEN_KEY}_meta`);
};

/**
 * `POST /admin/impersonate/:schoolId` — open a session and take its token.
 *
 * `reason` is required and 10 characters minimum, server-side. It is stored on the
 * `ImpersonationSession` and shown in the school's own activity log, which means it
 * is read by the people whose school it is — so it has to be written *to* them, and
 * the UI should say so where the operator types it.
 *
 * **The local session's own token is saved, not replaced.** If the tab reloads, or
 * the impersonation is ended from another tab, the owner needs their real token back
 * to continue working — and `endImpersonation` cannot mint one, because issuing a
 * platform-wide credential is not something an endpoint should be able to do on
 * request. Saving it under a separate key is what makes `endImpersonation` able to
 * restore without a re-login.
 */
export const impersonateSchool = async (schoolId, reason) => {
  if (!schoolId) throw new Error('A school is required.');
  try {
    const { data } = await api.post(`/admin/impersonate/${schoolId}`, { reason });

    const session = data?.data?.session;
    const token = data?.data?.token;

    if (!token) {
      throw new Error('The server did not return an impersonation token.');
    }

    // Only stash the original token if we are not already impersonating. Doing this
    // twice would overwrite the real token with a 60-minute impersonation one, and
    // "exit" would then hand back a token that is itself scoped to a school.
    if (!getActiveImpersonationToken()) {
      localStorage.setItem(`${IMPERSONATION_TOKEN_KEY}_owner`, localStorage.getItem('auth_token') || '');
    }

    storeImpersonation(token, {
      sessionId: session?._id ?? null,
      schoolId: data?.data?.school?._id ?? schoolId,
      schoolName: data?.data?.school?.name ?? '',
      schoolCode: data?.data?.school?.schoolCode ?? '',
      region: data?.data?.school?.region ?? '',
      reason,
      startedAt: session?.startedAt ?? null,
    });

    /*
     * `auth_token` is swapped last, after everything above has succeeded.
     *
     * `api`'s request interceptor reads that one key on every request, so replacing
     * it switches the whole client over — no second axios instance, no per-request
     * header, and therefore no code path where a console request can quietly go out
     * on the platform owner's real credential while the banner says otherwise.
     *
     * Order matters: if this ran first and the `throw` above fired, the tab would be
     * left holding an impersonation token with nothing to restore it from.
     */
    localStorage.setItem('auth_token', token);

    return data.data;
  } catch (error) {
    throw toApiError(error, 'That school could not be impersonated.');
  }
};

/**
 * `POST /admin/impersonate/end` — close the session and restore the owner token.
 *
 * Idempotent by contract: the server answers `{ ended: false }` when no session is
 * open rather than a 404, so the banner's button can be pressed without the caller
 * having to know whether it needed to be.
 *
 * **The stored owner token is cleared whether or not the call succeeds.** A failure
 * here leaves a session the operator believes is closed and the server believes is
 * open, and the next `auth_token` read would resume it. Clearing locally and
 * forcing a clean sign-in is the recoverable outcome; the alternative is an
 * invisible open session nobody knows to look for. The error is still surfaced —
 * this is about which state we leave behind, not about hiding the failure.
 */
export const endImpersonation = async () => {
  try {
    const { data } = await api.post('/admin/impersonate/end');
    const ownerToken = localStorage.getItem(`${IMPERSONATION_TOKEN_KEY}_owner`);
    clearStoredImpersonation();
    localStorage.removeItem(`${IMPERSONATION_TOKEN_KEY}_owner`);
    if (ownerToken) localStorage.setItem('auth_token', ownerToken);
    return data?.data ?? { ended: true };
  } catch (error) {
    clearStoredImpersonation();
    localStorage.removeItem(`${IMPERSONATION_TOKEN_KEY}_owner`);
    throw toApiError(error, 'Impersonation could not be ended cleanly. Sign in again.');
  }
};

/**
 * `GET /admin/impersonate/sessions` — the platform owner's own history.
 *
 * Read with the *owner's* token, so this must be called after `endImpersonation`
 * or it describes the wrong actor. Not corrected for here on purpose: swapping
 * tokens back and forth inside a render to satisfy a history query is exactly the
 * kind of cleverness that eventually leaves a tab on the wrong credential.
 */
export const listImpersonationSessions = async ({
  page = 1,
  perPage = 20,
  schoolId = '',
  superAdminId = '',
} = {}) => {
  try {
    const { data } = await api.get('/admin/impersonate/sessions', {
      params: {
        page,
        perPage,
        schoolId: schoolId || undefined,
        superAdminId: superAdminId || undefined,
      },
    });
    const meta = data?.meta || {};
    const size = Number(meta.perPage) || perPage;
    const total = Number(meta.total) || 0;
    return {
      rows: Array.isArray(data?.data) ? data.data : [],
      meta: {
        page: Number(meta.page) || 1,
        perPage: size,
        total,
        totalPages: Number(meta.pages) || Math.max(1, Math.ceil(total / size)),
      },
    };
  } catch (error) {
    throw toApiError(error, 'Impersonation history could not be loaded.');
  }
};

/** `GET /admin/impersonate/sessions/:id` — the session plus what was done in it. */
export const getImpersonationSession = async (sessionId) => {
  if (!sessionId) throw new Error('A session id is required.');
  try {
    const { data } = await api.get(`/admin/impersonate/sessions/${sessionId}`);
    return data?.data || {};
  } catch (error) {
    throw toApiError(error, 'That impersonation session could not be loaded.');
  }
};

export default {
  IMPERSONATION_TOKEN_KEY,
  getActiveImpersonation,
  getActiveImpersonationToken,
  impersonateSchool,
  endImpersonation,
  listImpersonationSessions,
  getImpersonationSession,
};