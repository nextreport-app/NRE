import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildColumnMap, readRowsWithAutoMap } from "../columns";
import {
  csvColumnPresentButAllZero,
  csvZeroMetricWarnings,
  detectBlankCsvMetricLabels,
} from "../csv-zero-metric-guidance";
import { parseCsvText } from "../parse-csv";
import { aggregateReach } from "../reach-aggregation";
import { getRowDate } from "../columns";
import { validateMtdDailyCsv } from "../validate";

const FIXTURE_DIR = join(dirname(fileURLToPath(import.meta.url)), "fixtures");
const BLANK_REACH = join(FIXTURE_DIR, "dc-weekly-the-belle-reach-blank.csv");
const GOOD_REACH = join(FIXTURE_DIR, "dc-weekly-the-belle-oct2026.csv");

describe("csv-zero-metric-guidance", () => {
  it("flags Reach and Frequency when cells are blank but Impressions exist", () => {
    const { headers, rows } = parseCsvText(readFileSync(BLANK_REACH, "utf8"));
    const colMap = buildColumnMap(headers);
    const labels = detectBlankCsvMetricLabels(colMap, rows);
    expect(labels).toContain("Reach");
    expect(labels).toContain("Frequency");
    expect(csvColumnPresentButAllZero(colMap, rows, "reach")).toBe(true);
  });

  it("does not flag fixture CSV with populated daily reach", () => {
    const { headers, rows } = parseCsvText(readFileSync(GOOD_REACH, "utf8"));
    const colMap = buildColumnMap(headers);
    expect(detectBlankCsvMetricLabels(colMap, rows)).toEqual([]);
  });

  it("aggregateReach is 0 for blank reach week but positive when reach is populated", () => {
    const weekFilter = (rows: ReturnType<typeof parseCsvText>["rows"]) =>
      rows.filter((r) => {
        const d = getRowDate(r);
        return d >= "2026-10-14" && d <= "2026-10-20";
      });

    const blank = weekFilter(parseCsvText(readFileSync(BLANK_REACH, "utf8")).rows);
    const good = weekFilter(parseCsvText(readFileSync(GOOD_REACH, "utf8")).rows);
    expect(aggregateReach(blank)).toBe(0);
    expect(aggregateReach(good)).toBeGreaterThan(1000);
  });

  it("returns a combined warning when multiple metrics are blank", () => {
    const { headers, rows } = parseCsvText(readFileSync(BLANK_REACH, "utf8"));
    const colMap = buildColumnMap(headers);
    const warnings = csvZeroMetricWarnings(colMap, rows);
    expect(warnings.length).toBe(1);
    expect(warnings[0]?.kind).toBe("missing_metric_values");
    expect(warnings[0]?.message).toMatch(/Reach/);
    expect(warnings[0]?.message).toMatch(/Frequency/);
  });

  it("validateMtdDailyCsv warns but still passes", () => {
    const { headers, rows } = parseCsvText(readFileSync(BLANK_REACH, "utf8"));
    const colMap = buildColumnMap(headers);
    const result = validateMtdDailyCsv(colMap, rows, new Date("2026-10-21T12:00:00Z"), headers, "META");
    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.field === "metrics")).toBe(true);
  });

  it("returns false when reach column is missing from headers", () => {
    const { colMap, rows } = readRowsWithAutoMap(
      ["Campaign name", "Day", "Amount spent (USD)", "Results", "Impressions"],
      [["Camp", "2026-10-14", "10", "1", "500"]],
    );
    expect(csvColumnPresentButAllZero(colMap, rows, "reach")).toBe(false);
  });
});
