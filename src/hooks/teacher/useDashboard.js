import { useQuery } from '@tanstack/react-query';
import { fetchDashboard, fetchMySchedule } from '../../services/teacher/classes';

/**
 * The dashboard payload, and the week's schedule as its own query.
 *
 * Two queries rather than one because they age differently: the dashboard
 * carries "attendance pending today", which is wrong the moment a class is
 * marked, so it is fresh for a minute; the timetable is fixed for the term and
 * is cached for five. Folding the schedule into the dashboard payload would
 * mean either re-fetching a constant or showing a stale attendance count.
 *
 * `refetchOnWindowFocus` is left at the app default (false) — a teacher who
 * switches to their register app and back should not watch the pending count
 * move under them.
 */
export const useTeacherDashboard = () =>
  useQuery({
    queryKey: ['teacher', 'dashboard'],
    queryFn: fetchDashboard,
    staleTime: 60 * 1000,
    select: (response) => response.data,
  });

export const useMySchedule = () =>
  useQuery({
    queryKey: ['teacher', 'schedule'],
    queryFn: fetchMySchedule,
    staleTime: 5 * 60 * 1000,
    refetchOnMount: true,
    select: (response) => response.data?.schedule || [],
  });
