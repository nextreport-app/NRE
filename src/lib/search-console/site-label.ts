/** Keep URL-prefix paths visible, but hide Google's domain-property marker. */
export function searchConsoleSiteLabel(siteUrl: string): string {
  return siteUrl.startsWith("sc-domain:")
    ? siteUrl.slice("sc-domain:".length)
    : siteUrl;
}
