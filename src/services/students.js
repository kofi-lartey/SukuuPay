import api from './api';
import { toApiError } from './toApiError';

const unwrapStudent = (data) => data?.data?.student || data?.student || data?.data || data;

/**
 * Single-student create. `POST /students/single` expects the same payload as
 * the bulk importer's per-row build: pesewas integers for money, a
 * `YYYY/YYYY` academic year and a non-past deadline.
 */
export const createStudent = async (payload) => {
  try {
    const { data } = await api.post('/students/single', payload);
    return unwrapStudent(data);
  } catch (error) {
    throw toApiError(error, 'Failed to add that student.');
  }
};

/**
 * Bulk roster import.
 *
 * `POST /students/bulk` is multipart; the file field is `file` and the
 * remaining fields are the import meta the schema accepts. Resolves to
 * `{ created, failed, errors, format }`.
 */
export const bulkImport = async (file, meta = {}) => {
  if (!file) throw new Error('No file selected.');

  const form = new FormData();
  form.append('file', file);
  Object.entries(meta).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      form.append(key, String(value));
    }
  });

  try {
    const { data } = await api.post('/students/bulk', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
      onUploadProgress: (event) => {
        if (!event.total) return;
        window.dispatchEvent(
          new CustomEvent('sukuupay:upload-progress', {
            detail: Math.round((event.loaded / event.total) * 100),
          })
        );
      },
    });
    return data.data || data;
  } catch (error) {
    throw toApiError(error, 'The roster could not be imported.');
  }
};

/** Roster preview for the SMS mock-up on the final step. */
export const listStudents = async (params = {}) => {
  try {
    const { data } = await api.get('/students', { params, timeout: 15000 });
    // `listStudentsController` returns `{ success, message, data, meta }`, where
    // `data` is a bare ARRAY of students — not an object with a `students` key.
    // `data.data?.students` therefore read `undefined` against the real API and
    // this function returned `[]` for every school: the dashboard showed no
    // students and Step 4's reminder preview showed no recipients.
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.students)) return data.students;
    if (Array.isArray(data)) return data;
    return [];
  } catch (error) {
    // A preview is decorative: never let it block the wizard.
    return [];
  }
};

export default { createStudent, bulkImport, listStudents };
