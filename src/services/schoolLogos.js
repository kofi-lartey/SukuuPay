import api from './api';

/**
 * Fetches the schools whose logos the homepage carousel shows.
 *
 * Unauthenticated and marketing-grade, like `fetchSchoolAds`: every
 * failure is "no logos", the carousel renders nothing, and the reason
 * is named in the console rather than swallowed. Never throws.
 */
export const fetchSchoolLogos = async () => {
  try {
    const { data } = await api.get('/public/schools/logos', { timeout: 8000 });
    const schools = Array.isArray(data?.schools) ? data.schools : [];
    return schools.filter(
      (school) =>
        typeof school?.name === 'string' &&
        school.name.trim() &&
        typeof school?.logo === 'string' &&
        school.logo.trim()
    );
  } catch (error) {
    const status = error?.response?.status;
    console.warn(
      `[schoolLogos] GET /public/schools/logos failed${status ? ` (${status})` : ''} — showing no school logos.`,
      error?.response?.data?.message || error?.message || error
    );
    return [];
  }
};

export default fetchSchoolLogos;
