import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseCsvText } from "../parse-csv";
import { buildReportData } from "../report-data";
import { manualExportPrimaryResult } from "../meta-api-sync/manual-export-mapper";
import { insightToManualCsvRow } from "../meta-api-sync/insight-engine";
import { META_CSV_HEADERS } from "../meta-api-sync/insight-engine";
import { readRowsWithAutoMap } from "../columns";
import { manualRowToMetaInsight } from "./golden-parity-helpers";

const MANUAL = resolve(
  process.cwd(),
  "src/lib/nre/__tests__/fixtures/dc-credit-firm-weekly-sep29-2026-upload.csv",
);
const BAD_API = resolve(
  process.cwd(),
  "src/lib/nre/__tests__/fixtures/dc-credit-firm-api-sync-sep29-2026-bad.csv",
);

function parseSimpleCsv(path: string): Map<string, Record<string, string>> {
  const lines = readFileSync(path, "utf8").trim().split("\n");
  const headers = lines[0].split(",").map((h) => h.replace(/^"|"$/g, ""));
  const byDay = new Map<string, Record<string, string>>();
  for (const line of lines.slice(1)) {
    const cells = line.match(/("([^"]|"")*"|[^,]*)/g)?.map((c) => c.replace(/^"|"$/g, "").replace(/""/g, '"')) ?? [];
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = cells[i] ?? "";
    });
    const day = row.Day ?? row.day ?? "";
    if (day) byDay.set(day, row);
  }
  return byDay;
}

/** Shape Meta returns when cost_per_action_type over-counts vs Ads Manager Results. */
function productionOvercountInsight(
  row: ReturnType<typeof parseCsvText>["rows"][number],
  badApiDay: Record<string, string> | undefined,
) {
  const insight = manualRowToMetaInsight(row);
  const manualResults = Number(row.results) || 0;
  const spend = Number(row.spend) || 0;
  const badResults = badApiDay ? Number(badApiDay.Results) || 0 : 0;

  insight.cost_per_result = [];
  insight.objective_results = [];
  insight.cost_per_objective_result = [];

  if (manualResults > 0) {
    const cpr = spend / manualResults;
    insight.objective_results = [
      {
        indicator: "actions:offsite_conversion.fb_pixel_lead",
        values: [{ value: String(manualResults) }],
      },
    ];
    insight.cost_per_objective_result = [
      {
        indicator: "actions:offsite_conversion.fb_pixel_lead",
        values: [{ value: String(cpr) }],
      },
    ];
  }

  if (badResults > 0) {
    const count = badResults;
    const cpr = spend / count;
    insight.actions = (insight.actions ?? []).filter(
      (a) =>
        ![
          "offsite_conversion.fb_pixel_lead",
          "lead",
          "onsite_conversion.lead_grouped",
          "website_lead",
        ].includes(a.action_type),
    );
    insight.actions.push({ action_type: "offsite_conversion.fb_pixel_lead", value: String(count) });
    insight.actions.push({ action_type: "lead", value: String(count) });
    insight.cost_per_action_type = [
      { action_type: "offsite_conversion.fb_pixel_lead", value: String(cpr) },
    ];
    insight.results = [
      { indicator: "actions:offsite_conversion.fb_pixel_lead", values: [{ value: String(count) }] },
      { indicator: "actions:lead", values: [{ value: String(count) }] },
    ];
    insight.cost_per_result = [
      { indicator: "actions:offsite_conversion.fb_pixel_lead", values: [{ value: String(cpr) }] },
      { indicator: "actions:lead", values: [{ value: String(cpr) }] },
    ];
  } else if (manualResults > 0) {
    const cpr = spend / manualResults;
    insight.results = [
      { indicator: "actions:offsite_conversion.fb_pixel_lead", values: [{ value: String(manualResults) }] },
      { indicator: "actions:lead", values: [{ value: String(manualResults) }] },
    ];
    insight.cost_per_result = [
      { indicator: "actions:offsite_conversion.fb_pixel_lead", values: [{ value: String(cpr) }] },
      { indicator: "actions:lead", values: [{ value: String(cpr) }] },
    ];
  } else {
    insight.results = [{ indicator: "actions:lead", values: [{ value: "1" }] }];
    insight.actions = [
      ...(insight.actions ?? []),
      { action_type: "offsite_conversion.fb_pixel_lead", value: "1" },
    ];
    insight.cost_per_action_type = [
      { action_type: "offsite_conversion.fb_pixel_lead", value: String(spend || 1) },
    ];
  }

  return insight;
}

