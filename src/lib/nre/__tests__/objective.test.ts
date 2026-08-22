import { describe, expect, it, vi } from "vitest";
import {
  buildCampaignObjectiveMap,
  buildCampaignObjectiveMapWithConfidence,
  detectObjectiveFromColumns,
  getGroupedResultDisplay,
  getGroupedResultDisplayForObjective,
  getResultGroups,
  getResultLabels,
  getSingleRowResultDisplay,
  getSingleRowResultDisplayForObjective,
  groupResultsByCampaignObjective,
  normalizeCampaignName,
  resolveCampaignObjective,
  resolveCampaignObjectiveWithConfidence,
  resolveObjective,
} from "../objective";
import type { AggRow } from "../aggregate";
import type { MetricRow } from "../types";

function row(overrides: Partial<AggRow> = {}): AggRow {
  return {
    campaign_name: "Campaign A",
    ad_set_name: "Ad Set 1",
    result_type: "Leads (form)",
    delivery_status: "",
    objectiveConfident: true,
    spend: 1000,
    reach: 5000,
    impressions: 10000,
    results: 20,
    link_clicks: 200,
    purchases: 0,
    initiate_checkout: 0,
    add_to_cart: 0,
    ctr: 2,
    cpc: 5,
    cpr: 50,
    frequency: 2,
    date_start: "13-07-2026",
    date_end: "13-07-2026",
    ...overrides,
  };
}

describe("getResultLabels", () => {
  // One representative phrase per objective in the full dictionary (Step 1).
  it.each([
    ["Website lead", "WEBSITE LEADS", "COST PER WEBSITE LEAD"],
    ["Web lead", "WEBSITE LEADS", "COST PER WEBSITE LEAD"],
    ["Lead (website)", "WEBSITE LEADS", "COST PER WEBSITE LEAD"],
    ["Contact", "WEBSITE LEADS", "COST PER WEBSITE LEAD"],
    ["Instant form", "META FORM LEADS", "COST PER LEAD"],
    ["Meta lead", "META FORM LEADS", "COST PER LEAD"],
    ["Lead form", "META FORM LEADS", "COST PER LEAD"],
    ["Form lead", "META FORM LEADS", "COST PER LEAD"],
    ["Leads (form)", "META FORM LEADS", "COST PER LEAD"], // the real, common Meta result_type string
    ["Lead (form)", "META FORM LEADS", "COST PER LEAD"],
    ["Messaging conversation", "MESSAGING LEADS", "COST PER CONVERSATION"],
    ["Messenger lead", "MESSAGING LEADS", "COST PER CONVERSATION"],
    ["Message start", "MESSAGING LEADS", "COST PER CONVERSATION"],
    ["Instagram conversation", "INSTAGRAM DM LEADS", "COST PER CONVERSATION"],
    ["Instagram DM", "INSTAGRAM DM LEADS", "COST PER CONVERSATION"],
    ["Whatsapp conversation", "WHATSAPP LEADS", "COST PER CONVERSATION"],
    ["Whatsapp lead", "WHATSAPP LEADS", "COST PER CONVERSATION"],
    ["Phone call", "CALL LEADS", "COST PER CALL"],
    ["Call lead", "CALL LEADS", "COST PER CALL"],
    ["Calls", "CALL LEADS", "COST PER CALL"],
    ["Appointment", "APPOINTMENT LEADS", "COST PER BOOKING"],
    ["Booking", "APPOINTMENT LEADS", "COST PER BOOKING"],
    ["Complete registration", "REGISTRATIONS", "COST PER REGISTRATION"],
    ["Registration", "REGISTRATIONS", "COST PER REGISTRATION"],
    ["Submit application", "APPLICATIONS", "COST PER APPLICATION"],
    ["Application", "APPLICATIONS", "COST PER APPLICATION"],
    ["Subscribe", "SUBSCRIPTIONS", "COST PER SUBSCRIPTION"],
    ["Subscription", "SUBSCRIPTIONS", "COST PER SUBSCRIPTION"],
    ["Custom conversion", "CONVERSIONS", "COST PER CONVERSION"],
    ["Purchase", "PURCHASES", "COST PER PURCHASE"],
    ["Buy", "PURCHASES", "COST PER PURCHASE"],
    ["Checkout complete", "PURCHASES", "COST PER PURCHASE"],
    ["Order", "PURCHASES", "COST PER PURCHASE"],
    ["Add to cart", "ADD TO CART", "COST PER ADD TO CART"],
    ["AddToCart", "ADD TO CART", "COST PER ADD TO CART"],
    ["Initiate checkout", "INITIATE CHECKOUT", "COST PER CHECKOUT"],
    ["InitiateCheckout", "INITIATE CHECKOUT", "COST PER CHECKOUT"],
    ["Add payment info", "PAYMENT INFO", "COST PER PAYMENT INFO"],
    ["AddPaymentInfo", "PAYMENT INFO", "COST PER PAYMENT INFO"],
    ["View content", "CONTENT VIEWS", "COST PER VIEW"],
    ["ViewContent", "CONTENT VIEWS", "COST PER VIEW"],
    ["Landing page view", "LANDING PAGE VIEWS", "COST PER LPV"],
    ["LPV", "LANDING PAGE VIEWS", "COST PER LPV"],
    ["Link click", "LINK CLICKS", "COST PER CLICK"],
    ["Outbound click", "LINK CLICKS", "COST PER CLICK"],
    ["App install", "APP INSTALLS", "COST PER INSTALL"],
    ["Mobile app install", "APP INSTALLS", "COST PER INSTALL"],
    ["App event", "APP EVENTS", "COST PER APP EVENT"],
    ["In-app purchase", "APP EVENTS", "COST PER APP EVENT"],
    ["Reach", "REACH", "COST PER 1K REACH"],
    ["People reached", "REACH", "COST PER 1K REACH"],
    ["Impression", "IMPRESSIONS", "CPM"],
    ["CPM", "IMPRESSIONS", "CPM"],
    ["Ad recall", "AD RECALL LIFT", "COST PER RECALL LIFT"],
    ["Recall lift", "AD RECALL LIFT", "COST PER RECALL LIFT"],
    ["Post engagement", "POST ENGAGEMENTS", "COST PER ENGAGEMENT"],
    ["Engagement", "POST ENGAGEMENTS", "COST PER ENGAGEMENT"],
    ["Page like", "PAGE LIKES", "COST PER PAGE LIKE"],
    ["Page likes", "PAGE LIKES", "COST PER PAGE LIKE"],
    ["Follower", "FOLLOWERS", "COST PER FOLLOW"],
    ["Follow", "FOLLOWERS", "COST PER FOLLOW"],
    ["Event response", "EVENT RESPONSES", "COST PER RESPONSE"],
    ["Video view", "VIDEO VIEWS", "COST PER VIDEO VIEW"],
    ["Video play", "VIDEO VIEWS", "COST PER VIDEO VIEW"],
    ["ThruPlay", "VIDEO VIEWS", "COST PER VIDEO VIEW"],
    ["Newsletter lead", "LEADS", "COST PER LEAD"], // unmatched lead type -> generic fallback
    ["Some Other Lead Type", "LEADS", "COST PER LEAD"],
    ["", "RESULTS", "COST PER RESULT"],
  ])("classifies %s as %s / %s", (input, resultLabel, costLabel) => {
    expect(getResultLabels(input)).toEqual({ resultLabel, costLabel });
  });

  it("in-app purchase resolves to APP EVENTS, not PURCHASES, even though it contains the substring 'purchase'", () => {
    expect(getResultLabels("In-app purchase").resultLabel).toBe("APP EVENTS");
    expect(getResultLabels("Purchase").resultLabel).toBe("PURCHASES");
  });

  it("keeps 'Leads (form)'/'Website lead' distinct from the generic LEADS bucket a bare 'Lead' falls into", () => {
    expect(getResultLabels("Leads (form)").resultLabel).toBe("META FORM LEADS");
    expect(getResultLabels("Website lead").resultLabel).toBe("WEBSITE LEADS");
    expect(getResultLabels("Lead").resultLabel).toBe("LEADS");
  });

  it("keeps 'Submit application' distinct from any 'app'-prefixed bucket", () => {
    expect(getResultLabels("Submit application").resultLabel).toBe("APPLICATIONS");
    expect(getResultLabels("App install").resultLabel).toBe("APP INSTALLS");
  });

  it("falls back to the raw result_type (cleaned up), not a generic RESULTS label, when totally unrecognized", () => {
    expect(getResultLabels("Some Custom Event XYZ")).toEqual({
      resultLabel: "SOME CUSTOM EVENT XYZ",
      costLabel: "COST PER SOME CUSTOM EVENT XYZ",
    });
  });

  it("still falls back to the generic RESULTS bucket for a genuinely blank result_type", () => {
    // aggregate.ts's Step 2-4 objective correction relies on a blank
    // result_type mapping to the generic RESULTS bucket to detect "no
    // result type set" rows — only a *present*, unrecognized string should
    // keep its own text.
    expect(getResultLabels("")).toEqual({ resultLabel: "RESULTS", costLabel: "COST PER RESULT" });
    expect(getResultLabels(null)).toEqual({ resultLabel: "RESULTS", costLabel: "COST PER RESULT" });
    expect(getResultLabels(undefined)).toEqual({ resultLabel: "RESULTS", costLabel: "COST PER RESULT" });
  });
});

