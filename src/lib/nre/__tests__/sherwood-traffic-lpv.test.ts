import { describe, expect, it, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseCsvText } from "../parse-csv";
import {
  buildCampaignObjectiveMap,
  normalizeCampaignName,
  resultValueForObjective,
} from "../objective";
import { buildReportData } from "../report-data";

beforeAll(() => {
  process.env.TZ = "UTC";
});

const FIXTURE = resolve(process.cwd(), "src/lib/nre/__tests__/fixtures/dc-weekly-sherwood-traffic-lpv.csv");

describe("Sherwood Traffic CSV — LPV objective (not link clicks)", () => {
  const { rows } = parseCsvText(readFileSync(FIXTURE, "utf8"));

  it("detects LANDING PAGE VIEWS for Traffic-named campaigns when Result type is LPV", () => {
    const map = buildCampaignObjectiveMap(rows);
    const campaigns = [...new Set(rows.map((r) => r.campaign_name))];
    for (const name of campaigns) {
      expect(map.get(normalizeCampaignName(name))?.resultLabel).toBe("LANDING PAGE VIEWS");
    }
  });

  it("honors wizard LPV override on aggregated rows (non-zero LPV totals)", () => {
    let lpvTotal = 0;
    for (const row of rows) {
      lpvTotal += resultValueForObjective(row, "LANDING PAGE VIEWS");
    }
    expect(lpvTotal).toBeGreaterThan(0);

    const data = buildReportData({
      accountName: "Sherwood",
      currencySymbol: "$",
      timezone: "America/Chicago",
      monthlyBudget: null,
      mtdDailyRows: rows,
      now: new Date("2026-09-29T12:00:00Z"),
    });
    const lpvCol = data.mtdRow.resultColumns.find((c) => c.label === "LANDING PAGE VIEWS");
    expect(lpvCol).toBeDefined();
    expect(Number(String(lpvCol?.value).replace(/,/g, ""))).toBeGreaterThan(0);
  });
});
