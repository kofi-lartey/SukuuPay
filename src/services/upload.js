import api from './api';
import { toApiError } from './toApiError';

/**
 * The one way a file leaves this app.
 *
 * **No `Content-Type` is set on any call below, and there is nothing left to add.**
 * A multipart content type is only valid with a boundary parameter, and the boundary
 * is generated while the body is encoded — a hand-written `multipart/form-data` has
 * none, and busboy then rejects the entire body. Every function here used to set one.
 * `services/api.js` now deletes the header for any `FormData` body, which is what
 * actually makes them work; the calls themselves stay silent so the rule lives in one
 * place.
 *
 * `field` matches the multer field name on the route — `upload/school-logo` and
 * `upload/student-photo` are both `.single("file")`, unlike the ad routes, which are
 * `.single("image")`. Getting that name wrong is invisible here and total on the
 * server: the file is simply not a file part, so `req.file` stays undefined.
 */
const asMultipart = (file, field = 'file', extra = {}) => {
  const form = new FormData();
  // Filename stated rather than derived from the blob. A `File` carries its own name
  // so this is not strictly required, but a nameless part is a field to multer rather
  // than a file, which is the one failure here that produces no error at all.
  form.append(field, file, file.name);
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
      { timeout: 60000 }
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
      { timeout: 60000 }
    );
    return data?.data?.url || data?.url || null;
  } catch (error) {
    throw toApiError(error, 'The photo could not be uploaded.');
  }
};

export default { uploadSchoolLogo, uploadStudentPhoto };
