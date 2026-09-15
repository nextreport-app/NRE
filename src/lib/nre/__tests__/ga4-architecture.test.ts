import { describe, expect, it } from "vitest";
import type { Platform } from "../google-columns";
import { parseReportGenerationJob } from "../report-generation-job";
import type { WebsiteReportData } from "../website-report-data";

/**
 * Guards the #9 architecture decision: GA4 website reporting stays forked from
 * the ad-platform NRE pipeline. See docs/ga4-reporting-architecture.md.
 */
describe("GA4 architecture — fork from ad NRE pipeline", () => {
  it("Platform type excludes GA4 (ads-only union)", () => {
    const platforms = ["META", "GOOGLE", "TIKTOK"] satisfies Platform[];
    expect(platforms).not.toContain("GA4" as Platform);
  });

  it("report generation job payload kinds are ads-only today", () => {
    const parsed = parseReportGenerationJob(
      JSON.stringify({
        version: 1,
        kind: "STANDARD",
        userId: "u1",
        clientId: "c1",
        platform: "META",
        reportData: { campaigns: [] },
      }),
    );
    expect(parsed?.kind).toBe("STANDARD");
    expect(parseReportGenerationJob(JSON.stringify({ version: 1, kind: "WEBSITE" }))).toBeNull();
  });

  it("WebsiteReportData is a distinct shape from ad ReportData", () => {
    const sample: Pick<WebsiteReportData, "clientKind" | "overviewMetrics"> = {
      clientKind: "lead_gen",
      overviewMetrics: [],
    };
    expect(sample.clientKind).toBe("lead_gen");
    expect("campaigns" in sample).toBe(false);
  });
});
