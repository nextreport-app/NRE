import { describe, it, expect } from "vitest";
import { buildGoogleSlots, buildMetaSlots, buildSlotsFromSelection, type GoogleSlotBaseline, type MetaSlotBaseline } from "../slot-assignment";
import type { RawMetricRow } from "../dynamic-metrics";
import type { GoogleObjectiveKey } from "../detect-objective";

function row(raw: Record<string, string>): RawMetricRow {
  return { _raw: raw };
}

const CORE_BASELINE = { spend: "$100", reach: "1,000", impressions: "5,000", ctr: "2.00%" };

function metaBaseline(overrides: Partial<MetaSlotBaseline> = {}): MetaSlotBaseline {
  return { resultLabel: "RESULTS", costLabel: "COST PER RESULT", resultValue: "10", cprValue: "$10.00", ...CORE_BASELINE, ...overrides };
}

describe("buildMetaSlots — Part 1: 8-slot assignment", () => {
  it("always returns exactly 8 entries, in physical slot order 1-8", () => {
    const slots = buildMetaSlots(metaBaseline(), [], "$");
    expect(slots).toHaveLength(8);
    // Slot 8's default-case fallback is COST PER LINK CLICK, not CLICKS
    // (ALL) — CLICKS (ALL) would duplicate slot 7's own LINK CLICKS
    // (redundancy fix, round 5).
    expect(slots.map((s) => s.key)).toEqual(["spend", "reach", "impressions", "results", "cost_per_result", "ctr", "link_clicks", "cpc_link_click"]);
  });

  it("keeps slots 1-3 and 6 fixed to the baseline regardless of objective", () => {
    const slots = buildMetaSlots(metaBaseline({ resultLabel: "PURCHASES" }), [], "$");
    expect(slots[0]).toMatchObject({ key: "spend", value: "$100" });
    expect(slots[1]).toMatchObject({ key: "reach", value: "1,000" });
    expect(slots[2]).toMatchObject({ key: "impressions", value: "5,000" });
    expect(slots[5]).toMatchObject({ key: "ctr", value: "2.00%" });
  });

  it.each([
    ["WEBSITE LEADS", "landing_page_views"],
    ["LEADS", "landing_page_views"],
    ["META FORM LEADS", "landing_page_views"],
    ["VIDEO VIEWS", "video_p100"],
    ["THRUPLAYS", "video_p100"],
    ["MESSAGING LEADS", "messaging_contacts"],
    ["APP INSTALLS", "app_events"],
    ["MOBILE APP INSTALLS", "app_events"],
  ])("assigns slot 8 per the product spec for %s", (resultLabel, expectedSlot8Key) => {
    const slots = buildMetaSlots(metaBaseline({ resultLabel }), [], "$");
    expect(slots[7].key).toBe(expectedSlot8Key);
  });

  // Regression (redundancy fix, round 5): when the spec's literal slot 8
  // pick would duplicate that case's own slot 4/5/7, the fallback is no
  // longer unconditionally CLICKS (ALL) — CLICKS (ALL) is itself a
  // redundant superset of LINK CLICKS (Issue 1), so any case that already
  // shows LINK CLICKS elsewhere picks a genuinely different, non-redundant
  // metric instead. PAGE LIKES doesn't use LINK CLICKS anywhere in its own
  // slots, so CLICKS (ALL) is still a valid (non-redundant) fallback there.
  it.each([
    ["LINK CLICKS", "cost_per_lpv"],
    ["REACH", "cpc_link_click"],
    ["UNIQUE REACH", "cpc_link_click"],
    ["LANDING PAGE VIEWS", "cpc_link_click"],
    ["PAGE LIKES", "clicks_all"],
    ["POST ENGAGEMENTS", "post_reactions"],
    ["ENGAGEMENT", "post_reactions"],
    ["SOMETHING UNRECOGNIZED", "cpc_link_click"],
  ])("assigns a non-redundant slot 8 fallback when the spec's literal pick would duplicate that case's own slot 4/5/7 — %s", (resultLabel, expectedKey) => {
    const slots = buildMetaSlots(metaBaseline({ resultLabel }), [], "$");
    expect(slots[7].key).toBe(expectedKey);
  });

  it("never selects CLICKS (ALL) for slot 8 when LINK CLICKS is already shown elsewhere in the same card set — Issue 1", () => {
    for (const resultLabel of ["LINK CLICKS", "LANDING PAGE VIEWS", "REACH", "UNIQUE REACH", "POST ENGAGEMENTS", "ENGAGEMENT", "SOMETHING UNRECOGNIZED"]) {
      const slots = buildMetaSlots(metaBaseline({ resultLabel }), [], "$");
      const keys = slots.map((s) => s.key);
      if (keys.includes("link_clicks")) {
        expect(keys, resultLabel).not.toContain("clicks_all");
      }
    }
  });

  it("Landing Page Views campaigns get exactly the spec'd 8 slots — no CLICKS (ALL)", () => {
    const rows = [
      row({
        "Amount spent": "500",
        Reach: "10000",
        Impressions: "40000",
        "Landing page views": "300",
        "Cost per landing page view": "1.50",
        CTR: "2.5",
        "Link clicks": "800",
        "CPC (cost per link click)": "0.60",
      }),
    ];
    const slots = buildMetaSlots(
      metaBaseline({ resultLabel: "LANDING PAGE VIEWS", costLabel: "COST PER LPV", spend: "$500", reach: "10,000", impressions: "40,000", ctr: "2.50%" }),
      rows,
      "$",
    );
    expect(slots.map((s) => s.key)).toEqual([
      "spend",
      "reach",
      "impressions",
      "landing_page_views",
      "cost_per_lpv",
      "ctr",
      "link_clicks",
      "cpc_link_click",
    ]);
    expect(slots.map((s) => s.label)).toEqual([
      "AD SPEND",
      "REACH",
      "IMPRESSIONS",
      "LANDING PAGE VIEWS",
      "COST PER LPV",
      "CTR (ALL)",
      "LINK CLICKS",
      "COST PER LINK CLICK",
    ]);
    expect(slots.map((s) => s.key)).not.toContain("clicks_all");
    expect(slots[6].value).not.toBe("—");
    expect(slots[7].value).not.toBe("—");
  });

  it("PURCHASES: slot 8 is ADD TO CART when present in the CSV", () => {
    const rows = [row({ "Amount spent": "100", "Adds to cart": "25" })];
    const slots = buildMetaSlots(metaBaseline({ resultLabel: "PURCHASES" }), rows, "$");
    expect(slots[7].key).toBe("add_to_cart");
    expect(slots[7].value).not.toBe("—");
  });

  it("PURCHASES: slot 8 falls back to INITIATE CHECKOUT when ADD TO CART isn't in the CSV", () => {
    const rows = [row({ "Amount spent": "100", "Initiate checkout": "40" })];
    const slots = buildMetaSlots(metaBaseline({ resultLabel: "PURCHASES" }), rows, "$");
    expect(slots[7].key).toBe("initiate_checkout");
    expect(slots[7].value).not.toBe("—");
  });

  it("PURCHASES: slot 8 falls back to the default CLICKS (ALL) when neither ADD TO CART nor INITIATE CHECKOUT is in the CSV (skipping ROAS, already slot 7)", () => {
    const slots = buildMetaSlots(metaBaseline({ resultLabel: "PURCHASES" }), [], "$");
    expect(slots[7].key).toBe("clicks_all");
  });

  // Regression (Issue 2): a candidate column present in the CSV but
  // aggregating to zero must be skipped just like a missing column — the
  // next candidate in priority order is tried instead of showing a dash
  // for a metric that technically "exists" but has no real data.
  it("PURCHASES: slot 8 skips ADD TO CART when its CSV column is present but sums to zero, falling through to INITIATE CHECKOUT", () => {
    const rows = [row({ "Amount spent": "100", "Adds to cart": "0", "Initiate checkout": "40" })];
    const slots = buildMetaSlots(metaBaseline({ resultLabel: "PURCHASES" }), rows, "$");
    expect(slots[7].key).toBe("initiate_checkout");
    expect(slots[7].value).not.toBe("—");
  });

  it("PURCHASES: slot 8 skips ADD TO CART and INITIATE CHECKOUT when both are zero, falling through to CLICKS (ALL) with real data rather than showing a dash", () => {
    const rows = [row({ "Amount spent": "100", "Adds to cart": "0", "Initiate checkout": "0", "Clicks (all)": "250" })];
    const slots = buildMetaSlots(metaBaseline({ resultLabel: "PURCHASES" }), rows, "$");
    expect(slots[7].key).toBe("clicks_all");
    expect(slots[7].value).not.toBe("—");
  });

  it("never assigns the same key to two different slots among 4/5/7/8, across every documented case", () => {
    const cases = [
      "WEBSITE LEADS", "LEADS", "META FORM LEADS", "LINK CLICKS", "LANDING PAGE VIEWS", "REACH", "UNIQUE REACH",
      "VIDEO VIEWS", "THRUPLAYS", "MESSAGING LEADS", "MESSAGING CONVERSATIONS STARTED", "CONVERSATIONS",
      "PURCHASES", "APP INSTALLS", "MOBILE APP INSTALLS", "PAGE LIKES", "POST ENGAGEMENTS", "ENGAGEMENT", "UNKNOWN",
    ];
    for (const resultLabel of cases) {
      const slots = buildMetaSlots(metaBaseline({ resultLabel }), [], "$");
      const keys = [slots[3].key, slots[4].key, slots[6].key, slots[7].key];
      expect(new Set(keys).size, `${resultLabel}: ${keys.join(",")}`).toBe(keys.length);
    }
  });
});

