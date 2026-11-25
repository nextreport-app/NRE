import { expect, it } from "vitest";
import { needsMetaCustomConversionCatalog } from "../meta-custom-conversion-labels";
import { campaignSpendRequestKey } from "../campaign-selection-spend";
import type { NreRow } from "../columns";
const row = (result_type: string, raw: Record<string, string> = {}) =>
  ({ result_type, _raw: raw }) as NreRow;
it("does not request live custom conversion metadata for standard events", () => {
  expect(
    needsMetaCustomConversionCatalog([
      row("Purchases"),
      row("Website leads"),
      row("Link clicks"),
    ]),
  ).toBe(false);
});
it.each([
  row("actions:offsite_conversion.custom.123"),
  row("Results", { "NRE API result action": "offsite_conversion.custom.123" }),
  row("Results", {
    "Result indicator": "actions:offsite_conversion.custom.123",
  }),
])("still resolves custom IDs and reuses the captured catalogue", (source) => {
  expect(needsMetaCustomConversionCatalog([source])).toBe(true);
  expect(
    needsMetaCustomConversionCatalog([source], {
      "123": "Quote Request Submitted",
    }),
  ).toBe(false);
  expect(needsMetaCustomConversionCatalog([source], {})).toBe(false);
});
it("normalizes spend requests so unrelated controls do not trigger another context read", () => {
  const key = campaignSpendRequestKey({
    reportType: "WEEKLY",
    dateSelection: { mode: "last7" },
  });
  expect(
    campaignSpendRequestKey({
      reportType: "WEEKLY",
      dateSelection: { mode: "last7" },
      historicalMonthCount: 12,
    }),
  ).toBe(key);
  expect(
    campaignSpendRequestKey({
      reportType: "WEEKLY",
      dateSelection: { mode: "prev7" },
    }),
  ).not.toBe(key);
  expect(
    campaignSpendRequestKey({
      reportType: "HISTORICAL",
      historicalMonthCount: 3,
    }),
  ).not.toBe(
    campaignSpendRequestKey({
      reportType: "HISTORICAL",
      historicalMonthCount: 6,
    }),
  );
});
it("preserves comparison and custom date changes in the request identity", () => {
  expect(
    campaignSpendRequestKey({
      reportType: "COMPARISON",
      comparisonPeriodA: { startIso: "2026-11-01", endIso: "2026-11-07" },
    }),
  ).not.toBe(
    campaignSpendRequestKey({
      reportType: "COMPARISON",
      comparisonPeriodA: { startIso: "2026-11-08", endIso: "2026-11-14" },
    }),
  );
  expect(
    campaignSpendRequestKey({
      dateSelection: {
        mode: "custom",
        customStart: "2026-11-01",
        customEnd: "2026-11-07",
      },
    }),
  ).not.toBe(
    campaignSpendRequestKey({
      dateSelection: {
        mode: "custom",
        customStart: "2026-11-02",
        customEnd: "2026-11-07",
      },
    }),
  );
});
