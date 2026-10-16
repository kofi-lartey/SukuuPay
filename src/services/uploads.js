import api from './api';
import { toApiError } from './toApiError';

/**
 * `POST /upload/avatar` — replaces the signed-in user's picture.
 *
 * multipart, so axios sets the boundary itself; the field name is `file`, which
 * is what `avatarUpload`'s `.single('file')` reads.
 *
 * There is no userId here and there must never be one. The server writes to
 * `req.user`, so the only picture this can change is the caller's own — the
 * one thing keeps a picture upload from being a way to edit somebody else's
 * profile. The route is authenticated and ungated for exactly that reason: a
 * profile picture belongs to the account, not to a school.
 *
 * The response carries the updated user, so the caller can put it straight into
 * `AuthContext` rather than re-reading `/auth/me` — a second request to learn
 * what the first one just changed.
 */
export const uploadAvatar = async (file) => {
  const form = new FormData();
  form.append('file', file, file.name);

  try {
    const { data } = await api.post('/upload/avatar', form);
    return { user: data.data?.user || data.user, avatar: data.data?.avatar || null };
  } catch (error) {
    throw toApiError(error, 'We could not upload that picture. Please try again.');
  }
};

/**
 * `DELETE /upload/avatar` — drops the picture and falls back to initials.
 *
 * Its own call rather than a flag through the POST, because "remove" is what
 * somebody does on a handset that is about to be handed to somebody else: the
 * last person's face should not be the first thing the next one sees.
 */
export const removeAvatar = async () => {
  try {
    const { data } = await api.delete('/upload/avatar');
    return { user: data.data?.user || data.user, avatar: null };
  } catch (error) {
    throw toApiError(error, 'We could not remove that picture. Please try again.');
  }
};

export default { uploadAvatar, removeAvatar };
