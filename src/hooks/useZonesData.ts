"use client";

import { useEffect, useState } from 'react';

export interface Zone {
  id: number;
  name: string;
  geometry: {
    type: string;
    coordinates: number[][][];
  };
}

interface UseZonesDataReturn {
  zones: Zone[];
  isLoading: boolean;
  error: string | null;
}

export function useZonesData(): UseZonesDataReturn {
  const [zones, setZones] = useState<Zone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchZones = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
        console.log('📍 Fetching zones from:', `${apiUrl}/geo/zones`);

        const response = await fetch(`${apiUrl}/geo/zones`);

        if (!response.ok) {
          // If rate limited, just log and continue with empty state
          if (response.status === 429) {
            console.warn('⚠️ Rate limited - zones will load on next retry');
            setError('Rate limited - retrying soon');
            return;
          }
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('📍 Raw API response:', data);

        if (data.success && data.data) {
          console.log('✅ Successfully loaded zones:', data.data.length);
          setZones(data.data);
        } else {
          console.warn('⚠️ API response missing data:', data);
        }
      } catch (err) {
        console.error('❌ Failed to fetch zones:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchZones();
  }, []);

  return {
    zones,
    isLoading,
    error,
  };
}
