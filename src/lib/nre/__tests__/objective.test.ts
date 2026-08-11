import { describe, expect, it } from "vitest";
import {
  detectObjectiveFromColumns,
  getGroupedResultDisplay,
  getResultGroups,
  getResultLabels,
  getSingleRowResultDisplay,
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
