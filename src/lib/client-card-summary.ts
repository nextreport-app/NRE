export type ClientConnectionState = "connected" | "reconnect" | "not-linked";
/** Saved setup state only; never implies a live API health check. */
export function clientConnectionState(linked: boolean, authorized: boolean): ClientConnectionState {
  return !linked ? "not-linked" : authorized ? "connected" : "reconnect";
}
export function clientActivityDate(iso: string, timezone: string, includeTime = false): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "Unavailable";
  const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric", ...(includeTime ? { hour: "numeric", minute: "2-digit" } : {}) };
  try { return new Intl.DateTimeFormat("en-US", { ...options, timeZone: timezone }).format(date); }
  catch { return new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" }).format(date); }
}
