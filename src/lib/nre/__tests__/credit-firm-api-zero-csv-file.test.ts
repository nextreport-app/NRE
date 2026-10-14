import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ZERO_API = resolve(
  process.cwd(),
  "src/lib/nre/__tests__/fixtures/dc-credit-firm-api-sync-zero-sep30-2026.csv",
);

/** Regression artifact: API sync CSV with every Result column empty (Oct 2026 production). */
describe("Credit Firm zero API sync CSV artifact", () => {
  it("fixture documents the all-blank failure mode we fixed in manual-export-mapper", () => {
    const text = readFileSync(ZERO_API, "utf8");
    const lines = text.trim().split("\n").slice(1);
    const withResults = lines.filter((line) => {
      const cells = line.split(",");
      const results = cells[4]?.trim();
      return results && results !== "";
    });
    expect(withResults.length).toBe(0);
  });
});
