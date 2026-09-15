import { describe, expect, it } from "vitest";
import { splitIsoDateRangeIntoChunks } from "../api-date-range";

describe("splitIsoDateRangeIntoChunks", () => {
  it("splits a 30-day range into weekly chunks", () => {
    const chunks = splitIsoDateRangeIntoChunks("2026-08-15", "2026-09-13", 7);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]).toEqual({ sinceIso: "2026-08-15", untilIso: "2026-08-21" });
    expect(chunks.at(-1)?.untilIso).toBe("2026-09-13");
  });

  it("returns a single chunk when the range fits", () => {
    const chunks = splitIsoDateRangeIntoChunks("2026-09-01", "2026-09-03", 7);
    expect(chunks).toEqual([{ sinceIso: "2026-09-01", untilIso: "2026-09-03" }]);
  });
});
