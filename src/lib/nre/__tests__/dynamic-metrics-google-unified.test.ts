import { describe, expect, it } from "vitest";
import { lookupMetricValue, type MetricRef } from "../dynamic-metrics";
import type { NreRow } from "../columns";

function row(raw: Record<string, string>): NreRow {
  return { _raw: raw } as NreRow;
}

describe("lookupMetricValue — Google unified pipeline (Meta-normalized headers)", () => {
  it("resolves cost and clicks from normalized Google CSV headers", () => {
    const rows = [
      row({
        "Campaign name": "Shoes",
        "Amount spent": "100",
        "Link clicks": "50",
        "Impr.": "1000",
        Results: "4",
      }),
    ];
    const costRef: MetricRef = { key: "cost", format: "currency", csvName: "cost" };
    const clicksRef: MetricRef = { key: "clicks", format: "number", csvName: "clicks" };
    expect(lookupMetricValue(rows, costRef, "google", "$")).toBe("$100.00");
    expect(lookupMetricValue(rows, clicksRef, "google", "$")).toBe("50");
  });
});
