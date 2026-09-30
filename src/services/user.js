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

export default { getMe, updateMe };

