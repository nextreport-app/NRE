import { describe, expect, it } from "vitest";
import {
  buildClientReportShareMessage,
  buildClientReportSlackShareUrl,
  buildClientReportTeamsShareUrl,
  buildClientReportWhatsAppShareUrl,
} from "../utils";

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

describe("buildClientReportShareMessage", () => {
  it("matches the WhatsApp prefill body", () => {
    const input = {
      clientName: "Acme Co",
      reportTypeLabel: "Weekly Performance Report",
      platformLabel: "Meta Ads",
      dateRangeLabel: "Sep 22 – Sep 28",
      reportUrl: "https://nextreport.in/r/abc",
    };
    const message = buildClientReportShareMessage(input);
    const wa = buildClientReportWhatsAppShareUrl(input);
    expect(message).toContain("Acme Co");
    expect(decodeURIComponent(wa)).toContain(message);
  });
});

describe("buildClientReportTeamsShareUrl", () => {
  it("uses Teams share endpoint with href and message", () => {
    const url = buildClientReportTeamsShareUrl({
      clientName: "Acme Co",
      reportTypeLabel: "Weekly Performance Report",
      platformLabel: "Meta Ads",
      dateRangeLabel: "Sep 22 – Sep 28",
      reportUrl: "https://nextreport.in/r/abc",
    });
    expect(url).toContain("teams.microsoft.com/share");
    expect(decodeURIComponent(url)).toContain("nextreport.in/r/abc");
    expect(decodeURIComponent(url)).toContain("Acme Co");
  });
});

describe("buildClientReportSlackShareUrl", () => {
  it("includes client message and slack share endpoint", () => {
    const url = buildClientReportSlackShareUrl({
      clientName: "Acme Co",
      reportTypeLabel: "Weekly Performance Report",
      platformLabel: "Meta Ads",
      dateRangeLabel: "Sep 22 – Sep 28",
      reportUrl: "https://nextreport.in/r/abc",
    });
    expect(url).toContain("slack.com/share");
    expect(decodeURIComponent(url)).toContain("Acme Co");
    expect(decodeURIComponent(url)).toContain("nextreport.in/r/abc");
  });
});