describe("detectObjectiveFromColumns", () => {
  it("detects WEBSITE LEADS when a 'Website leads' header exists, regardless of case", () => {
    expect(detectObjectiveFromColumns(["Campaign name", "Website Leads", "Link clicks"])).toEqual({
      resultLabel: "WEBSITE LEADS",
      costLabel: "COST PER WEBSITE LEAD",
    });
  });

  it("detects META FORM LEADS when a 'Meta leads' header exists", () => {
    expect(detectObjectiveFromColumns(["Campaign name", "Meta leads"])).toEqual({
      resultLabel: "META FORM LEADS",
      costLabel: "COST PER LEAD",
    });
  });

  it("detects MESSAGING LEADS when a 'Messaging conversations started' header exists", () => {
    expect(detectObjectiveFromColumns(["Campaign name", "Messaging conversations started"])).toEqual({
      resultLabel: "MESSAGING LEADS",
      costLabel: "COST PER CONVERSATION",
    });
  });

  it("detects WHATSAPP LEADS when a 'WhatsApp conversations started' header exists", () => {
    expect(detectObjectiveFromColumns(["Campaign name", "WhatsApp conversations started"])).toEqual({
      resultLabel: "WHATSAPP LEADS",
      costLabel: "COST PER CONVERSATION",
    });
  });

  it("detects CALL LEADS from 'Calls' or 'Phone calls'", () => {
    expect(detectObjectiveFromColumns(["Campaign name", "Calls"])).toEqual({
      resultLabel: "CALL LEADS",
      costLabel: "COST PER CALL",
    });
    expect(detectObjectiveFromColumns(["Campaign name", "Phone calls"])).toEqual({
      resultLabel: "CALL LEADS",
      costLabel: "COST PER CALL",
    });
  });

  it("detects PURCHASES when a 'Purchases' header exists", () => {
    expect(detectObjectiveFromColumns(["Campaign name", "Purchases"])).toEqual({
      resultLabel: "PURCHASES",
      costLabel: "COST PER PURCHASE",
    });
  });

  it("detects PURCHASES when only a 'Purchase ROAS' header exists", () => {
    expect(detectObjectiveFromColumns(["Campaign name", "Purchase ROAS"])).toEqual({
      resultLabel: "PURCHASES",
      costLabel: "COST PER PURCHASE",
    });
  });

  it("detects ADD TO CART from 'Adds to cart' or 'Add to cart'", () => {
    expect(detectObjectiveFromColumns(["Campaign name", "Adds to cart"])).toEqual({
      resultLabel: "ADD TO CART",
      costLabel: "COST PER ADD TO CART",
    });
    expect(detectObjectiveFromColumns(["Campaign name", "Add to cart"])).toEqual({
      resultLabel: "ADD TO CART",
      costLabel: "COST PER ADD TO CART",
    });
  });

  it("detects INITIATE CHECKOUT when a 'Checkouts initiated' header exists", () => {
    expect(detectObjectiveFromColumns(["Campaign name", "Checkouts initiated"])).toEqual({
      resultLabel: "INITIATE CHECKOUT",
      costLabel: "COST PER CHECKOUT",
    });
  });

  it("detects APP INSTALLS when an 'App installs' header exists", () => {
    expect(detectObjectiveFromColumns(["Campaign name", "App installs"])).toEqual({
      resultLabel: "APP INSTALLS",
      costLabel: "COST PER INSTALL",
    });
  });

  it("detects VIDEO VIEWS from 'Video plays' or 'ThruPlays'", () => {
    expect(detectObjectiveFromColumns(["Campaign name", "Video plays"])).toEqual({
      resultLabel: "VIDEO VIEWS",
      costLabel: "COST PER VIDEO VIEW",
    });
    expect(detectObjectiveFromColumns(["Campaign name", "ThruPlays"])).toEqual({
      resultLabel: "VIDEO VIEWS",
      costLabel: "COST PER VIDEO VIEW",
    });
  });

  it("detects LANDING PAGE VIEWS only when there's no Website leads column", () => {
    expect(detectObjectiveFromColumns(["Campaign name", "Landing page views"])).toEqual({
      resultLabel: "LANDING PAGE VIEWS",
      costLabel: "COST PER LPV",
    });
    // Website leads takes priority when both are present.
    expect(
      detectObjectiveFromColumns(["Campaign name", "Landing page views", "Website leads"]),
    ).toEqual({ resultLabel: "WEBSITE LEADS", costLabel: "COST PER WEBSITE LEAD" });
  });

  it("detects the generic LEADS when only a bare 'Leads' header exists", () => {
    expect(detectObjectiveFromColumns(["Campaign name", "Leads"])).toEqual({
      resultLabel: "LEADS",
      costLabel: "COST PER LEAD",
    });
  });

  it("prioritizes Website leads over Meta leads over generic Leads when several are present", () => {
    expect(detectObjectiveFromColumns(["Leads", "Meta leads", "Website leads"])).toEqual({
      resultLabel: "WEBSITE LEADS",
      costLabel: "COST PER WEBSITE LEAD",
    });
    expect(detectObjectiveFromColumns(["Leads", "Meta leads"])).toEqual({
      resultLabel: "META FORM LEADS",
      costLabel: "COST PER LEAD",
    });
  });

  it("returns null when no recognized objective column exists — Link clicks alone is not a signal", () => {
    expect(detectObjectiveFromColumns(["Campaign name", "Link clicks", "Impressions"])).toBeNull();
  });

  it("returns null for an empty header list", () => {
    expect(detectObjectiveFromColumns([])).toBeNull();
  });
});

describe("getResultGroups", () => {
  it("sums count/spend per result label and sorts by count descending", () => {
    const rows: AggRow[] = [
      row({ result_type: "Lead", results: 10, spend: 500 }),
      row({ result_type: "Newsletter lead", results: 5, spend: 250 }),
      row({ result_type: "Purchase", results: 20, spend: 2000 }),
    ];
    const groups = getResultGroups(rows);
    expect(groups[0]).toMatchObject({ label: "PURCHASES", count: 20 });
    expect(groups[1]).toMatchObject({ label: "LEADS", count: 15 });
    expect(groups[1].avgCpr).toBeCloseTo(750 / 15);
  });

  it("keeps 'Meta form leads' and 'Subscriptions' as separate groups, not folded into a generic bucket", () => {
    const rows: AggRow[] = [
      row({ result_type: "Leads (form)", results: 12, spend: 600 }),
      row({ result_type: "Subscription", results: 8, spend: 400 }),
    ];
    const groups = getResultGroups(rows);
    const leads = groups.find((g) => g.label === "META FORM LEADS");
    const subs = groups.find((g) => g.label === "SUBSCRIPTIONS");
    expect(leads).toMatchObject({ label: "META FORM LEADS", costLabel: "COST PER LEAD", count: 12 });
    expect(subs).toMatchObject({ label: "SUBSCRIPTIONS", costLabel: "COST PER SUBSCRIPTION", count: 8 });
  });

  it("multiplies REACH's avgCpr by 1000 when a results count IS present", () => {
    const rows: AggRow[] = [row({ result_type: "Reach", results: 5000, spend: 100 })];
    const groups = getResultGroups(rows);
    expect(groups[0].label).toBe("REACH");
    expect(groups[0].avgCpr).toBeCloseTo((100 / 5000) * 1000);
  });

  it("computes REACH's avgCpr from the reach column directly when results is 0 (real Reach objective)", () => {
    const rows: AggRow[] = [row({ result_type: "Reach", results: 0, reach: 70000, spend: 1400 })];
    const groups = getResultGroups(rows);
    expect(groups[0].label).toBe("REACH");
    expect(groups[0].count).toBe(0);
    expect(groups[0].avgCpr).toBeCloseTo((1400 * 1000) / 70000);
  });
});

