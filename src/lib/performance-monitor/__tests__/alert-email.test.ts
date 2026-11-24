import { describe, expect, it } from "vitest";
import { buildPerformanceAlertEmail } from "../alert-email";
import type { CampaignPerformance, PerformanceSnapshot } from "../facts";
const campaign: CampaignPerformance = {
  name: "DC Leads Campaign Main",
  objective: "WEBSITE LEADS",
  costLabel: "Cost Per Website Lead",
  comparableResults: true,
  current: {
    spend: 102.27,
    impressions: 1392,
    clicks: 94,
    ctr: 6.75,
    cpc: 1.09,
    results: 2,
    cpr: 51.14,
  },
  previous: {
    spend: 107.16,
    impressions: 1335,
    clicks: 77,
    ctr: 5.77,
    cpc: 1.39,
    results: 8,
    cpr: 13.4,
  },
  signals: [
    {
      key: "results-down",
      tone: "critical",
      metric: "WEBSITE LEADS",
      change: -75,
      message: "Old verbose explanation",
    },
    {
      key: "cpr-up",
      tone: "critical",
      metric: "Cost per result",
      change: 281.7,
      message: "Old verbose explanation",
    },
  ],
};
const snapshot: PerformanceSnapshot = {
  version: 2,
  config: {
    currency: "USD",
    timezone: "America/Los_Angeles",
    metaAdAccountId: "123",
    performanceWindowDays: 7,
  },
  checkedAt: "2026-11-24T11:23:13.931Z",
  facts: {
    periodA: { startIso: "2026-11-17", endIso: "2026-11-23" },
    periodB: { startIso: "2026-11-10", endIso: "2026-11-16" },
    current: campaign.current,
    previous: campaign.previous,
    campaigns: [campaign],
    empty: false,
  },
};
const render = (c = campaign, signals = c.signals) =>
  buildPerformanceAlertEmail({
    accountName: "Credit Firm Inc",
    clientId: "client&1",
    snapshot,
    alerts: signals.map((signal) => ({ campaign: c, signal })),
  });
describe("performance alert email", () => {
  it("renders a branded inline HTML email with readable dates, actual figures and a review CTA", () => {
    const { html, text } = render();
    expect(html).not.toContain("<pre");
    expect(html).toContain("CRITICAL ALERT");
    expect(html).toContain('role="presentation"');
    expect(html).toContain("max-width:600px");
    expect(html).toContain("Review performance &rarr;");
    expect(html).toContain("client=client%261");
    expect(text).toContain("Nov 17 – Nov 23, 2026");
    expect(text).toContain("Nov 10 – Nov 16, 2026");
    expect(text).toContain("Nov 24, 2026, 3:23 AM (America/Los_Angeles)");
    expect(text).toContain("Website Leads declined by 75%");
    expect(text).toContain("Cost Per Website Lead increased by 281.7%");
    expect(text).toContain("$51.14 · Previous: $13.40");
    expect(html).not.toContain("Old verbose explanation");
    expect(text).toContain("Manage them in the dashboard");
  });
  it("escapes campaign, metric and account content rather than allowing HTML injection", () => {
    const c = {
      ...campaign,
      name: '<img src=x onerror="alert(1)"> & test',
      costLabel: "<script>cost</script>",
    };
    const email = buildPerformanceAlertEmail({
      accountName: '<a href="evil">test</a>',
      clientId: 'x" onclick="evil',
      snapshot,
      alerts: [{ campaign: c, signal: c.signals[1] }],
    });
    expect(email.html).not.toContain("<img");
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;img");
    expect(email.html).toContain("&lt;a href=&quot;evil&quot;&gt;");
    expect(email.html).not.toContain('onclick="evil');
  });
  it("labels target comparisons and missing values without inventing previous metrics", () => {
    const c = {
      ...campaign,
      target: { maxCpr: 20, objective: "WEBSITE LEADS" },
      current: { ...campaign.current, cpr: null },
    } as CampaignPerformance;
    const email = render(c, [
      {
        key: "cost-above-target",
        tone: "warning",
        metric: "Cost per result",
        change: null,
        message: "",
      },
    ]);
    expect(email.html).toContain("REVIEW NEEDED");
    expect(email.html).not.toContain("CRITICAL ALERT");
    expect(email.html).toContain("Saved target");
    expect(email.text).toContain("Unavailable · Target: $20.00");
  });
  it("puts critical alerts before review alerts, even when the email is capped", () => {
    const warning = {
      campaign,
      signal: { ...campaign.signals[0], tone: "warning" as const },
    };
    const email = buildPerformanceAlertEmail({
      accountName: "Account",
      clientId: "client",
      snapshot,
      alerts: [
        ...Array(10).fill(warning),
        {
          campaign: { ...campaign, name: "Urgent campaign" },
          signal: campaign.signals[0],
        },
      ],
    });
    expect(email.html.indexOf("Urgent campaign")).toBeLessThan(
      email.html.indexOf("DC Leads Campaign Main"),
    );
    expect(email.html).toContain("Needs review");
    expect(email.html).toContain("1 more alert is available");
  });
  it("caps displayed alerts and links to the remaining ones", () => {
    const email = render(campaign, Array(12).fill(campaign.signals[0]));
    expect(email.html.match(/<h2 /g)).toHaveLength(10);
    expect(email.text).toContain(
      "2 more alerts are available in your dashboard",
    );
  });
});
