import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as reportsApi from '../services/reportsBuilder';
import { useToast } from './useToast';

export const useTemplates = (params = {}) =>
  useQuery({
    queryKey: ['reportTemplates', params],
    queryFn: () => reportsApi.getTemplates(params),
    enabled: !!params.schoolId,
  });

export const useJobs = (params = {}) =>
  useQuery({
    queryKey: ['reportJobs', params],
    queryFn: () => reportsApi.listJobs(params),
    enabled: !!params.schoolId,
  });

export const useJob = (id) =>
  useQuery({
    queryKey: ['reportJob', id],
    queryFn: () => reportsApi.getJob(id),
    enabled: Boolean(id),
    refetchInterval: (data) => (data?.status === 'queued' || data?.status === 'processing' ? 3000 : false),
  });

export const useCreateTemplate = () => {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (data) => reportsApi.createTemplate(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reportTemplates'] });
      toast.success('Report template created.');
    },
    onError: (err) => toast.error(err?.message || 'Failed to create template.'),
  });
};

export const useCreateJob = () => {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (data) => reportsApi.createJob(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reportJobs'] });
      toast.success('Export job queued.');
    },
    onError: (err) => toast.error(err?.message || 'Failed to queue export job.'),
  });
};

export default {
  useTemplates,
  useJobs,
  useJob,
  useCreateTemplate,
  useCreateJob,
};
