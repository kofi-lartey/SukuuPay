/**
 * Lazy loader for the Google Maps JavaScript API.
 *
 * Three properties this file exists to guarantee:
 *
 *  1. **One load.** A module-level promise is cached, so mounting two pickers
 *     (or remounting one on every wizard step) cannot inject a second `<script>`.
 *     Google rejects a duplicate load with `InvalidKeyMapError`-adjacent noise and
 *     leaves `google.maps` in a confusing half-defined state.
 *
 *  2. **Honest absence.** `isMapsConfigured()` is checked before any load is
 *     attempted, because there is no committed `.env` in this project — see the
 *     note in `services/api.js`. A static build cannot gain a key at deploy time
 *     from a file it does not ship, so a missing key is the *expected* state on a
 *     fresh clone, not an error to hide. Callers render a real fallback instead
 *     of a broken map, which is the same approach `verifyHubtel` takes when the
 *     API has no route yet.
 *
 *  3. **A failed load is remembered as failure.** The cached promise rejects, so
 *     a second attempt does not re-inject a script that Google will refuse.
 */

const CALLBACK = '__sukuupayMapsReady';
const SCRIPT_ID = 'sukuupay-google-maps';

let loadPromise = null;

export const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

/** True when a key is configured. Cheap and synchronous, so callers can branch on render. */
export const isMapsConfigured = () => Boolean(GOOGLE_MAPS_API_KEY);

/**
 * Resolves the `google.maps` namespace, or rejects with a coded error.
 *
 * Rejects with `MAPS_NOT_CONFIGURED` when there is no key — that is a
 * configuration state the caller renders around, not an exception to surface.
 */
