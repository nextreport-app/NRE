export type ReportPollStatus = "PENDING" | "GENERATING" | "COMPLETE" | "FAILED";

export interface ReportStatusResponse {
  status: ReportPollStatus;
  shareToken?: string | null;
  errorMessage?: string | null;
}

export class ReportGenerationPollError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReportGenerationPollError";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  const intervalMs = options?.intervalMs ?? 2500;
  const maxAttempts = options?.maxAttempts ?? 120;
  const fetchFn = options?.fetchFn ?? fetch;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetchFn(`/api/reports/${reportId}/status`);
    const json = (await res.json().catch(() => null)) as ReportStatusResponse | null;

    if (!res.ok || !json?.status) {
      throw new ReportGenerationPollError("Could not check report status. Please try again.");
    }

    if (json.status === "COMPLETE") {
      return { shareToken: json.shareToken ?? null };
    }

    if (json.status === "FAILED") {
      throw new ReportGenerationPollError(json.errorMessage || "Report generation failed.");
    }

    if (attempt < maxAttempts - 1) {
      await sleep(intervalMs);
    }
  }

  throw new ReportGenerationPollError("Report generation is taking longer than expected. Check report history shortly.");
}
