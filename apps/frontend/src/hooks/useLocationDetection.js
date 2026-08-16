import { useState, useCallback, useEffect, useMemo } from 'react';
import MapApiService from '../components/map/services/mapApi';
import { isQuestionQuery } from '../utils/queryIntent';

// Mapbox returns { lon, lat }; the map context expects { lat, lng }.
function toLatLng(position) {
  if (!position) return null;
  return { lat: position.lat, lng: position.lng ?? position.lon };
}

// ── PARSING A LOCAL QUERY ───────────────────────────────────────────────────
//
// A local query has two halves: WHAT you are looking for and WHERE. "coffee
// near me" is subject "coffee", where "my position". Both matter, and only the
// second one used to be read at all.
//
// THREE BUGS THIS REPLACES, all of which broke the same journey:
//
//  1. "near me" resolved to the PLACE "me". The old pattern list was ordered
//     [/(in|at|near)\s+([A-Za-z\s]+)/, …, /near\s+me/] and the first match
//     won — so "coffee near me" captured the word "me" and geocoded it as a
//     place name. The geolocation pattern below it could never be reached; it
//     was unreachable code that looked like a working feature.
//  2. "nearby", "around me" and "closest" matched NOTHING. They were listed in
//     a LOCATION_KEYWORDS object that no pattern ever consulted, so those
//     queries were not treated as local at all.
//  3. THE SUBJECT WAS ALWAYS THROWN AWAY. Even when "dentist in austin"
//     resolved correctly it geocoded "austin" and showed a map of Austin with
//     no dentists on it. Nothing carried the word "dentist" forward, so the
//     map could centre on a place but never answer the question.
//
// Order matters here and the specific patterns come first, which is the whole
// fix for (1).

/** "near me" and everything that means it. */
const NEAR_ME = /\b(?:near(?:by)?\s+me|near\s*by|nearby|around\s+me|close\s+to\s+me|closest(?:\s+to\s+me)?|by\s+me)\b/i;

/** "coffee in austin" / "dentist near portland" — subject, then a place. */
const SUBJECT_IN_PLACE = /^(.*?)\s+(?:in|at|near|around)\s+(.+)$/i;

const DIRECTIONS = /^\s*(?:directions?|route|navigate|how\s+do\s+i\s+get)\s+to\s+(.+)$/i;

const ZIPCODE = /\b(\d{5})\b/;

/**
 * "43.752413, -123.070256" — a pair of coordinates and nothing else.
 *
 * This is what the map's share menu puts in a link, so it has to come back in
 * as a place. It is checked BEFORE the zipcode pattern, which would otherwise
 * grab five digits out of the middle of a decimal and geocode them as a
 * postcode on the other side of the country.
 */
