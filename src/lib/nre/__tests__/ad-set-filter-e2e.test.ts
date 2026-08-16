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
 *
 * An earlier version of selectedAdSets filtered mtdDailyRows itself, before
 * splitMtdDaily — so deselecting an ad set shrank the MTD chart/table/cover
 * budget line below the account's real spend, which misled clients. That's
 * why the wizard stopped calling it. The current version only prunes which
 * ad-set slide gets built (report-data.ts's Phase A2) — every total below
 * proves the full, unfiltered account spend regardless of what's deselected.
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

// One campaign, three ad sets — "broad" ($949 total), "interests" ($51
// total), and "lookalike" ($200 total) — spread across the trailing-7-day
// window so both the weekly and MTD splits see every row. Three ad sets
// (not two) so that deselecting one still leaves 2+ behind, exercising the
// "2+ ad sets get their own slide" rule for the surviving pair.
const HEADER =
  "Campaign name,Ad set name,Day,Result Type,Amount spent,Reach,Impressions,Results,CTR,CPC,Frequency";
const DAYS = ["13-07-2026", "14-07-2026", "15-07-2026", "16-07-2026", "17-07-2026", "18-07-2026", "19-07-2026"];

function buildCsv(): Buffer {
  const lines = [HEADER];
  const broadPerDay = [136, 136, 136, 136, 135, 135, 135]; // sums to 949
  const interestsPerDay = [8, 8, 7, 7, 7, 7, 7]; // sums to 51
  const lookalikePerDay = [29, 29, 29, 29, 28, 28, 28]; // sums to 200
  DAYS.forEach((day, i) => {
    lines.push(csvRow(day, "broad", broadPerDay[i]));
    lines.push(csvRow(day, "interests", interestsPerDay[i]));
    lines.push(csvRow(day, "lookalike", lookalikePerDay[i]));
  });
  return Buffer.from(lines.join("\n"), "utf-8");
}

describe("ad-set filter — full pipeline reproduction (CSV parse -> selection -> buildReportData)", () => {
  it("deselecting 'broad' removes only its own slide — MTD/chart/cover totals still show the full $1,200 account spend, never a filtered $251", () => {
    const buffer = buildCsv();
    const parsed = parseUploadedFile(buffer, "MTD Daily CSV");
    const validation = validateMtdDailyCsv(parsed.colMap, parsed.rows, NOW, parsed.headers);
    expect(validation.valid).toBe(true);

    // Sanity check on the fixture itself, independent of any filtering: the
    // unfiltered file really does total $1,200 across all three ad sets.
    const groups = extractAdSetGroups(parsed.rows);
    expect(groups).toEqual([{ campaignName: "Growth Campaign", adSetNames: ["broad", "interests", "lookalike"] }]);

    // Mirrors the wizard: everything selected except "broad".
    const selectedAdSets = [adSetKey("Growth Campaign", "interests"), adSetKey("Growth Campaign", "lookalike")];

    const data = buildReportData({
      accountName: "Acme Inc",
      currencySymbol: "$",
      timezone: "UTC",
      monthlyBudget: 5000,
      mtdDailyRows: parsed.rows,
      selectedAdSets,
      now: NOW,
    });

    // The bug this test used to guard against: the engine must NEVER shrink
    // MTD/chart/cover totals just because an ad-set slide was deselected —
    // the account's real spend is $1,200 regardless of slide selection.
    expect(data.mtdRow.spend).toBe("$1,200");
    expect(data.chart!.totalAllSpend).toBe(1200);
    expect(data.chart!.campaigns).toEqual([expect.objectContaining({ name: "Growth Campaign", spend: 1200 })]);
    expect(data.campaignSlides).toEqual([expect.objectContaining({ campaignName: "Growth Campaign" })]);
    expect(data.campaignSlides[0].metrics.spend).toBe("$1,200");
    expect(data.cover.budgetSummary).toContain("$1,200 of $5,000");

    // What DOES change: "broad" gets no ad-set slide of its own; the other
    // two (still 2+, so still slide-worthy) do, each showing its OWN
    // unfiltered spend — not reduced by "broad"'s exclusion.
    expect(data.adSetSlides.map((s) => s.adSetName).sort()).toEqual(["interests", "lookalike"]);
    expect(data.adSetSlides.find((s) => s.adSetName === "interests")!.metrics.spend).toBe("$51");
    expect(data.adSetSlides.find((s) => s.adSetName === "lookalike")!.metrics.spend).toBe("$200");
  });

  it("case/whitespace variance between the CSV's ad-set text and the selected key does not silently defeat the filter", () => {
    // A composite key built from a name with different casing/whitespace
    // than what's actually in the CSV must NOT match — filterRowsByAdSets
    // does its own trim() but is intentionally case-sensitive (ad-set names
    // are opaque user text, not normalized), so passing a mismatched key
    // here is expected to exclude that ad set's own slide, not silently
    // treat the mismatch as "keep everything".
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

    // Totals are still the full, unfiltered account spend — selectedAdSets
    // never reaches mtdDailyRows regardless of whether any key matches.
    expect(data.isPaused).toBe(false);
    expect(data.mtdRow.spend).toBe("$1,200");
    // None of the three real ad-set names match the mismatched key, so none
    // of them get their own slide.
    expect(data.adSetSlides).toEqual([]);
  });
});
