import { describe, expect, it } from "vitest";
import {
  isValidAutomationWebhookUrl,
  isValidSlackWebhookUrl,
  type ReportNotificationPayload,
} from "../report-notifications";

describe("isValidSlackWebhookUrl", () => {
  it("accepts Slack incoming webhook URLs", () => {
    expect(isValidSlackWebhookUrl("https://hooks.slack.com/services/T/B/x")).toBe(true);
  });

  it("rejects non-Slack HTTPS URLs", () => {
    expect(isValidSlackWebhookUrl("https://example.com/hook")).toBe(false);
  });

  it("rejects non-HTTPS URLs", () => {
    expect(isValidSlackWebhookUrl("http://hooks.slack.com/services/T/B/x")).toBe(false);
  });
});

describe("isValidAutomationWebhookUrl", () => {
  it("accepts any HTTPS URL", () => {
    expect(isValidAutomationWebhookUrl("https://hooks.zapier.com/hooks/catch/123/abc")).toBe(true);
  });

  it("rejects HTTP", () => {
    expect(isValidAutomationWebhookUrl("http://hooks.zapier.com/x")).toBe(false);
  });
});

describe("ReportNotificationPayload", () => {
  it("uses a stable event name for Zapier triggers", () => {
    const payload: ReportNotificationPayload = {
      event: "report.generated",
      reportId: "r1",
      clientName: "Acme",
      platform: "META",
      reportType: "WEEKLY",
      displayName: "Weekly — Aug 1-7",
      shareUrl: "https://nextreport.in/r/abc",
      healthScore: 82,
      healthBadge: "Strong performance",
      generatedAt: new Date().toISOString(),
    };
    expect(payload.event).toBe("report.generated");
  });
});
