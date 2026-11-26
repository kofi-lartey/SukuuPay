import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as campusApi from '../services/campusApi';

export const useCampuses = (schoolId) =>
  useQuery({
    queryKey: ['campuses', schoolId],
    queryFn: () => campusApi.getCampuses(schoolId),
    enabled: Boolean(schoolId),
    select: (r) => r?.data || r,
  });

export const useCreateCampus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => campusApi.createCampus(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campuses'] }),
  });
};

export const useUpdateCampus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => campusApi.updateCampus(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campuses'] }),
  });
};

export const useArchiveCampus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => campusApi.archiveCampus(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campuses'] }),
  });
};
