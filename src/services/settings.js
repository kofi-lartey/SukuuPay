import api from './api';
import { toApiError } from './toApiError';
import { updateSchool } from './school';

/**
 * The Settings module's five endpoints, plus the one it borrows from `school.js`.
 *
 * There is no `settings.js`-shaped store behind this page. The write surface is
 * split across three different resources with three different validation
 * schemas, and the split is not tidy — it is what the backend happens to be:
 *
 *   School identity   →  PUT /schools/:id                (updateSchoolSchema)
 *   Brand + academic  →  PUT /settings/:id              (updateSettingsSchema)
 *   Year + term       →  PUT /settings/:id/academic-year
 *   Notifications     →  PUT /settings/:id/notifications
 *
 * So "Save" on this page is genuinely several requests with different rules, and
 * a school admin who edits the legal name and the motto presses one button to
 * send two. `updateProfile` and `updateGeneral` below are separate exports
 * precisely so the page can save one region without touching the other, which is
 * also why it does not offer a single global "Save All Changes" button.
 *
 * Three regions are read-only, and this module does not pretend otherwise:
 *
 *   Payment & gateway — `payment.gatewayMode`, `platformMarkupPercent` and
 *     `networksEnabled` are returned by the GET but no endpoint writes them. The
 *     `markup.update` and `gateway_mode.update` audit actions exist in the enum
 *     and nothing emits them.
 *   SMS & sender ID  — `sms.provider` and `sms.senderId` are returned; nothing
 *     writes them.
 *   Billing          — subscription and usage are computed, `invoices` is a hard
 *     `[]`, and `usage.storageUsedMB` is a hard `0`.
 *
 * Rendering those as disabled form fields with a stated reason is honest.
 * Rendering them as editable would produce a 422 the moment anyone tried.
 */

/** `GET /settings/:schoolId` — everything the page renders. */
export const getSettings = async (schoolId) => {
  try {
    const { data } = await api.get(`/settings/${schoolId}`);
    return data.data || {};
  } catch (error) {
    throw toApiError(error, 'Could not load your school settings.');
  }
};

/**
 * School identity fields, via the school resource rather than settings.
 *
 * `name`, `type`, `phone`, `email`, `website`, `address`, `city`, `region`,
 * `motto`, `yearFounded`, `gpsAddress` and `brandColor` are all in
 * `updateSchoolSchema`. Everything is `.optional()` there, so this sends only
 * what actually changed — a PUT with the whole form would rewrite every field
 * and trip the `.min(1)` that exists to reject an empty save.
 */
export const updateProfile = async (schoolId, patch) => {
  try {
    const { data } = await api.put(`/schools/${schoolId}`, patch);
    return data.data || data.school || {};
  } catch (error) {
    throw toApiError(error, 'Could not save the school profile.');
  }
};

/**
 * Branding and academic extras that only settings accepts.
 *
 * `brandColor`, `motto`, `yearFounded`, `website`, `gpsAddress`, `classes`,
 * `termsPerYear`, `gradingSystem`. This is where the class list is written — it
 * is the field the Students roster's class selector reads, so an edit here
 * changes what every other module's dropdown offers.
 */
export const updateGeneral = async (schoolId, patch) => {
  try {
    const { data } = await api.put(`/settings/${schoolId}`, patch);
    return data.data || {};
  } catch (error) {
    throw toApiError(error, 'Could not save those settings.');
  }
};

/**
 * `PUT /settings/:schoolId/academic-year`
 *
 * `currentYear` must match `YYYY/YYYY` with consecutive years and `currentTerm`
 * must be one of `Term 1`…`Term 3`. Both are `required`, and `termsPerYear`
 * defaults to 3 server-side, so a partial body is a 422 rather than a partial
 * write.
 *
 * This is the most consequential save on the page: the term is what every
 * report, plan and deadline in the system is measured against, which is why the
 * page confirms it rather than writing it quietly.
 */
export const updateAcademicYear = async (schoolId, payload) => {
  try {
    const { data } = await api.put(`/settings/${schoolId}/academic-year`, payload);
    return data.data || {};
  } catch (error) {
    throw toApiError(error, 'Could not set the academic year and term.');
  }
};

/** `PUT /settings/:schoolId/notifications` — all three flags are required. */
export const updateNotifications = async (schoolId, prefs) => {
  try {
    const { data } = await api.put(`/settings/${schoolId}/notifications`, prefs);
    return data.data || {};
  } catch (error) {
    throw toApiError(error, 'Could not save notification preferences.');
  }
};

/** `GET /settings/:schoolId/billing` — read-only, and honestly partial. */
export const getBilling = async (schoolId) => {
  try {
    const { data } = await api.get(`/settings/${schoolId}/billing`);
    return data.data || {};
  } catch (error) {
    throw toApiError(error, 'Could not load billing information.');
  }
};

/** `PUT /schools/:schoolId/logo` — multipart, outside `updateSchool`'s JSON. */
export const uploadSchoolLogo = async (schoolId, file) => {
  try {
    const body = new FormData();
    body.append('logo', file);
    const { data } = await api.put(`/schools/${schoolId}/logo`, body, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data.data || data.school || {};
  } catch (error) {
    throw toApiError(error, 'Could not upload that logo.');
  }
};

/**
 * `PUT /schools/:schoolId/stamp` — the institutional seal.
 *
 * `authorize("super_admin")` on the route. A school admin therefore *cannot*
 * upload one, however much the design shows a "Change Logo" button beside it. The
 * page renders the seal read-only for anyone who is not a super admin and says
 * why, rather than offering a control that is guaranteed to 403.
 */
export const uploadSchoolStamp = async (schoolId, file) => {
  try {
    const body = new FormData();
    body.append('stamp', file);
    const { data } = await api.put(`/schools/${schoolId}/stamp`, body, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data.data || data.school || {};
  } catch (error) {
    throw toApiError(error, 'Could not upload that seal.');
  }
};

/** The `School.type` enum, from `createSchoolSchema`. */
export const SCHOOL_TYPES = [
  { value: 'public', label: 'Public Basic & JHS' },
  { value: 'private', label: 'Private Basic & JHS (Co-educational)' },
  { value: 'international', label: 'International' },
  { value: 'mission', label: 'Mission / Church-based' },
  { value: 'charter', label: 'Charter' },
];

/**
 * The `region` enum. Ghana's 16 regions, which is what `updateSchoolSchema`
 * validates `region` against — sending anything else is a 422.
 */
export const GHANA_REGIONS = [
  'Ahafo', 'Ashanti', 'Bono', 'Bono East', 'Central', 'Eastern', 'Greater Accra',
  'North East', 'Northern', 'Oti', 'Savannah', 'Upper East', 'Upper West',
  'Volta', 'Western', 'Western North',
];

/** `updateAcademicYearSchema`'s term enum. */
export const ACADEMIC_TERMS = ['Term 1', 'Term 2', 'Term 3'];

/** `updateSettingsSchema`'s grading enum. */
export const GRADING_SYSTEMS = ['WAEC', 'IB', 'Cambridge', 'Custom'];

export default {
  getSettings,
  updateProfile,
  updateGeneral,
  updateAcademicYear,
  updateNotifications,
  getBilling,
  uploadSchoolLogo,
  uploadSchoolStamp,
};
