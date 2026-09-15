import { describe, expect, it } from "vitest";
import { detectGa4ClientKind } from "../ga4-client-kind-dictionary";
import { GA4_API_METRIC_NAMES, GA4_COLUMN_KEYWORDS, GA4_MATCH_PRIORITY } from "../ga4-metric-dictionary";
import { buildGa4ColumnMap } from "../ga4-columns";

describe("ga4-client-kind-dictionary", () => {
  it("detects ecommerce, lead gen, and content kinds", () => {
    expect(detectGa4ClientKind({ purchaseRevenue: 100, transactions: 2, conversions: 5 })).toBe("ecommerce");
    expect(detectGa4ClientKind({ purchaseRevenue: 0, transactions: 0, conversions: 12 })).toBe("lead_gen");
    expect(detectGa4ClientKind({ purchaseRevenue: 0, transactions: 0, conversions: 0 })).toBe("content");
  });
});

describe("ga4-metric-dictionary", () => {
  it("builds column map from CSV headers using shared keywords", () => {
    const map = buildGa4ColumnMap(["Date", "Sessions", "Total users", "Key events", "Purchase revenue"]);
    expect(map.sessions).toBe("Sessions");
    expect(map.total_users).toBe("Total users");
    expect(map.conversions).toBe("Key events");
    expect(map.purchase_revenue).toBe("Purchase revenue");
    expect(GA4_COLUMN_KEYWORDS.sessions).toContain("sessions");
    expect(GA4_MATCH_PRIORITY.length).toBeGreaterThan(20);
    expect(GA4_API_METRIC_NAMES).toContain("sessions");
  });
});
