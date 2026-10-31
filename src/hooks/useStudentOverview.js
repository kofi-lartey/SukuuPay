import { useQuery } from '@tanstack/react-query';
import { getStudentOverview } from '../services/student';

/**
 * React Query wrapper for the student overview payload.
 *
 * Returns the normalized `data` (the DTO) via `select`, so consumers never
 * have to unwrap the axios envelope. Disabled when there is no student session.
 */
export const useStudentOverview = (enabled = true) =>
  useQuery({
    queryKey: ['student-overview'],
    queryFn: () => getStudentOverview(),
    enabled,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
    select: (response) => response?.data?.data || response?.data || null,
  });