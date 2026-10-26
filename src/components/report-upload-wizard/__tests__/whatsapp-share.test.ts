import { describe, expect, it } from "vitest";
import {
  buildShareReportAbsoluteUrl,
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
      reportTitle: "Weekly Performance Report",
      reportTypeLabel: "Weekly Performance Report",
      platformLabel: "Meta Ads",
      dateRangeLabel: "Sep 22 – Sep 28",
      reportUrl: "https://nextreport.in/r/abc",
    };
    const message = buildClientReportShareMessage(input);
    const wa = buildClientReportWhatsAppShareUrl(input);
    expect(message).toContain("Acme Co");
    expect(message).toContain("Sep 22 – Sep 28");
    expect(message).toContain("https://nextreport.in/r/abc");
    expect(message).toContain("ready to review");
    expect(decodeURIComponent(wa)).toContain("Acme Co");
    expect(decodeURIComponent(wa)).toContain("ready to review");
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
    const decoded = decodeURIComponent(url.replace(/\+/g, " "));
    expect(decoded).toContain("nextreport.in/r/abc");
    expect(decoded).toContain("Acme Co");
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


describe("report link deployment scope", () => {
  it("keeps preview tokens on the preview deployment rather than production", () => {
    expect(buildShareReportAbsoluteUrl("preview-token", "https://nre-preview.vercel.app")).toBe("https://nre-preview.vercel.app/r/preview-token");
    expect(buildShareReportAbsoluteUrl("live-token", "https://nextreport.in")).toBe("https://nextreport.in/r/live-token");
  });
  it("preserves HTTP for local review links", () => {
    expect(buildShareReportAbsoluteUrl("local-token", "http://localhost:3002")).toBe("http://localhost:3002/r/local-token");
  });
});