/**
 * Builds a Period-row-shaped MetricRow the way a raw, un-aggregated NreRow
 * looks (real CSV headers in _raw, plus the mapped objective-specific
 * fields) — this is exactly the shape getResultGroups receives for the
 * Combined Total table's Previous Month Data row, which (unlike the MTD
 * row) never passes through aggregate.ts's aggregateRows first, so
 * getResultGroups' own Priority 1-4 chain is the ONLY objective correction
 * these rows ever get.
 */
function metricRow(overrides: Partial<MetricRow> & { _raw: Record<string, string> }): MetricRow {
  return {
    campaign_name: "Campaign A",
    ad_set_name: "Ad Set 1",
    result_type: "",
    spend: 100,
    reach: 0,
    impressions: 1000,
    results: 0,
    ...overrides,
  };
}

describe("resolveObjective — Priority 1 (dedicated metric columns) beats Priority 2 (result_type text)", () => {
  // Reported bug: result_type = 'landing_page_view' (an intermediate signal
  // Meta always populates) must not win over a real, non-zero Website leads
  // column — Website leads is the actual conversion being optimized for.
  it("Test 1 — website leads column value 5 + result_type 'landing_page_view' -> WEBSITE LEADS, not LANDING PAGE VIEWS", () => {
    const resolution = resolveObjective(
      { result_type: "landing_page_view", website_leads: 5, results: 5 },
      null,
    );
    expect(resolution.resultLabel).toBe("WEBSITE LEADS");
    expect(resolution.resultLabel).not.toBe("LANDING PAGE VIEWS");
  });

  it("Test 2 — leads column value 14 + result_type 'onsite_conversion.lead_grouped' -> META FORM LEADS", () => {
    const resolution = resolveObjective(
      { result_type: "onsite_conversion.lead_grouped", leads: 14, results: 14 },
      null,
    );
    expect(resolution.resultLabel).toBe("META FORM LEADS");
  });

  it("Test 3 — a Reach campaign with no conversion columns at all -> REACH", () => {
    const resolution = resolveObjective({ result_type: "Reach", reach: 20000, results: 0 }, null);
    expect(resolution.resultLabel).toBe("REACH");
  });

  it("is deterministic — the same input always produces the same classification", () => {
    const signals = { result_type: "landing_page_view", website_leads: 5, results: 5 };
    const results = new Set(
      Array.from({ length: 20 }, () => resolveObjective(signals, null).resultLabel),
    );
    expect(results.size).toBe(1);
    expect(results.has("WEBSITE LEADS")).toBe(true);
  });
});

// Real-account bug report (Combined Total table's Previous Month row): a
// purchase-funnel campaign's Purchases column can carry secondary/
// incidental conversions even when the campaign's real optimization event
// is Initiate Checkout — the old unconditional `purchases > 0 -> PURCHASES`
// check never looked at Initiate Checkout at all, so a 4-IC/2-secondary-
// purchase campaign was misclassified as PURCHASES. Part 6 then fixed that
// by picking whichever of the two had the larger raw count — but Initiate
// Checkout routinely out-counts Purchases simply because a checkout has to
// start before it can complete (normal funnel drop-off), so that "larger
// wins" rule itself over-classified genuine purchase campaigns as INITIATE
// CHECKOUT. Part 7 replaces the raw-count race with a Results-column match:
// whichever of Purchases/Initiate Checkout/Add To Cart sums closest to the
// Results column (Meta's own declared primary conversion metric) wins.
describe("resolveObjective — Purchases vs Initiate Checkout: Results-column match, not raw count race (Part 7 bug fix)", () => {
  it("a higher Initiate Checkout count does NOT automatically win — Results decides", () => {
    // Results=2 matches Purchases exactly (diff 0) vs Initiate Checkout's
    // diff of 2 — Part 6's old "larger count wins" rule would have picked
    // Initiate Checkout (4 > 2) here and gotten it wrong.
    const resolution = resolveObjective({ result_type: "", purchases: 2, initiate_checkout: 4, results: 2 }, null);
    expect(resolution.resultLabel).toBe("PURCHASES");
    expect(resolution.costLabel).toBe("COST PER PURCHASE");
    expect(resolution.source).toBe("priority1");
  });

  it("Results matches Initiate Checkout more closely than Purchases -> INITIATE CHECKOUT", () => {
    const resolution = resolveObjective({ result_type: "", purchases: 2, initiate_checkout: 4, results: 4 }, null);
    expect(resolution.resultLabel).toBe("INITIATE CHECKOUT");
    expect(resolution.costLabel).toBe("COST PER CHECKOUT");
    expect(resolution.source).toBe("priority1");
  });

  it("a tie in distance-to-Results goes to Purchases (deepest funnel event)", () => {
    expect(resolveObjective({ result_type: "", purchases: 5, initiate_checkout: 5, results: 5 }, null).resultLabel).toBe(
      "PURCHASES",
    );
    expect(resolveObjective({ result_type: "", purchases: 3, initiate_checkout: 1, results: 3 }, null).resultLabel).toBe(
      "PURCHASES",
    );
  });

  it("Purchases alone (no Initiate Checkout data at all) still resolves PURCHASES — original behavior preserved", () => {
    const resolution = resolveObjective({ result_type: "", purchases: 7, results: 7 }, null);
    expect(resolution.resultLabel).toBe("PURCHASES");
  });

  it("Initiate Checkout alone (no Purchases data at all) resolves INITIATE CHECKOUT", () => {
    const resolution = resolveObjective({ result_type: "", initiate_checkout: 6, results: 6 }, null);
    expect(resolution.resultLabel).toBe("INITIATE CHECKOUT");
  });

  it("Add To Cart, with neither Purchases nor Initiate Checkout data, resolves ADD TO CART", () => {
    const resolution = resolveObjective({ result_type: "", add_to_cart: 9, results: 9 }, null);
    expect(resolution.resultLabel).toBe("ADD TO CART");
    expect(resolution.costLabel).toBe("COST PER ADD TO CART");
  });

  it("a real result_type still wins over a merely-present Purchases/IC data value — Priority 1 numeric check fires first regardless of blank/non-blank text (existing chain order, unchanged)", () => {
    // Reach text should never be overridden by an incidental purchases
    // value the same rows also happen to carry — but since Priority 1 is
    // checked unconditionally before result_type text, a genuine non-zero
    // purchases signal here legitimately wins (matches the pre-existing
    // "purchases > 0 -> PURCHASES" precedence this fix extends).
    const resolution = resolveObjective({ result_type: "Reach", purchases: 1, results: 1 }, null);
    expect(resolution.resultLabel).toBe("PURCHASES");
  });

  describe("ad_set_name fallback — last resort, only for a blank result_type with no numeric funnel-column data at all", () => {
    it("ad set name containing 'ATC' -> ADD TO CART", () => {
      const resolution = resolveObjective({ result_type: "", ad_set_name: "Retargeting - ATC Warm" }, null);
      expect(resolution.resultLabel).toBe("ADD TO CART");
      expect(resolution.source).toBe("priority4");
    });

    it("ad set name containing 'IC' or 'initiate' -> INITIATE CHECKOUT", () => {
      expect(resolveObjective({ result_type: "", ad_set_name: "Prospecting - IC" }, null).resultLabel).toBe(
        "INITIATE CHECKOUT",
      );
      expect(resolveObjective({ result_type: "", ad_set_name: "Initiate Checkout Broad" }, null).resultLabel).toBe(
        "INITIATE CHECKOUT",
      );
    });

    it("ad set name containing 'purchase' or 'conversion' -> PURCHASES", () => {
      expect(resolveObjective({ result_type: "", ad_set_name: "Purchase - Lookalike" }, null).resultLabel).toBe(
        "PURCHASES",
      );
      expect(resolveObjective({ result_type: "", ad_set_name: "Conversion Campaign Set 1" }, null).resultLabel).toBe(
        "PURCHASES",
      );
    });

    it("a real numeric signal always outranks the name hint, even a contradictory one", () => {
      const resolution = resolveObjective(
        { result_type: "", website_leads: 3, ad_set_name: "Purchase - Lookalike" },
        null,
      );
      expect(resolution.resultLabel).toBe("WEBSITE LEADS");
    });

    it("no ad_set_name, no data, blank result_type -> generic RESULTS fallback, unchanged", () => {
      const resolution = resolveObjective({ result_type: "" }, null);
      expect(resolution.resultLabel).toBe("RESULTS");
    });
  });
});

