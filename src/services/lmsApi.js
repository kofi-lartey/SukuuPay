import api from './api';

/**
 * LMS content access for the multi-campus tier.
 *
 * Every endpoint is school-scoped through the auth middleware; the
 * `campusId` query param narrows results to one campus, and `sharingScope`
 * records whether the item is school-wide or campus-specific.
 */

/** `GET /teacher/lms/items` — list LMS items, optionally filtered by campus. */
export const getLmsItems = (params = {}) =>
  api.get('/teacher/lms/items', { params });

/** `GET /teacher/lms/items/:id` — fetch a single LMS item. */
export const getLmsItem = (id) =>
  api.get(`/teacher/lms/items/${encodeURIComponent(id)}`);

/** `POST /teacher/lms/items` — create a new LMS item. */
export const createLmsItem = (data) =>
  api.post('/teacher/lms/items', data);

/** `PUT /teacher/lms/items/:id` — update an existing LMS item. */
export const updateLmsItem = (id, data) =>
  api.put(`/teacher/lms/items/${encodeURIComponent(id)}`, data);

/** `DELETE /teacher/lms/items/:id` — delete an existing LMS item. */
export const deleteLmsItem = (id) =>
  api.delete(`/teacher/lms/items/${encodeURIComponent(id)}`);

/** `GET /v2/campuses` — list the school's campuses for the dropdown. */
export const getCampuses = (schoolId, params = {}) =>
  api.get('/v2/campuses', { params: { schoolId, ...params } });

/** `GET /teacher/lms/analytics` — LMS analytics for the Growth plan. */
export const getLmsAnalytics = (params = {}) =>
  api.get('/teacher/lms/analytics', { params });