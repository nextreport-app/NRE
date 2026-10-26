/** Keep Preview/local reports on their own deployment; production keeps its own host. */
export function buildShareReportAbsoluteUrl(shareToken: string, origin?: string): string {
  const reportOrigin = origin ?? (typeof window !== "undefined" ? window.location.origin : "https://nextreport.in");
  return new URL(`/r/${encodeURIComponent(shareToken)}`, reportOrigin).href;
}
