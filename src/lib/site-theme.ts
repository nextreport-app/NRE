/**
 * Cursor-style site theme: same pages and layout; only the marketing palette swaps
 * (dark navy ↔ light gray/white, text inverted for contrast). Accent orange unchanged.
 * Dashboard/wizard always stay dark ({@link DASHBOARD_THEME_LOCK_CLASS} + DashboardThemeGuard).
 */

export type SiteThemeMode = "system" | "light" | "dark";

export const SITE_THEME_STORAGE_KEY = "nre.site-theme";
export const SITE_LOCALE_STORAGE_KEY = "nre.locale";

export const DEFAULT_SITE_THEME: SiteThemeMode = "dark";

export const SITE_LOCALES = [
  { id: "en", label: "English" },
  { id: "es", label: "Español" },
  { id: "fr", label: "Français" },
  { id: "pt", label: "Português" },
  { id: "de", label: "Deutsch" },
  { id: "ru", label: "Русский" },
  { id: "it", label: "Italiano" },
  { id: "zh", label: "中文" },
  { id: "bn", label: "বাংলা" },
  { id: "mr", label: "मराठी" },
  { id: "te", label: "తెలుగు" },
  { id: "ta", label: "தமிழ்" },
] as const;

export type SiteLocaleId = (typeof SITE_LOCALES)[number]["id"];

export const DEFAULT_SITE_LOCALE: SiteLocaleId = "en";

export function isSiteLocaleId(value: string): value is SiteLocaleId {
  return SITE_LOCALES.some((l) => l.id === value);
}

export function resolveSiteTheme(mode: SiteThemeMode): "light" | "dark" {
  if (mode === "light") return "light";
  if (mode === "dark") return "dark";
  if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: light)").matches) {
    return "light";
  }
  return "dark";
}

/** Wrapper class on logged-in app shell — keeps wizard/dashboard on dark tokens. */
export const DASHBOARD_THEME_LOCK_CLASS = "nre-theme-dark-lock";
