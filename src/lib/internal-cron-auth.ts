/**
 * Shared auth for Vercel cron routes and the internal report-generation worker.
 * These callers use Authorization: Bearer CRON_SECRET — no NextAuth session.
 */
export function isCronBearerAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export function isInternalWorkerPath(pathname: string): boolean {
  return pathname.startsWith("/api/cron/") || pathname === "/api/jobs/generate-report";
}