function googleBaseline(overrides: Partial<GoogleSlotBaseline> = {}): GoogleSlotBaseline {
  return { spend: "$100", reach: "40", impressions: "2,000", ctr: "2.00%", cpc: "$2.50", results: "6", cpr: "$16.67", ...overrides };
}

describe("buildGoogleSlots — Part 1: 8-slot assignment", () => {
  it("always returns exactly 8 entries, in physical slot order 1-8", () => {
    const slots = buildGoogleSlots("search", googleBaseline(), [], "$");
    expect(slots).toHaveLength(8);
    expect(slots.map((s) => s.key)).toEqual(["spend", "reach", "impressions", "conversions", "cost_per_conv", "ctr", "avg_cpc", "conv_rate"]);
  });

  it.each([
    ["shopping", "conv_rate"],
    ["performance_max", "conv_rate"],
    ["display", "avg_viewable_cpm"],
    ["video", "video_p100"],
    ["youtube", "video_p100"],
    ["search", "conv_rate"],
  ] as [GoogleObjectiveKey, string][])("assigns slot 8 for %s campaign type, avoiding a duplicate of slot 4/5", (objectiveKey, expectedSlot8Key) => {
    const slots = buildGoogleSlots(objectiveKey, googleBaseline(), [], "$");
    expect(slots[7].key).toBe(expectedSlot8Key);
  });

  it("never assigns the same key to two different slots among 4/5/8, across every campaign type", () => {
    const keys: GoogleObjectiveKey[] = ["search", "display", "shopping", "video", "youtube", "app", "performance_max", "demand_gen", "local", "leads"];
    for (const objectiveKey of keys) {
      const slots = buildGoogleSlots(objectiveKey, googleBaseline(), [], "$");
      const slotKeys = [slots[3].key, slots[4].key, slots[7].key];
      expect(new Set(slotKeys).size, `${objectiveKey}: ${slotKeys.join(",")}`).toBe(slotKeys.length);
    }
  });
});

