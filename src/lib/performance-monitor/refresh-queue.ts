import type { OverviewRow } from "../agency-overview";
export interface DueCheck {
  id: string;
  name: string;
  kind: "performance-monitor" | "budget-monitor";
}
export function dueChecks(clients: OverviewRow[]): DueCheck[] {
  return clients.flatMap((c) =>
    !c.linked
      ? []
      : [
          ...(c.performanceEnabled &&
          !c.performanceFresh &&
          !c.comparison.customStart
            ? [{ id: c.id, name: c.name, kind: "performance-monitor" as const }]
            : []),
          ...(c.budgetEnabled && !c.budgetFresh
            ? [{ id: c.id, name: c.name, kind: "budget-monitor" as const }]
            : []),
        ],
  );
}
export async function runDueChecks(
  jobs: DueCheck[],
  check: (job: DueCheck) => Promise<void>,
  cancelled: () => boolean,
  onProgress: (finished: number) => void,
) {
  let cursor = 0,
    finished = 0;
  const failed: { job: DueCheck; error: string }[] = [];
  async function worker() {
    while (!cancelled()) {
      const job = jobs[cursor++];
      if (!job) return;
      try {
        await check(job);
      } catch (error) {
        failed.push({
          job,
          error: error instanceof Error ? error.message : "Check failed.",
        });
      } finally {
        onProgress(++finished);
      }
    }
  }
  await Promise.all([worker(), worker()]);
  return { finished, failed, unstarted: jobs.length - finished };
}
