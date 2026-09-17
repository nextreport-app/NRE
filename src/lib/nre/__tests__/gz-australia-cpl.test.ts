import { describe, expect, it, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getRowDate } from "../columns";
import { parseCsvText } from "../parse-csv";
import { buildReportData } from "../report-data";
import {
  buildCampaignObjectiveMap,
  groupResultsByCampaignObjective,
  resolveCampaignObjective,
} from "../objective";
import { parseCellNum } from "../format";

beforeAll(() => {
  process.env.TZ = "UTC";
});

const CSV_PATH = resolve(process.cwd(), "src/lib/nre/__tests__/fixtures/gz-australia-lead-forms.csv");

describe("GZ Australia CSV — CPL matches spend / leads", () => {
  const { rows } = parseCsvText(readFileSync(CSV_PATH, "utf8"));

  const sepRows = rows.filter((r) => getRowDate(r) >= "2026-09-01");
  const augRows = rows.filter((r) => {
    const d = getRowDate(r);
    return d >= "2026-08-01" && d <= "2026-08-31";
  });

  it("all slide date labels align to Sep 16 when Sydney is already Sep 18 but data ends Sep 16", () => {
    const data = buildReportData({
      accountName: "GZ Australia",
      currencySymbol: "A$",
      timezone: "Australia/Sydney",
      monthlyBudget: null,
      mtdDailyRows: rows,
      now: new Date("2026-09-17T14:29:00Z"),
    });
    expect(data.mtdRow.monthLabel).toBe("Sep 1 - 16");
    expect(data.cover.reportDate).toBe("09-16-2026");
    expect(data.cover.dateRange).toBe("September 10 - September 16");
    expect(data.chart?.periodSubLabel).toBe("Aug 18 - Sep 16, 2026");
  });

  it("Sep 1–16: CPL equals total spend / total leads (956.63 / 17)", () => {
    const data = buildReportData({
      accountName: "GZ Australia",
      currencySymbol: "A$",
      timezone: "UTC",
      monthlyBudget: null,
      mtdDailyRows: sepRows,
      now: new Date("2026-09-17T12:00:00Z"),
    });
    const col = data.mtdRow.resultColumns.find((c) => c.label === "META FORM LEADS");
    expect(col?.value).toBe("17");
    expect(col?.cprValue).toBe("A$56.27");
    expect(data.mtdRow.spend).toBe("A$957");
  });

  it("Aug partial as previous month: CPL equals total spend / total leads", () => {
    const data = buildReportData({
      accountName: "GZ Australia",
      currencySymbol: "A$",
      timezone: "UTC",
      monthlyBudget: null,
      mtdDailyRows: sepRows,
      periodRows: augRows,
      now: new Date("2026-09-17T12:00:00Z"),
    });
    const col = data.periodRow.resultColumns.find((c) => c.label === "META FORM LEADS");
    const totalSpend = augRows.reduce((s, r) => s + parseCellNum(r.spend), 0);
    const totalLeads = augRows.reduce((s, r) => s + parseCellNum(r.results), 0);
    const expectedCpl = totalSpend / totalLeads;
    expect(col?.value).toBe(String(totalLeads));
    expect(col?.cprValue).toBe("A$40.33");
    expect(parseCellNum(col?.cprValue?.replace(/[^0-9.-]/g, "") ?? 0)).toBeCloseTo(expectedCpl, 2);
  });

  it("zero-result days with incidental LINK CLICKS row label still attribute spend to META FORM LEADS CPL", () => {
    const map = buildCampaignObjectiveMap(rows);
    const groups = groupResultsByCampaignObjective(rows, map);
    const meta = groups.find((g) => g.label === "META FORM LEADS");
    const totalSpend = rows.reduce((s, r) => s + parseCellNum(r.spend), 0);
    const totalLeads = rows.reduce((s, r) => s + parseCellNum(r.results), 0);

    expect(meta?.count).toBe(totalLeads);
    expect(meta?.totalSpend).toBeCloseTo(totalSpend, 2);
    expect(meta?.avgCpr).toBeCloseTo(totalSpend / totalLeads, 2);

    const zeroResultRows = rows.filter((r) => !parseCellNum(r.results));
    expect(zeroResultRows.length).toBeGreaterThan(0);
    for (const r of zeroResultRows) {
      expect(resolveCampaignObjective([r]).resultLabel).toBe("META FORM LEADS");
    }
  });
});
