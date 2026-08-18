import { describe, it, expect } from "vitest";
import {
  buildGoogleSlots,
  buildMetaSlots,
  buildSlotsFromSelection,
  filterMetricsForCampaignObjective,
  redistributeCardSlots,
  type GoogleSlotBaseline,
  type MetaSlotBaseline,
} from "../slot-assignment";
import type { AvailableMetric } from "../available-metrics";
import type { RawMetricRow } from "../dynamic-metrics";
import type { GoogleObjectiveKey } from "../detect-objective";

function row(raw: Record<string, string>): RawMetricRow {
  return { _raw: raw };
}

const CORE_BASELINE = { spend: "$100", reach: "1,000", impressions: "5,000", ctr: "2.00%" };

function metaBaseline(overrides: Partial<MetaSlotBaseline> = {}): MetaSlotBaseline {
  return { resultLabel: "RESULTS", costLabel: "COST PER RESULT", resultValue: "10", cprValue: "$10.00", ...CORE_BASELINE, ...overrides };
}

/**
 * A CSV with real, non-zero data for every column any slot 7/8 candidate
 * (objective-specific or the Round I global fallback chain) could ever read
 * — used by the "which key wins" tests below, whose whole point is testing
 * pickSlot's priority/redundancy logic, not CSV-availability filtering
 * (that's covered separately by the empty/sparse-CSV tests).
 */
function fullRows(): RawMetricRow[] {
  return [
    row({
      "Amount spent": "500",
      Reach: "10000",
      Impressions: "40000",
      "Link clicks": "800",
      "CPC (cost per link click)": "0.60",
      "Clicks (all)": "1200",
      "Landing page views": "300",
      "Cost per landing page view": "1.50",
      "CPM (cost per 1,000 impressions)": "12.50",
      Frequency: "3.2",
      Thruplays: "150",
      "Video plays at 100%": "90",
      "New messaging contacts": "40",
      "Messaging contacts": "60",
      "Post engagements": "220",
      "Post reactions": "80",
      "App events": "35",
    }),
  ];
}

