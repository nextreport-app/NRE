"use client";

import { SITE_LOCALES, type SiteThemeMode } from "@/lib/site-theme";
import { footerCopy } from "@/lib/footer-i18n";
import { useSiteTheme } from "@/components/site-theme-provider";

function ThemeIcon({ kind }: { kind: "system" | "light" | "dark" }) {
  if (kind === "light") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path strokeLinecap="round" d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
    );
  }
  if (kind === "dark") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
      <rect x="3" y="4" width="18" height="13" rx="2" />
      <path strokeLinecap="round" d="M8 20h8" />
    </svg>
  );
}

const THEME_OPTIONS: { mode: SiteThemeMode; label: string; icon: "system" | "light" | "dark" }[] = [
  { mode: "system", label: "System theme", icon: "system" },
  { mode: "light", label: "Light theme", icon: "light" },
  { mode: "dark", label: "Dark theme", icon: "dark" },
];

export function SiteThemeControls() {
  const { themeMode, setThemeMode, locale, setLocale } = useSiteTheme();
  const localeNote = footerCopy(locale).uiEnglishNote;

  return (
    <div className="flex flex-col items-center gap-2 sm:items-end">
    <div className="flex flex-wrap items-center justify-center gap-4 sm:justify-end">
      <div className="flex items-center gap-0.5 rounded-full border border-navy-border bg-navy-panel/50 p-0.5">
        {THEME_OPTIONS.map((opt) => {
          const active = themeMode === opt.mode;
          return (
            <button
              key={opt.mode}
              type="button"
              title={opt.label}
              aria-label={opt.label}
              aria-pressed={active}
              onClick={() => setThemeMode(opt.mode)}
              className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                active ? "bg-ink text-navy" : "text-ink-muted hover:text-ink-secondary"
              }`}
            >
              <ThemeIcon kind={opt.icon} />
            </button>
          );
        })}
      </div>

      <label className="flex items-center gap-2 text-sm text-ink-muted">
        <span className="sr-only">Language</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 shrink-0" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path strokeLinecap="round" d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
        </svg>
        <select
          value={locale}
          onChange={(e) => setLocale(e.target.value as typeof locale)}
          className="max-w-[9.5rem] cursor-pointer rounded-md border border-navy-border bg-navy-panel py-1.5 pl-2 pr-7 text-sm text-ink-secondary outline-none focus:border-accent"
          aria-label="Site language"
        >
          {SITE_LOCALES.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.label}
            </option>
          ))}
        </select>
      </label>
    </div>
    {localeNote ? (
      <p className="max-w-md text-center text-[11px] leading-snug text-ink-muted sm:text-right" role="status">
        {localeNote}
      </p>
    ) : null}
    </div>
  );
}
