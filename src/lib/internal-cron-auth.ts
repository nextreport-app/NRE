/**
 * Shared auth for Vercel cron routes and the internal report-generation worker.
 * Most callers use CRON_SECRET; the exact report-scheduler endpoint can use
 * its dedicated secret. Neither requires a browser session.
 */
import { reportSchedulerSecret } from "./report-schedules/secret";

export function isCronBearerAuthorized(request: Request): boolean {
  const secret =
    new URL(request.url).pathname === "/api/cron/report-schedules"
      ? reportSchedulerSecret()
      : process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export function isInternalWorkerPath(pathname: string): boolean {
  return (
    pathname.startsWith("/api/cron/") ||
    pathname === "/api/jobs/generate-report"
  );
}
