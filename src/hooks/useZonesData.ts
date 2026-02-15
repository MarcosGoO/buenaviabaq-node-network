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

        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'}/geo/zones`);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.success && data.data) {
          setZones(data.data);
        }
      } catch (err) {
        console.error('Failed to fetch zones:', err);
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