describe("buildSlotsFromSelection — Part 3/4 wizard override", () => {
  it("uses the baseline value for a known core key instead of re-deriving it from raw rows", () => {
    const selected = [{ key: "spend", label: "AD SPEND", format: "currency" as const, csvName: "amount spent" }];
    const result = buildSlotsFromSelection(selected, { spend: "$999" }, [], "meta", "$");
    expect(result[0].value).toBe("$999");
  });

  it("aggregates fresh from raw rows for a key not present in baseline", () => {
    const selected = [{ key: "link_clicks", label: "LINK CLICKS", format: "number" as const, csvName: "link clicks" }];
    const rows = [row({ "Link clicks": "42" })];
    const result = buildSlotsFromSelection(selected, {}, rows, "meta", "$");
    expect(result[0].value).toBe("42");
  });

  it("preserves selection order and count, independent of the automatic per-objective switch", () => {
    const selected = [
      { key: "impressions", label: "IMPRESSIONS", format: "number" as const, csvName: "impressions" },
      { key: "spend", label: "AD SPEND", format: "currency" as const, csvName: "amount spent" },
    ];
    const result = buildSlotsFromSelection(selected, { impressions: "5,000", spend: "$100" }, [], "meta", "$");
    expect(result.map((r) => r.key)).toEqual(["impressions", "spend"]);
  });
});
