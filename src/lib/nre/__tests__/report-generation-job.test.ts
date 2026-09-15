import { describe, expect, it } from "vitest";
import {
  parseReportGenerationJob,
  serializeReportGenerationJob,
  type StandardReportJobPayload,
} from "../report-generation-job";

describe("report-generation-job", () => {
  it("round-trips a standard job payload", () => {
    const payload: StandardReportJobPayload = {
      version: 1,
      kind: "STANDARD",
      userId: "user-1",
      clientId: "client-1",
      uploadSessionId: "550e8400-e29b-41d4-a716-446655440000",
      platform: "META",
      reportTitle: "Weekly Performance Report",
      reportData: {
        reportType: "WEEKLY",
        fileDateRange: "Aug 1 to Aug 26",
        isPaused: false,
        cover: { healthScore: 80, healthBadge: "Good", dateRange: "Aug 1 to Aug 26", budgetSummary: null },
        campaignSlides: [],
        adSetSlides: [],
        periodRow: { fullMonthLabel: "August 2026" },
      } as StandardReportJobPayload["reportData"],
    };

    const raw = serializeReportGenerationJob(payload);
    const parsed = parseReportGenerationJob(raw);
    expect(parsed).toEqual(payload);
  });

  it("returns null for invalid payload", () => {
    expect(parseReportGenerationJob(null)).toBeNull();
    expect(parseReportGenerationJob("{")).toBeNull();
    expect(parseReportGenerationJob(JSON.stringify({ version: 99, kind: "STANDARD" }))).toBeNull();
  });
});
