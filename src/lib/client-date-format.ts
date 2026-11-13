/** Client currency provides the regional default until clients have a country setting. */
export function clientDateLocale(currency?: string): string {
  return ({ INR: "en-IN", USD: "en-US", GBP: "en-GB", AUD: "en-AU", CAD: "en-CA", NZD: "en-NZ", AED: "en-AE", SGD: "en-SG", MYR: "en-MY", PHP: "en-PH", EUR: "en-GB", ZAR: "en-ZA", BRL: "pt-BR", MXN: "es-MX" } as Record<string, string>)[currency ?? ""] ?? "en-GB";
}

/** Calendar dates never pass through the browser timezone. ISO stays the wire/storage format. */
export function formatClientCalendarDate(iso: string, currency?: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const date = new Date(`${iso}T12:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== iso) return iso;
  return new Intl.DateTimeFormat(clientDateLocale(currency), { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

export function formatClientCalendarRange(start: string, end: string, currency?: string): string {
  return start === end ? formatClientCalendarDate(start, currency) : `${formatClientCalendarDate(start, currency)} – ${formatClientCalendarDate(end, currency)}`;
}

/** Actual timestamps use the client's timezone, with an explicit UTC fallback. */
export function formatClientTimestamp(value: string | Date, currency?: string, timezone = "UTC", includeTime = true): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat(clientDateLocale(currency), { timeZone: timezone, day: "2-digit", month: "2-digit", year: "numeric", ...(includeTime ? { hour: "2-digit", minute: "2-digit" } as const : {}) }).format(date);
}

/** Legacy report periods are always stored MM/DD/YYYY; never guess their order. */
export function storedReportDateToIso(value: string): string | null {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  if (!match) return null;
  const iso = `${match[3]}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
  const date = new Date(`${iso}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === iso ? iso : null;
}

/** Account-wide pages have no client region: spell the month out to avoid ambiguity. */
export function formatUnambiguousDate(value: string | Date): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }).format(typeof value === "string" ? new Date(value) : value);
}

/** Only for app-generated labels containing ISO or legacy US dates, never free-form user text. */
export function formatStoredDateText(text: string, currency?: string): string {
  if (!currency) return text;
  return text.replace(/\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})\b/g, value => {
    const iso = value.includes("-") ? value : storedReportDateToIso(value);
    return iso ? formatClientCalendarDate(iso, currency) : value;
  });
}