describe("getResultGroups — Priority 1 dedicated metric columns (the reported Combined Total table bug)", () => {
  it("Test 1 — website leads column (value 5) beats result_type = 'landing_page_view'", () => {
    const rows: MetricRow[] = [
      metricRow({
        _raw: { "Website leads": "5", "Result type": "landing_page_view" },
        result_type: "landing_page_view",
        website_leads: 5,
        results: 5,
        spend: 100,
      }),
    ];
    const groups = getResultGroups(rows);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("WEBSITE LEADS");
    expect(groups[0].count).toBe(5);
  });

  it("Test 2 — leads column (value 14) + result_type 'onsite_conversion.lead_grouped' -> META FORM LEADS", () => {
    const rows: MetricRow[] = [
      metricRow({
        _raw: { Leads: "14", "Result type": "onsite_conversion.lead_grouped" },
        result_type: "onsite_conversion.lead_grouped",
        leads: 14,
        results: 14,
        spend: 596,
      }),
    ];
    const groups = getResultGroups(rows);
    expect(groups[0].label).toBe("META FORM LEADS");
    expect(groups[0].count).toBe(14);
  });

  it("Test 3 — a Reach campaign with no conversion columns -> REACH", () => {
    const rows: MetricRow[] = [
      metricRow({
        _raw: { Reach: "20000", "Result type": "Reach" },
        result_type: "Reach",
        reach: 20000,
        results: 0,
        spend: 400,
      }),
    ];
    const groups = getResultGroups(rows);
    expect(groups[0].label).toBe("REACH");
  });

  // A real CSV export has the SAME header row for every campaign in the
  // file — getResultGroups (like aggregate.ts) computes columnObjective
  // once from the first row's headers, so every fixture row below carries
  // the full shared header set (with "0" for whichever columns that
  // particular campaign didn't earn), exactly as columns.ts's
  // readRowsWithAutoMap would produce.
  const mixedAccountHeaders = { Reach: "0", Leads: "0", "Website leads": "0" };

  it("Test 4 — mixed account (Reach + Meta Form Leads + Website Leads) resolves as three separate objective columns", () => {
    const rows: MetricRow[] = [
      metricRow({
        campaign_name: "Awareness",
        _raw: { ...mixedAccountHeaders, Reach: "20000" },
        // A real Reach campaign's own result_type is "Reach" — Priority 2
        // resolves it correctly before ever reaching Priority 3's
        // file-level (not per-campaign) column-presence fallback, which
        // would otherwise see this same file's "Website leads" header
        // (earned by a different campaign) and misclassify this one too.
        result_type: "Reach",
        reach: 20000,
        results: 0,
        spend: 400,
      }),
      metricRow({
        campaign_name: "Meta Leads",
        _raw: { ...mixedAccountHeaders, Leads: "14" },
        result_type: "",
        leads: 14,
        results: 14,
        spend: 596,
      }),
      metricRow({
        campaign_name: "Website Leads",
        _raw: { ...mixedAccountHeaders, "Website leads": "9" },
        result_type: "",
        website_leads: 9,
        results: 9,
        spend: 155,
      }),
    ];
    const groups = getResultGroups(rows);
    const labels = groups.map((g) => g.label).sort();
    expect(labels).toEqual(["META FORM LEADS", "REACH", "WEBSITE LEADS"]);
    expect(groups.find((g) => g.label === "WEBSITE LEADS")).toMatchObject({ count: 9, totalSpend: 155 });
    expect(groups.find((g) => g.label === "META FORM LEADS")).toMatchObject({ count: 14, totalSpend: 596 });
    expect(groups.find((g) => g.label === "REACH")).toMatchObject({ count: 0, totalSpend: 400 });
  });

  it("Test 5 — website leads at 0 shows 0/no cost, meta form leads at 14 shows its own $42.57 cost per lead", () => {
    const rows: MetricRow[] = [
      metricRow({
        campaign_name: "Meta Leads",
        _raw: { ...mixedAccountHeaders, Leads: "14" },
        result_type: "",
        leads: 14,
        results: 14,
        spend: 596,
      }),
      metricRow({
        campaign_name: "Website Leads",
        _raw: { ...mixedAccountHeaders, "Website leads": "0" },
        result_type: "",
        website_leads: 0,
        results: 0,
        spend: 155,
      }),
    ];
    const groups = getResultGroups(rows);
    const metaLeads = groups.find((g) => g.label === "META FORM LEADS");
    expect(metaLeads?.count).toBe(14);
    expect(metaLeads?.avgCpr).toBeCloseTo(42.57, 1);
    // Website leads column exists (Priority 3) but has 0 value -> its own
    // group with 0 count, no cost computable (report-data.ts renders this
    // as "N/A", not "$0.00" — see report-data.test.ts for that assertion).
    const websiteLeads = groups.find((g) => g.label === "WEBSITE LEADS");
    expect(websiteLeads?.count).toBe(0);
    expect(websiteLeads?.avgCpr).toBe(0);
    expect(websiteLeads?.totalSpend).toBe(155);
  });
});

