/** Resolve IANA aliases without treating unrelated zones with the same current offset as equal. */
export function canonicalTimezone(timezone: string): string | null {
  if (typeof timezone !== "string" || !timezone) return null;
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
    }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
}
export function timezonesEquivalent(a: string, b: string): boolean {
  const first = canonicalTimezone(a);
  return first !== null && first === canonicalTimezone(b);
}
