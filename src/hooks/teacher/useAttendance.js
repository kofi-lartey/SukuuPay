import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchAttendanceForDate,
  fetchClassRoster,
  markAttendanceBulk,
  autoMarkPresent,
  fetchStudentAttendance,
} from '../../services/teacher/attendance';

/**
 * Attendance reads.
 *
 * Both are keyed by class *and* date, and both are `enabled`-gated on their
 * arguments rather than firing with `undefined`. `useClassRoster('')` would
 * otherwise ask the server for the roster of a class with no name and surface
 * a 422 as an error banner over an empty state, on the first paint of every
 * page that has not picked a class yet.
 */
export const useClassRoster = (className) =>
  useQuery({
    queryKey: ['teacher', 'roster', className],
    queryFn: () => fetchClassRoster(className),
    enabled: Boolean(className),
    select: (response) => response.data?.students || [],
  });

export const useAttendanceForDate = (className, date) =>
  useQuery({
    queryKey: ['teacher', 'attendance', className, date],
    queryFn: () => fetchAttendanceForDate(className, date),
    enabled: Boolean(className && date),
    select: (response) => response.data?.marks || [],
  });

/**
 * Saves a whole class's marks in one call.
 *
 * `variables` — not the input date — is what the invalidation is keyed from,
 * so the query that is refetched is the one that was just written. The
 * dashboard is invalidated too: its "attendance pending" count is derived from
 * absence, and a save is exactly what clears it.
 */
export const useMarkAttendanceBulk = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markAttendanceBulk,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['teacher', 'attendance', variables.className, variables.date],
      });
      queryClient.invalidateQueries({ queryKey: ['teacher', 'dashboard'] });
    },
  });
};

/**
 * "Mark everyone present", server-side.
 *
 * No invalidation here on purpose: the shift roster is still dirty on the
 * client, so the refetch this triggers would replace the teacher's unsubmitted
 * edits with the server's answer. `TakeAttendance` calls `refetch` itself
 * once the row has been rebuilt from the response.
 */
export const useAutoMarkPresent = () =>
  useMutation({ mutationFn: autoMarkPresent });

export const useStudentAttendance = (studentId, { term } = {}) =>
  useQuery({
    queryKey: ['teacher', 'student-attendance', studentId, term || 'current'],
    queryFn: () => fetchStudentAttendance(studentId, { term }),
    enabled: Boolean(studentId),
    select: (response) => response.data,
  });
