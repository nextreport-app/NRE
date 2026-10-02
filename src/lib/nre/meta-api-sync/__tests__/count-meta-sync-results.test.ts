import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { sumResultsInMetaSyncCsv } from "../count-meta-sync-results";

describe("sumResultsInMetaSyncCsv", () => {
  it("returns 0 for Oct 2026 all-blank API sync artifact", () => {
    const path = resolve(
      process.cwd(),
      "src/lib/nre/__tests__/fixtures/dc-credit-firm-api-sync-zero-sep30-2026.csv",
    );
    const text = readFileSync(path, "utf8");
    expect(sumResultsInMetaSyncCsv(text)).toBe(0);
  });
});
