import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  Check,
  Crosshair,
  LoaderCircle,
  MapPin,
  Search,
  X,
} from 'lucide-react';
import { isInsideGhana } from '../../utils/ghanaPostGps';
import {
  GEOLOCATION_MESSAGES,
  MIN_SUGGESTION_LENGTH,
  getDevicePosition,
  isMapsConfigured,
  openInGoogleMaps,
  resolvePlace,
  reverseGeocode,
  suggestPlaces,
} from '../../utils/googleMaps';
import {
  isNominatimAvailable,
  suggestPlacesNominatim,
  resolvePlaceNominatim,
  reverseGeocodeNominatim,
} from '../../utils/nominatim';

/** Keystrokes to wait before asking Google. Long enough to skip most of a burst. */
const DEBOUNCE_MS = 250;

/**
 * School location: one-click GPS, address search, and a single-line summary.
 *
 * There is deliberately no map. A 250px map inside a card that already contains a
 * twelve-field form pushed the fee-relevant fields off a phone screen, and the
 * map was mostly decorative: the school was always a school, and what the bursar
 * needed was to *set* the position, not to admire it. So the three inputs a user
 * actually uses — GPS, search, and typing coordinates — are now the whole
 * component, and the result is one line: what was selected, and where it is.
 *
 * Verification moved to a link rather than an embedded map: "Open in Maps" opens
 * the same coordinates in a full tab, which is a better check than a thumbnail
 * and costs no vertical space.
 */
