import api from './api';

export const createPost = async (payload) => api.post('/community/posts', payload);
export const createPoll = async (payload) => api.post('/community/posts/poll', payload);
export const listPosts = async (params = {}) => api.get('/community/posts', { params });

/**
 * Returns the club's chat thread, creating it only if the server has none.
 *
 * Replaces a client-side "list the club's posts, then create if absent", which is
 * a read followed by a write and therefore not safe: two mounts in the same second
 * both saw no thread and both created one. The server holds the unique index and
 * resolves the race, so this is one call and cannot produce a duplicate.
 */
export const ensureClubChat = async (clubId) => {
  const { data } = await api.post(`/community/clubs/${clubId}/chat`);
  return data.data || data;
};
export const getPost = async (id) => api.get(`/community/posts/${id}`);
export const updatePost = async (id, payload) => api.put(`/community/posts/${id}/status`, payload);
export const bookmarkPost = async (id) => api.put(`/community/posts/${id}/bookmark`);
export const deletePost = async (id) => api.delete(`/community/posts/${id}`);

export const createComment = async (payload) => api.post(`/community/posts/${payload.postId}/comments`, payload);
export const listComments = async (postId, params = {}) => api.get(`/community/posts/${postId}/comments`, { params });
export const updateComment = async (commentId, body) => api.patch(`/community/comments/${commentId}`, { body });

/**
 * Preview card for a link, resolved server-side.
 *
 * The browser cannot read another origin's Open Graph tags without CORS, so the
 * card has to be fetched by the server. Called on a debounce while typing; the
 * authoritative preview is re-derived when the message is stored, so this cannot be
 * used to post a card the server would not have produced.
 *
 * Resolves to `null` for a link the server will not or cannot preview — an
 * unpreviewable link is not an error the composer should report.
 */
export const fetchLinkPreview = async (url) => {
  try {
    const { data } = await api.post('/community/link-preview', { url });
    return data.data || null;
  } catch {
    return null;
  }
};

/**
 * Uploads one attachment and returns the `media[]` entry to attach to a post or comment.
 *
 * Two steps rather than one multipart request: the server validates the file's own
 * bytes before anything is persisted (see `Backend/src/services/communityUpload.service.js`),
 * and a multipart comment body has to be validated by a schema that cannot see
 * `req.file` — the same trap the parent voice-note path fell into.
 *
 * `api.js` deletes `Content-Type` for a `FormData` body so the browser can write
 * the multipart boundary; this is the only thing this call has to get right.
 */
export const uploadCommunityFile = async (file) => {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post('/community/upload', form);
  return data.data || data;
};
export const listCommentReplies = async (postId, commentId, params = {}) => api.get(`/community/posts/${postId}/comments/${commentId}/replies`, { params });
export const acceptAnswer = async (postId, commentId) => api.put(`/community/posts/${postId}/comments/${commentId}/accept`);
export const deleteComment = async (postId, commentId) => api.delete(`/community/posts/${postId}/comments/${commentId}`);

export const addReaction = async (payload) => api.post('/community/reactions', payload);
export const listReactions = async (targetId, targetType) => api.get(`/community/reactions/${targetType}/${targetId}`);
export const getReactionCount = async (targetId, targetType) => api.get(`/community/reactions/${targetType}/${targetId}/count`);
export const removeReaction = async (targetId, targetType) => api.delete(`/community/reactions/${targetType}/${targetId}`);

export const createClub = async (payload) => api.post('/community/clubs', payload);
export const listClubs = async (params = {}) => api.get('/community/clubs', { params });
export const getClub = async (id) => api.get(`/community/clubs/${id}`);
export const updateClub = async (id, payload) => api.put(`/community/clubs/${id}`, payload);
export const toggleClubMembership = async (id, password) => api.put(`/community/clubs/${id}/membership`, { password });
export const deleteClub = async (id) => api.delete(`/community/clubs/${id}`);

export const getGamification = async () => api.get('/community/gamification');
export const getReactionCountsForPost = async (postId) => api.get(`/community/posts/${postId}/reactions`);
export const getReactionCountsForComment = async (commentId) => api.get(`/community/comments/${commentId}/reactions`);

export const createEvent = async (payload) => api.post('/community/events', payload);
export const listEvents = async (params = {}) => api.get('/community/events', { params });
export const getEvent = async (id) => api.get('/community/events/' + id);
export const updateEvent = async (id, payload) => api.put('/community/events/' + id, payload);
export const rsvpEvent = async (id) => api.put('/community/events/' + id + '/rsvp');
export const deleteEvent = async (id) => api.delete('/community/events/' + id);

/** Who is online in the caller's school. Live changes arrive over the socket. */
export const getPresence = async () => {
  const { data } = await api.get('/community/presence');
  return data.data?.userIds || [];
};

/** Resolved club members, plus the total and student counts for the header. */
export const getClubMembers = async (clubId) => {
  const { data } = await api.get(`/community/clubs/${clubId}/members`);
  return data.data;
};