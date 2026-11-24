const DEFAULT_DESTINATION = "/clients";
/** Keep login callbacks local, preserve client context, and avoid loops back into authentication. */
export function safeAuthRedirect(value: string | null | undefined): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    /[\u0000-\u0020]/.test(value)
  )
    return DEFAULT_DESTINATION;
  try {
    const base = "https://nextreport.local";
    const url = new URL(value, base);
    const path = decodeURIComponent(url.pathname);
    if (
      path.startsWith("//") ||
      path.includes("\\") ||
      /[\u0000-\u0020]/.test(path)
    )
      return DEFAULT_DESTINATION;
    const normalized = new URL(path, base);
    if (
      url.origin !== base ||
      normalized.origin !== base ||
      ["/login", "/signup"].includes(normalized.pathname.replace(/\/$/, ""))
    )
      return DEFAULT_DESTINATION;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return DEFAULT_DESTINATION;
  }
}
