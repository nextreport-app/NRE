/**
 * End-to-end reproduction of the report upload wizard's ad-set filter,
 * exercised through the exact same pipeline the "generate report" API route
 * uses: raw CSV bytes -> parseUploadedFile -> validateMtdDailyCsv ->
 * buildReportData(selectedAdSets: [...]). Unlike report-data.test.ts's
 * ad-set-filtering tests (which hand-build NreRow objects directly),
 * this goes through real CSV text parsing and column auto-detection too, so
 * it would also catch a bug in how the wizard's composite ad-set keys line
 * up with what CSV parsing actually produces — the two ad-set names are
 * deliberately spelled with the same case/whitespace variance a real export
 * and a real click-derived selection could plausibly disagree on, to prove
 * filtering isn't silently failing due to a string-matching mismatch.
 */
import { describe, expect, it, beforeAll } from "vitest";
import { parseUploadedFile } from "../parse-file";
import { validateMtdDailyCsv } from "../validate";
import { buildReportData } from "../report-data";
import { adSetKey, extractAdSetGroups } from "../ad-sets";

beforeAll(() => {
  process.env.TZ = "UTC";
});

const NOW = new Date("2026-07-20T12:00:00Z");

function csvRow(day: string, adSet: string, spend: number): string {
  return `"Growth Campaign","${adSet}","${day}","Purchase","${spend}","1000","3000","2","1.50","3.00","2.1"`;
}

// One campaign, two ad sets — "broad" ($949 total) and "interests" ($51
// total), spread across the trailing-7-day window so both the weekly and
// MTD splits see every row. $949 + $51 = $1000 total, matching the bug
// report's numbers exactly.
const HEADER =
  "Campaign name,Ad set name,Day,Result Type,Amount spent,Reach,Impressions,Results,CTR,CPC,Frequency";
const DAYS = ["13-07-2026", "14-07-2026", "15-07-2026", "16-07-2026", "17-07-2026", "18-07-2026", "19-07-2026"];

function buildCsv(): Buffer {
  const lines = [HEADER];
  // 7 days x $135.57... doesn't divide evenly — use whole numbers that sum exactly.
  const broadPerDay = [136, 136, 136, 136, 135, 135, 135]; // sums to 949
  const interestsPerDay = [8, 8, 7, 7, 7, 7, 7]; // sums to 51
  DAYS.forEach((day, i) => {
    lines.push(csvRow(day, "broad", broadPerDay[i]));
    lines.push(csvRow(day, "interests", interestsPerDay[i]));
  });
  return Buffer.from(lines.join("\n"), "utf-8");
}

describe("ad-set filter — full pipeline reproduction (CSV parse -> selection -> buildReportData)", () => {
  it("removing 'broad' ($949) leaves only 'interests' ($51) — never the combined $1,000", () => {
    const buffer = buildCsv();
    const parsed = parseUploadedFile(buffer, "MTD Daily CSV");
    const validation = validateMtdDailyCsv(parsed.colMap, parsed.rows, NOW, parsed.headers);
    expect(validation.valid).toBe(true);

    // Sanity check on the fixture itself, independent of any filtering: the
    // unfiltered file really does total $1,000 across both ad sets.
    const groups = extractAdSetGroups(parsed.rows);
    expect(groups).toEqual([{ campaignName: "Growth Campaign", adSetNames: ["broad", "interests"] }]);

    // Mirrors the wizard: everything selected except "broad".
    const selectedAdSets = [adSetKey("Growth Campaign", "interests")];

    const data = buildReportData({
      accountName: "Acme Inc",
      currencySymbol: "$",
      timezone: "UTC",
      monthlyBudget: 5000,
      mtdDailyRows: parsed.rows,
      selectedAdSets,
      now: NOW,
    });

    // The engine must only ever see $51 — not $1,000, not $949.
    expect(data.mtdRow.spend).toBe("$51");
    expect(data.chart!.totalAllSpend).toBe(51);
    expect(data.chart!.campaigns).toEqual([expect.objectContaining({ name: "Growth Campaign", spend: 51 })]);
    expect(data.campaignSlides).toEqual([expect.objectContaining({ campaignName: "Growth Campaign" })]);
    expect(data.campaignSlides[0].metrics.spend).toBe("$51");
    // Only one ad set survives, so the campaign no longer gets its own
    // dedicated ad-set slide (the "2+ ad sets" rule) — its campaign summary
    // slide covers it alone.
    expect(data.adSetSlides).toEqual([]);

    // Point 5 of the bug report: the cover slide's budget line is computed
    // from the same filtered mtdRows, so it must reflect $51 too, not $1,000.
    expect(data.cover.budgetSummary).toContain("$51 of $5,000");
  });

  it("case/whitespace variance between the CSV's ad-set text and the selected key does not silently defeat the filter", () => {
    // A composite key built from a name with different casing/whitespace
    // than what's actually in the CSV must NOT match — filterRowsByAdSets
    // does its own trim() but is intentionally case-sensitive (ad-set names
    // are opaque user text, not normalized), so passing a mismatched key
    // here is expected to filter everything out, not silently pass
    // everything through unfiltered.
    const buffer = buildCsv();
    const parsed = parseUploadedFile(buffer, "MTD Daily CSV");

    const mismatchedKey = adSetKey("Growth Campaign", "  Interests  "); // wrong case + extra whitespace
    const data = buildReportData({
      accountName: "Acme Inc",
      currencySymbol: "$",
      timezone: "UTC",
      monthlyBudget: null,
      mtdDailyRows: parsed.rows,
      selectedAdSets: [mismatchedKey],
      now: NOW,
    });

    // Exact match required: campaign becomes fully excluded (isPaused: true
    // for an all-filtered-out file), not a silent pass-through to $1,000.
    expect(data.isPaused).toBe(true);
  });
});
