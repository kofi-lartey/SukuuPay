import { useQuery } from '@tanstack/react-query';
import { fetchAttendance } from '../../services/parent/attendance';

export const useAttendance = (token, { term } = {}) =>
  useQuery({
    queryKey: ['parent-attendance', token, term || 'current'],
    queryFn: () => fetchAttendance(token, { term }),
    enabled: Boolean(token),
    staleTime: 2 * 60 * 1000,
    select: (response) => response.data,
  });
