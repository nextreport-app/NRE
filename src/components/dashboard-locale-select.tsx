"use client";

import { SITE_LOCALES } from "@/lib/site-theme";
import { useSiteTheme } from "@/components/site-theme-provider";

/** Language picker for logged-in shell (wizard has no public footer). */
export function DashboardLocaleSelect() {
  const { locale, setLocale } = useSiteTheme();

  return (
    <label className="flex shrink-0 items-center gap-1.5 text-[13px] text-dash-ink-secondary">
      <span className="sr-only">Language</span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 shrink-0" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path strokeLinecap="round" d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
      </svg>
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as typeof locale)}
        className="max-w-[8.5rem] cursor-pointer rounded-md border border-dash-border bg-dash-card py-1 pl-1.5 pr-6 text-[13px] text-dash-ink outline-none focus:border-dash-accent"
        aria-label="Site language"
      >
        {SITE_LOCALES.map((loc) => (
          <option key={loc.id} value={loc.id}>
            {loc.label}
          </option>
        ))}
      </select>
    </label>
  );
}
