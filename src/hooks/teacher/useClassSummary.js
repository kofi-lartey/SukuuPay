import { useQuery } from '@tanstack/react-query';
import { fetchClassSummary } from '../../services/teacher/classes';

/**
 * One class's headline figures for the term.
 *
 * Keyed by class *and* term, because the term selector on `ClassDetail` is the
 * whole point of the numbers: an average for Term 1 shown under a Term 3 tab
 * is worse than no number at all, since a teacher will quote it to a parent.
 */
export const useClassSummary = (className, { term } = {}) =>
  useQuery({
    queryKey: ['teacher', 'class-summary', className, term],
    queryFn: () => fetchClassSummary(className, { term }),
    enabled: Boolean(className),
    select: (response) => response.data,
  });
