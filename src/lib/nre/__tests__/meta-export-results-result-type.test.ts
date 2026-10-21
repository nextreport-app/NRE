import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseCsvText } from "../parse-csv";
import { buildReportData } from "../report-data";
import { buildCampaignObjectiveMap, resolveCampaignObjective, resultValueForObjective } from "../objective";
import { websiteLeadsFromMetaExportRow } from "../meta-csv-export-counting";
import { metaFormLeadsFromMetaExportRow as metaFormFromCounting } from "../meta-csv-export-counting";
import type { MetricRow } from "../types";

const BELLE = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "dc-weekly-the-belle-oct2026.csv");

function row(partial: Partial<MetricRow>): MetricRow {
  return {
    campaign_name: "C1",
    ad_set_name: "A1",
    spend: 0,
    impressions: 0,
    ...partial,
  } as MetricRow;
}

describe("Meta export invariants — Result type + Results only", () => {
  it("Meta Leads Campaign row (blank Result type, Results=14) counts toward META FORM LEADS bucket", () => {
    const r = row({ campaign_name: "Meta Leads Campaign", result_type: "", leads: 14, results: 14, spend: 596 });
    expect(resolveCampaignObjective([r]).resultLabel).toBe("META FORM LEADS");
    expect(resultValueForObjective(r, "META FORM LEADS")).toBe(14);
    expect(buildCampaignObjectiveMap([r]).get("meta leads campaign")?.resultLabel).toBe("META FORM LEADS");
  });

  it("blank Result type + blank Results = zero meta form leads (never Leads/Meta leads columns)", () => {
    const orphan = row({ result_type: "", results: 0, meta_leads: 2, leads: 2 });
    expect(metaFormFromCounting(orphan)).toBe(0);
    expect(resultValueForObjective(orphan, "META FORM LEADS")).toBe(0);
  });

  it("Leads (form) row uses Results only", () => {
    const typed = row({ result_type: "Leads (form)", results: 3, meta_leads: 3, leads: 3 });
    expect(metaFormFromCounting(typed)).toBe(3);
    expect(resultValueForObjective(typed, "META FORM LEADS")).toBe(3);
  });

  it("blank Result type + blank Results = zero website leads", () => {
    const orphan = row({ result_type: "", results: 0, website_leads: 1 });
    expect(websiteLeadsFromMetaExportRow(orphan)).toBe(0);
    expect(resultValueForObjective(orphan, "WEBSITE LEADS")).toBe(0);
  });

  it("The Belle — objective from Leads (form) majority; weekly/MTD/L30 Results totals", () => {
    const { rows } = parseCsvText(readFileSync(BELLE, "utf8"));
    const campaign = "dc - leads - instant forms - q3 - july2026";
    expect(buildCampaignObjectiveMap(rows).get(campaign)?.resultLabel).toBe("META FORM LEADS");

    const report = buildReportData({
      accountName: "The Belle",
      currencySymbol: "$",
      timezone: "America/Los_Angeles",
      monthlyBudget: null,
      mtdDailyRows: rows,
      now: new Date("2026-10-20T12:00:00Z"),
      reportType: "WEEKLY",
      selectedCampaigns: ["DC - LEADS - INSTANT FORMS - Q3 - JULY2026"],
      weeklyRange: { startIso: "2026-10-13", endIso: "2026-10-19" },
    });

    expect(report.campaignSlides[0]?.resultLabel).toBe("META FORM LEADS");
    expect(report.campaignSlides[0]?.metrics.results).toBe("10");
    expect(report.mtdRow.resultColumns.find((c) => c.label === "META FORM LEADS")?.value).toBe("27");
    expect(report.chart?.campaigns[0]?.results).toBe(45);
  });
});
