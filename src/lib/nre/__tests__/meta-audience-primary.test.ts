import { describe, expect, it } from "vitest";
import { parseCsvText } from "../parse-csv";
import {
  parseMetaContentSource,
  buildMetaContentPresentation,
} from "../meta-report-content/data";
import { audienceOnlyPrimary } from "../meta-report-content/primary";
import { validateMtdDailyCsv } from "../validate";
const csv =
  "Campaign name,Ad set name,Day,Amount spent (USD),Impressions,Clicks (all),Results,Result type,Age\nExample,Set,2026-11-10,10,100,5,1,Leads (form),18-24\nExample,Set,2026-11-10,20,200,6,2,Leads (form),25-34\nExample,Set,2026-11-11,30,300,8,3,Leads (form),25-34";
describe("audience-only first upload", () => {
  it("creates one routing fact per day without losing source cohorts or enabling standard slides", () => {
    const source = parseMetaContentSource(parseCsvText(csv), "USD");
    const converted = audienceOnlyPrimary(source);
    expect(converted.parsed.rows).toHaveLength(2);
    expect(converted.content.sourceOnly).toBe(true);
    expect(converted.content.options.includeStandard).toBe(false);
    expect(converted.content.sources[0].rows).toHaveLength(3);
    expect(converted.parsed.rows.map((row) => Number(row.spend))).toEqual([
      30, 30,
    ]);
    expect(
      validateMtdDailyCsv(
        converted.parsed.colMap,
        converted.parsed.rows,
        new Date("2026-11-12T12:00:00Z"),
        converted.parsed.headers,
        "META",
      ).valid,
    ).toBe(true);
    const pages = buildMetaContentPresentation(
      converted.content,
      [{ startIso: "2026-11-10", endIso: "2026-11-11" }],
      null,
      "$",
    )!.pages;
    expect(pages[0].rows.reduce((n, row) => n + row.spend, 0)).toBe(60);
    expect(pages[0].rows.map((row) => row.name).sort()).toEqual([
      "18-24",
      "25-34",
    ]);
  });
});
