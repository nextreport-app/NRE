import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseCsvText } from "../parse-csv";
import { defaultMetaSelection, filterAddableMetrics, listSelectableMetrics } from "../available-metrics";
import { buildMetaSlots } from "../slot-assignment";
import type { RawMetricRow } from "../dynamic-metrics";

const FIXTURE = resolve(__dirname, "fixtures/bumpertech-campaigns-table-sep-oct2026.csv");

function campaignsTableHeaders(): string[] {
  const text = readFileSync(FIXTURE, "utf8");
  const firstLine = text.split(/\r?\n/)[0] ?? "";
  return firstLine.split(",").map((cell) => cell.replace(/^"|"$/g, "").trim());
}

describe("BumperTech campaigns-table CSV — metric chips match Ad Reporting logic", () => {
  const headers = campaignsTableHeaders();

  it("maps Cost per results and currency-suffixed CPC headers", () => {
    expect(headers.some((h) => h.toLowerCase() === "cost per results")).toBe(true);
    expect(headers.some((h) => h.toLowerCase().includes("cpc (cost per link click)"))).toBe(true);
  });

  it("defaultMetaSelection keeps COST PER QUOTE and excludes generic Leads", () => {
    const selected = defaultMetaSelection("QUOTE REQUESTS", "COST PER QUOTE", headers);
    const keys = selected.map((m) => m.key);
    const labels = selected.map((m) => m.label);

    expect(keys).toContain("cost_per_result");
    expect(labels).toContain("COST PER QUOTE");
    expect(keys).not.toContain("leads");
    expect(selected).toHaveLength(8);
  });

  it("Add-from-CSV pool hides Leads when QUOTE REQUESTS is already selected", () => {
    const selected = defaultMetaSelection("QUOTE REQUESTS", "COST PER QUOTE", headers);
    const addable = filterAddableMetrics(listSelectableMetrics(headers, "META"), selected);
    expect(addable.some((m) => m.key === "leads")).toBe(false);
  });

  it("buildMetaSlots slot 5 is cost per result for QUOTE REQUESTS", () => {
    const { rows } = parseCsvText(readFileSync(FIXTURE, "utf8"));
    const rawRows: RawMetricRow[] = rows.map((r) => ({ _raw: r._raw ?? {} }));
    const slots = buildMetaSlots(
      {
        resultLabel: "QUOTE REQUESTS",
        costLabel: "COST PER QUOTE",
        spend: "A$100",
        reach: "1,000",
        impressions: "2,000",
        ctr: "1.5%",
        resultValue: "10",
        cprValue: "A$10.00",
      },
      rawRows,
      "A$",
    );
    const keys = slots.filter(Boolean).map((s) => s!.key);
    expect(keys).toContain("cost_per_result");
    expect(keys).not.toContain("leads");
  });
});
