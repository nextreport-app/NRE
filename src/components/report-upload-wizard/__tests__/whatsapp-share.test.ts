import { describe, expect, it } from "vitest";
import { buildClientReportWhatsAppShareUrl } from "../utils";

describe("buildClientReportWhatsAppShareUrl", () => {
  it("includes client name, report type, platform, dates, and link", () => {
    const url = buildClientReportWhatsAppShareUrl({
      clientName: "Acme Co",
      reportTypeLabel: "Weekly Performance Report",
      platformLabel: "Meta Ads",
      dateRangeLabel: "Sep 22 – Sep 28",
      reportUrl: "https://nextreport.in/r/abc",
    });
    expect(url).toContain("wa.me");
    expect(decodeURIComponent(url)).toContain("Acme Co");
    expect(decodeURIComponent(url)).toContain("Sep 22");
    expect(decodeURIComponent(url)).toContain("nextreport.in/r/abc");
  });
});
