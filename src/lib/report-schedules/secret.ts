/** Server-side only: never return either value through an API or log it. */
export function reportSchedulerSecret(): string | null {
  return (
    process.env.REPORT_SCHEDULER_CRON_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    null
  );
}
