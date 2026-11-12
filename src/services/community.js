import api from './api';

export const createPost = async (payload) => api.post('/community/posts', payload);
export const createPoll = async (payload) => api.post('/community/posts/poll', payload);
export const listPosts = async (params = {}) => api.get('/community/posts', { params });
export const getPost = async (id) => api.get(`/community/posts/${id}`);
export const updatePost = async (id, payload) => api.put(`/community/posts/${id}/status`, payload);
export const bookmarkPost = async (id) => api.put(`/community/posts/${id}/bookmark`);
export const deletePost = async (id) => api.delete(`/community/posts/${id}`);

export const createComment = async (payload) => api.post(`/community/posts/${payload.postId}/comments`, payload);
export const listComments = async (postId, params = {}) => api.get(`/community/posts/${postId}/comments`, { params });
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
export const toggleClubMembership = async (id) => api.put(`/community/clubs/${id}/membership`);
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
