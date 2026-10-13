import { useQuery } from '@tanstack/react-query';
import { fetchPortalContext } from '../../services/parent/portal';

/**
 * The root query every page depends on.
 *
 * Cached by token, never stale within a session. The layout reads this once
 * and every child page gets the same student, school, and unread count
 * without re-fetching.
 */
export const useParentPortal = (token) =>
  useQuery({
    queryKey: ['parent-portal', token],
    queryFn: () => fetchPortalContext(token),
    enabled: Boolean(token),
    staleTime: 5 * 60 * 1000,
    select: (response) => response.data,
  });
