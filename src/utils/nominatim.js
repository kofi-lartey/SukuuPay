/**
 * Nominatim (OpenStreetMap) geocoding — free, no API key required.
 *
 * Used as a fallback when VITE_GOOGLE_MAPS_API_KEY is not configured.
 * Respects Nominatim's usage policy: max 1 request per second, no bulk geocoding.
 */

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';

export const isNominatimAvailable = () => true;

export const suggestPlacesNominatim = async (query) => {
  const trimmed = String(query ?? '').trim();
  if (trimmed.length < 3) return [];

  const url = `${NOMINATIM_BASE}/search?format=json&q=${encodeURIComponent(trimmed + ', Ghana')}&countrycodes=gh&limit=5&addressdetails=1`;
  const response = await fetch(url, {
    headers: { 'Accept-Language': 'en' },
  });
  if (!response.ok) return [];

  const results = await response.json();
  return (results || []).map((r) => ({
    placeId: r.place_id?.toString() || r.osm_id?.toString() || '',
    description: r.display_name || '',
    mainText: r.name || r.display_name?.split(',')[0] || '',
    secondaryText: r.display_name?.split(',').slice(1).join(',').trim() || '',
  }));
};

export const resolvePlaceNominatim = async (placeId, query) => {
  // Nominatim search result already has lat/lon in the suggestion.
  // We need to re-search or use the place_id to get details.
  // Simpler: use the search query to get the first result's coordinates.
  const url = `${NOMINATIM_BASE}/search?format=json&q=${encodeURIComponent(query + ', Ghana')}&countrycodes=gh&limit=1&addressdetails=1`;
  const response = await fetch(url, {
    headers: { 'Accept-Language': 'en' },
  });
  if (!response.ok) throw new Error('Geocoding failed');

  const results = await response.json();
  if (!results?.length) throw new Error('No results');

  const r = results[0];
  return {
    latitude: parseFloat(r.lat),
    longitude: parseFloat(r.lon),
    label: r.name || r.display_name?.split(',')[0] || '',
  };
};

export const reverseGeocodeNominatim = async (lat, lng) => {
  const url = `${NOMINATIM_BASE}/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`;
  const response = await fetch(url, {
    headers: { 'Accept-Language': 'en' },
  });
  if (!response.ok) return null;

  const result = await response.json();
  if (!result) return null;

  return {
    label: result.name || result.address?.city || result.address?.town || result.address?.village || '',
    address: result.display_name || '',
  };
};