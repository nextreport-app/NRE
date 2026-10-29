/** Shared visual language for every day/month picker in the report wizard. */
export const CALENDAR_TRIGGER = "flex w-full items-center justify-between gap-3 rounded-lg border border-dash-border bg-dash-bg px-4 py-3 text-left text-sm font-medium text-dash-ink hover:border-dash-ink-secondary focus-visible:outline-2 focus-visible:outline-dash-accent disabled:cursor-not-allowed disabled:opacity-50";
export const CALENDAR_PANEL = "absolute z-40 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-dash-border bg-dash-popover nre-dash-surface p-3 shadow-xl";
export const CALENDAR_NAV = "h-9 w-9 rounded-md text-dash-ink hover:bg-dash-card disabled:opacity-30 disabled:cursor-not-allowed";
export function CalendarIcon() {
  return <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="shrink-0 text-dash-ink-secondary"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M16 3v4M8 3v4M3 11h18"/></svg>;
}
