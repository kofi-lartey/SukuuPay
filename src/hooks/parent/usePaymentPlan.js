import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchPaymentPlan,
  requestPaymentPlan,
  cancelPaymentPlan,
} from '../../services/parent/payments';

export const usePaymentPlan = (token) =>
  useQuery({
    queryKey: ['parent-plan', token],
    queryFn: () => fetchPaymentPlan(token),
    enabled: Boolean(token),
    select: (response) => response.data,
  });

export const useRequestPaymentPlan = (token) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => requestPaymentPlan(token, payload),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['parent-plan', token] }),
  });
};

export const useCancelPaymentPlan = (token) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => cancelPaymentPlan(token, payload),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['parent-plan', token] }),
  });
};
