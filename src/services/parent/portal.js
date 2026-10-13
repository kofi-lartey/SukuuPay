import apiClient from './apiClient';

/**
 * The one call every parent page needs.
 *
 * `GET /pay/:token` returns the student, school, and the parent's unread
 * counters. Every page reads this via `useParentPay()`, which caches it at
 * the layout level — a parent navigating between Fees and Attendance does
 * not re-fetch the student.
 */
export const fetchPortalContext = (token) =>
  apiClient.get(`/pay/${encodeURIComponent(token)}`);
