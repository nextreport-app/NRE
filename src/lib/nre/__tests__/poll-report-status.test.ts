import { describe, expect, it, vi } from "vitest";
import { pollReportStatus, ReportGenerationPollError } from "../poll-report-status";

describe("pollReportStatus", () => {
  it("returns immediately when first poll is COMPLETE", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: "COMPLETE", shareToken: "tok-1" }),
    });

    const result = await pollReportStatus("report-1", { fetchFn, intervalMs: 1, maxAttempts: 3 });
    expect(result.shareToken).toBe("tok-1");
    expect(fetchFn).toHaveBeenCalledOnce();
  });

  it("polls until COMPLETE", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: "GENERATING" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: "COMPLETE", shareToken: null }),
      });

    const result = await pollReportStatus("report-2", { fetchFn, intervalMs: 1, maxAttempts: 5 });
    expect(result.shareToken).toBeNull();
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("throws on FAILED status", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: "FAILED", errorMessage: "AI timeout" }),
    });

    await expect(pollReportStatus("report-3", { fetchFn, intervalMs: 1, maxAttempts: 2 })).rejects.toThrow(
      ReportGenerationPollError,
    );
  });
});
