import { expect, it } from "vitest";
import {
  customWebsitePeriods,
  customWebsiteRangeSchema,
  websiteRangeKey,
} from "../range";
it("compares a custom range with the preceding equal inclusive calendar range", () => {
  expect(
    customWebsitePeriods(
      { startIso: "2026-10-25", endIso: "2026-11-23" },
      "Asia/Kolkata",
      new Date("2026-11-24T00:00Z"),
    ),
  ).toEqual({
    days: 30,
    currentPeriod: { startIso: "2026-10-25", endIso: "2026-11-23" },
    previousPeriod: { startIso: "2026-09-25", endIso: "2026-10-24" },
  });
  expect(
    websiteRangeKey({ startIso: "2026-10-25", endIso: "2026-11-23" }),
  ).toBe(0);
});
it.each([
  { startIso: "2026-02-30", endIso: "2026-03-02" },
  { startIso: "2026-11-23", endIso: "2026-11-20" },
  { startIso: "2026-01-01", endIso: "2026-12-31" },
])("rejects invalid or unbounded custom dates %j", (range) =>
  expect(customWebsiteRangeSchema.safeParse(range).success).toBe(false),
);
it("rejects today using the actual property timezone", () => {
  const range = { startIso: "2026-11-22", endIso: "2026-11-23" };
  expect(() =>
    customWebsitePeriods(
      range,
      "America/Chicago",
      new Date("2026-11-24T01:00Z"),
    ),
  ).toThrow("completed dates");
  expect(
    customWebsitePeriods(range, "Asia/Kolkata", new Date("2026-11-24T01:00Z"))
      .days,
  ).toBe(2);
});
