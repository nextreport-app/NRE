"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_SITE_LOCALE,
  DEFAULT_SITE_THEME,
  SITE_LOCALE_STORAGE_KEY,
  SITE_THEME_STORAGE_KEY,
  resolveSiteTheme,
  isSiteLocaleId,
  type SiteLocaleId,
  type SiteThemeMode,
} from "@/lib/site-theme";

type SiteThemeContextValue = {
  themeMode: SiteThemeMode;
  resolvedTheme: "light" | "dark";
  setThemeMode: (mode: SiteThemeMode) => void;
  locale: SiteLocaleId;
  setLocale: (locale: SiteLocaleId) => void;
};

const SiteThemeContext = createContext<SiteThemeContextValue | null>(null);

function readStoredTheme(): SiteThemeMode {
  if (typeof window === "undefined") return DEFAULT_SITE_THEME;
  try {
    const raw = localStorage.getItem(SITE_THEME_STORAGE_KEY);
    if (raw === "light" || raw === "dark" || raw === "system") return raw;
  } catch {
    /* ignore */
  }
  return DEFAULT_SITE_THEME;
}

function readStoredLocale(): SiteLocaleId {
  if (typeof window === "undefined") return DEFAULT_SITE_LOCALE;
  try {
    const raw = localStorage.getItem(SITE_LOCALE_STORAGE_KEY);
    if (raw && isSiteLocaleId(raw)) return raw;
  } catch {
    /* ignore */
  }
  return DEFAULT_SITE_LOCALE;
}

function applyDocumentTheme(resolved: "light" | "dark") {
  document.documentElement.dataset.siteTheme = resolved;
  document.documentElement.style.colorScheme = resolved;
}

function applyDocumentLocale(locale: SiteLocaleId) {
  document.documentElement.lang = locale === "zh" ? "zh-Hans" : locale;
}

export function SiteThemeProvider({ children }: { children: ReactNode }) {
  const [themeMode, setThemeModeState] = useState<SiteThemeMode>(DEFAULT_SITE_THEME);
  const [locale, setLocaleState] = useState<SiteLocaleId>(DEFAULT_SITE_LOCALE);
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    setThemeModeState(readStoredTheme());
    setLocaleState(readStoredLocale());
  }, []);

  useEffect(() => {
    const resolved = themeMode === "system" ? resolveSiteTheme("system") : resolveSiteTheme(themeMode);
    setResolvedTheme(resolved);
    applyDocumentTheme(resolved);
    applyDocumentLocale(locale);
  }, [themeMode, locale]);

  useEffect(() => {
    if (themeMode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => setResolvedTheme(resolveSiteTheme("system"));
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [themeMode]);

  const setThemeMode = useCallback((mode: SiteThemeMode) => {
    setThemeModeState(mode);
    try {
      localStorage.setItem(SITE_THEME_STORAGE_KEY, mode);
    } catch {
      /* ignore */
    }
  }, []);

  const setLocale = useCallback((next: SiteLocaleId) => {
    setLocaleState(next);
    try {
      localStorage.setItem(SITE_LOCALE_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(
    () => ({ themeMode, resolvedTheme, setThemeMode, locale, setLocale }),
    [themeMode, resolvedTheme, setThemeMode, locale, setLocale],
  );

  return <SiteThemeContext.Provider value={value}>{children}</SiteThemeContext.Provider>;
}

export function useSiteTheme() {
  const ctx = useContext(SiteThemeContext);
  if (!ctx) throw new Error("useSiteTheme must be used within SiteThemeProvider");
  return ctx;
}

/** Inline boot script — runs before paint to avoid theme flash. */
export const SITE_THEME_BOOT_SCRIPT = `(function(){try{
var t=localStorage.getItem("${SITE_THEME_STORAGE_KEY}");
var l=localStorage.getItem("${SITE_LOCALE_STORAGE_KEY}");
var locales=${JSON.stringify(["en", "es", "fr", "pt", "de", "ru", "it", "zh", "bn", "mr", "te", "ta"])};
if(l&&locales.indexOf(l)!==-1){document.documentElement.lang=l==="zh"?"zh-Hans":l;}
var mode=t==="light"||t==="dark"||t==="system"?t:"dark";
var light=mode==="light"||(mode==="system"&&window.matchMedia("(prefers-color-scheme: light)").matches);
document.documentElement.dataset.siteTheme=light?"light":"dark";
document.documentElement.style.colorScheme=light?"light":"dark";
}catch(e){}})();`;
