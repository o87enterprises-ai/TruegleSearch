import { useState, useCallback, useEffect, useMemo } from 'react';
import MapApiService from '../components/map/services/mapApi';

const LOCATION_KEYWORDS = {
  nearMe: ['near me', 'nearby', 'around me', 'close to me', 'closest'],
  inCity: ['in ', 'at '],
  directions: ['directions to', 'route to', 'get to', 'how to get to', 'navigate to'],
  distance: ['within ', 'within ', 'radius of ', 'around '],
};

const LOCATION_PATTERNS = [
  {
    pattern: /(?:in|at|near)\s+([A-Za-z\s]+)/i,
    type: 'location',
  },
  {
    pattern: /(\d{5})/,
    type: 'zipcode',
  },
  {
    pattern: /near\s+me/i,
    type: 'geolocation',
  },
  {
    pattern: /directions?\s+to\s+(.+)/i,
    type: 'directions',
  },
];

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
      for (const { pattern, type } of LOCATION_PATTERNS) {
        const match = searchQuery.match(pattern);
        if (match) {
          setQueryType(type);
          
          if (type === 'geolocation') {
            const position = await getUserLocation();
            if (position) {
              setDetectedLocation({
                query: searchQuery,
                type: 'geolocation',
                coordinates: position,
              });
              setIsLocationQuery(true);
              return position;
            }
          } else if (type === 'location') {
            const location = match[1].trim();
            const result = await MapApiService.geocode(location);
            if (result && result.data && result.data.length > 0) {
              const coords = result.data[0].position;
              setDetectedLocation({
                query: searchQuery,
                type: 'location',
                locationName: location,
                coordinates: coords,
                address: result.data[0].address,
              });
              setIsLocationQuery(true);
              return coords;
            }
          } else if (type === 'zipcode') {
            const zipcode = match[1];
            const result = await MapApiService.geocode(zipcode);
            if (result && result.data && result.data.length > 0) {
              const coords = result.data[0].position;
              setDetectedLocation({
                query: searchQuery,
                type: 'zipcode',
                zipcode,
                coordinates: coords,
                address: result.data[0].address,
              });
              setIsLocationQuery(true);
              return coords;
            }
          } else if (type === 'directions') {
            const destination = match[1].trim();
            const result = await MapApiService.geocode(destination);
            if (result && result.data && result.data.length > 0) {
              const coords = result.data[0].position;
              setDetectedLocation({
                query: searchQuery,
                type: 'directions',
                destination,
                coordinates: coords,
                address: result.data[0].address,
              });
              setIsLocationQuery(true);
              return coords;
            }
          }
          
          break;
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