describe("buildCampaignObjectiveMap + groupResultsByCampaignObjective — single source of truth for campaign objective detection", () => {
  // The exact reported bug: a real Website Leads campaign also has one ad
  // set whose result_type read as the intermediate "landing_page_view"
  // signal (Meta always tracks landing page views regardless of objective)
  // — Landing Page Views must never earn its own Combined Total column,
  // since no campaign was actually built around it; it's just a metric
  // inside the Website Leads campaign.
  it("required scenario — campaigns detected as [REACH, META FORM LEADS, WEBSITE LEADS] produce exactly those 3 columns, even with real Landing Page Views data inside one campaign", () => {
    const rows: MetricRow[] = [
      metricRow({
        campaign_name: "Awareness Campaign",
        _raw: {},
        result_type: "Reach",
        reach: 20000,
        results: 0,
        spend: 400,
      }),
      metricRow({
        campaign_name: "Meta Leads Campaign",
        _raw: {},
        result_type: "",
        leads: 14,
        results: 14,
        spend: 596,
      }),
      // Website Leads campaign, ad set 1: the campaign's real, dominant
      // objective — 20 website leads.
      metricRow({
        campaign_name: "Website Leads Campaign",
        _raw: {},
        result_type: "",
        website_leads: 20,
        results: 20,
        spend: 200,
      }),
      // Website Leads campaign, ad set 2: a SECONDARY signal within the
      // SAME campaign — no website_leads value on this row, just landing
      // page view data, so row-level detection alone would call this
      // "LANDING PAGE VIEWS". Small spend/count vs. the campaign's own
      // dominant ad set above.
      metricRow({
        campaign_name: "Website Leads Campaign",
        _raw: {},
        result_type: "",
        landing_page_views: 8,
        results: 0,
        spend: 10,
      }),
    ];

    const objectiveMap = buildCampaignObjectiveMap(rows);
    const groups = groupResultsByCampaignObjective(rows, objectiveMap);
    const labels = groups.map((g) => g.label).sort();
    expect(labels).toEqual(["META FORM LEADS", "REACH", "WEBSITE LEADS"]);
    // Landing Page Views never appears — no campaign was actually detected
    // as a Landing Page Views campaign, even though the raw data exists.
    expect(labels).not.toContain("LANDING PAGE VIEWS");

    // The Website Leads campaign's ENTIRE spend/results (both ad sets) roll
    // into the one WEBSITE LEADS bucket — nothing siphoned off into a
    // phantom column.
    const websiteLeads = groups.find((g) => g.label === "WEBSITE LEADS");
    expect(websiteLeads).toMatchObject({ count: 20, totalSpend: 210 });
  });

  it("row-level getResultGroups WOULD have produced a phantom 4th column for the same input — proving this is a real fix, not a no-op", () => {
    const rows: MetricRow[] = [
      metricRow({ campaign_name: "Website Leads Campaign", _raw: {}, result_type: "", website_leads: 20, results: 20, spend: 200 }),
      metricRow({ campaign_name: "Website Leads Campaign", _raw: {}, result_type: "", landing_page_views: 8, results: 0, spend: 10 }),
    ];
    const rowLevelLabels = getResultGroups(rows).map((g) => g.label).sort();
    expect(rowLevelLabels).toEqual(["LANDING PAGE VIEWS", "WEBSITE LEADS"]);

    const objectiveMap = buildCampaignObjectiveMap(rows);
    const campaignLevelLabels = groupResultsByCampaignObjective(rows, objectiveMap).map((g) => g.label);
    expect(campaignLevelLabels).toEqual(["WEBSITE LEADS"]);
  });

  it("a campaign whose OWN dominant objective genuinely is Landing Page Views still gets a real column", () => {
    const rows: MetricRow[] = [
      metricRow({ campaign_name: "LP Views Campaign", _raw: {}, result_type: "", landing_page_views: 50, results: 0, spend: 300 }),
    ];
    const objectiveMap = buildCampaignObjectiveMap(rows);
    const labels = groupResultsByCampaignObjective(rows, objectiveMap).map((g) => g.label);
    expect(labels).toEqual(["LANDING PAGE VIEWS"]);
  });

  it("a REACH-only campaign still shows as REACH (not folded into a non-existent non-Reach objective)", () => {
    const rows: MetricRow[] = [
      metricRow({ campaign_name: "Reach Only", _raw: {}, result_type: "Reach", reach: 9000, results: 0, spend: 120 }),
    ];
    const objectiveMap = buildCampaignObjectiveMap(rows);
    const labels = groupResultsByCampaignObjective(rows, objectiveMap).map((g) => g.label);
    expect(labels).toEqual(["REACH"]);
  });

  it("is deterministic — the same campaign-level input always produces the same grouping", () => {
    const rows: MetricRow[] = [
      metricRow({ campaign_name: "Website Leads Campaign", _raw: {}, result_type: "", website_leads: 20, results: 20, spend: 200 }),
      metricRow({ campaign_name: "Website Leads Campaign", _raw: {}, result_type: "", landing_page_views: 8, results: 0, spend: 10 }),
    ];
    const objectiveMap = buildCampaignObjectiveMap(rows);
    const first = groupResultsByCampaignObjective(rows, objectiveMap);
    for (let i = 0; i < 5; i++) {
      expect(groupResultsByCampaignObjective(rows, objectiveMap)).toEqual(first);
    }
  });

  // The user's exact required scenario: 5 campaigns, 4 distinct objectives
  // (2 campaigns share PURCHASES), capped at the top 3 by spend for the
  // table's own column limit (buildReportData's own responsibility, not
  // this function's — verified separately in report-data.test.ts). Here we
  // verify the map itself assigns the right objective to every campaign,
  // and that the SAME map drives both the "per-campaign display" use case
  // (campaign slides) and the "grouped totals" use case (Combined Total
  // table), guaranteeing they agree.
  it("5-campaign mixed-objective scenario — same objective map used for per-campaign display and grouped table totals", () => {
    const rows: MetricRow[] = [
      metricRow({ campaign_name: "Campaign 1", _raw: {}, result_type: "Purchase", results: 10, spend: 500 }),
      metricRow({ campaign_name: "Campaign 2", _raw: {}, result_type: "Purchase", results: 8, spend: 400 }),
      metricRow({ campaign_name: "Campaign 3", _raw: {}, result_type: "Leads (form)", results: 15, spend: 300 }),
      metricRow({ campaign_name: "Campaign 4", _raw: {}, result_type: "", website_leads: 20, results: 20, spend: 250 }),
      metricRow({ campaign_name: "Campaign 5", _raw: {}, result_type: "", landing_page_views: 40, results: 0, spend: 100 }),
    ];

    // buildCampaignObjectiveMap's keys are normalized (trimmed, lower-cased
    // — see normalizeCampaignName) — every lookup below runs the same
    // display-cased name through it, exactly as report-data.ts's own
    // campaign/ad-set slide building does.
    const objectiveMap = buildCampaignObjectiveMap(rows);
    expect(objectiveMap.get(normalizeCampaignName("Campaign 1"))).toEqual({ resultLabel: "PURCHASES", costLabel: "COST PER PURCHASE" });
    expect(objectiveMap.get(normalizeCampaignName("Campaign 2"))).toEqual({ resultLabel: "PURCHASES", costLabel: "COST PER PURCHASE" });
    expect(objectiveMap.get(normalizeCampaignName("Campaign 3"))).toEqual({ resultLabel: "META FORM LEADS", costLabel: "COST PER LEAD" });
    expect(objectiveMap.get(normalizeCampaignName("Campaign 4"))).toEqual({ resultLabel: "WEBSITE LEADS", costLabel: "COST PER WEBSITE LEAD" });
    expect(objectiveMap.get(normalizeCampaignName("Campaign 5"))).toEqual({ resultLabel: "LANDING PAGE VIEWS", costLabel: "COST PER LPV" });

    // Combined Total table's grouping: 4 distinct objective buckets, PURCHASES combining both campaigns.
    const tableGroups = groupResultsByCampaignObjective(rows, objectiveMap);
    const tableLabels = tableGroups.map((g) => g.label).sort();
    expect(tableLabels).toEqual(["LANDING PAGE VIEWS", "META FORM LEADS", "PURCHASES", "WEBSITE LEADS"]);
    const purchases = tableGroups.find((g) => g.label === "PURCHASES");
    expect(purchases).toMatchObject({ count: 18, totalSpend: 900 });

    // Campaign slides' per-campaign display, using the exact same map —
    // Campaign 1 and Campaign 2 both independently resolve to PURCHASES.
    const campaign1Rows = rows.filter((r) => r.campaign_name === "Campaign 1");
    const campaign3Rows = rows.filter((r) => r.campaign_name === "Campaign 3");
    const display1 = getGroupedResultDisplayForObjective(campaign1Rows, objectiveMap.get(normalizeCampaignName("Campaign 1"))!, "$");
    const display3 = getGroupedResultDisplayForObjective(campaign3Rows, objectiveMap.get(normalizeCampaignName("Campaign 3"))!, "$");
    expect(display1.resultLabel).toBe("PURCHASES");
    expect(display1.costLabel).toBe("COST PER PURCHASE");
    expect(display3.resultLabel).toBe("META FORM LEADS");
    expect(display3.costLabel).toBe("COST PER LEAD");
  });

  it("no phantom objectives from secondary metrics — a campaign's minority in-campaign signal never earns its own map entry or table column", () => {
    const rows: MetricRow[] = [
      // Dominant signal: 30 website leads.
      metricRow({ campaign_name: "Mixed Campaign", _raw: {}, result_type: "", website_leads: 30, results: 30, spend: 600 }),
      // Minority in-campaign signal: some landing page view activity, no
      // website_leads value on this particular row.
      metricRow({ campaign_name: "Mixed Campaign", _raw: {}, result_type: "", landing_page_views: 12, results: 0, spend: 20 }),
      // Another minority signal: a stray reach-only row.
      metricRow({ campaign_name: "Mixed Campaign", _raw: {}, result_type: "Reach", reach: 5000, results: 0, spend: 5 }),
    ];
    const objectiveMap = buildCampaignObjectiveMap(rows);
    expect(objectiveMap.size).toBe(1);
    expect(objectiveMap.get(normalizeCampaignName("Mixed Campaign"))).toEqual({ resultLabel: "WEBSITE LEADS", costLabel: "COST PER WEBSITE LEAD" });

    const tableGroups = groupResultsByCampaignObjective(rows, objectiveMap);
    expect(tableGroups.map((g) => g.label)).toEqual(["WEBSITE LEADS"]);
    expect(tableGroups.find((g) => g.label === "LANDING PAGE VIEWS")).toBeUndefined();
    expect(tableGroups.find((g) => g.label === "REACH")).toBeUndefined();
  });

  it("case-insensitivity fix — differently-cased occurrences of the same campaign name are treated as ONE campaign, not two", () => {
    const rows: MetricRow[] = [
      metricRow({ campaign_name: "Website Leads Campaign", _raw: {}, result_type: "", website_leads: 20, results: 20, spend: 200 }),
      // Same campaign, differently cased (e.g. a re-export, or a different
      // ad set's row that happened to carry different capitalization) —
      // must still fold into the SAME map entry and the SAME table bucket,
      // not spawn a second "website leads campaign" column.
      metricRow({ campaign_name: "website leads campaign", _raw: {}, result_type: "", website_leads: 5, results: 5, spend: 50 }),
      metricRow({ campaign_name: "WEBSITE LEADS CAMPAIGN", _raw: {}, result_type: "", website_leads: 3, results: 3, spend: 30 }),
    ];

    const objectiveMap = buildCampaignObjectiveMap(rows);
    // One map entry, not three.
    expect(objectiveMap.size).toBe(1);
    expect(objectiveMap.get(normalizeCampaignName("Website Leads Campaign"))).toEqual({
      resultLabel: "WEBSITE LEADS",
      costLabel: "COST PER WEBSITE LEAD",
    });
    // Every differently-cased spelling normalizes to the same key and hits the same entry.
    expect(objectiveMap.get("website leads campaign")).toEqual(objectiveMap.get(normalizeCampaignName("WEBSITE LEADS CAMPAIGN")));

    // The table rolls all three rows' totals into ONE bucket, not three
    // separate (accidentally-duplicated) WEBSITE LEADS columns.
    const tableGroups = groupResultsByCampaignObjective(rows, objectiveMap);
    expect(tableGroups).toHaveLength(1);
    expect(tableGroups[0]).toMatchObject({ label: "WEBSITE LEADS", count: 28, totalSpend: 280 });
  });

  // Real-account bug report (MTD row showing 15 purchases when the CSV only
  // has 3): a campaign with TWO ad-set-level rows — one whose OWN
  // resolveObjective classification is INITIATE CHECKOUT (its own blank
  // result_type, IC column = 12), one whose own classification is PURCHASES
  // (explicit "Website purchases" result_type, 3 real purchases) — gets
  // assigned ONE campaign-wide objective (PURCHASES, since explicit purchase
  // text wins per Part 7's own Step 0). Before this fix, groupResultsByCampaignObjective
  // summed BOTH rows' `results` blindly into the PURCHASES bucket (12 + 3 =
  // 15) even though the IC row's `results` measures Initiate Checkouts, not
  // purchases. Now only the row that actually agrees with the campaign's
  // assigned objective contributes its `results`; the mismatched IC row
  // contributes its own (zero) purchases count instead.
  it("MTD-row bug fix — a campaign's mismatched ad-set row (own objective differs from the campaign's assigned objective) never has its `results` summed into the wrong bucket", () => {
    const rows: MetricRow[] = [
      metricRow({
        campaign_name: "Purchase Campaign",
        ad_set_name: "Prospecting - IC",
        _raw: { "Initiate checkout": "12" },
        result_type: "",
        purchases: 0,
        results: 12,
        spend: 120,
      }),
      metricRow({
        campaign_name: "Purchase Campaign",
        ad_set_name: "Retargeting - Purchases",
        _raw: {},
        result_type: "Website purchases",
        purchases: 3,
        results: 3,
        spend: 60,
      }),
    ];

    const objectiveMap = buildCampaignObjectiveMap(rows);
    expect(objectiveMap.get("purchase campaign")).toEqual({ resultLabel: "PURCHASES", costLabel: "COST PER PURCHASE" });

    const tableGroups = groupResultsByCampaignObjective(rows, objectiveMap);
    expect(tableGroups).toHaveLength(1);
    // NOT 15 (12 + 3) — the exact reported bug.
    expect(tableGroups[0]).toMatchObject({ label: "PURCHASES", count: 3 });
  });

  it("MTD-row bug fix — the reverse case: a campaign assigned INITIATE CHECKOUT correctly excludes a mismatched Purchases-classified row's own results", () => {
    const rows: MetricRow[] = [
      metricRow({
        campaign_name: "IC Campaign",
        ad_set_name: "Set 1",
        _raw: { "Initiate checkout": "20" },
        result_type: "initiate_checkout",
        purchases: 0,
        results: 20,
        spend: 100,
      }),
      // A secondary ad set with a blank result_type but real purchases data —
      // individually (via the Step 3/4 Results-column-match fallback) it
      // resolves to PURCHASES, even though the campaign overall was assigned
      // INITIATE CHECKOUT (Set 1's explicit result_type text). Its `results`
      // (5, its own purchase count) must not be counted as Initiate Checkouts.
      metricRow({
        campaign_name: "IC Campaign",
        ad_set_name: "Set 2",
        _raw: {},
        result_type: "",
        purchases: 5,
        results: 5,
        spend: 50,
      }),
    ];

    const objectiveMap = buildCampaignObjectiveMap(rows);
    expect(objectiveMap.get("ic campaign")).toEqual({ resultLabel: "INITIATE CHECKOUT", costLabel: "COST PER CHECKOUT" });

    const tableGroups = groupResultsByCampaignObjective(rows, objectiveMap);
    expect(tableGroups).toHaveLength(1);
    // NOT 25 (20 + 5) — Set 2's 5 purchases are not Initiate Checkouts.
    expect(tableGroups[0]).toMatchObject({ label: "INITIATE CHECKOUT", count: 20 });
  });

  it("groupResultsByCampaignObjective's debugLabel parameter prints per-campaign diagnostics without changing the returned result", () => {
    const rows: MetricRow[] = [
      metricRow({ campaign_name: "Debug Campaign", _raw: {}, result_type: "Purchase", purchases: 4, results: 4, spend: 40 }),
    ];
    const objectiveMap = buildCampaignObjectiveMap(rows);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const withDebug = groupResultsByCampaignObjective(rows, objectiveMap, "TEST");
    const withoutDebug = groupResultsByCampaignObjective(rows, objectiveMap);
    expect(withDebug).toEqual(withoutDebug);
    expect(logSpy).toHaveBeenCalled();
    expect(logSpy.mock.calls.some((call) => String(call[0]).includes("[TEST]"))).toBe(true);
    logSpy.mockRestore();
  });
});

