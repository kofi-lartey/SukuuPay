import api from './api';

/**
 * Fetches the public profile of a school.
 *
 * Unauthenticated, marketing-grade: every failure is "no details", the
 * caller must degrade gracefully. Never throws.
 */
export const fetchPublicSchool = async (schoolId) => {
  try {
    const { data } = await api.get(`/public/schools/${schoolId}`, { timeout: 8000 });
    return data?.school || null;
  } catch (error) {
    const status = error?.response?.status;
    console.warn(
      `[publicSchool] GET /public/schools/${schoolId} failed${status ? ` (${status})` : ''} — no school details.`,
      error?.response?.data?.message || error?.message || error
    );
    return null;
  }
};

export default fetchPublicSchool;
