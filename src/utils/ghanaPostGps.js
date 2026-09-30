/**
 * Ghana Post GPS digital addresses — client mirror.
 *
 * Must agree with `Backend/src/utils/ghanaPostGps.js`, which normalises on write.
 * The two are kept in step deliberately rather than sharing a module, because the
 * frontend bundle cannot import server code; the backend test suite pins the
 * cases here so a change to one without the other is caught.
 *
 * A digital address identifies a 5m x 5m square of Ghana:
 *
 *   GA-183-8164
 *   │  │    └── 4 digits: the unique address within the postal code
 *   │  └─────── 3 digits: the postal code area (post office zone)
 *   └────────── 2 letters: the area code — first letter region, second district
 */

/**
 * Canonical shape.
 *
 * `[-\s]*` rather than `[-\s]?` because users paste from all sorts of places:
 * "GA-183-8164", "GA1838164" and "GA - 183 - 8164" are all the same address, and
 * a single-character separator class rejects the third of those. Must stay in
 * step with `Backend/src/utils/ghanaPostGps.js`.
 */
const DIGITAL_ADDRESS = /^([A-Za-z]{2})[-\s]*(\d{3})[-\s]*(\d{4})$/;


/**
 * Area codes verified against Ghana Post's published region/district guide.
 *
 * Rendered as `<datalist>` suggestions and nothing more. This is deliberately
 * not a region -> code mapping enforced on the form: there are roughly 260
 * districts, the set was reorganised when Ghana's regions were split in 2019, and
 * a stale entry would silently stamp the wrong district onto a document a parent
 * relies on. The user types or picks; we suggest.
 */
export const AREA_CODE_SUGGESTIONS = [
  { code: 'GA', district: 'Accra', region: 'Greater Accra' },
  { code: 'GB', district: 'Ashaiman', region: 'Greater Accra' },
  { code: 'GC', district: 'Ga Central', region: 'Greater Accra' },
  { code: 'GD', district: 'Adentan', region: 'Greater Accra' },
  { code: 'GE', district: 'Ga East', region: 'Greater Accra' },
  { code: 'GS', district: 'Ga South', region: 'Greater Accra' },
  { code: 'GX', district: 'Ada West', region: 'Greater Accra' },
  { code: 'GY', district: 'Ada East', region: 'Greater Accra' },
  { code: 'AA', district: 'Asante Akim South', region: 'Ashanti' },
  { code: 'AK', district: 'Kumasi Metropolitan', region: 'Ashanti' },
  { code: 'AH', district: 'Atwima Nwabiagya', region: 'Ashanti' },
  { code: 'AJ', district: 'Ejura Sekyedumase', region: 'Ashanti' },
  { code: 'AR', district: 'Sekyere East', region: 'Ashanti' },
  { code: 'AS', district: 'Asokore Mampong', region: 'Ashanti' },
  { code: 'AT', district: 'Bosomtwe', region: 'Ashanti' },
  { code: 'AU', district: 'Kumawu', region: 'Ashanti' },
  { code: 'BA', district: 'Atebubu-Amantin', region: 'Bono' },
  { code: 'BB', district: 'Berekum', region: 'Bono' },
  { code: 'BT', district: 'Cape Coast', region: 'Central' },
  { code: 'EA', district: 'Asuogyaman', region: 'Eastern' },
  { code: 'EB', district: 'Birim Central', region: 'Eastern' },
  { code: 'EK', district: 'Kwaebibirem', region: 'Eastern' },
  { code: 'EM', district: 'Akyemansa', region: 'Eastern' },
  { code: 'NK', district: 'Kumbugu', region: 'Northern' },
  { code: 'NR', district: 'Karaga', region: 'Northern' },
  { code: 'NT', district: 'Tamale Metropolitan', region: 'Northern' },
  { code: 'NW', district: 'Sawla-Tuna-Kalba', region: 'Northern' },
  { code: 'NY', district: 'Yendi Municipal', region: 'Northern' },
  { code: 'UA', district: 'Bawku Municipal', region: 'Upper East' },
  { code: 'UB', district: 'Bolgatanga Municipal', region: 'Upper East' },
  { code: 'UG', district: 'Garu-Tempane', region: 'Upper East' },
  { code: 'UW', district: 'Wa Municipal', region: 'Upper West' },
  { code: 'VC', district: 'Hohoe Municipal', region: 'Volta' },
  { code: 'VD', district: 'North Dayi', region: 'Volta' },
  { code: 'VE', district: 'South Dayi', region: 'Volta' },
  { code: 'VV', district: 'Central Tongu', region: 'Volta' },
  { code: 'VW', district: 'Akatsi North', region: 'Volta' },
  { code: 'VY', district: 'Ketu North', region: 'Volta' },
  { code: 'WA', district: 'Aowin', region: 'Western' },
  { code: 'WD', district: 'Sefwi Wiawso', region: 'Western' },
];

