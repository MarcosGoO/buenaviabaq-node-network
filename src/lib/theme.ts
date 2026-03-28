export const THEME_STORAGE_KEY = "viabaq:settings"

export type AppTheme = "light" | "dark" | "system"

interface StoredThemeSettings {
  theme?: AppTheme
}

export function readStoredTheme(raw: string | null): AppTheme {
  if (!raw) {
    return "system"
  }

  try {
    const parsed = JSON.parse(raw) as StoredThemeSettings
    if (parsed.theme === "light" || parsed.theme === "dark" || parsed.theme === "system") {
      return parsed.theme
    }
  } catch {
    return "system"
  }

  return "system"
}

export function applyThemeToDocument(theme: AppTheme, root: HTMLElement = document.documentElement) {
  if (theme === "dark") {
    root.classList.add("dark")
    return
  }

  if (theme === "light") {
    root.classList.remove("dark")
    return
  }

  root.classList.toggle("dark", window.matchMedia("(prefers-color-scheme: dark)").matches)
}

export function getThemeBootstrapScript() {
  return `(() => {
    try {
      const raw = localStorage.getItem('${THEME_STORAGE_KEY}');
      const parsed = raw ? JSON.parse(raw) : null;
      const theme = parsed?.theme;
      const root = document.documentElement;
      if (theme === 'dark') root.classList.add('dark');
      else if (theme === 'light') root.classList.remove('dark');
      else root.classList.toggle('dark', window.matchMedia('(prefers-color-scheme: dark)').matches);
    } catch {}
  })();`
}
