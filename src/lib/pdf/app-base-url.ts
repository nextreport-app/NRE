/** Canonical app origin for server-side Puppeteer navigation to print routes. */
export function appBaseUrl(): string {
  const production =
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim();
  if (production) return production.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`;
  return "http://127.0.0.1:3000";
}
