import { useQuery } from '@tanstack/react-query';
import { fetchTimetable } from '../../services/parent/timetable';

export const useTimetable = (token, { weekOf } = {}) =>
  useQuery({
    queryKey: ['parent-timetable', token, weekOf || 'current'],
    queryFn: () => fetchTimetable(token, { weekOf }),
    enabled: Boolean(token),
    staleTime: 10 * 60 * 1000,
    select: (response) => response.data,
  });