describe("buildMetaSlots — Part 1: 8-slot assignment", () => {
  it("always returns exactly 8 entries, in physical slot order 1-8, when the CSV backs every candidate with real data", () => {
    const slots = buildMetaSlots(metaBaseline(), fullRows(), "$");
    expect(slots).toHaveLength(8);
    // Slot 8's default-case candidates are [LANDING PAGE VIEWS, COST PER
    // LINK CLICK], tried in that priority order — LANDING PAGE VIEWS wins
    // here since fullRows() has real data for it.
    expect(slots.map((s) => s?.key)).toEqual(["spend", "reach", "impressions", "results", "cost_per_result", "ctr", "link_clicks", "landing_page_views"]);
  });

  // Round I bug fix regression: previously, when the uploaded CSV had NONE
  // of a slot's own candidate columns (or the global fallback chain's),
  // pickSlot fell back to showing that candidate's own label with a dash
  // value — i.e. a metric name the CSV never actually had. Slots 7/8 must
  // now be null (fill-tags.ts dashes out both label and value for a null
  // slot) rather than ever display an unavailable metric's name.
  it("returns null for slot 7 and slot 8 — never a metric name absent from the CSV — when the CSV has none of the objective's own or the global-fallback columns", () => {
    const slots = buildMetaSlots(metaBaseline(), [], "$");
    expect(slots).toHaveLength(8);
    expect(slots[6]).toBeNull();
    expect(slots[7]).toBeNull();
    // Slots 1-3/4/5/6 are always backed by the baseline (already-aggregated
    // core fields), never CSV-column-gated — they still populate normally.
    expect(slots[0]).toMatchObject({ key: "spend", value: "$100" });
    expect(slots[1]).toMatchObject({ key: "reach", value: "1,000" });
    expect(slots[2]).toMatchObject({ key: "impressions", value: "5,000" });
    expect(slots[3]).toMatchObject({ key: "results", value: "10" });
    expect(slots[4]).toMatchObject({ key: "cost_per_result", value: "$10.00" });
    expect(slots[5]).toMatchObject({ key: "ctr", value: "2.00%" });
  });

  it("slot 7 falls through the Round I global fallback chain (LINK CLICKS -> CLICKS (ALL) -> FREQUENCY -> CPM) when the objective's own candidate has no data in this CSV", () => {
    // CPM is a perUnitOf metric (spend / impressions) — Impressions must be
    // present for it to compute to a real, non-zero value.
    const rows = [row({ "Amount spent": "100", Impressions: "8000" })];
    // Default case's own slot 7 candidate is LINK CLICKS — absent here — so
    // it falls through CLICKS (ALL) (absent) and FREQUENCY (absent) to CPM
    // (computable from Amount Spent + Impressions, both present).
    const slots = buildMetaSlots(metaBaseline(), rows, "$");
    expect(slots[6]).toMatchObject({ key: "cpm" });
    expect(slots[6]?.value).not.toBe("—");
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
  ])("assigns slot 8 per the product spec for %s, when the CSV has real data for it", (resultLabel, expectedSlot8Key) => {
    const slots = buildMetaSlots(metaBaseline({ resultLabel }), fullRows(), "$");
    expect(slots[7]?.key).toBe(expectedSlot8Key);
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
    // Default case's own slot 8 candidate list is [LANDING PAGE VIEWS, COST
    // PER LINK CLICK], tried in that priority order — LANDING PAGE VIEWS
    // wins here since fullRows() has real data for it.
    ["SOMETHING UNRECOGNIZED", "landing_page_views"],
  ])("assigns a non-redundant slot 8 fallback when the spec's literal pick would duplicate that case's own slot 4/5/7 — %s", (resultLabel, expectedKey) => {
    const slots = buildMetaSlots(metaBaseline({ resultLabel }), fullRows(), "$");
    expect(slots[7]?.key).toBe(expectedKey);
  });

  it("never selects CLICKS (ALL) for slot 8 when LINK CLICKS is already shown elsewhere in the same card set — Issue 1", () => {
    for (const resultLabel of ["LINK CLICKS", "LANDING PAGE VIEWS", "REACH", "UNIQUE REACH", "POST ENGAGEMENTS", "ENGAGEMENT", "SOMETHING UNRECOGNIZED"]) {
      const slots = buildMetaSlots(metaBaseline({ resultLabel }), fullRows(), "$");
      const keys = slots.map((s) => s?.key);
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
    expect(slots.map((s) => s?.key)).toEqual([
      "spend",
      "reach",
      "impressions",
      "landing_page_views",
      "cost_per_lpv",
      "ctr",
      "link_clicks",
      "cpc_link_click",
    ]);
    expect(slots.map((s) => s?.label)).toEqual([
      "AD SPEND",
      "REACH",
      "IMPRESSIONS",
      "LANDING PAGE VIEWS",
      "COST PER LPV",
      "CTR (ALL)",
      "LINK CLICKS",
      "COST PER LINK CLICK",
    ]);
    expect(slots.map((s) => s?.key)).not.toContain("clicks_all");
    expect(slots[6]?.value).not.toBe("—");
    expect(slots[7]?.value).not.toBe("—");
  });

  // Objective Confirmation (Part 6) — ADD TO CART is now this case's own
  // slot 7 pick (a funnel-step-earlier metric, prioritized over ROAS
  // whenever real funnel data exists), not slot 8.
  it("PURCHASES: slot 7 is ADD TO CART when present in the CSV", () => {
    const rows = [row({ "Amount spent": "100", "Adds to cart": "25" })];
    const slots = buildMetaSlots(metaBaseline({ resultLabel: "PURCHASES" }), rows, "$");
    expect(slots[6]?.key).toBe("add_to_cart");
    expect(slots[6]?.value).not.toBe("—");
  });

  it("PURCHASES: slot 8 falls back to INITIATE CHECKOUT when ADD TO CART isn't in the CSV", () => {
    const rows = [row({ "Amount spent": "100", "Initiate checkout": "40" })];
    const slots = buildMetaSlots(metaBaseline({ resultLabel: "PURCHASES" }), rows, "$");
    expect(slots[7]?.key).toBe("initiate_checkout");
    expect(slots[7]?.value).not.toBe("—");
  });

  it("PURCHASES: slot 8 falls back to CLICKS (ALL) when neither ADD TO CART nor INITIATE CHECKOUT is in the CSV, but CLICKS (ALL) itself has real data", () => {
    // Results ROAS given real data too, so slot 7 (this case's own primary
    // pick) resolves to it directly rather than reaching into the global
    // fallback chain and consuming CLICKS (ALL) before slot 8's turn. ROAS
    // is calculated from totals (conversion value / spend), never read off
    // the CSV's own ROAS column directly — the conversion-value column is
    // what gives it real, non-dash data here (450 / 100 = 4.5x).
    const rows = [row({ "Amount spent": "100", "Results ROAS": "4.5", "Purchases conversion value": "450", "Clicks (all)": "300" })];
    const slots = buildMetaSlots(metaBaseline({ resultLabel: "PURCHASES" }), rows, "$");
    expect(slots[6]?.key).toBe("results_roas");
    expect(slots[7]?.key).toBe("clicks_all");
    expect(slots[7]?.value).not.toBe("—");
  });

  // Round I bug fix regression: previously this fell back to showing
  // "CLICKS (ALL)" with a dash value even though the CSV had zero data for
  // it (or anything else) — now the slot is left null entirely.
  it("PURCHASES: slot 8 is null — never a metric name absent from the CSV — when the CSV has none of ADD TO CART / INITIATE CHECKOUT / CLICKS (ALL) / the global fallback columns", () => {
    const slots = buildMetaSlots(metaBaseline({ resultLabel: "PURCHASES" }), [], "$");
    expect(slots[7]).toBeNull();
  });

  // Regression (Issue 2): a candidate column present in the CSV but
  // aggregating to zero must be skipped just like a missing column — the
  // next candidate in priority order is tried instead of showing a dash
  // for a metric that technically "exists" but has no real data.
  it("PURCHASES: slot 8 skips ADD TO CART when its CSV column is present but sums to zero, falling through to INITIATE CHECKOUT", () => {
    const rows = [row({ "Amount spent": "100", "Adds to cart": "0", "Initiate checkout": "40" })];
    const slots = buildMetaSlots(metaBaseline({ resultLabel: "PURCHASES" }), rows, "$");
    expect(slots[7]?.key).toBe("initiate_checkout");
    expect(slots[7]?.value).not.toBe("—");
  });

  it("PURCHASES: slot 8 skips ADD TO CART and INITIATE CHECKOUT when both are zero, falling through to CLICKS (ALL) with real data rather than showing a dash", () => {
    const rows = [
      row({
        "Amount spent": "100",
        "Results ROAS": "4.5",
        "Purchases conversion value": "450",
        "Adds to cart": "0",
        "Initiate checkout": "0",
        "Clicks (all)": "250",
      }),
    ];
    const slots = buildMetaSlots(metaBaseline({ resultLabel: "PURCHASES" }), rows, "$");
    expect(slots[7]?.key).toBe("clicks_all");
    expect(slots[7]?.value).not.toBe("—");
  });

  it("never assigns the same key to two different slots among 4/5/7/8, across every documented case", () => {
    const cases = [
      "WEBSITE LEADS", "LEADS", "META FORM LEADS", "LINK CLICKS", "LANDING PAGE VIEWS", "REACH", "UNIQUE REACH",
      "VIDEO VIEWS", "THRUPLAYS", "MESSAGING LEADS", "MESSAGING CONVERSATIONS STARTED", "CONVERSATIONS",
      "PURCHASES", "APP INSTALLS", "MOBILE APP INSTALLS", "PAGE LIKES", "POST ENGAGEMENTS", "ENGAGEMENT", "UNKNOWN",
    ];
    for (const resultLabel of cases) {
      const slots = buildMetaSlots(metaBaseline({ resultLabel }), fullRows(), "$");
      const keys = [slots[3]?.key, slots[4]?.key, slots[6]?.key, slots[7]?.key].filter((k): k is string => !!k);
      expect(new Set(keys).size, `${resultLabel}: ${keys.join(",")}`).toBe(keys.length);
    }
  });

  // Round I — user bug report: a Meta Form Leads / Instant Form campaign's
  // slot assignment was showing LANDING PAGE VIEWS/LINK CLICKS/CLICKS (ALL)
  // with dash values on CSVs that never had those columns at all. This is
  // the exact repro CSV from the report: only Campaign Name/Ad Set Name/
  // Day/Result Type/Results/Amount Spent/Cost Per Result/Reach/
  // Impressions/CTR/Website Leads/Cost Per Lead — no Link Clicks, no
  // Clicks (All), no Landing Page Views, no Frequency column.
  //
  // CPM legitimately DOES appear here: it's a perUnitOf metric (spend /
  // impressions, same as every other "cost per X" in this dictionary), and
  // this CSV has both Amount Spent and Impressions — real, non-zero data —
  // even though it has no literal "CPM" column. That's consistent with how
  // cost_per_lpv/cost_per_result/every other perUnitOf metric already
  // works elsewhere in this file (never required a literal column of their
  // own); it isn't the bug being fixed here.
  it("Meta Form Leads campaign on a CSV with no Link Clicks/Clicks (All)/Landing Page Views/Frequency columns never assigns a metric absent from (or not computable from) the CSV — comprehensive Round I regression", () => {
    const rows = [
      row({
        "Campaign Name": "Lead Gen Campaign",
        "Ad Set Name": "Set 1",
        Day: "01-08-2026",
        "Result Type": "Website Leads",
        Results: "10",
        "Amount Spent": "200",
        "Cost Per Result": "20",
        Reach: "5000",
        Impressions: "15000",
        CTR: "1.8",
        "Website Leads": "10",
        "Cost Per Lead": "20",
      }),
    ];
    const slots = buildMetaSlots(
      metaBaseline({ resultLabel: "WEBSITE LEADS", costLabel: "COST PER LEAD", resultValue: "10", cprValue: "$20.00" }),
      rows,
      "$",
    );

    expect(slots).toHaveLength(8);
    const nonNullKeys = slots.filter((s): s is NonNullable<typeof s> => s !== null).map((s) => s.key);
    expect(nonNullKeys).not.toContain("landing_page_views");
    expect(nonNullKeys).not.toContain("link_clicks");
    expect(nonNullKeys).not.toContain("clicks_all");
    expect(nonNullKeys).not.toContain("frequency");

    // Slot 7 falls all the way through the global fallback chain to CPM
    // (computable from Amount Spent + Impressions); slot 8 (Landing Page
    // Views, per spec) is genuinely null — nothing left in the CSV backs it
    // once CPM has already been used for slot 7.
    expect(slots[6]).toMatchObject({ key: "cpm" });
    expect(slots[6]?.value).not.toBe("—");
    expect(slots[7]).toBeNull();

    // Core slots (always backed by the baseline, never CSV-gated) still
    // populate normally — including slot 4/5, which ARE this CSV's own
    // Website Leads / Cost Per Lead columns.
    expect(slots[0]).toMatchObject({ key: "spend" });
    expect(slots[1]).toMatchObject({ key: "reach" });
    expect(slots[2]).toMatchObject({ key: "impressions" });
    expect(slots[3]).toMatchObject({ key: "results", value: "10" });
    expect(slots[4]).toMatchObject({ key: "cost_per_result", value: "$20.00" });
    expect(slots[5]).toMatchObject({ key: "ctr" });
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
    expect(result[0]?.value).toBe("$999");
  });

  it("aggregates fresh from raw rows for a key not present in baseline", () => {
    const selected = [{ key: "link_clicks", label: "LINK CLICKS", format: "number" as const, csvName: "link clicks" }];
    const rows = [row({ "Link clicks": "42" })];
    const result = buildSlotsFromSelection(selected, {}, rows, "meta", "$");
    expect(result[0]?.value).toBe("42");
  });

  it("preserves selection order and count, independent of the automatic per-objective switch", () => {
    const selected = [
      { key: "impressions", label: "IMPRESSIONS", format: "number" as const, csvName: "impressions" },
      { key: "spend", label: "AD SPEND", format: "currency" as const, csvName: "amount spent" },
    ];
    const result = buildSlotsFromSelection(selected, { impressions: "5,000", spend: "$100" }, [], "meta", "$");
    expect(result.map((r) => r?.key)).toEqual(["impressions", "spend"]);
  });

  it("returns null (not a dash-valued card) when the resolved value is the dash placeholder — Part 8 empty-card fix", () => {
    const selected = [{ key: "website_leads", label: "WEBSITE LEADS", format: "number" as const, csvName: "results" }];
    const result = buildSlotsFromSelection(selected, {}, [], "meta", "$");
    expect(result[0]).toBeNull();
  });
});

describe("filterMetricsForCampaignObjective — Part 8 per-campaign objective filtering", () => {
  const spend = { key: "spend", label: "AD SPEND", format: "currency" as const, csvName: "amount spent" };
  const reach = { key: "reach", label: "REACH", format: "number" as const, csvName: "reach" };
  const impressions = { key: "impressions", label: "IMPRESSIONS", format: "number" as const, csvName: "impressions" };
  const ctr = { key: "ctr", label: "CTR", format: "percentage" as const, csvName: "ctr (all)" };
  const linkClicks = { key: "link_clicks", label: "LINK CLICKS", format: "number" as const, csvName: "link clicks" };
  const metaFormLeads = { key: "meta_form_leads", label: "META FORM LEADS", format: "number" as const, csvName: "results" };
  // objectiveMetricKeys("META FORM LEADS") mechanically slugifies the whole
  // resultLabel, including its own trailing "S" -> "cost_per_meta_form_leads"
  // (plural) — not the singular "cost_per_meta_form_lead" a genuinely
  // dedicated CSV column would use (see meta-dictionary.ts); the two never
  // need to match each other, only to agree with what buildMultiObjectiveSelection
  // itself derived when it built this synthetic pair in the first place.
  const costPerLead = { key: "cost_per_meta_form_leads", label: "COST PER LEAD", format: "currency" as const, csvName: "cost per result" };
  const websiteLeads = { key: "website_leads", label: "WEBSITE LEADS", format: "number" as const, csvName: "results" };
  const costPerWebsiteLead = { key: "cost_per_website_leads", label: "COST PER WEBSITE LEAD", format: "currency" as const, csvName: "cost per result" };
  const purchases = { key: "purchases", label: "PURCHASES", format: "number" as const, csvName: "results" };
  const costPerPurchase = { key: "cost_per_purchases", label: "COST PER PURCHASE", format: "currency" as const, csvName: "cost per result" };
  const cpm = { key: "cpm", label: "CPM", format: "currency" as const, csvName: "cpm (cost per 1,000 impressions)" };
  const costPer1kReached = { key: "cost_per_1k_reached", label: "COST PER 1K REACHED", format: "currency" as const, csvName: "cost per 1,000 meta accounts reached" };

  const mixedSelection = [
    spend,
    reach,
    impressions,
    metaFormLeads,
    costPerLead,
    websiteLeads,
    costPerWebsiteLead,
    purchases,
    costPerPurchase,
    cpm,
    costPer1kReached,
    ctr,
    linkClicks,
  ];

  it("keeps only META FORM LEADS/COST PER LEAD (plus base + secondaries) for a meta_form_leads campaign", () => {
    const result = filterMetricsForCampaignObjective(mixedSelection, { resultLabel: "META FORM LEADS", costLabel: "COST PER LEAD" });
    const keys = result.map((m) => m.key);
    expect(keys).toContain("meta_form_leads");
    expect(keys).toContain("cost_per_meta_form_leads");
    expect(keys).not.toContain("website_leads");
    expect(keys).not.toContain("cost_per_website_leads");
    expect(keys).not.toContain("purchases");
    expect(keys).not.toContain("cost_per_purchases");
    expect(keys).not.toContain("cpm");
    expect(keys).not.toContain("cost_per_1k_reached");
    expect(keys).toContain("link_clicks"); // generic secondary, always shown
  });

  it("keeps only WEBSITE LEADS/COST PER WEBSITE LEAD for a website_leads campaign", () => {
    const result = filterMetricsForCampaignObjective(mixedSelection, { resultLabel: "WEBSITE LEADS", costLabel: "COST PER WEBSITE LEAD" });
    const keys = result.map((m) => m.key);
    expect(keys).toContain("website_leads");
    expect(keys).toContain("cost_per_website_leads");
    expect(keys).not.toContain("meta_form_leads");
    expect(keys).not.toContain("purchases");
    expect(keys).not.toContain("cpm");
  });

  it("keeps only PURCHASES/COST PER PURCHASE for a purchases campaign", () => {
    const result = filterMetricsForCampaignObjective(mixedSelection, { resultLabel: "PURCHASES", costLabel: "COST PER PURCHASE" });
    const keys = result.map((m) => m.key);
    expect(keys).toContain("purchases");
    expect(keys).toContain("cost_per_purchases");
    expect(keys).not.toContain("website_leads");
    expect(keys).not.toContain("meta_form_leads");
    expect(keys).not.toContain("cpm");
  });

  it("keeps only CPM/COST PER 1K REACHED for a reach campaign", () => {
    const result = filterMetricsForCampaignObjective(mixedSelection, { resultLabel: "REACH", costLabel: "COST PER 1K REACHED" });
    const keys = result.map((m) => m.key);
    expect(keys).toContain("cpm");
    expect(keys).toContain("cost_per_1k_reached");
    expect(keys).not.toContain("website_leads");
    expect(keys).not.toContain("meta_form_leads");
    expect(keys).not.toContain("purchases");
  });

  it("always keeps the base 4 and generic secondaries regardless of objective", () => {
    const result = filterMetricsForCampaignObjective(mixedSelection, { resultLabel: "PURCHASES", costLabel: "COST PER PURCHASE" });
    const keys = result.map((m) => m.key);
    expect(keys).toEqual(expect.arrayContaining(["spend", "reach", "impressions", "ctr", "link_clicks"]));
  });

  it("pads back up to minCount with the next highest-priority dropped metrics when pure filtering leaves too few", () => {
    // No base/secondary metrics at all here — pure filtering on a
    // meta_form_leads objective only keeps metaFormLeads/costPerLead (2),
    // below the 4-minimum, so the padding step pulls back in the two
    // dropped (other-objective) metrics to reach 4.
    const sparse = [metaFormLeads, costPerLead, websiteLeads, costPerWebsiteLead];
    const result = filterMetricsForCampaignObjective(sparse, { resultLabel: "META FORM LEADS", costLabel: "COST PER LEAD" }, 4);
    expect(result).toHaveLength(4);
    const keys = result.map((m) => m.key);
    expect(keys).toEqual(expect.arrayContaining(["meta_form_leads", "cost_per_meta_form_leads", "website_leads", "cost_per_website_leads"]));
  });

  it("passes every metric through unfiltered when no campaignObjective is known (null)", () => {
    const result = filterMetricsForCampaignObjective(mixedSelection, null);
    // No objective-specific pair matches, but nothing besides those pairs is excluded either.
    const keys = result.map((m) => m.key);
    expect(keys).not.toContain("meta_form_leads");
    expect(keys).not.toContain("website_leads");
    expect(keys).toContain("spend");
    expect(keys).toContain("link_clicks");
  });
});

describe("redistributeCardSlots — Part 4: no dash cards, compact + pad from real data", () => {
  function av(key: string, csvName: string, priority: number): AvailableMetric {
    return { key, label: key.toUpperCase(), format: "number", csvName, priority, isAutoCatch: false };
  }

  it("compacts real (non-null) cards forward, closing the gap a null slot left behind", () => {
    const slots = [
      { key: "spend", label: "AD SPEND", format: "currency" as const, value: "$100" },
      null,
      { key: "reach", label: "REACH", format: "number" as const, value: "1,000" },
      { key: "ctr", label: "CTR", format: "percentage" as const, value: "2%" },
    ];
    const result = redistributeCardSlots(slots, new Set(["spend", "reach", "ctr"]), [], {}, [], "meta", "$");
    expect(result.map((m) => m.key)).toEqual(["spend", "reach", "ctr"]);
  });

  it("pads back up to minCount using the highest-priority unused candidate that resolves to real, non-zero data for this campaign", () => {
    const slots = [
      { key: "spend", label: "AD SPEND", format: "currency" as const, value: "$100" },
      { key: "reach", label: "REACH", format: "number" as const, value: "1,000" },
    ];
    const rows = [{ _raw: { "Link clicks": "40", Frequency: "0" } }];
    const candidates = [av("frequency", "frequency", 90), av("link_clicks", "link clicks", 70)];
    const result = redistributeCardSlots(slots, new Set(["spend", "reach"]), candidates, {}, rows, "meta", "$", 3);
    // frequency has priority 90 (tried first) but resolves to a real 0 ->
    // dash -> skipped; link_clicks (priority 70) has real data and gets
    // pulled in instead.
    expect(result.map((m) => m.key)).toEqual(["spend", "reach", "link_clicks"]);
  });

  it("never pads with a key already in usedKeys, even if it would otherwise resolve to real data", () => {
    const slots = [{ key: "spend", label: "AD SPEND", format: "currency" as const, value: "$100" }];
    const rows = [{ _raw: { "Link clicks": "40" } }];
    const candidates = [av("link_clicks", "link clicks", 70)];
    const result = redistributeCardSlots(slots, new Set(["spend", "link_clicks"]), candidates, {}, rows, "meta", "$", 2);
    expect(result.map((m) => m.key)).toEqual(["spend"]);
  });

  it("does not pad when already at or above minCount, even with real-data candidates available", () => {
    const slots = [
      { key: "spend", label: "AD SPEND", format: "currency" as const, value: "$100" },
      { key: "reach", label: "REACH", format: "number" as const, value: "1,000" },
    ];
    const rows = [{ _raw: { "Link clicks": "40" } }];
    const candidates = [av("link_clicks", "link clicks", 70)];
    const result = redistributeCardSlots(slots, new Set(["spend", "reach"]), candidates, {}, rows, "meta", "$", 2);
    expect(result.map((m) => m.key)).toEqual(["spend", "reach"]);
  });

  it("caps the result at maxCount even after padding", () => {
    const slots = [{ key: "spend", label: "AD SPEND", format: "currency" as const, value: "$100" }];
    const rows = [{ _raw: { A: "1", B: "1", C: "1" } }];
    const candidates = [av("a", "a", 90), av("b", "b", 80), av("c", "c", 70)];
    const result = redistributeCardSlots(slots, new Set(["spend"]), candidates, {}, rows, "meta", "$", 10, 2);
    expect(result.length).toBeLessThanOrEqual(2);
  });

  it("returns an empty array when nothing has real data and no candidates resolve either", () => {
    const result = redistributeCardSlots([null, null], new Set(), [], {}, [], "meta", "$");
    expect(result).toEqual([]);
  });
});
