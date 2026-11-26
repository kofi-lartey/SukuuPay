import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as financialBatchesApi from '../services/financialBatches';
import { useToast } from './useToast';

export const useBatches = (params = {}) =>
  useQuery({
    queryKey: ['financialBatches', params],
    queryFn: () => financialBatchesApi.getBatches(params),
    enabled: !!params.schoolId,
  });

export const useBatch = (id) =>
  useQuery({
    queryKey: ['financialBatch', id],
    queryFn: () => financialBatchesApi.getBatch(id),
    enabled: Boolean(id),
  });

export const useCreateBatch = () => {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (data) => financialBatchesApi.createBatch(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['financialBatches'] });
      toast.success('Disbursement batch created.');
    },
    onError: (err) => toast.error(err?.message || 'Failed to create batch.'),
  });
};

export const useSignBatch = () => {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (id) => financialBatchesApi.signBatch(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['financialBatches'] });
      qc.invalidateQueries({ queryKey: ['financialBatch'] });
      toast.success('Batch signed.');
    },
    onError: (err) => toast.error(err?.message || 'Failed to sign batch.'),
  });
};

export const useApproveBatch = () => {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (id) => financialBatchesApi.approveBatch(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['financialBatches'] });
      qc.invalidateQueries({ queryKey: ['financialBatch'] });
      toast.success('Batch approved.');
    },
    onError: (err) => toast.error(err?.message || 'Failed to approve batch.'),
  });
};

export const useRejectBatch = () => {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ id, reason }) => financialBatchesApi.rejectBatch(id, { reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['financialBatches'] });
      qc.invalidateQueries({ queryKey: ['financialBatch'] });
      toast.success('Batch rejected.');
    },
    onError: (err) => toast.error(err?.message || 'Failed to reject batch.'),
  });
};

export default {
  useBatches,
  useBatch,
  useCreateBatch,
  useSignBatch,
  useApproveBatch,
  useRejectBatch,
};