const SchoolLocationPicker = ({
  latitude,
  longitude,
  source,
  label = '',
  onChange,
  onClear,
  disabled = false,
  error = '',
}) => {
  const listboxId = useId();

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [message, setMessage] = useState('');

  const searchEnabled = true;
  // A session token groups one burst of keystrokes into a single billable
  // session. Created on focus, terminated after a pick, per Google's guidance.
  const sessionToken = useRef(null);
  // Aborts a stale response: typing "Canton" then "Cantonments" fires two
  // requests, and the slower first one must not overwrite the second.
  const requestSeq = useRef(0);

  const hasPin = isInsideGhana(latitude, longitude);
  const coordinateText = hasPin ? `${latitude}, ${longitude}` : '';

  /**
   * Opens a billing session for a burst of keystrokes.
   *
   * Guarded on the SDK actually being present rather than on a key merely being
   * configured: a key can exist while the script is still in flight, and
   * `google.maps.places` is undefined until it lands. Touching the bare `google`
   * global before then throws a ReferenceError inside a keystroke handler.
   */
  const newSession = () => {
    const token = globalThis.google?.maps?.places?.AutocompleteSessionToken;
    if (typeof token === 'function') sessionToken.current = new token();
  };

  const endSession = () => {
    sessionToken.current = null;
  };

  // Discard a pending search when the component goes away, and end any open
  // billing session so it does not linger.
  useEffect(() => () => endSession(), []);

  const resetSearch = useCallback(() => {
    setQuery('');
    setSuggestions([]);
    setOpen(false);
    setActiveIndex(-1);
  }, []);

  // ── Debounced suggestions ──
  useEffect(() => {
    const trimmed = query.trim();
    if (!searchEnabled || trimmed.length < MIN_SUGGESTION_LENGTH) {
      setSuggestions([]);
      setOpen(false);
      setSearching(false);
      return undefined;
    }

    const seq = ++requestSeq.current;
    setSearching(true);

    const timer = setTimeout(async () => {
      // A first keystroke in a burst needs a session to bill against.
      if (!sessionToken.current) newSession();

      try {
        let results;
        if (isMapsConfigured()) {
          results = await suggestPlaces(trimmed, {
            sessionToken: sessionToken.current,
            centre: hasPin ? { lat: latitude, lng: longitude } : null,
          });
        } else {
          results = await suggestPlacesNominatim(trimmed);
        }
        // A slower earlier request must not clobber a newer one.
        if (seq !== requestSeq.current) return;
        setSuggestions(results);
        setOpen(results.length > 0);
        setActiveIndex(results.length ? 0 : -1);
      } catch (error) {
        if (seq !== requestSeq.current) return;
        setSuggestions([]);
        setOpen(false);
        setMessage(
          error.code === 'PLACES_UNAVAILABLE'
            ? 'Address search is unavailable in this build.'
            : ''
        );
      } finally {
        if (seq === requestSeq.current) setSearching(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query, searchEnabled, hasPin, latitude, longitude]);

  // ── Choosing a suggestion ──
  const choose = useCallback(
    async (suggestion) => {
      setResolving(true);
      setMessage('');
      try {
        let place;
        if (isMapsConfigured()) {
          place = await resolvePlace(suggestion.placeId, { sessionToken: sessionToken.current });
        } else {
          place = await resolvePlaceNominatim(suggestion.placeId, suggestion.mainText);
        }
        endSession();
        if (!isInsideGhana(place.latitude, place.longitude)) {
          // Should not happen behind `componentRestrictions: { country: 'gh' }`,
          // but a pin outside the country is worse than no pin, so it is checked
          // rather than assumed.
          setMessage('That address is not in Ghana.');
          return;
        }
        onChange({ latitude: place.latitude, longitude: place.longitude, source: 'map_pin', label: place.label });
        resetSearch();
      } catch {
        setMessage('That address could not be resolved. Try a different one.');
      } finally {
        setResolving(false);
      }
    },
    [onChange, resetSearch]
  );

  // ── One-click GPS ──
  const useMyLocation = useCallback(async () => {
    setLocating(true);
    setMessage('');
    try {
      const position = await getDevicePosition();

      // A device with no fix, or a fix taken somewhere else entirely, would
      // otherwise silently file the school at the wrong end of the country.
      if (!isInsideGhana(position.lat, position.lng)) {
        setMessage('That position is outside Ghana. Check your device location, or search instead.');
        return;
      }

      onChange({
        latitude: position.lat,
        longitude: position.lng,
        source: 'device',
        // The row needs *something* to name the pin. Reverse geocoding is
        // best-effort: without a key it simply yields nothing, and the generic
        // label below is honest rather than misleading.
        label: 'Your current location',
      });
      resetSearch();

      if (isMapsConfigured()) {
        try {
          const place = await reverseGeocode(position.lat, position.lng);
          if (place?.label) {
            onChange({
              latitude: position.lat,
              longitude: position.lng,
              source: 'device',
              label: place.label,
            });
          }
        } catch {
          // Coordinates are already set; a missing label does not undo that.
        }
      } else {
        try {
          const place = await reverseGeocodeNominatim(position.lat, position.lng);
          if (place?.label) {
            onChange({
              latitude: position.lat,
              longitude: position.lng,
              source: 'device',
              label: place.label,
            });
          }
        } catch {
          // Coordinates are already set; a missing label does not undo that.
        }
      }
    } catch (error) {
      setMessage(GEOLOCATION_MESSAGES[error.code] || 'Could not read your location.');
    } finally {
      setLocating(false);
    }
  }, [onChange, resetSearch]);

  // ── Keyboard ──
  const onKeyDown = (event) => {
    if (!open || suggestions.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => (current - 1 + suggestions.length) % suggestions.length);
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      choose(suggestions[activeIndex]);
    } else if (event.key === 'Escape') {
      setOpen(false);
      setActiveIndex(-1);
    }
  };

  const sourceLabel = {
    device: 'From this device',
    map_pin: 'From address search',
    gps_address: 'From Ghana Post GPS',
    manual: 'Entered by hand',
  }[source];

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      {/* Header: the one-click action sits here, opposite the label, so it is
          the most prominent thing in the block. */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-[12px] font-bold text-ink">Location</p>
            <p className="mt-0.5 text-[11px] font-medium leading-snug text-slate-500">
              Optional. Use your current position, or search for the school.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={useMyLocation}
          disabled={locating || disabled}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-700 px-3 py-2 text-[12px] font-bold text-white shadow-sm transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {locating ? (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Crosshair className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {locating ? 'Locating…' : 'Use my current location'}
        </button>
      </div>

      {/* Search */}
      <div className="relative mt-3">
        <label htmlFor={`${listboxId}-input`} className="sr-only">
          Search for a school address in Ghana
        </label>
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          aria-hidden="true"
        />
        <input
          id={`${listboxId}-input`}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined}
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          value={query}
          placeholder={
            searchEnabled ? 'Search for a place in Ghana…' : 'Address search needs an API key'
          }
          onChange={(event) => {
            setQuery(event.target.value);
            setMessage('');
            if (!sessionToken.current) newSession();
          }}
          onFocus={() => {
            if (query.trim().length >= MIN_SUGGESTION_LENGTH) setOpen(true);
          }}
          // `onMouseDown` with preventDefault on the option, not `onClick` here:
          // blur fires before click, so a click handler would lose the race and
          // the list would close out from under the click.
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-9 text-[13px] font-medium text-ink placeholder:font-normal placeholder:text-slate-500 focus:border-brand-700 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/30 disabled:cursor-not-allowed disabled:bg-slate-50"
        />
        {(searching || resolving) && (
          <LoaderCircle
            className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-brand-700"
            aria-hidden="true"
          />
        )}
        {!searching && !resolving && query && (
          <button
            type="button"
            onClick={resetSearch}
            aria-label="Clear address search"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}

        {open && suggestions.length > 0 && (
          <ul
            id={listboxId}
            role="listbox"
            aria-label="Address suggestions"
            className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-soft"
          >
            {suggestions.map((suggestion, index) => (
              <li
                key={suggestion.placeId}
                id={`${listboxId}-option-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                // preventDefault keeps focus in the input so the arrow keys keep
                // working after a click.
                onMouseDown={(event) => {
                  event.preventDefault();
                  choose(suggestion);
                }}
                onMouseEnter={() => setActiveIndex(index)}
                className={`cursor-pointer px-3 py-2 transition-colors ${
                  index === activeIndex ? 'bg-brand-50' : ''
                }`}
              >
                <p className="text-[13px] font-bold text-ink">{suggestion.mainText}</p>
                {suggestion.secondaryText && (
                  <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500">
                    {suggestion.secondaryText}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {message && (
        <p role="status" className="mt-2 text-[11px] font-semibold text-amber-700">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-[11px] font-semibold text-red-600">
          {error}
        </p>
      )}

      {/* ── The summary line ──
          Requirement: the selected place and the coordinates on one line. It
          sits directly under the controls, so the answer to "did that work?" is
          where the eye already is. */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-slate-200 pt-3">
        {hasPin ? (
          <>
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <Check className="h-3.5 w-3.5 shrink-0 text-brand-700" aria-hidden="true" />
              <span className="truncate text-[12px] font-bold text-ink">
                {label || 'Location set'}
              </span>
            </span>

            <span className="font-mono text-[12px] font-bold tabular-nums text-brand-800">
              {coordinateText}
            </span>

            {sourceLabel && (
              <span className="text-[11px] font-medium text-slate-500">{sourceLabel}</span>
            )}

            <span className="ml-auto flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => openInGoogleMaps(latitude, longitude)}
                className="rounded px-1.5 py-0.5 text-[11px] font-bold text-brand-700 underline"
              >
                Open in Maps
              </button>
              {!disabled && (
                <button
                  type="button"
                  onClick={onClear}
                  className="rounded px-1.5 py-0.5 text-[11px] font-bold text-red-600 hover:underline"
                >
                  Clear
                </button>
              )}
            </span>
          </>
        ) : (
          <p className="text-[11px] font-medium text-slate-500">
            No location set. Parents can still find you by address.
          </p>
        )}
      </div>

      <CoordinateInputs
        latitude={latitude}
        longitude={longitude}
        onChange={(lat, lng) =>
          onChange({
            latitude: lat === '' ? null : Number(lat),
            longitude: lng === '' ? null : Number(lng),
            source: 'manual',
            // A hand-typed coordinate carries no place name, so any previous label
            // is dropped rather than left describing a position that has moved.
            label: '',
          })
        }
        disabled={disabled}
      />
    </div>
  );
};

/**
 * Manual coordinates.
 *
 * Doubles as the accessible representation of the selection: with the map gone,
 * these numbers are the only machine-readable statement of where the school is.
 */
const CoordinateInputs = ({ latitude, longitude, onChange, disabled }) => (
  <div className="mt-3 grid gap-2 sm:grid-cols-2">
    <label className="block">
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">
        Latitude
      </span>
      <input
        type="number"
        step="0.000001"
        min={-90}
        max={90}
        value={latitude ?? ''}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value, longitude ?? '')}
        placeholder="5.603700"
        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-[12px] font-bold text-ink placeholder:font-normal placeholder:text-slate-300 focus:border-brand-700 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/30 disabled:opacity-50"
      />
    </label>
    <label className="block">
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">
        Longitude
      </span>
      <input
        type="number"
        step="0.000001"
        min={-180}
        max={180}
        value={longitude ?? ''}
        disabled={disabled}
        onChange={(event) => onChange(latitude ?? '', event.target.value)}
        placeholder="-0.187000"
        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-[12px] font-bold text-ink placeholder:font-normal placeholder:text-slate-300 focus:border-brand-700 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/30 disabled:opacity-50"
      />
    </label>
  </div>
);

export default SchoolLocationPicker;
