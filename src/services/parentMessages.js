import api from './api';
import { toApiError } from './toApiError';

/**
 * The school's parent-message inbox client.
 *
 * Separate from `services/sms.js` and `services/admin.js` because this is the *school*
 * console, not the platform console: every call is scoped to the signed-in user's own
 * school by the server, and none of them accept a `schoolId` from the client. The
 * `schoolId` parameter the service layer accepts exists solely for `super_admin`,
 * who has none of their own.
 */

/** Reads the page plus the tab counts from one response — the server sends both. */
export const listParentMessages = async ({
  page = 1,
  perPage = 20,
  status = 'all',
  q = '',
  hasAudio = '',
} = {}) => {
  try {
    const { data } = await api.get('/parent-messages', {
      params: {
        page,
        perPage,
        status: status || undefined,
        q: q || undefined,
        hasAudio: hasAudio || undefined,
      },
    });

    return {
      rows: Array.isArray(data?.data) ? data.data : [],
      meta: {
        page: Number(data?.meta?.page) || 1,
        perPage: Number(data?.meta?.perPage) || perPage,
        total: Number(data?.meta?.total) || 0,
        totalPages: Math.max(1, Number(data?.meta?.totalPages) || 1),
      },
      counts: data?.counts || { all: 0, new: 0, read: 0, resolved: 0, archived: 0 },
    };
  } catch (error) {
    throw toApiError(error, 'Parent messages could not be loaded.');
  }
};

export const getParentMessage = async (messageId) => {
  try {
    const { data } = await api.get(`/parent-messages/${messageId}`);
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, 'That message could not be opened.');
  }
};

/** The thread on one student, oldest first. Shown from the roster drawer. */
export const listStudentMessages = async (studentId, { page = 1, perPage = 20 } = {}) => {
  try {
    const { data } = await api.get(`/parent-messages/student/${studentId}`, {
      params: { page, perPage },
    });
    return {
      rows: Array.isArray(data?.data) ? data.data : [],
      meta: {
        page: Number(data?.meta?.page) || 1,
        perPage: Number(data?.meta?.perPage) || perPage,
        total: Number(data?.meta?.total) || 0,
        totalPages: Math.max(1, Number(data?.meta?.totalPages) || 1),
      },
    };
  } catch (error) {
    throw toApiError(error, 'This student’s messages could not be loaded.');
  }
};

export const markParentMessageRead = async (messageId) => {
  try {
    const { data } = await api.put(`/parent-messages/${messageId}/read`);
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, 'That message could not be marked as read.');
  }
};

export const resolveParentMessage = async (messageId, resolutionNote) => {
  try {
    const { data } = await api.put(`/parent-messages/${messageId}/resolve`, { resolutionNote });
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, 'That message could not be resolved.');
  }
};

/** `0` → `0:07`. Matches `components/parent/AudioRecorder.jsx`, deliberately. */
export const formatDuration = (seconds) => {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

/** A relative "2h ago" for the list. */
export const messageAge = (iso) => {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};