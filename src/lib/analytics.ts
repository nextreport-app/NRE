/** No private routes, report tokens, sensitive query strings, emails, or form contents in analytics. */
export const ANALYTICS_CONSENT_KEY = "nre.analytics-consent.v1";
export const ANALYTICS_PUBLIC_PATHS = new Set([
  "/",
  "/pricing",
  "/how-it-works",
  "/help/download",
  "/help/metrics",
  "/help/objectives",
  "/about",
  "/contact",
  "/book-demo",
  "/refer",
  "/feedback",
  "/privacy",
  "/terms",
  "/data-deletion",
]);
export function validGaMeasurementId(id: string): boolean {
  return /^G-[A-Z0-9]+$/.test(id);
}
export function analyticsPageLocation(
  origin: string,
  pathname: string,
  search = "",
): string | null {
  if (!ANALYTICS_PUBLIC_PATHS.has(pathname)) return null;
  const safe = new URLSearchParams();
  const params = new URLSearchParams(search);
  for (const key of [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_id",
    "utm_content",
    "utm_term",
  ]) {
    const value = params.get(key);
    if (value && /^[a-z][a-z0-9_-]{0,63}$/i.test(value) && !/\d{7}/.test(value))
      safe.set(key, value);
  }
  return `${origin}${pathname}${safe.size ? `?${safe}` : ""}`;
}
