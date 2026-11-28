export type ReportPollStatus = "PENDING" | "GENERATING" | "COMPLETE" | "FAILED";

export interface ReportStatusResponse {
  status: ReportPollStatus;
  shareToken?: string | null;
  errorMessage?: string | null;
}

export class ReportGenerationPollError extends Error {
  constructor(message: string, readonly reason: "failed" | "unavailable" | "timeout" = "unavailable") {
    super(message);
    this.name = "ReportGenerationPollError";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Faster early polls so the generate screen finishes sooner after the worker completes. */
export function reportStatusPollIntervalMs(attempt: number, fixedIntervalMs?: number): number {
  if (fixedIntervalMs != null && fixedIntervalMs > 0) return fixedIntervalMs;
  if (attempt < 25) return 600;
  if (attempt < 50) return 1200;
  return 2500;
}

/** Poll GET /api/reports/:id/status until COMPLETE or FAILED. */
export async function pollReportStatus(
  reportId: string,
  options?: {
    intervalMs?: number;
    maxAttempts?: number;
    fetchFn?: typeof fetch;
  },
): Promise<{ shareToken: string | null }> {
  const maxAttempts = options?.maxAttempts ?? 120;
  const fetchFn = options?.fetchFn ?? fetch;

  let consecutiveFailures = 0;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let res: Response | null = null;
    let json: ReportStatusResponse | null = null;
    try {
      res = await fetchFn(`/api/reports/${reportId}/status`, { cache: "no-store" });
      json = await res.json().catch(() => null) as ReportStatusResponse | null;
    } catch {
      // A dropped status request does not mean the background job failed.
    }
    const validStatus = json && ["PENDING", "GENERATING", "COMPLETE", "FAILED"].includes(json.status);
    if (!res?.ok || !validStatus) {
      const transient = !res || res.status === 408 || res.status === 429 || res.status >= 500 || (res.ok && !validStatus);
      consecutiveFailures++;
      if (!transient || consecutiveFailures >= 3 || attempt === maxAttempts - 1) {
        throw new ReportGenerationPollError("Could not check report status. Check report history before generating again.");
      }
      await sleep(reportStatusPollIntervalMs(attempt, options?.intervalMs));
      continue;
    }
    consecutiveFailures = 0;
    if (!json) continue;

    if (json.status === "COMPLETE") {
      return { shareToken: json.shareToken ?? null };
    }

    if (json.status === "FAILED") {
      throw new ReportGenerationPollError(json.errorMessage || "Report generation failed.", "failed");
    }

    if (attempt < maxAttempts - 1) {
      await sleep(reportStatusPollIntervalMs(attempt, options?.intervalMs));
    }
  }

  throw new ReportGenerationPollError("Report generation is taking longer than expected. Check report history shortly.", "timeout");
}
