/** Canonical app origin for absolute asset URLs in PDF/HTML export. */
export function appBaseUrl(): string {
  if (process.env.VERCEL_ENV === "production") {
    return "https://nextreport.in";
  }

  const explicit =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`;
  return "http://127.0.0.1:3000";
}
