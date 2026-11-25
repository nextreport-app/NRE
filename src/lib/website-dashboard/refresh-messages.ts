/** Shared fallback copy for failures without a specific Google diagnostic. */
export const WEBSITE_RANGE_REFRESH_FAILED = "Website data could not be loaded for the selected dates. Try Last 30 days or Custom dates, then refresh again. Prior figures are not a fresh check.";
const LEGACY_REFRESH_FAILED = "GA4 refresh failed. Check your Analytics connection and property access, then retry. Prior figures are not a fresh check.";
export function isWebsiteRangeFailure(message: string | null | undefined) {
  return message === WEBSITE_RANGE_REFRESH_FAILED || message === LEGACY_REFRESH_FAILED;
}
