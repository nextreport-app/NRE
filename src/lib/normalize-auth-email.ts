/** Single normalization for credentials login, signup, and password reset lookup. */
export function normalizeAuthEmail(raw: string): string {
  return raw.trim().toLowerCase();
}