const COORDS = /^\s*(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/;

/** Words that are not the thing being looked for. */
const FILLER = /^(?:the|a|an|some|any|best|good|cheap|open|find|show|me|my|is|are|there)$/i;

/** Trim filler off the subject. "find me the best coffee" → "coffee". */
function cleanSubject(raw) {
  if (!raw) return '';
  const words = raw.trim().toLowerCase().split(/\s+/).filter((w) => w && !FILLER.test(w));
  return words.join(' ').trim();
}

/**
 * What is being asked, and where.
 *
 * @returns {{type: string, subject: string, place?: string, zipcode?: string}|null}
 *   type is 'geolocation' | 'place' | 'zipcode' | 'directions'; subject is the
 *   business or category to look for and is '' when the query is purely a
 *   place ("austin" on its own).
 */
export function parseLocalQuery(query) {
  const q = (query || '').trim();
  if (!q) return null;

  const directions = q.match(DIRECTIONS);
  if (directions) return { type: 'directions', subject: '', place: directions[1].trim() };

  // A shared pin. No geocoder involved — the point IS the answer, and asking
  // a geocoder to turn coordinates back into coordinates can only lose
  // precision or fail.
  const coords = q.match(COORDS);
  if (coords) {
    const lat = parseFloat(coords[1]);
    const lng = parseFloat(coords[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng)
      && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { type: 'coords', subject: '', lat, lng };
    }
  }

  // Specific before generic: this is what stops "near me" being read as the
  // place "me".
  if (NEAR_ME.test(q)) {
    return { type: 'geolocation', subject: cleanSubject(q.replace(NEAR_ME, ' ')) };
  }

  const zip = q.match(ZIPCODE);
  if (zip) {
    return { type: 'zipcode', zipcode: zip[1], subject: cleanSubject(q.replace(ZIPCODE, ' ')) };
  }

  const inPlace = q.match(SUBJECT_IN_PLACE);
  if (inPlace) {
    const subject = cleanSubject(inPlace[1]);
    const place = inPlace[2].trim();
    // "in austin" with nothing before it is a place query, not a search for
    // nothing in Austin.
    if (place) return { type: 'place', subject, place };
  }

  return null;
}

export function useLocationDetection(query = '') {
  const [isLocationQuery, setIsLocationQuery] = useState(false);
  const [detectedLocation, setDetectedLocation] = useState(null);
  const [queryType, setQueryType] = useState(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [error, setError] = useState(null);

  const detectLocation = useCallback(async (searchQuery) => {
    if (!searchQuery || searchQuery.trim().length < 3) {
      setIsLocationQuery(false);
      setDetectedLocation(null);
      setQueryType(null);
      return null;
    }

    setIsDetecting(true);
    setError(null);

    try {
      const parsed = parseLocalQuery(searchQuery);
      if (parsed) {
        setQueryType(parsed.type);

        // The SUBJECT rides along on every branch. Without it the map can
        // centre on the right spot and still be unable to answer the question
        // that was asked — which is exactly what "coffee near me" used to do.
        const base = { query: searchQuery, type: parsed.type, subject: parsed.subject || '' };

        // A shared pin resolves with no round trip at all.
        if (parsed.type === 'coords') {
          const coords = { lat: parsed.lat, lng: parsed.lng };
          setDetectedLocation({
            ...base,
            coordinates: coords,
            locationName: `${parsed.lat.toFixed(5)}, ${parsed.lng.toFixed(5)}`,
          });
          setIsLocationQuery(true);
          // The street address is a nicety here, not a blocker — fill it in
          // when it arrives so a shared pin reads as a place rather than as
          // two numbers.
          MapApiService.reverseGeocode(parsed.lat, parsed.lng)
            .then((r) => {
              const address = r?.data?.address;
              if (address) {
                setDetectedLocation((prev) => (prev && prev.query === searchQuery
                  ? { ...prev, address, locationName: address } : prev));
              }
            })
            .catch(() => { /* two numbers is still a usable answer */ });
          return coords;
        }

        if (parsed.type === 'geolocation') {
          const position = await getUserLocation();
          if (position) {
            setDetectedLocation({ ...base, coordinates: position });
            setIsLocationQuery(true);
            return position;
          }
        } else {
          // place, zipcode and directions all resolve a string to a point.
          const target = parsed.place || parsed.zipcode;
          const result = await MapApiService.geocode(target);
          const best = result?.data?.[0];
          if (best) {
            const coords = toLatLng(best.position);
            setDetectedLocation({
              ...base,
              coordinates: coords,
              address: best.address,
              locationName: parsed.place || target,
              ...(parsed.zipcode ? { zipcode: parsed.zipcode } : {}),
              ...(parsed.type === 'directions' ? { destination: parsed.place } : {}),
            });
            setIsLocationQuery(true);
            return coords;
          }
        }
      }

      // No keyword pattern matched — only open the map when the query very
      // confidently resolves to a geographic place. Require ≥2 words (single words
      // are almost always topic searches, not place names), ≤4 words (longer
      // queries are rarely pure place names), and a high geocode relevance (≥0.85)
      // so common brand names / tech terms don't accidentally trigger the map.
      const words = searchQuery.trim().split(/\s+/);
      if (!isQuestionQuery(searchQuery) && words.length >= 2 && words.length <= 4) {
        try {
          const result = await MapApiService.geocode(searchQuery, { types: 'poi,address,place' });
          const best = result?.data?.[0];
          if (best && best.relevance >= 0.85) {
            const coords = toLatLng(best.position);
            setQueryType('place');
            setDetectedLocation({
              query: searchQuery,
              type: 'place',
              // No subject: the whole query WAS the place. Consumers can then
              // rely on `subject` always existing rather than testing for it.
              subject: '',
              locationName: searchQuery.trim(),
              coordinates: coords,
              address: best.address,
            });
            setIsLocationQuery(true);
            return coords;
          }
        } catch (err) {
          // Not a recognizable place — fall through to a normal search.
        }
      }

      setIsLocationQuery(false);
      return null;
    } catch (err) {
      setError(err.message);
      setIsLocationQuery(false);
      return null;
    } finally {
      setIsDetecting(false);
    }
  }, []);

  const getUserLocation = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          reject(new Error(`Geolocation error: ${error.message}`));
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0,
        }
      );
    });
  }, []);

  const reverseGeocode = useCallback(async (lat, lng) => {
    try {
      const result = await MapApiService.reverseGeocode(lat, lng);
      if (result && result.data) {
        return result.data.address;
      }
      return null;
    } catch (err) {
      console.error('Reverse geocoding error:', err);
      return null;
    }
  }, []);

  const calculateDistance = useCallback(async (origin, destination) => {
    try {
      const result = await MapApiService.getDistance(
        { lat: origin.lat, lng: origin.lng },
        { lat: destination.lat, lng: destination.lng }
      );
      return result;
    } catch (err) {
      console.error('Distance calculation error:', err);
      return null;
    }
  }, []);

  const getRoute = useCallback(async (origin, destination, options = {}) => {
    try {
      const result = await MapApiService.getDirections(
        { lat: origin.lat, lng: origin.lng },
        { lat: destination.lat, lng: destination.lng },
        options
      );
      return result;
    } catch (err) {
      console.error('Route calculation error:', err);
      return null;
    }
  }, []);

  useEffect(() => {
    if (query) {
      detectLocation(query);
    }
  }, [query, detectLocation]);

  const value = useMemo(() => ({
    isLocationQuery,
    detectedLocation,
    queryType,
    isDetecting,
    error,
    detectLocation,
    reverseGeocode,
    calculateDistance,
    getRoute,
  }), [
    isLocationQuery,
    detectedLocation,
    queryType,
    isDetecting,
    error,
    detectLocation,
    reverseGeocode,
    calculateDistance,
    getRoute,
  ]);

  return value;
}

export default useLocationDetection;