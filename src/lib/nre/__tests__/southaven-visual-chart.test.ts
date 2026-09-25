import { describe, expect, it, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseCsvText } from "../parse-csv";
import { buildReportData } from "../report-data";
import { buildVisualChartSlideModel, formatDonutObjectiveLabel } from "../visual-chart-slide";

beforeAll(() => {
  process.env.TZ = "UTC";
});

describe("Southaven weekly CSV — visual chart slide", () => {
  const { rows } = parseCsvText(
    readFileSync(resolve(process.cwd(), "src/lib/nre/__tests__/fixtures/southaven-weekly.csv"), "utf8"),
  );
  const campaignNames = [...new Set(rows.map((r) => r.campaign_name).filter(Boolean))];

  it("uses objective labels on the donut and spend-proportional campaign bars", () => {
    const data = buildReportData({
      accountName: "Southaven",
      currencySymbol: "$",
      timezone: "America/Chicago",
      monthlyBudget: null,
      mtdDailyRows: rows,
      now: new Date("2026-09-24T12:00:00Z"),
      reportType: "WEEKLY",
      selectedCampaigns: campaignNames as string[],
    });

    expect(data.chart).toBeTruthy();
    const model = buildVisualChartSlideModel(data.chart!, "$");

    expect(model.useSplitPanel).toBe(true);
    expect(model.rightHeading).toBe("Performance by Campaign");
    expect(model.leftHeading).toBe("Spend by Objective");
    expect(model.resultBars).toHaveLength(3);
    expect(model.groupedDonut!.map((s) => s.name)).toEqual([
      formatDonutObjectiveLabel("META FORM LEADS"),
      formatDonutObjectiveLabel("LINK CLICKS"),
      formatDonutObjectiveLabel("REACH"),
    ]);

    const leadBar = model.resultBars.find((b) => b.name.includes("LeadGen"))!;
    const trafficBar = model.resultBars.find((b) => b.name.includes("Traffic"))!;
    const reachBar = model.resultBars.find((b) => b.name.includes("Reach"))!;
    expect(leadBar.barPct).toBe(100);
    expect(trafficBar.barPct).toBeLessThan(leadBar.barPct);
    expect(reachBar.barPct).toBeLessThan(trafficBar.barPct);
    expect(reachBar.resultCount).toBeGreaterThan(0);
    expect(reachBar.statLine).toContain("reach");
    expect(leadBar.statLine).toContain("meta form lead");
    expect(trafficBar.statLine).toContain("link click");
    expect(leadBar.statLine).not.toContain("website lead");
    expect(trafficBar.statLine).not.toContain("website lead");
    expect(leadBar.statLine).not.toContain("% of total");

    expect(model.summaryLine).toContain("Meta Instant Form");
    expect(model.summaryLine).toContain("Traffic");
    expect(model.summaryLine).toContain("Reach");
    expect(model.summaryLine).not.toContain("Website Leads");

    // Guard against folded snapshot summary (6173 = lead gen + traffic combined).
    expect(model.summaryLine).not.toMatch(/Website Leads:\s*6,?173/);
  });
});
