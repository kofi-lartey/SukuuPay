import api from './api';
import { toApiError } from './toApiError';

/** `GET /auth/me` */
export const getMe = async () => {
  const { data } = await api.get('/auth/me');
  return data.user;
};

/**
 * Partial profile update.
 *
 * NOTE: `PUT /users/:userId` exists but the User model has no
 * `onboardingCompleted` field, so Joi strips it and the flag never persists
 * server-side. Callers must treat this as best-effort: the durable record of a
 * completed wizard is the local flag `AuthContext` maintains.
 */
export const updateMe = async (userId, patch) => {
  try {
    const { data } = await api.put(`/users/${userId}`, patch);
    return data.data?.user || data.user || data.data || data;
  } catch (error) {
    throw toApiError(error, 'Failed to save your profile.');
  }
};

export default { getMe, updateMe };
