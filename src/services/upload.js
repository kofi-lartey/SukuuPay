import api from './api';
import { toApiError } from './toApiError';

const asMultipart = (file, field = 'file', extra = {}) => {
  const form = new FormData();
  form.append(field, file);
  Object.entries(extra).forEach(([key, value]) => {
    if (value !== undefined && value !== null) form.append(key, String(value));
  });
  return form;
};

const readLogoUrl = (data) =>
  data?.data?.url || data?.data?.logo || data?.url || data?.logo || data?.secure_url || null;

/** `POST /upload/school-logo` — persists the logo on the school. */
export const uploadSchoolLogo = async (file, schoolId) => {
  try {
    const { data } = await api.post(
      '/upload/school-logo',
      asMultipart(file, 'file', schoolId ? { schoolId } : {}),
      { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 }
    );
    return readLogoUrl(data);
  } catch (error) {
    throw toApiError(error, 'The logo could not be uploaded.');
  }
};

export const uploadStudentPhoto = async (file, studentId) => {
  try {
    const { data } = await api.post(
      '/upload/student-photo',
      asMultipart(file, 'file', { studentId }),
      { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 }
    );
    return data?.data?.url || data?.url || null;
  } catch (error) {
    throw toApiError(error, 'The photo could not be uploaded.');
  }
};

export default { uploadSchoolLogo, uploadStudentPhoto };
