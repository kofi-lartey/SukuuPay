import api from './api';

/**
 * Fetches the approved, currently-live ad creatives for a placement.
 *
 * Called from the public marketing surfaces — the hero slider and the
 * advertisements page — so this deliberately treats every failure as
 * "no ads": the endpoint is a marketing nicety, and an empty slider
 * must never stand between a visitor and the page content. Never throws.
 *
 * ## The failure is logged, though
 *
 * `catch { return [] }` with nothing in it is the reason "I published an ad and the
 * login page shows nothing" was undiagnosable from the browser. The contract above is
 * right — the page must degrade — but silently degrading is what turns a 403, a 404, a
 * CORS refusal and an expired cache into four identical empty panels.
 *
 * So the slider still never breaks the login form, and the console now says which of
 * those four it was. `console.warn` rather than `console.error`: this is an expected
 * state on the login path, not an exception, and it must not look like one in a
 * production browser's error reporting.
 */
export const fetchSchoolAds = async (placement = 'advertisement_page', { perPage } = {}) => {
  try {
    const { data } = await api.get('/public/school-ads', {
      params: { placement, ...(perPage ? { perPage } : {}) },
      timeout: 8000,
    });

    const ads = Array.isArray(data?.ads) ? data.ads : [];

    // The two states the list alone cannot distinguish, which is what the backend
    // documents `adsEnabled` for: the platform switch is off, or there is simply
    // nothing live. Both render an empty panel, so both are worth saying out loud.
    if (data?.adsEnabled === false) {
      console.warn('[schoolAds] The platform has turned advertisements off (adsEnabled: false).');
    } else if (ads.length === 0) {
      console.warn(
        `[schoolAds] No live creatives for "${placement}". An ad only appears here once it is ` +
          'approved, within its run window, and not soft-deleted — the Content queue shows which ' +
          'of those a given creative fails.'
      );
    }

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
  } catch (error) {
    // The request itself failed, so there is no `adsEnabled` to report — name the
    // status and the URL, which between them distinguish a wrong base URL, a refused
    // origin, a missing route and a network failure.
    const status = error?.response?.status;
    console.warn(
      `[schoolAds] GET /public/school-ads failed${
        status ? ` (${status})` : ''
      } — showing no advertisements.`,
      error?.response?.data?.message || error?.message || error
    );
    return [];
  }
};

export default fetchSchoolAds;
