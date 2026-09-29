import api from './api';

/**
 * Fetches the approved, currently-live ad creatives for a placement.
 *
 * Called from the unauthenticated auth pages, so this deliberately treats every
 * failure as "no ads": the endpoint is a marketing nicety, and an empty slider
 * must never stand between a bursar and the login form. Never throws.
 */
export const fetchSchoolAds = async (placement = 'auth_aside') => {
  try {
    const { data } = await api.get('/public/school-ads', {
      params: { placement },
      timeout: 8000,
    });

    const ads = Array.isArray(data?.ads) ? data.ads : [];

    // Defensive: the backend constrains linkUrl to https and requires the text
    // fields, but this data still reaches an href and an alt attribute, so
    // re-check at the boundary rather than trusting a field that is only as safe
    // as its most recent writer. An ad with no imageAlt would otherwise render
    // an unlabelled image on the login page.
    return ads.filter(
      (ad) =>
        typeof ad?.imageAlt === 'string' &&
        ad.imageAlt.trim() &&
        typeof ad?.headline === 'string' &&
        ad.headline.trim() &&
        /^https:\/\//i.test(ad?.imageUrl || '') &&
        /^https:\/\//i.test(ad?.linkUrl || '')
    );
  } catch {
    return [];
  }
};

export default fetchSchoolAds;
