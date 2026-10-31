import { useQuery } from '@tanstack/react-query';
import { getStudentOverview } from '../services/student';

export const useStudentDashboard = (enabled = true) =>
  useQuery({
    queryKey: ['student-dashboard'],
    queryFn: () => getStudentOverview(),
    enabled,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
    select: (response) => response?.data?.data || response?.data || null,
  });
