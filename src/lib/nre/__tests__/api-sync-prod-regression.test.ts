import { describe, expect, it, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseCsvText } from "../parse-csv";
import { buildReportData } from "../report-data";
import { fetchMetaReportCsv } from "../fetch-meta-report-rows";
import { readRowsWithAutoMap } from "../columns";
import { manualRowToMetaInsight } from "./golden-parity-helpers";
import type { MetaInsightRow } from "@/lib/meta-api";

const USER_CSV = resolve(
  process.cwd(),
  "src/lib/nre/__tests__/fixtures/dc-credit-firm-user-upload-sep2026.csv",
);

describe("API sync production regression (Meta results[] + stray costed pixel actions)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("does not count costed fb_pixel_lead from actions when Meta results[] only reports combined lead", async () => {
    const { rows: manualRows } = parseCsvText(readFileSync(USER_CSV, "utf8"));
    const insights: MetaInsightRow[] = manualRows.map((row) => {
      const insight = manualRowToMetaInsight(row);
      const results = Number(row.results) || 0;
      const spend = Number(row.spend) || 0;

      insight.results = [
        {
          indicator: "actions:lead",
          values: [{ value: results > 0 ? String(results) : "2" }],
        },
      ];
      insight.cost_per_result = [
        {
          indicator: "actions:lead",
          values: [{ value: results > 0 ? String(spend / results) : "3.50" }],
        },
      ];

      if (results === 0) {
        insight.actions = [
          ...(insight.actions ?? []),
          { action_type: "offsite_conversion.fb_pixel_lead", value: "1" },
        ];
        insight.cost_per_action_type = [
          ...(insight.cost_per_action_type ?? []),
          { action_type: "offsite_conversion.fb_pixel_lead", value: String(spend || 3.5) },
        ];
      } else {
        insight.results!.unshift({
          indicator: "actions:offsite_conversion.fb_pixel_lead",
          values: [{ value: String(results) }],
        });
        insight.cost_per_result!.unshift({
          indicator: "actions:offsite_conversion.fb_pixel_lead",
          values: [{ value: String(spend / results) }],
        });
      }
      return insight;
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ data: insights }) })),
    );

    const apiCsv = await fetchMetaReportCsv({
      accessToken: "token",
      adAccountId: "act_123",
      timezone: "America/New_York",
      sinceIso: "2026-08-26",
      untilIso: "2026-09-24",
    });
    const lines = apiCsv.csvText.split("\n").filter(Boolean);
    const { rows: apiRows } = readRowsWithAutoMap(
      lines[0].split(","),
      lines.slice(1).map((line) => line.split(",")),
    );

    const opts = {
      accountName: "Credit Firm",
      currencySymbol: "$",
      timezone: "America/New_York",
      monthlyBudget: null,
      now: new Date("2026-09-25T12:00:00Z"),
      reportType: "WEEKLY" as const,
      selectedCampaigns: ["DC Leads Campaign Main"],
      weeklyRange: { startIso: "2026-09-18", endIso: "2026-09-24" },
    };

    const manualReport = buildReportData({ ...opts, mtdDailyRows: manualRows });
    const apiReport = buildReportData({ ...opts, mtdDailyRows: apiRows });

    expect(apiReport.mtdRow.resultColumns.find((c) => c.label === "WEBSITE LEADS")?.value).toBe("9");
    expect(apiReport.chart?.campaigns[0]?.results).toBe(12);
    expect(apiReport.campaignSlides[0]?.metrics.results).toBe("4");
    expect(manualReport.mtdRow.resultColumns.find((c) => c.label === "WEBSITE LEADS")?.value).toBe("9");
  });
});
