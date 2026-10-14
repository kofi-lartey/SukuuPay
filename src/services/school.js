import api from './api';
import { toApiError } from './toApiError';

export const getSchool = async (schoolId) => {
  try {
    const { data } = await api.get(`/schools/${schoolId}`);
    return data.data?.school || data.school || data.data || data;
  } catch (error) {
    throw toApiError(error, 'Failed to load your school.');
  }
};

/**
 * PATCH-equivalent update. The backend's `updateSchoolSchema` already accepts
 * exactly the Step 1 field set (name, type, motto, yearFounded, phone, email,
 * website, address, city, region, gpsAddress) and strips everything else, so
 * the caller must not expect unlisted keys to persist.
 */
export const updateSchool = async (schoolId, payload) => {
  try {
    const { data } = await api.put(`/schools/${schoolId}`, payload);
    return data.data?.school || data.school || data.data || data;
  } catch (error) {
    throw toApiError(error, 'Failed to save your school details.');
  }
};

/**
 * Save the school's class list.
 *
 * **The key must be the flattened dotted string, not a nested object.**
 * `updateSchoolSchema` declares `"academic.classes"` as a Joi path, and Joi
 * matches that path against a *literal* dotted key in the body. Sending
 * `{ academic: { classes } }` does not reach it: `stripUnknown` drops `academic`
 * wholesale, the schema is left with zero keys, and `.min(1)` turns the request
 * into a 422 `value must have at least 1 key`. The flat form round-trips intact.
 *
 * The flattened form is also the only safe one. `updateSchool` routes dotted
 * keys through `NESTED_PATHS` and assigns `school.academic.classes = value`,
 * so a nested object — had it survived validation — would have replaced the
 * whole `academic` subdocument and silently dropped `currentTerm`,
 * `currentYear`, `termsPerYear`, `gradingSystem` and `finalYearClasses`.
 */
export const updateSchoolClasses = async (schoolId, classes) => {
  try {
    const { data } = await api.put(`/schools/${schoolId}`, {
      'academic.classes': classes,
    });
    return data.data?.school || data.school || data.data || data;
  } catch (error) {
    throw toApiError(error, 'Failed to save your class list.');
  }
};

/**
 * Settlement account.
 *
 * NOTE: the School model has `payment.bankAccount` but no route currently
 * writes it — `PUT /schools/:id` strips the key and there is no payout
 * endpoint. `updatePayoutAccount` attempts the two most plausible shapes and
 * reports honestly when neither is accepted, so the wizard never claims a save
 * the server did not perform.
 */
export const updatePayoutAccount = async (schoolId, payout) => {
  try {
    const { data } = await api.put(`/schools/${schoolId}/payout`, {
      bankAccount: payout,
    });
    return data.data?.school || data.school || data;
  } catch (error) {
    const status = error?.response?.status;
    // 404/405 mean the route is absent; 422 means the body was stripped by the
    // update schema. Both are "not persisted", never "saved with an error".
    if (status === 404 || status === 405 || status === 422) {
      const notSupported = toApiError(error, 'Settlement account could not be saved.');
      notSupported.code = 'PAYOUT_NOT_SUPPORTED';
      notSupported.status = status;
      throw notSupported;
    }
    throw toApiError(error, 'Failed to save your settlement account.');
  }
};

/**
 * Hubtel credential check.
 *
 * NOTE: there is no `/schools/:id/verify-hubtel` route on the API yet. This
 * throws `HUBTEL_VERIFY_NOT_SUPPORTED` so the step can say so plainly instead
 * of showing a fake "Verified" badge.
 */
export const verifyHubtel = async (schoolId, credentials) => {
  try {
    const { data } = await api.post(`/schools/${schoolId}/verify-hubtel`, credentials);
    return data;
  } catch (error) {
    const status = error?.response?.status;
    if (status === 404 || status === 405) {
      const notSupported = new Error(
        'Hubtel credential verification is not available on the API yet.'
      );
      notSupported.status = status;
      notSupported.code = 'HUBTEL_VERIFY_NOT_SUPPORTED';
      throw notSupported;
    }
    throw toApiError(error, 'Hubtel rejected those credentials.');
  }
};

/**
 * `POST /schools/me` — create the signed-in admin's own school and link them to
 * it. The endpoint that replaced the "not linked, contact support" dead end.
 *
 * Idempotent server-side: a replayed submit returns `200` with the existing
 * school rather than `409`, so a double-clicked Continue is harmless.
 *
 * `409 SCHOOL_ALREADY_REGISTERED` is the one failure worth branching on. It
 * means the email belongs to a School that already exists — a second bursar of a
 * school someone else registered — and the only route forward is
 * `joinSchoolByCode`, so the error carries that code for the caller to switch on.
 */
export const provisionMySchool = async (payload) => {
  try {
    const { data } = await api.post('/schools/me', payload);
    return {
      // The real controller responds `{ success, message, data: school, user }`,
      // so `data.data` is the school itself. The `?.school` hop covers a
      // wrapper that nests it one level deeper, which is the shape the mock
      // adapter produces — both resolve to the school record here.
      school: data.data?.school || data.data || data.school || data,
      // Returned alongside so the caller can swap the identity into AuthContext
      // without a follow-up `/auth/me` just to learn a `schoolId` this response
      // already contains.
      user: data.user,
    };
  } catch (error) {
    throw toApiError(error, 'We could not create your school. Please try again.');
  }
};

/**
 * `POST /schools/join` — ask to join a school that already exists.
 *
 * A `202` is success, not a failure: the school code identifies the school, it
 * does not authenticate the applicant, so an existing admin of that school has
 * to approve before access is granted. `INVALID_SCHOOL_CODE` is the only
 * rejection the applicant can act on alone.
 */
export const joinSchoolByCode = async ({ schoolCode, applicantName, applicantPosition }) => {
  try {
    const { data } = await api.post('/schools/join', {
      schoolCode,
      applicantName,
      applicantPosition,
    });
    return data.data || data;
  } catch (error) {
    throw toApiError(error, 'We could not send your request. Please try again.');
  }
};

/**
 * `GET /schools/join-requests` — the approval queue for the signed-in school
 * admin's own school.
 *
 * The server scopes it to the caller's `schoolId` and refuses every role except
 * `school_admin` (and the platform owner), so there is no school id to pass and
 * no way to ask about another school's applicants. `userId` is populated by the
 * server — name, email, position, role — because the deciding admin needs to
 * know *who* applied before granting them full access.
 */
export const listJoinRequests = async () => {
  try {
    const { data } = await api.get('/schools/join-requests');
    return data.data || [];
  } catch (error) {
    throw toApiError(error, 'We could not load the access requests for your school.');
  }
};

/**
 * `PUT /schools/join-requests/:requestId` — the decision.
 *
 * `'approved'` links the applicant to the school in the same server-side
 * transaction that flips the request, so an approval is never recorded without
 * the access it promises. `409 ALREADY_DECIDED` means somebody else handled it
 * first — expected on a shared admin desk, and the caller only has to re-read
 * the queue.
 */
export const decideJoinRequest = async (requestId, decision, note) => {
  try {
    const { data } = await api.put(`/schools/join-requests/${requestId}`, {
      decision,
      note,
    });
    return data.data || data;
  } catch (error) {
    throw toApiError(error, 'We could not record that decision. Please try again.');
  }
};

export default {
  getSchool,
  updateSchool,
  updateSchoolClasses,
  provisionMySchool,
  joinSchoolByCode,
  listJoinRequests,
  decideJoinRequest,
  updatePayoutAccount,
  verifyHubtel,
};
