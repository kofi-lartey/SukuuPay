import { useQuery } from '@tanstack/react-query';
import { fetchRecords } from '../../services/parent/records';

export const useRecords = (token, { term } = {}) =>
  useQuery({
    queryKey: ['parent-records', token, term || 'current'],
    queryFn: () => fetchRecords(token, { term }),
    enabled: Boolean(token),
    staleTime: 2 * 60 * 1000,
    select: (response) => response.data,
  });
