import api from './api';
import { toApiError } from './toApiError';

export const searchSchoolDirectory = async ({ q, region, district, limit = 20 }) => {
  try {
    const params = { q };
    if (region) params.region = region;
    if (district) params.district = district;
    if (limit) params.limit = limit;
    const { data } = await api.get('/schools/directory/search', { params });
    return data.data || [];
  } catch (error) {
    throw toApiError(error, 'Failed to search school directory.');
  }
};

export const linkDirectoryMatch = async (schoolId, payload) => {
  try {
    const { data } = await api.post(`/schools/${schoolId}/verification/link-directory`, payload);
    return data.data || data;
  } catch (error) {
    throw toApiError(error, 'Failed to link directory match.');
  }
};

export const uploadVerificationDocument = async (schoolId, documentType, file) => {
  try {
    const form = new FormData();
    form.append('document', file, file.name);
    form.append('documentType', documentType);
    const { data } = await api.post(`/schools/${schoolId}/verification/documents`, form, {
      timeout: 60000,
    });
    return data.data || data;
  } catch (error) {
    throw toApiError(error, 'Failed to upload verification document.');
  }
};

export const getVerificationStatus = async (schoolId) => {
  try {
    const { data } = await api.get(`/schools/${schoolId}/verification/status`);
    return data.data || {};
  } catch (error) {
    throw toApiError(error, 'Failed to get verification status.');
  }
};

export const adminVerifySchool = async (schoolId, { decision, rejectionReason }) => {
  try {
    const { data } = await api.patch(`/admin/schools/${schoolId}/verify`, {
      decision,
      rejectionReason,
    });
    return data.data || data;
  } catch (error) {
    throw toApiError(error, 'Failed to verify school.');
  }
};

export default {
  searchSchoolDirectory,
  linkDirectoryMatch,
  uploadVerificationDocument,
  getVerificationStatus,
  adminVerifySchool,
};