import { useQuery } from '@tanstack/react-query';
import { fetchPortalContext } from '../../services/parent/portal';

/**
 * The root query every page depends on.
 *
 * Cached by token, refreshed on window focus and reconnect so a parent who
 * switches to their banking app and back sees a balance that moved — and so
 * the bell badge does not stay dark for five minutes after a new notification
 * arrives. One minute stale is short enough that a parent opening the portal
 * is told about a payment that landed while they were away, and long enough
 * that navigating between Fees and Attendance does not re-fetch the student.
 */
export const useParentPortal = (token) =>
  useQuery({
    queryKey: ['parent-portal', token],
    queryFn: () => fetchPortalContext(token),
    enabled: Boolean(token),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    select: (response) => response.data,
  });
