"use client";

import { useState, useEffect, useCallback } from 'react';

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  language: 'es' | 'en';
  showAlerts: boolean;
  minAlertSeverity: 'low' | 'medium' | 'high' | 'critical';
  defaultZoom: number;
  autoCenter: boolean;
  showRoadLabels: boolean;
}

const STORAGE_KEY = 'viabaq:settings';

const DEFAULTS: AppSettings = {
  theme: 'system',
  language: 'es',
  showAlerts: true,
  minAlertSeverity: 'low',
  defaultZoom: 13,
  autoCenter: true,
  showRoadLabels: true,
};

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(() => {
    if (typeof window === 'undefined') return DEFAULTS;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? { ...DEFAULTS, ...JSON.parse(stored) } : DEFAULTS;
    } catch {
      return DEFAULTS;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'dark') {
      root.classList.add('dark');
    } else if (settings.theme === 'light') {
      root.classList.remove('dark');
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', prefersDark);
    }
  }, [settings.theme]);

  const updateSetting = useCallback(<K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULTS);
  }, []);

  return { settings, updateSetting, resetSettings };
}
