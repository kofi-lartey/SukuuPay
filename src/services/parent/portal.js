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

/**
 * Verify the parent's PIN (derived from child's DOB).
 *
 * `POST /pay/:token/verify-pin` - Additional security factor for sensitive operations.
 *
 * @param {string} token - The pay token (STU-XXXXXXXX)
 * @param {string} pin - 8-digit PIN in DDMMYYYY format
 * @returns {Promise<Object>} Portal view with pinVerified flag
 */
export const verifyPin = (token, pin) =>
  apiClient.post(`/pay/${encodeURIComponent(token)}/verify-pin`, { pin });

/**
 * Parent login with child's date of birth and name.
 *
 * `POST /pay/login` - Returns a pay token if a student with the given DOB and matching name exists.
 *
 * @param {string} dateOfBirth - ISO date string (YYYY-MM-DD)
 * @param {string} studentName - Student's full name
 * @param {string} [phone] - Optional parent phone for additional verification
 * @returns {Promise<Object>} Token and student info
 */
export const loginWithDob = (dateOfBirth, studentName, phone) =>
  apiClient.post('/pay/login', { dateOfBirth, studentName, phone });
