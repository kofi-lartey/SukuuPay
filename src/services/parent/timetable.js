import apiClient from './apiClient';

/**
 * Weekly timetable for the student's class.
 *
 * `weekOf` is an ISO date; the server returns the schedule for the week
 * that contains it. Omitting `weekOf` returns the current week.
 */
export const fetchTimetable = (token, { weekOf } = {}) =>
  apiClient.get(`/pay/${encodeURIComponent(token)}/timetable`, {
    params: weekOf ? { weekOf } : undefined,
  });
