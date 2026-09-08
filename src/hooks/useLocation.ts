import { useState, useEffect, useCallback } from 'react';

export interface LocationData {
  lat: number;
  lon: number;
  city?: string;
  state?: string;
  district?: string;
  country?: string;
  timestamp: number;
}

export const useLocation = () => {
  const [location, setLocation] = useState<LocationData | null>(() => {
    const saved = localStorage.getItem('agri_location');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Cache for 1 hour
        if (Date.now() - parsed.timestamp < 3600000) {
          return parsed;
        }
      } catch (e) {
        console.error("Failed to parse cached location", e);
      }
    }
    return null;
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  const reverseGeocode = async (lat: number, lon: number) => {
    try {
      const apiKey = import.meta.env.VITE_WEATHER_API_KEY;
      const res = await fetch(`https://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${apiKey}`);
      const data = await res.json();
      
      if (data && data.length > 0) {
        const place = data[0];
        return {
          city: place.name,
          state: place.state,
          district: place.state, // OpenWeatherMap doesn't always provide district, using state as fallback
          country: place.country
        };
      }
    } catch (e) {
      console.error("Reverse geocoding failed", e);
    }
    return {};
  };

  const fetchLocation = useCallback(async (manual: boolean = false) => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      return;
    }

    setLoading(true);
    setError(null);
    setDenied(false);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const geoInfo = await reverseGeocode(latitude, longitude);
        
        const newLocation: LocationData = {
          lat: latitude,
          lon: longitude,
          ...geoInfo,
          timestamp: Date.now()
        };

        setLocation(newLocation);
        localStorage.setItem('agri_location', JSON.stringify(newLocation));
        setLoading(false);
      },
      (err) => {
        if (import.meta.env.DEV) {
          console.warn("Geolocation error:", err);
        }
        if (err.code === err.PERMISSION_DENIED) {
          setDenied(true);
          setError("Location access denied. Please enable it in your browser settings.");
        } else {
          setError("Could not determine your location.");
        }
        setLoading(false);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }, []);

  useEffect(() => {
    if (!location) {
      fetchLocation();
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setManualLocation = (city: string) => {
    const manualLoc: any = { // Using any to bypass strict lat/lon requirement for manual selection
      city: city,
      state: '',
      district: '',
      timestamp: Date.now()
    };
    setLocation(manualLoc);
    localStorage.setItem('agri_location', JSON.stringify(manualLoc));
  };

  return { 
    location, 
    loading, 
    error, 
    denied, 
    refresh: () => fetchLocation(true),
    setManualLocation
  };
};
