"use client";

import { useState, useEffect, useCallback } from 'react';
import { applyThemeToDocument, readStoredTheme, THEME_STORAGE_KEY } from '@/lib/theme';

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  language: 'es' | 'en';
  showAlerts: boolean;
  minAlertSeverity: 'low' | 'medium' | 'high' | 'critical';
  defaultZoom: number;
  autoCenter: boolean;
  showRoadLabels: boolean;
}

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
      const raw = localStorage.getItem(THEME_STORAGE_KEY);
      const stored = raw ? JSON.parse(raw) : null;
      return stored ? { ...DEFAULTS, ...stored, theme: readStoredTheme(raw) } : DEFAULTS;
    } catch {
      return DEFAULTS;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Ignore storage failures in restricted environments.
    }
  }, [settings]);

  useEffect(() => {
    applyThemeToDocument(settings.theme);
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
