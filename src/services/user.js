import api from './api';
import { toApiError } from './toApiError';

/**
 * `GET /auth/me`
 *
 * Returns the whole envelope. `onboarding` is the server's resolved link state
 * — whether this account is linked to a school — and the guard reads it from
 * here rather than inferring it from a nullable `schoolId`.
 */
export const getMe = async () => {
  const { data } = await api.get('/auth/me');
  return { user: data.user, onboarding: data.onboarding };
};

/**
 * Partial profile update.
 *
 * `onboardingCompleted` / `onboardingHighestStep` are real fields on the User
 * model and real keys on `updateUserSchema`, so wizard progress now survives a
 * device change. Before this they were stripped by Joi and the call silently did
 * nothing, which left the localStorage flag as the only record — and meant an
 * admin who finished onboarding on a laptop walked the wizard again on a phone.
 */
export const updateMe = async (userId, patch) => {
  try {
    const { data } = await api.put(`/users/${userId}`, patch);
    return data.user || data.data?.user || data.data || data;
  } catch (error) {
    throw toApiError(error, 'Failed to save your profile.');
  }
};

// ── Team management ──────────────────────────────────────────────────────────
//
// The three calls the User Management module needs. Separate from the
// `updateMe` above on purpose even though both touch `/users/:id`: that one
// edits the signed-in user's own profile and is used by the onboarding wizard,
// these administer other people's accounts and are admin-only. Merging them
// would mean the profile form's blast radius quietly grew to include role
// changes and deletions of other users.

/**
 * `GET /users`
 *
 * The server scopes the list to the caller's own school and paginates it, so
 * there is no `schoolId` to pass — sending one is the shape the endpoint
 * accepts for a `super_admin` browsing another school, and for anyone else it is
 * ignored. `role`/`status` are server-side filters; the page keeps its search
 * box client-side because a roster of a single school is short enough that
 * filtering on every keystroke is cheaper than a round trip.
 *
 * Returns the whole envelope, unlike the helpers above, because the module
 * renders the pagination controls and needs `total`.
 */
export const listUsers = async ({ page = 1, limit = 50, role, status } = {}) => {
  try {
    const { data } = await api.get('/users', { params: { page, limit, role, status } });
    return {
      users: data.users || [],
      pagination: data.pagination || { page, limit, total: 0, pages: 0 },
    };
  } catch (error) {
    throw toApiError(error, 'Failed to load the team list.');
  }
};

/**
 * `POST /users/invite`
 *
 * `name` and `email` are the only required fields — a school admin inviting a
 * colleague knows those and little else. The server mints the default password
 * from the School ID; it is never accepted from this side, and asking for it
 * would be a client that expects to choose a stranger's password.
 *
 * Resolves even when the account was created but the email failed to send. The
 * controller answers 201 in that case and carries the distinction in
 * `emailSent`, because the account really was created — retrying the whole
 * request would just collide with its own duplicate-email 409. Callers must
 * read `emailSent` rather than assuming a thrown error means "nothing
 * happened".
 */
export const inviteUser = async (payload) => {
  try {
    const { data } = await api.post('/users/invite', payload);
    return { user: data.user, emailSent: data.emailSent === true, message: data.message };
  } catch (error) {
    throw toApiError(error, 'Could not send that invitation.');
  }
};

/**
 * `POST /users/:userId/resend-invite`
 *
 * Re-mints the default password and re-sends the mail. The previous password
 * stops working immediately, so this is only correct for an account that has
 * never signed in — the server enforces that rather than trusting the UI to
 * hide the button.
 */
export const resendUserInvite = async (userId) => {
  try {
    const { data } = await api.post(`/users/${userId}/resend-invite`);
    return { user: data.user, emailSent: data.emailSent === true, message: data.message };
  } catch (error) {
    throw toApiError(error, 'Could not re-send that invitation.');
  }
};

/** `PUT /users/:userId/role` */
export const updateUserRole = async (userId, role) => {
  try {
    const { data } = await api.put(`/users/${userId}/role`, { role });
    return data.user;
  } catch (error) {
    throw toApiError(error, 'Could not change that role.');
  }
};

/**
 * `DELETE /users/:userId`
 *
 * Soft delete. The row keeps its unique email address, so re-inviting somebody
 * who was removed needs a restore rather than a fresh invite — which is what
 * `EMAIL_ON_DELETED_ACCOUNT` in the invite error is telling the caller.
 */
export const removeUser = async (userId) => {
  try {
    const { data } = await api.delete(`/users/${userId}`);
    return data;
  } catch (error) {
    throw toApiError(error, 'Could not remove that user.');
  }
};

export default {
  getMe,
  updateMe,
  listUsers,
  inviteUser,
  resendUserInvite,
  updateUserRole,
  removeUser,
};