function inflatedProductionInsight(row: ReturnType<typeof parseCsvText>["rows"][number]) {
  const insight = manualRowToMetaInsight(row);
  const results = Number(row.results) || 0;
  const spend = Number(row.spend) || 0;
  const rt = String(row.result_type ?? "").toLowerCase();
  const linkClicks = Number(row.link_clicks) || 0;

  if (results > 0 && rt.includes("website")) {
    const cpr = spend / results;
    insight.objective_results = [
      {
        indicator: "actions:offsite_conversion.fb_pixel_lead",
        values: [{ value: String(results) }],
      },
    ];
    insight.cost_per_objective_result = [
      {
        indicator: "actions:offsite_conversion.fb_pixel_lead",
        values: [{ value: String(cpr) }],
      },
    ];
    insight.results = [
      {
        indicator: "actions:offsite_conversion.fb_pixel_lead",
        values: [{ value: String(Math.max(linkClicks, results * 4)) }],
      },
    ];
  } else {
    insight.results = [{ indicator: "actions:lead", values: [{ value: "1" }] }];
  }
  insight.cost_per_result = [];
  return insight;
}

describe("Credit Firm Sep 29 2026 upload (manual 12 website submissions / 30d)", () => {
  it("manual fixture sums to 12 website submission Results in window", () => {
    const { rows } = parseCsvText(readFileSync(MANUAL, "utf8"));
    const sum = rows.reduce((s, r) => s + (Number(r.results) || 0), 0);
    expect(sum).toBe(12);
  });

  it("matches manual for every day when Meta mirrors Sep 2026 bad API (costed results[] noise)", () => {
    const { rows } = parseCsvText(readFileSync(MANUAL, "utf8"));
    const badByDay = parseSimpleCsv(BAD_API);

    for (const row of rows) {
      const day = String(row._raw?.Day ?? "");
      const bad = badByDay.get(day);
      const manualResults = Number(row.results) || 0;
      const spend = Number(row.spend) || 0;
      const badResults = bad ? Number(bad.Results) || 0 : 0;

      const insight = manualRowToMetaInsight(row);
      insight.objective_results = [];
      insight.cost_per_objective_result = [];

      if (manualResults > 0) {
        const cpr = spend / manualResults;
        insight.objective_results = [
          {
            indicator: "actions:offsite_conversion.fb_pixel_lead",
            values: [{ value: String(manualResults) }],
          },
        ];
        insight.cost_per_objective_result = [
          {
            indicator: "actions:offsite_conversion.fb_pixel_lead",
            values: [{ value: String(cpr) }],
          },
        ];
      } else if (badResults > 0) {
        insight.objective_results = [
          { indicator: "actions:link_click", values: [{ value: String(Number(row.link_clicks) || 1) }] },
        ];
        insight.cost_per_objective_result = [
          {
            indicator: "actions:link_click",
            values: [{ value: String(spend / (Number(row.link_clicks) || 1)) }],
          },
        ];
      }

      if (badResults > 0) {
        const cpr = spend / badResults;
        insight.results = [
          {
            indicator: "actions:offsite_conversion.fb_pixel_lead",
            values: [{ value: String(badResults) }],
          },
        ];
        insight.cost_per_result = [
          {
            indicator: "actions:offsite_conversion.fb_pixel_lead",
            values: [{ value: String(cpr) }],
          },
        ];
        insight.actions = [
          ...(insight.actions ?? []).filter((a) => a.action_type !== "offsite_conversion.fb_pixel_lead"),
          { action_type: "offsite_conversion.fb_pixel_lead", value: String(badResults) },
        ];
      } else if (manualResults > 0) {
        insight.results = [
          {
            indicator: "actions:offsite_conversion.fb_pixel_lead",
            values: [{ value: String(manualResults) }],
          },
          { indicator: "actions:lead", values: [{ value: String(manualResults) }] },
        ];
        insight.cost_per_result = [
          {
            indicator: "actions:offsite_conversion.fb_pixel_lead",
            values: [{ value: String(spend / manualResults) }],
          },
          {
            indicator: "actions:lead",
            values: [{ value: String(spend / manualResults) }],
          },
        ];
      } else {
        insight.results = [{ indicator: "actions:lead", values: [{ value: "1" }] }];
        insight.cost_per_result = [];
      }

      const primary = manualExportPrimaryResult(insight);
      const got = primary ? parseFloat(primary.value) : 0;
      expect(got, day).toBe(manualResults);
    }
  });

  it("mapper matches manual per day under production over-count payloads (regression: bad API CSV ~70)", () => {
    const { rows } = parseCsvText(readFileSync(MANUAL, "utf8"));
    const badByDay = parseSimpleCsv(BAD_API);

    for (const row of rows) {
      const day = String(row._raw?.Day ?? row.date_start ?? "");
      const expected = Number(row.results) || 0;
      const primary = manualExportPrimaryResult(
        productionOvercountInsight(row, badByDay.get(day)),
      );
      const got = primary ? parseFloat(primary.value) : 0;
      expect(got, day).toBe(expected);
    }
  });

  it("regression: costed pixel in results[] on manual blank days must stay blank (Sep 2 → 4 in bad API)", () => {
    const { rows } = parseCsvText(readFileSync(MANUAL, "utf8"));
    const sep2 = rows.find((r) => String(r._raw?.Day) === "2026-09-02");
    expect(sep2 && Number(sep2.results) === 0).toBe(true);

    const spend = Number(sep2!.spend) || 0;
    const inflated = 4;
    const insight = manualRowToMetaInsight(sep2!);
    insight.results = [
      {
        indicator: "actions:offsite_conversion.fb_pixel_lead",
        values: [{ value: String(inflated) }],
      },
    ];
    insight.cost_per_result = [
      {
        indicator: "actions:offsite_conversion.fb_pixel_lead",
        values: [{ value: String(spend / inflated) }],
      },
    ];
    insight.actions = [
      ...(insight.actions ?? []).filter((a) => a.action_type !== "offsite_conversion.fb_pixel_lead"),
      { action_type: "offsite_conversion.fb_pixel_lead", value: String(inflated) },
    ];

    const primary = manualExportPrimaryResult(insight);
    expect(primary).toBeNull();
  });

  it("regression: costed pixel in actions only (no results[]) must not inflate blank or lead days", () => {
    const { rows } = parseCsvText(readFileSync(MANUAL, "utf8"));
    const badByDay = parseSimpleCsv(BAD_API);

    for (const row of rows) {
      const day = String(row._raw?.Day ?? "");
      const bad = badByDay.get(day);
      if (!bad) continue;
      const badCount = Number(bad.Results) || 0;
      const spend = Number(row.spend) || 0;
      const expected = Number(row.results) || 0;

      const insight = manualRowToMetaInsight(row);
      insight.results = [];
      insight.cost_per_result = [];
      insight.objective_results = [];
      insight.cost_per_objective_result = [];
      if (badCount > 0) {
        insight.actions = (insight.actions ?? []).filter(
          (a) => a.action_type !== "offsite_conversion.fb_pixel_lead",
        );
        insight.actions.push({
          action_type: "offsite_conversion.fb_pixel_lead",
          value: String(badCount),
        });
        insight.cost_per_action_type = [
          { action_type: "offsite_conversion.fb_pixel_lead", value: String(spend / badCount) },
        ];
      }

      const primary = manualExportPrimaryResult(insight);
      const got = primary ? parseFloat(primary.value) : 0;
      expect(got, day).toBe(expected);
    }
  });

  it("Sep 2026 production inflation shape (objective correct, results[] uncosted inflated) still matches manual", () => {
    const { rows } = parseCsvText(readFileSync(MANUAL, "utf8"));
    for (const row of rows) {
      const expected = Number(row.results) || 0;
      const primary = manualExportPrimaryResult(inflatedProductionInsight(row));
      const got = primary ? parseFloat(primary.value) : 0;
      expect(got, String(row._raw?.Day)).toBe(expected);
    }
  });

  it("API-shaped CSV matches manual report totals for last-30-days weekly window", () => {
    const { rows: manualRows } = parseCsvText(readFileSync(MANUAL, "utf8"));
    const badByDay = parseSimpleCsv(BAD_API);

    const apiRows = manualRows.map((row) => {
      const csvCells = insightToManualCsvRow(productionOvercountInsight(row, badByDay.get(String(row._raw?.Day ?? ""))));
      const obj: Record<string, string> = {};
      META_CSV_HEADERS.forEach((h, i) => {
        obj[h] = csvCells[i] ?? "";
      });
      return readRowsWithAutoMap([...META_CSV_HEADERS], [[...META_CSV_HEADERS.map((h) => obj[h])]]).rows[0];
    });

    const opts = {
      accountName: "Credit Firm",
      currencySymbol: "$",
      timezone: "America/New_York",
      monthlyBudget: null,
      now: new Date("2026-09-29T12:00:00Z"),
      reportType: "WEEKLY" as const,
      selectedCampaigns: ["DC Leads Campaign Main"],
      weeklyRange: { startIso: "2026-09-22", endIso: "2026-09-28" },
    };

    const manualReport = buildReportData({ ...opts, mtdDailyRows: manualRows });
    const apiReport = buildReportData({ ...opts, mtdDailyRows: apiRows });

    const label = "WEBSITE LEADS";
    expect(apiReport.mtdRow.resultColumns.find((c) => c.label === label)?.value).toBe(
      manualReport.mtdRow.resultColumns.find((c) => c.label === label)?.value,
    );
    expect(apiReport.chart?.campaigns[0]?.results).toBe(manualReport.chart?.campaigns[0]?.results);
    expect(apiReport.campaignSlides[0]?.metrics.results).toBe(
      manualReport.campaignSlides[0]?.metrics.results,
    );
  });
});