// Objective Confirmation — the permanent objective-detection fix (Part 8's
// numbered test list). resolveCampaignObjective is the new per-campaign
// resolver buildCampaignObjectiveMap now uses: exact result_type ground
// truth (result-type-map.ts) first, the existing dedicated-column/fuzzy-
// catalog/data-value priority chain as fallback for anything it doesn't
// recognize.
describe("resolveCampaignObjective — Objective Confirmation permanent fix (Part 8)", () => {
  it("Test 1 — result_type 'initiate_checkout' -> INITIATE CHECKOUT, even with real purchases column data present", () => {
    const rows: MetricRow[] = [
      metricRow({ _raw: {}, result_type: "initiate_checkout", purchases: 50, results: 40, spend: 300 }),
      metricRow({ _raw: {}, result_type: "initiate_checkout", purchases: 30, results: 35, spend: 280 }),
    ];
    const resolution = resolveCampaignObjective(rows);
    expect(resolution.resultLabel).toBe("INITIATE CHECKOUT");
    expect(resolution.resultLabel).not.toBe("PURCHASES");
    expect(resolution.costLabel).toBe("COST PER CHECKOUT");
  });

  it("Test 2 — result_type 'purchase' -> PURCHASES", () => {
    const rows: MetricRow[] = [
      metricRow({ _raw: {}, result_type: "purchase", purchases: 20, results: 20, spend: 500 }),
      metricRow({ _raw: {}, result_type: "purchase", purchases: 15, results: 15, spend: 400 }),
    ];
    const resolution = resolveCampaignObjective(rows);
    expect(resolution.resultLabel).toBe("PURCHASES");
    expect(resolution.costLabel).toBe("COST PER PURCHASE");
  });

  it("Test 4 — result_type 'onsite_conversion.lead_grouped' -> META FORM LEADS", () => {
    const rows: MetricRow[] = [
      metricRow({ _raw: {}, result_type: "onsite_conversion.lead_grouped", results: 12, spend: 150 }),
      metricRow({ _raw: {}, result_type: "onsite_conversion.lead_grouped", results: 9, spend: 120 }),
    ];
    const resolution = resolveCampaignObjective(rows);
    expect(resolution.resultLabel).toBe("META FORM LEADS");
    expect(resolution.costLabel).toBe("COST PER LEAD");
  });

  it("Test 5 — result_type missing but website_leads column has value -> WEBSITE LEADS (falls through to the existing dedicated-column priority)", () => {
    const rows: MetricRow[] = [
      metricRow({ _raw: {}, result_type: "", website_leads: 18, results: 18, spend: 220 }),
      metricRow({ _raw: {}, result_type: "", website_leads: 7, results: 7, spend: 90 }),
    ];
    const resolution = resolveCampaignObjective(rows);
    expect(resolution.resultLabel).toBe("WEBSITE LEADS");
    expect(resolution.costLabel).toBe("COST PER WEBSITE LEAD");
  });

  describe("Test 9 — the landing_page_view special case", () => {
    it("result_type 'landing_page_view' + real website_leads column data -> WEBSITE LEADS (a lead campaign using LPV as a mid-funnel signal)", () => {
      const rows: MetricRow[] = [
        metricRow({ _raw: {}, result_type: "landing_page_view", website_leads: 22, landing_page_views: 340, results: 22, spend: 260 }),
        metricRow({ _raw: {}, result_type: "landing_page_view", website_leads: 14, landing_page_views: 210, results: 14, spend: 190 }),
      ];
      const resolution = resolveCampaignObjective(rows);
      expect(resolution.resultLabel).toBe("WEBSITE LEADS");
      expect(resolution.resultLabel).not.toBe("LANDING PAGE VIEWS");
    });

    it("result_type 'landing_page_view' + genuinely zero leads anywhere -> LANDING PAGE VIEWS (a real traffic/LPV campaign)", () => {
      const rows: MetricRow[] = [
        metricRow({ _raw: {}, result_type: "landing_page_view", landing_page_views: 500, results: 500, spend: 300 }),
        metricRow({ _raw: {}, result_type: "landing_page_view", landing_page_views: 420, results: 420, spend: 260 }),
      ];
      const resolution = resolveCampaignObjective(rows);
      expect(resolution.resultLabel).toBe("LANDING PAGE VIEWS");
      expect(resolution.costLabel).toBe("COST PER LPV");
    });
  });

  it("Test 6 setup — buildCampaignObjectiveMap's engine detection can be overridden by a caller-supplied map entry (report-data.ts's own override layer is tested at the buildReportData level)", () => {
    // resolveCampaignObjective itself has no override concept — the
    // override happens one layer up, in report-data.ts's buildReportData
    // (see report-data.test.ts's own Objective Confirmation coverage) —
    // this just confirms the engine's own detection is what gets
    // overridden, i.e. it's deterministic and doesn't itself special-case
    // any campaign name.
    const rows: MetricRow[] = [metricRow({ _raw: {}, result_type: "initiate_checkout", results: 10, spend: 100 })];
    expect(resolveCampaignObjective(rows).resultLabel).toBe("INITIATE CHECKOUT");
  });

  it("outnumbering the blank bucket still requires a real majority — a single stray non-blank result_type among mostly-blank rows never overrides the blank majority's own dedicated-column detection", () => {
    const rows: MetricRow[] = [
      metricRow({ _raw: {}, result_type: "", website_leads: 15, results: 15, spend: 200 }),
      metricRow({ _raw: {}, result_type: "", website_leads: 10, results: 10, spend: 150 }),
      metricRow({ _raw: {}, result_type: "reach", reach: 5000, results: 0, spend: 5 }),
    ];
    const resolution = resolveCampaignObjective(rows);
    expect(resolution.resultLabel).toBe("WEBSITE LEADS");
  });
});

