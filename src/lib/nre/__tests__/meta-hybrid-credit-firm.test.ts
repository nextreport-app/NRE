import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { mergeApiCsvWithManualReference } from "../meta-api-sync/merge-reference-manual-csv";
import { sumResultsColumnInCsv } from "../meta-api-sync/csv-results-sum";

const MANUAL = resolve(
  process.cwd(),
  "src/lib/nre/__tests__/fixtures/dc-credit-firm-weekly-sep29-2026-upload.csv",
);
const BAD_API = resolve(
  process.cwd(),
  "src/lib/nre/__tests__/fixtures/dc-credit-firm-api-sync-sep29-2026-bad.csv",
);
const ZERO_API = resolve(
  process.cwd(),
  "src/lib/nre/__tests__/fixtures/dc-credit-firm-api-sync-zero-sep30-2026.csv",
);

describe("Meta hybrid merge (Credit Firm)", () => {
  it("restores 12 Results from manual CSV when API CSV over-counts", () => {
    const manualText = readFileSync(MANUAL, "utf8");
    const badApiText = readFileSync(BAD_API, "utf8");
    const merged = mergeApiCsvWithManualReference(badApiText, manualText);
    expect(sumResultsColumnInCsv(manualText)).toBe(12);
    expect(sumResultsColumnInCsv(merged)).toBe(12);
  });

  it("restores 12 Results when API CSV has blank Results", () => {
    const manualText = readFileSync(MANUAL, "utf8");
    const zeroApiText = readFileSync(ZERO_API, "utf8");
    const merged = mergeApiCsvWithManualReference(zeroApiText, manualText);
    expect(sumResultsColumnInCsv(merged)).toBe(12);
  });
});
