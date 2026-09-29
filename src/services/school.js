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

export default { getSchool, updateSchool, updatePayoutAccount, verifyHubtel };