// Real-account bug report (follow-up to Part 6/7's own bug report): a
// purchase campaign whose result_type is blank on most days still shows the
// explicit "Website purchases" text on the handful of days a purchase
// actually landed. Part 6's per-row purchases-vs-IC logic, and even Part 7's
// row-level "closest to Results" replacement, could still get outvoted by
// the many blank-result_type days if their own Initiate Checkout column
// happened to sum higher than the one explicit-text day's Purchases count —
// because neither of those fixes ever looks across the WHOLE campaign's rows
// for explicit result_type evidence sitting on some OTHER row. This is the
// CAMPAIGN-level fix: resolveCampaignObjective now treats a single explicit
// purchase/Initiate-Checkout result_type occurrence, anywhere in the
// campaign's rows, as definitive — full stop, ahead of every raw column
// count anywhere else in that same campaign.
describe("resolveCampaignObjective — explicit result_type text beats raw column counts campaign-wide (Part 7 bug fix)", () => {
  it("result_type = 'Website purchases' on 1 of many days, Initiate Checkout column has values on every other (blank-result_type) day -> PURCHASES, not INITIATE CHECKOUT", () => {
    const blankIcHeavyDays: MetricRow[] = Array.from({ length: 20 }, () =>
      metricRow({ _raw: { "Initiate checkout": "1" }, result_type: "", purchases: 0, results: 1, spend: 10 }),
    );
    const rows: MetricRow[] = [
      metricRow({ _raw: {}, result_type: "Website purchases", purchases: 1, results: 1, spend: 20 }),
      ...blankIcHeavyDays,
    ];
    const resolution = resolveCampaignObjective(rows);
    expect(resolution.resultLabel).toBe("PURCHASES");
    expect(resolution.costLabel).toBe("COST PER PURCHASE");
  });

  it("result_type = 'initiate_checkout' on 5 days, purchases column has values on 2 (blank-result_type) days -> INITIATE CHECKOUT", () => {
    const icDays: MetricRow[] = Array.from({ length: 5 }, () =>
      metricRow({ _raw: {}, result_type: "initiate_checkout", purchases: 0, results: 1, spend: 10 }),
    );
    const blankPurchaseDays: MetricRow[] = Array.from({ length: 2 }, () =>
      metricRow({ _raw: {}, result_type: "", purchases: 1, results: 1, spend: 8 }),
    );
    const rows: MetricRow[] = [...icDays, ...blankPurchaseDays];
    const resolution = resolveCampaignObjective(rows);
    expect(resolution.resultLabel).toBe("INITIATE CHECKOUT");
    expect(resolution.costLabel).toBe("COST PER CHECKOUT");
  });

  it("result_type completely blank for every row, Purchases column totals 3, Initiate Checkout column totals 8 -> Results column total disambiguates (matches Purchases here) instead of the raw IC/Purchases count race", () => {
    const rows: MetricRow[] = [
      metricRow({ _raw: {}, result_type: "", purchases: 3, results: 3, spend: 90 }),
      metricRow({ _raw: { "Initiate checkout": "8" }, result_type: "", purchases: 0, results: 0, spend: 40 }),
    ];
    const resolution = resolveCampaignObjective(rows);
    expect(resolution.resultLabel).toBe("PURCHASES");
    expect(resolution.costLabel).toBe("COST PER PURCHASE");
  });

  it("result_type completely blank for every row, Results total matches Initiate Checkout more closely than Purchases -> INITIATE CHECKOUT", () => {
    const rows: MetricRow[] = [
      metricRow({ _raw: {}, result_type: "", purchases: 3, results: 8, spend: 90 }),
      metricRow({ _raw: { "Initiate checkout": "8" }, result_type: "", purchases: 0, results: 0, spend: 40 }),
    ];
    const resolution = resolveCampaignObjective(rows);
    expect(resolution.resultLabel).toBe("INITIATE CHECKOUT");
    expect(resolution.costLabel).toBe("COST PER CHECKOUT");
  });
});

