import { useQuery } from '@tanstack/react-query';
import { fetchMyClasses } from '../../services/teacher/classes';

/**
 * The classes this teacher is responsible for.
 *
 * The most-shared query in the portal — the dashboard counts from it, the
 * attendance and grades pages offer it as a picker — so it is cached hard
 * (`staleTime` of five minutes) rather than refetched on every mount. A
 * teacher's class list changes at the start of a term, not while they are
 * working, and a stale one costs nothing.
 *
 * `select` flattens the envelope to the array here rather than at each call
 * site, so no page has to remember whether it is `data.classes` or `data`.
 */
export const useMyClasses = () =>
  useQuery({
    queryKey: ['teacher', 'classes'],
    queryFn: fetchMyClasses,
    staleTime: 5 * 60 * 1000,
    select: (response) => response.data?.classes || [],
  });