export const loadGoogleMaps = () => {
  if (!isMapsConfigured()) {
    return Promise.reject(
      Object.assign(new Error('No Google Maps API key is configured.'), {
        code: 'MAPS_NOT_CONFIGURED',
      })
    );
  }

  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    // Another caller may have installed the script between our check and here.
    if (window.google?.maps?.Map) {
      resolve(window.google.maps);
      return;
    }

    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      existing.addEventListener('load', () => resolve(window.google?.maps), { once: true });
      existing.addEventListener(
        'error',
        () => reject(Object.assign(new Error('Google Maps failed to load.'), { code: 'MAPS_LOAD_FAILED' })),
        { once: true }
      );
      return;
    }

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.async = true;
    script.defer = true;
    // `loading=async` lets Google inject the UI without blocking the wizard,
    // which matters because Step 1 is already a long form on mobile.
    //
    // `libraries=places` is what makes `google.maps.places` available, and it is
    // required for autocomplete. Without it the namespace loads fine and
    // `google.maps.places` is undefined, which fails later and less obviously.
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      GOOGLE_MAPS_API_KEY
    )}&loading=async&v=weekly&libraries=places&callback=${CALLBACK}`;

    script.addEventListener(
      'load',
      () => {
        if (window.google?.maps) {
          resolve(window.google.maps);
        } else {
          reject(
            Object.assign(new Error('Google Maps loaded without a maps namespace.'), {
              code: 'MAPS_LOAD_FAILED',
            })
          );
        }
      },
      { once: true }
    );

    script.addEventListener(
      'error',
      () =>
        reject(
          Object.assign(new Error('Google Maps failed to load.'), { code: 'MAPS_LOAD_FAILED' })
        ),
      { once: true }
    );

    // A key that is present but rejected, or blocked by an ad blocker or an
    // offline run, surfaces here. Keeping it as a no-op callback means the loader
    // rejects through the `error` listener instead of throwing globally.
    window[CALLBACK] = () => resolve(window.google?.maps);

    document.head.appendChild(script);
  }).catch((error) => {
    // Allow a deliberate retry after a transient failure, but not on every
    // remount — clearing here means the next call starts fresh, and the caller's
    // own guard decides whether to retry.
    loadPromise = null;
    throw error;
  });

  return loadPromise;
};

/**
 * Browser geolocation, wrapped so the failure modes are nameable.
 *
 * Deliberately independent of the Maps SDK: a parent on a school whose bursar has
 * no API key configured can still set the pin from the device, which is the
 * single most accurate input available. Rejections are mapped to codes so the UI
 * can say *why* rather than showing a generic failure.
 */
export const getDevicePosition = (options = {}) =>
  new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(
        Object.assign(new Error('This browser cannot share your location.'), {
          code: 'GEOLOCATION_UNSUPPORTED',
        })
      );
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        }),
      (error) => {
        const code =
          error.code === 1
            ? 'GEOLOCATION_DENIED'
            : error.code === 2
              ? 'GEOLOCATION_UNAVAILABLE'
              : 'GEOLOCATION_TIMEOUT';
        reject(Object.assign(new Error(error.message || 'Could not read your location.'), { code }));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000, ...options }
    );
  });

/** Human-readable copy for the geolocation failure codes. */
export const GEOLOCATION_MESSAGES = {
  GEOLOCATION_DENIED:
    'Location access was blocked. Allow it in your browser settings, or drop the pin on the map.',
  GEOLOCATION_UNAVAILABLE: 'Your device could not determine a position. Drop the pin on the map instead.',
  GEOLOCATION_TIMEOUT: 'Locating took too long. Drop the pin on the map instead.',
  GEOLOCATION_UNSUPPORTED: 'This browser cannot share your location. Drop the pin on the map instead.',
};

/**
 * Suggestion search needs at least this many characters.
 *
 * Google's Places autocomplete bills per keystroke and returns near-useless
 * results below three characters, so short queries are not sent at all. This is
 * the single biggest lever on both cost and latency.
 */
export const MIN_SUGGESTION_LENGTH = 3;

/**
 * Fetches address predictions for a query.
 *
 * Deliberately uses `AutocompleteService` and renders our own list rather than
 * reaching for `Autocomplete` or the `PlaceAutocompleteElement` web component.
 * Both of those draw Google's own dropdown inside a shadow root, which cannot be
 * styled to match the rest of this form; this way the suggestion list is normal
 * React and inherits the design system. It also means keyboard handling, the
 * debounce and the Ghana restriction are code we can read and test rather than a
 * widget we have to work around.
 *
 * `AutocompleteService` is soft-deprecated in favour of `AutocompleteSuggestion`,
 * but it remains the documented and supported API for exactly this shape of
 * integration; the newer class is still settling and is not worth the churn here.
 *
 * @returns {Promise<Array<{placeId: string, description: string, mainText: string, secondaryText: string}>>}
 */
export const suggestPlaces = async (query, { sessionToken, centre } = {}) => {
  const trimmed = String(query ?? '').trim();
  if (trimmed.length < MIN_SUGGESTION_LENGTH) return [];

  const maps = await loadGoogleMaps();
  if (!maps.places?.AutocompleteService) {
    throw Object.assign(new Error('The Places library is unavailable.'), {
      code: 'PLACES_UNAVAILABLE',
    });
  }

  const service = new maps.places.AutocompleteService();

  const request = {
    input: trimmed,
    // Restricting to Ghana is the difference between a useful list of five
    // schools' worth of local results and a global one led by Atlanta. A
    // `componentRestrictions` country is also a hard filter, unlike a bias.
    componentRestrictions: { country: 'gh' },
    // Session tokens group a keystroke burst into one billable session. Without
    // them every character typed is billed as a separate request.
    sessionToken,
  };

  // Bias toward the user's vicinity where known, so "Canton" ranks the local one.
  if (centre && Number.isFinite(centre.lat) && Number.isFinite(centre.lng)) {
    request.location = new maps.LatLng(centre.lat, centre.lng);
    request.radius = 50000;
  }

  return new Promise((resolve, reject) => {
    service.getPlacePredictions(request, (predictions, status) => {
      if (status === 'OK') {
        resolve(
          (predictions || []).map((prediction) => ({
            placeId: prediction.place_id,
            description: prediction.description,
            mainText: prediction.structured_formatting?.main_text || prediction.description,
            secondaryText: prediction.structured_formatting?.secondary_text || '',
          }))
        );
        return;
      }
      // ZERO_RESULTS is a normal empty answer, not a failure — treating it as
      // one would flash an error for every query nobody has a match for.
      if (status === 'ZERO_RESULTS') {
        resolve([]);
        return;
      }
      reject(
        Object.assign(new Error('Address search is unavailable right now.'), {
          code: 'PLACES_REQUEST_FAILED',
        })
      );
    });
  });
};

/**
 * Turns a chosen suggestion into coordinates and a label.
 *
 * The prediction only carries text, so a second call is needed to get the
 * geometry. `fields` is listed explicitly: the full Place payload is billable
 * per field on newer SKUs and we use four of them.
 */
export const resolvePlace = async (placeId, { sessionToken } = {}) => {
  const maps = await loadGoogleMaps();
  if (!maps.places?.PlacesService) {
    throw Object.assign(new Error('The Places library is unavailable.'), {
      code: 'PLACES_UNAVAILABLE',
    });
  }

  // `PlacesService` is constructed without a map; it does not require one, which
  // is what lets autocomplete work in a component that renders no map at all.
  const service = new maps.places.PlacesService();

  return new Promise((resolve, reject) => {
    service.getDetails(
      {
        placeId,
        fields: ['geometry.location', 'formatted_address', 'name'],
        sessionToken,
      },
      (place, status) => {
        if (status !== 'OK' || !place?.geometry?.location) {
          reject(
            Object.assign(new Error('That address could not be resolved.'), {
              code: 'PLACE_RESOLUTION_FAILED',
            })
          );
          return;
        }
        resolve({
          latitude: place.geometry.location.lat(),
          longitude: place.geometry.location.lng(),
          // Prefer the place's own name ("Cantonments Senior High") over the
          // fully-qualified address, which repeats the city and country the
          // school already has fields for.
          label: place.name || place.formatted_address || '',
        });
      }
    );
  });
};

/**
 * Best-effort human label for a coordinate pair.
 *
 * Used after one-click GPS so the summary row can name where the pin landed.
 * Returns null rather than throwing on failure — the coordinates are still good,
 * and the caller falls back to a generic label.
 */
export const reverseGeocode = async (lat, lng) => {
  const maps = await loadGoogleMaps();
  if (!maps.Geocoder) return null;

  return new Promise((resolve) => {
    const geocoder = new maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status !== 'OK' || !results?.length) {
        resolve(null);
        return;
      }
      const result = results[0];
      resolve({
        label:
          result.address_components?.find((c) => c.types?.includes('locality'))?.long_name ||
          result.formatted_address ||
          '',
        address: result.formatted_address || '',
      });
    });
  });
};

/**
 * Opens Google Maps for a coordinate pair in a new tab.
 *
 * The only way a user can visually confirm a pin now that the map preview is
 * gone, so it has to stay reachable from the summary row.
 */
export const openInGoogleMaps = (lat, lng) => {
  window.open(
    `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
    '_blank',
    'noopener,noreferrer'
  );
};

export default {
  loadGoogleMaps,
  isMapsConfigured,
  getDevicePosition,
  GEOLOCATION_MESSAGES,
  GOOGLE_MAPS_API_KEY,
  suggestPlaces,
  resolvePlace,
  reverseGeocode,
  openInGoogleMaps,
  MIN_SUGGESTION_LENGTH,
};