// Objective Confirmation memory cache — resolveCampaignObjectiveWithConfidence
// is resolveCampaignObjective's display-only counterpart: same detection,
// plus a "high"/"low" confidence tag the /metrics route (and the wizard's
// Objective Confirmation step) uses to show a blue "Detected from result
// type" vs. grey "Please verify" badge. Never affects which objective is
// actually returned — only ever consulted for the badge.
describe("resolveCampaignObjectiveWithConfidence — confidence tiers for the Objective Confirmation memory cache badge", () => {
  it("Step 0's explicit purchase/Initiate-Checkout result_type match -> high confidence", () => {
    const rows: MetricRow[] = [metricRow({ _raw: {}, result_type: "Website purchases", purchases: 1, results: 1, spend: 20 })];
    expect(resolveCampaignObjectiveWithConfidence(rows).confidence).toBe("high");
  });

  it("Priority 1's dominant result_type -> RESULT_TYPE_MAP exact match -> high confidence", () => {
    const rows: MetricRow[] = [
      metricRow({ _raw: {}, result_type: "onsite_conversion.lead_grouped", results: 12, spend: 150 }),
      metricRow({ _raw: {}, result_type: "onsite_conversion.lead_grouped", results: 9, spend: 120 }),
    ];
    const resolution = resolveCampaignObjectiveWithConfidence(rows);
    expect(resolution.resultLabel).toBe("META FORM LEADS");
    expect(resolution.confidence).toBe("high");
  });

  it("the all-blank Results-column-match fallback -> low confidence (column data, not real result_type text)", () => {
    const rows: MetricRow[] = [
      metricRow({ _raw: {}, result_type: "", purchases: 3, results: 3, spend: 90 }),
      metricRow({ _raw: { "Initiate checkout": "8" }, result_type: "", purchases: 0, results: 0, spend: 40 }),
    ];
    const resolution = resolveCampaignObjectiveWithConfidence(rows);
    expect(resolution.resultLabel).toBe("PURCHASES");
    expect(resolution.confidence).toBe("low");
  });

  it("the final getResultGroups/resolveObjective fallback (column presence/data value/ad-set name) -> low confidence", () => {
    const rows: MetricRow[] = [
      metricRow({ _raw: {}, result_type: "", website_leads: 18, results: 18, spend: 220 }),
      metricRow({ _raw: {}, result_type: "", website_leads: 7, results: 7, spend: 90 }),
    ];
    const resolution = resolveCampaignObjectiveWithConfidence(rows);
    expect(resolution.resultLabel).toBe("WEBSITE LEADS");
    expect(resolution.confidence).toBe("low");
  });

  it("resolveCampaignObjective (the plain, unconfident version used everywhere else) is completely unaffected — same resultLabel/costLabel, no confidence field", () => {
    const rows: MetricRow[] = [metricRow({ _raw: {}, result_type: "Website purchases", purchases: 1, results: 1, spend: 20 })];
    expect(resolveCampaignObjective(rows)).toEqual({ resultLabel: "PURCHASES", costLabel: "COST PER PURCHASE" });
  });

  // Thing 2 (three-layer objective architecture rebuild) — the finer-grained
  // medium/low/verify split within what used to be one flat "low" bucket.
  it("a single non-leads dedicated column (reach) with no result_type -> medium confidence, no confirmation required", () => {
    const rows: MetricRow[] = [metricRow({ _raw: {}, result_type: "", reach: 5000, results: 5000, spend: 60 })];
    const resolution = resolveCampaignObjectiveWithConfidence(rows);
    expect(resolution.confidence).toBe("medium");
    expect(resolution.requiresConfirmation).toBe(false);
  });

  it("a single dedicated funnel column (purchases alone) with no result_type -> medium confidence", () => {
    const rows: MetricRow[] = [metricRow({ _raw: {}, result_type: "", purchases: 4, results: 4, spend: 80 })];
    const resolution = resolveCampaignObjectiveWithConfidence(rows);
    expect(resolution.resultLabel).toBe("PURCHASES");
    expect(resolution.confidence).toBe("medium");
    expect(resolution.requiresConfirmation).toBe(false);
  });

  it("BOTH lead columns present with no result_type -> verify confidence, requires confirmation", () => {
    const rows: MetricRow[] = [
      metricRow({ _raw: {}, result_type: "", website_leads: 5, leads: 3, results: 8, spend: 100 }),
    ];
    const resolution = resolveCampaignObjectiveWithConfidence(rows);
    expect(resolution.confidence).toBe("verify");
    expect(resolution.requiresConfirmation).toBe(true);
  });

  it("no result_type and no dedicated-column data at all (generic RESULTS fallback) -> verify confidence, requires confirmation", () => {
    const rows: MetricRow[] = [metricRow({ _raw: {}, result_type: "", results: 0, spend: 10 })];
    const resolution = resolveCampaignObjectiveWithConfidence(rows);
    expect(resolution.resultLabel).toBe("RESULTS");
    expect(resolution.confidence).toBe("verify");
    expect(resolution.requiresConfirmation).toBe(true);
  });

  it("requiresConfirmation is false for every high/medium/low tier, matching each tier's own test above", () => {
    const highRows: MetricRow[] = [metricRow({ _raw: {}, result_type: "Website purchases", purchases: 1, results: 1, spend: 20 })];
    expect(resolveCampaignObjectiveWithConfidence(highRows).requiresConfirmation).toBe(false);
    const lowRows: MetricRow[] = [metricRow({ _raw: {}, result_type: "", website_leads: 18, results: 18, spend: 220 })];
    expect(resolveCampaignObjectiveWithConfidence(lowRows).requiresConfirmation).toBe(false);
  });
});

describe("buildCampaignObjectiveMapWithConfidence", () => {
  it("returns one confidence-tagged entry per normalized campaign name, matching buildCampaignObjectiveMap's own grouping", () => {
    const rows: MetricRow[] = [
      metricRow({ campaign_name: "Purchase Campaign", _raw: {}, result_type: "Website purchases", purchases: 1, results: 1, spend: 20 }),
      metricRow({ campaign_name: "Leads Campaign", _raw: {}, result_type: "", website_leads: 18, results: 18, spend: 220 }),
    ];
    const map = buildCampaignObjectiveMapWithConfidence(rows);
    expect(map.get("purchase campaign")).toEqual({
      resultLabel: "PURCHASES",
      costLabel: "COST PER PURCHASE",
      confidence: "high",
      requiresConfirmation: false,
    });
    expect(map.get("leads campaign")).toEqual({
      resultLabel: "WEBSITE LEADS",
      costLabel: "COST PER WEBSITE LEAD",
      confidence: "low",
      requiresConfirmation: false,
    });
  });
});

// MTD-row bug fix, extended to ad-set slides (per-row objective correction —
// see resultValueForObjective/getGroupedResultDisplayForObjective) — an
// ad-set slide always shows the PARENT campaign's forced objective label,
// but its `results`/`cpr` numbers are no longer trusted as-is when this
// specific ad set's own resolved objective genuinely differs from what's
// being forced: `results` measures a different metric entirely in that
// case, so the raw number is never reused, matching the exact correction
// the Combined Total table already applies.
describe("getSingleRowResultDisplayForObjective — ad-set slides read the parent campaign's objective, not their own row-level result_type", () => {
  it("forces the given objective's label even when the row's own result_type disagrees, AND corrects the numbers when the row's own objective doesn't track that metric at all", () => {
    const r = row({ result_type: "Landing page view", results: 12, cpr: 8 });
    const display = getSingleRowResultDisplayForObjective(r, { resultLabel: "WEBSITE LEADS", costLabel: "COST PER WEBSITE LEAD" }, "$");
    expect(display.resultLabel).toBe("WEBSITE LEADS");
    expect(display.costLabel).toBe("COST PER WEBSITE LEAD");
    // NOT 12 — this ad set's own resolved objective is LANDING PAGE VIEWS,
    // which has no dedicated Website Leads count to fall back to, so a
    // mismatched row contributes 0 rather than reusing its LPV count. Since
    // the row still has spend > 0, cpr reads as "N/A" (spend with no
    // matching results), not "—" (which is reserved for zero spend).
    expect(display.resultValue).toBe("0");
    expect(display.cprValue).toBe("N/A");
  });

  it("the row's own numbers pass through unchanged when this ad set's own resolved objective already matches the forced one (the common, non-mismatched case)", () => {
    const r = row({ result_type: "Website lead", results: 12, spend: 96, cpr: 999 /* deliberately wrong — must never be read directly */ });
    const display = getSingleRowResultDisplayForObjective(r, { resultLabel: "WEBSITE LEADS", costLabel: "COST PER WEBSITE LEAD" }, "$");
    expect(display.resultValue).toBe("12");
    // Recomputed from spend/results (96/12 = 8), not the stale row.cpr (999).
    expect(display.cprValue).toBe("$8.00");
  });

  it("MTD-row bug fix scenario, single ad set — an Initiate-Checkout-leaning ad set forced to PURCHASES contributes 0, not its own IC count", () => {
    const r = row({ result_type: "", results: 12, purchases: undefined, spend: 40 });
    const display = getSingleRowResultDisplayForObjective(r, { resultLabel: "PURCHASES", costLabel: "COST PER PURCHASE" }, "$");
    // This ad set has no explicit result_type and its own `results` (12)
    // isn't backed by any Purchases-specific data — resultValueForObjective
    // falls back to row.purchases (undefined -> 0), not the mismatched 12.
    expect(display.resultValue).toBe("0");
    expect(display.cprValue).toBe("N/A"); // real spend, zero results.
  });
});

describe("getGroupedResultDisplay", () => {
  it("prefers the top non-REACH group over a REACH group", () => {
    const rows: AggRow[] = [
      row({ result_type: "Reach", results: 50000, spend: 1000 }),
      row({ result_type: "Lead", results: 10, spend: 500 }),
    ];
    const display = getGroupedResultDisplay(rows, "$");
    expect(display.resultLabel).toBe("LEADS");
    expect(display.resultValue).toBe("10");
    expect(display.cprValue).toBe("$50.00");
  });

  it("falls back to a REACH group if that's all there is", () => {
    const rows: AggRow[] = [row({ result_type: "Reach", results: 5000, spend: 100 })];
    const display = getGroupedResultDisplay(rows, "$");
    expect(display.resultLabel).toBe("REACH");
  });

  it("always shows the result count even when 0, and a dash for CPR only when results = 0", () => {
    const rows: AggRow[] = [row({ result_type: "Website lead", results: 0, spend: 0 })];
    const display = getGroupedResultDisplay(rows, "$");
    expect(display.resultLabel).toBe("WEBSITE LEADS");
    expect(display.cprValue).toBe("—");
    expect(display.resultValue).toBe("0");
  });
});

describe("getSingleRowResultDisplay", () => {
  it("reads resultLabel from result_type and values straight off the row", () => {
    const r = row({ result_type: "Purchase", results: 3, cpr: 250 });
    const display = getSingleRowResultDisplay(r, "$");
    expect(display).toEqual({
      resultLabel: "PURCHASES",
      costLabel: "COST PER PURCHASE",
      resultValue: "3",
      cprValue: "$250.00",
    });
  });
});
