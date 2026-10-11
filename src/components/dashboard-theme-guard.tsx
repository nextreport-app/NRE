"use client";

import { useEffect } from "react";
import { resolveSiteTheme, SITE_THEME_STORAGE_KEY, type SiteThemeMode } from "@/lib/site-theme";

/**
 * Dashboard + wizard always render dark. Visitor theme preference (light/dark/system)
 * still applies on marketing pages and is restored when they leave the app shell.
 */
export function DashboardThemeGuard({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.documentElement.dataset.siteTheme = "dark";
    document.documentElement.style.colorScheme = "dark";

    return () => {
      let mode: SiteThemeMode = "dark";
      try {
        const raw = localStorage.getItem(SITE_THEME_STORAGE_KEY);
        if (raw === "light" || raw === "dark" || raw === "system") mode = raw;
      } catch {
        /* ignore */
      }
      const resolved = resolveSiteTheme(mode);
      document.documentElement.dataset.siteTheme = resolved;
      document.documentElement.style.colorScheme = resolved;
    };
  }, []);

  return children;
}
