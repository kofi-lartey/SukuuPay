import api from './api';

export const getCampuses = async (schoolId, params = {}) =>
  api.get('/v2/campuses', { params: { schoolId, ...params } }).then((r) => r.data);
export const createCampus = async (data) => api.post('/v2/campuses', data).then((r) => r.data);
export const updateCampus = async (id, data) => api.put(`/v2/campuses/${id}`, data).then((r) => r.data);
export const archiveCampus = async (id) => api.delete(`/v2/campuses/${id}`).then((r) => r.data);
