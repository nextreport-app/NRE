import { describe, expect, it } from "vitest";
import { buildReportEmailHtml, buildReportEmailSubject, buildReportEmailText, type ReportEmailProps } from "../email-template";

function baseProps(overrides: Partial<ReportEmailProps> = {}): ReportEmailProps {
  return {
    clientName: "Acme Co",
    reportType: "Weekly",
    dateRange: "July 18 - July 24",
    shareLink: "https://nextreport.in/r/abc123xyz789",
    senderName: "Jordan Lee",
    ...overrides,
  };
}

describe("buildReportEmailSubject", () => {
  it("matches the spec's [ClientName] — [ReportType] Report — [DateRange] format", () => {
    expect(buildReportEmailSubject(baseProps())).toBe("Acme Co — Weekly Report — July 18 - July 24");
  });
});

describe("buildReportEmailHtml", () => {
  it("includes the default greeting when no custom message is given", () => {
    const html = buildReportEmailHtml(baseProps());
    expect(html).toContain("Hi,");
    expect(html).toContain("Please find your Weekly performance report for July 18 - July 24 below.");
  });

  it("uses the custom message instead of the default greeting when provided", () => {
    const html = buildReportEmailHtml(baseProps({ message: "Here's this week's numbers!" }));
    expect(html).toContain("Here&#39;s this week&#39;s numbers!");
    expect(html).not.toContain("Please find your Weekly performance report");
  });

  it("renders the CTA button linking to shareLink", () => {
    const html = buildReportEmailHtml(baseProps());
    expect(html).toContain('href="https://nextreport.in/r/abc123xyz789"');
    expect(html).toContain("View Report →");
  });

  it("omits the PowerPoint download link when no driveLink is given", () => {
    const html = buildReportEmailHtml(baseProps());
    expect(html).not.toContain("Or download as PowerPoint");
  });

  it("includes the PowerPoint download link when driveLink is given", () => {
    const html = buildReportEmailHtml(baseProps({ driveLink: "https://docs.google.com/presentation/d/xyz" }));
    expect(html).toContain('href="https://docs.google.com/presentation/d/xyz"');
    expect(html).toContain("Or download as PowerPoint");
  });

  it("renders the report summary box with client, period, and sender", () => {
    const html = buildReportEmailHtml(baseProps());
    expect(html).toContain("Acme Co");
    expect(html).toContain("July 18 - July 24");
    expect(html).toContain("Jordan Lee via NextReport");
  });

  it("prefers agencyName over senderName in the 'prepared by' footer line", () => {
    const html = buildReportEmailHtml(baseProps({ agencyName: "Bright Digital" }));
    expect(html).toContain("This report was prepared by Bright Digital using NextReport");
  });

  it("falls back to senderName in the footer line when no agencyName is given", () => {
    const html = buildReportEmailHtml(baseProps());
    expect(html).toContain("This report was prepared by Jordan Lee using NextReport");
  });

  it("includes the domain and the recipient-context disclaimer", () => {
    const html = buildReportEmailHtml(baseProps());
    expect(html).toContain("nextreport.in");
    expect(html).toContain("You are receiving this because your agency shared a performance report with you.");
  });

  it("escapes HTML in untrusted-ish fields like clientName and message", () => {
    const html = buildReportEmailHtml(baseProps({ clientName: "<b>Acme</b> & Co", message: "<script>alert(1)</script>" }));
    expect(html).not.toContain("<b>Acme</b>");
    expect(html).toContain("&lt;b&gt;Acme&lt;/b&gt; &amp; Co");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("converts newlines in a custom message to <br> tags", () => {
    const html = buildReportEmailHtml(baseProps({ message: "Line one\nLine two" }));
    expect(html).toContain("Line one<br>Line two");
  });

  it("uses only inline styles, no <link> or <style> tags referencing external stylesheets", () => {
    const html = buildReportEmailHtml(baseProps());
    expect(html).not.toContain("<link");
    expect(html).not.toContain("<style");
  });
});

describe("buildReportEmailText", () => {
  it("includes the share link and default greeting as plain text", () => {
    const text = buildReportEmailText(baseProps());
    expect(text).toContain("Please find your Weekly performance report for July 18 - July 24 below.");
    expect(text).toContain("View Report: https://nextreport.in/r/abc123xyz789");
  });

  it("includes the drive link line only when driveLink is given", () => {
    expect(buildReportEmailText(baseProps())).not.toContain("Download as PowerPoint");
    const text = buildReportEmailText(baseProps({ driveLink: "https://docs.google.com/presentation/d/xyz" }));
    expect(text).toContain("Download as PowerPoint: https://docs.google.com/presentation/d/xyz");
  });
});
