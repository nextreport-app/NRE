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
export const REFRESH_INTERVAL_MS = 5 * 60 * 1000;
/** Share the server cooldown; failed attempts also wait before retrying. */
export function refreshableChecks(
  clients: OverviewRow[],
  now: number,
  attempts: Map<string, number>,
  scopeId = "",
  manual = false,
): DueCheck[] {
  return clients.flatMap((c) => {
    if (!c.linked || (scopeId && c.id !== scopeId)) return [];
    const jobs: DueCheck[] = [];
    for (const kind of ["performance-monitor", "budget-monitor"] as const) {
      const performance = kind === "performance-monitor";
      if (!(performance ? c.performanceEnabled : c.budgetEnabled)) continue;
      if (performance && c.comparison.customStart && !manual) continue;
      const checkedAt = performance
        ? c.performance?.checkedAt
        : c.budget?.checkedAt;
      const checked = checkedAt ? Date.parse(checkedAt) : 0;
      const latest = Math.max(
        Number.isFinite(checked) ? checked : 0,
        attempts.get(`${c.id}:${kind}`) ?? 0,
      );
      if (now - latest >= REFRESH_INTERVAL_MS)
        jobs.push({ id: c.id, name: c.name, kind });
    }
    return jobs;
  });
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