export const isValidDigitalAddress = (value) => {
  if (typeof value !== 'string') return false;
  return DIGITAL_ADDRESS.test(value.trim());
};

/** Canonical form, or null when the value cannot be normalised. */
export const normaliseDigitalAddress = (value) => {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(DIGITAL_ADDRESS);
  if (!match) return null;
  const [, area, postal, unique] = match;
  return `${area.toUpperCase()}-${postal}-${unique}`;
};

/** Splits an address into its three parts for the segmented inputs. */
export const parseDigitalAddress = (value) => {
  const normalised = normaliseDigitalAddress(value);
  if (!normalised) return null;
  const [areaCode, postalCode, uniqueAddress] = normalised.split('-');
  return { areaCode, postalCode, uniqueAddress };
};

/**
 * Builds a canonical address from parts, or null unless all three are the right
 * shape — so a half-typed address is never written into the form state.
 */
export const composeDigitalAddress = ({ areaCode, postalCode, uniqueAddress }) => {
  const area = String(areaCode ?? '').trim().toUpperCase();
  const postal = String(postalCode ?? '').trim();
  const unique = String(uniqueAddress ?? '').trim();

  if (!/^[A-Z]{2}$/.test(area)) return null;
  if (!/^\d{3}$/.test(postal)) return null;
  if (!/^\d{4}$/.test(unique)) return null;

  return `${area}-${postal}-${unique}`;
};

/**
 * Partial state for the segmented inputs.
 *
 * When an existing value does not parse — a legacy row with a free-text value —
 * the raw string is kept in `postalCode` rather than discarded. Dropping it on
 * edit would silently erase a school's address the first time they opened the
 * form to change something unrelated.
 */
export const toParts = (value) => {
  const parsed = parseDigitalAddress(value);
  if (parsed) return { ...parsed, unparsed: '' };
  const raw = typeof value === 'string' ? value : '';
  return { areaCode: '', postalCode: raw, uniqueAddress: '', unparsed: raw };
};

/** Ghana's land bounding box, used to frame the map before a pin exists. */
export const GHANA_BOUNDS = { north: 11.19, south: 4.71, east: 1.2, west: -3.26 };

/** Centre of Ghana, used as the map's initial view. */
export const GHANA_CENTRE = { lat: 7.9465, lng: -1.0232 };

/** True when a coordinate pair sits inside Ghana's land bounding box. */
export const isInsideGhana = (lat, lng) =>
  Number.isFinite(lat) &&
  Number.isFinite(lng) &&
  lat >= GHANA_BOUNDS.south &&
  lat <= GHANA_BOUNDS.north &&
  lng >= GHANA_BOUNDS.west &&
  lng <= GHANA_BOUNDS.east;

export default {
  isValidDigitalAddress,
  normaliseDigitalAddress,
  parseDigitalAddress,
  composeDigitalAddress,
  toParts,
  AREA_CODE_SUGGESTIONS,
  GHANA_BOUNDS,
  GHANA_CENTRE,
  isInsideGhana,
};
