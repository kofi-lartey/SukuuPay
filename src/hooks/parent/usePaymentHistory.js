import { useQuery } from '@tanstack/react-query';
import { fetchPaymentHistory } from '../../services/parent/payments';

export const usePaymentHistory = (token, { filter } = {}) =>
  useQuery({
    queryKey: ['parent-payments', token, filter || 'all'],
    queryFn: () => fetchPaymentHistory(token, { filter }),
    enabled: Boolean(token),
    select: (response) => response.data,
  });
