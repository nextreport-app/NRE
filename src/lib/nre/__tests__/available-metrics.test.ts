import { describe, it, expect } from "vitest";
import {
  defaultGoogleSelection,
  defaultMetaSelection,
  listAvailableMetrics,
  listSelectableMetrics,
  MAX_TOTAL_METRICS,
  MIN_SECOND_SLIDE_METRICS,
  splitMetricsForSlides,
  type AvailableMetric,
  type SelectedMetric,
} from "../available-metrics";
import { buildGoogleSlots, buildMetaSlots } from "../slot-assignment";
import type { RawMetricRow } from "../dynamic-metrics";

/**
 * defaultMetaSelection is a pre-aggregation, header-presence-only preview
 * (no real CSV rows exist yet at that point in the wizard — see this
 * module's file header) while buildMetaSlots is the real, value-checked
 * automatic assignment (Round I: a slot only gets a key when the CSV
 * actually has real, non-zero data for it). To compare the two functions'
 * KEY CHOICE logic apples-to-apples (independent of that value-availability
 * difference), buildMetaSlots is fed a CSV with real data for every column
 * either function could ever pick.
 */
function fullMetaRows(): RawMetricRow[] {
  return [
    {
      _raw: {
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
        "Results ROAS": "4.5",
      },
    },
  ];
}

const META_HEADERS = [
  "Campaign name",
  "Amount spent",
  "Reach",
  "Impressions",
  "Results",
  "Cost per result",
  "CTR (All)",
  "Link clicks",
  "Landing page views",
  "A Totally Unknown Column",
];

describe("listAvailableMetrics — Part 2/3a", () => {
  it("includes every classifiable primary/secondary column, sorted by priority descending", () => {
    const metrics = listAvailableMetrics(META_HEADERS, "META");
    const keys = metrics.map((m) => m.key);
    expect(keys).toContain("spend");
    expect(keys).toContain("link_clicks");
    for (let i = 1; i < metrics.length; i++) {
      expect(metrics[i - 1].priority).toBeGreaterThanOrEqual(metrics[i].priority);
    }
  });

  it("never drops an unrecognized column — falls through to autoClassifyUnknownColumn (Part 2)", () => {
    const metrics = listAvailableMetrics(META_HEADERS, "META");
    const unknown = metrics.find((m) => m.key === "a_totally_unknown_column");
    expect(unknown).toBeDefined();
    expect(unknown?.isAutoCatch).toBe(true);
    expect(unknown?.priority).toBe(30);
  });

  it("excludes dimension/metadata columns (e.g. campaign name)", () => {
    const metrics = listAvailableMetrics(META_HEADERS, "META");
    expect(metrics.some((m) => m.key === "campaign_name")).toBe(false);
  });

  it("deduplicates by key — first-seen wins", () => {
    const metrics = listAvailableMetrics(["Amount spent", "Amount spent (USD)"], "META");
    expect(metrics.filter((m) => m.key === "spend")).toHaveLength(1);
  });
});

describe("listSelectableMetrics — the wizard's own dropdown pool", () => {
  it("excludes every auto-caught column (always priority 30, below the 50 cutoff)", () => {
    const metrics = listSelectableMetrics(META_HEADERS, "META");
    expect(metrics.every((m) => !m.isAutoCatch)).toBe(true);
    expect(metrics.every((m) => m.priority >= 50)).toBe(true);
    expect(metrics.some((m) => m.key === "a_totally_unknown_column")).toBe(false);
  });

  // Fix 1 — RESULTS/COST PER RESULT are the dictionary's own generic
  // fallback labels; defaultMetaSelection already substitutes the
  // campaign's real objective label (WEBSITE LEADS, PURCHASES, etc.) for
  // these same CSV columns, so offering the raw generic label as a
  // separate, addable "Add a metric" option is always redundant.
  it("permanently excludes results/cost_per_result from the addable pool, even though they're real high-priority primary dictionary entries", () => {
    // Confirm they'd otherwise qualify (real primary entries, priority
    // well above the 50 cutoff, present in this CSV) — proving the
    // exclusion is a deliberate override, not an accident of priority.
    const fullPool = listAvailableMetrics(META_HEADERS, "META");
    const results = fullPool.find((m) => m.key === "results");
    const costPerResult = fullPool.find((m) => m.key === "cost_per_result");
    expect(results?.priority).toBeGreaterThanOrEqual(50);
    expect(costPerResult?.priority).toBeGreaterThanOrEqual(50);

    const selectable = listSelectableMetrics(META_HEADERS, "META");
    const keys = selectable.map((m) => m.key);
    expect(keys).not.toContain("results");
    expect(keys).not.toContain("cost_per_result");
  });
});

describe("defaultMetaSelection — matches slot-assignment.ts's own automatic picks", () => {
  it.each(["WEBSITE LEADS", "META FORM LEADS", "LINK CLICKS", "REACH", "VIDEO VIEWS", "MESSAGING LEADS", "PURCHASES", "APP INSTALLS", "PAGE LIKES"])(
    "produces the same 8 keys, in the same order, as buildMetaSlots for %s (no ADD TO CART column present), when the CSV backs every candidate with real data",
    (resultLabel) => {
      const preview = defaultMetaSelection(resultLabel, "COST PER RESULT", META_HEADERS);
      const real = buildMetaSlots(
        { resultLabel, costLabel: "COST PER RESULT", spend: "$1", reach: "1", impressions: "1", ctr: "1%", resultValue: "1", cprValue: "$1" },
        fullMetaRows(),
        "$",
      );
      expect(preview.map((m) => m.key)).toEqual(real.map((m) => m?.key));
    },
  );

  // "UNKNOWN" (the default/fallback case) is a known, pre-existing gap
  // between these two functions, unrelated to Round I: defaultMetaSelection
  // always makes a single, unconditional slot 8 guess (COST PER LINK
  // CLICK), while buildMetaSlots' pickSlot tries its default case's own
  // candidate list [LANDING PAGE VIEWS, COST PER LINK CLICK] in priority
  // order and takes whichever has real data first. When a CSV genuinely has
  // real data for BOTH (as this comprehensive fixture does), the two can
  // legitimately disagree on slot 8 specifically — the wizard preview is a
  // simplified, values-free guess by design (see this module's own file
  // header), not a promise of exact parity in every ambiguous case.
  it("UNKNOWN: slots 1-7 still match buildMetaSlots exactly; slot 8 may legitimately differ (defaultMetaSelection doesn't try multiple candidates in priority order)", () => {
    const preview = defaultMetaSelection("UNKNOWN", "COST PER RESULT", META_HEADERS);
    const real = buildMetaSlots(
      { resultLabel: "UNKNOWN", costLabel: "COST PER RESULT", spend: "$1", reach: "1", impressions: "1", ctr: "1%", resultValue: "1", cprValue: "$1" },
      fullMetaRows(),
      "$",
    );
    expect(preview.slice(0, 7).map((m) => m.key)).toEqual(real.slice(0, 7).map((m) => m?.key));
    expect(preview[7].key).toBe("cpc_link_click");
    expect(real[7]?.key).toBe("landing_page_views");
  });

  // Objective Confirmation (Part 6) — ADD TO CART is now slot 7 (index 6),
  // not slot 8, matching buildMetaSlots' own updated priority.
  it("PURCHASES: picks ADD TO CART for slot 7 when the header is present, matching buildMetaSlots' own header-presence check", () => {
    const headersWithCart = [...META_HEADERS, "Adds to cart"];
    const preview = defaultMetaSelection("PURCHASES", "COST PER PURCHASE", headersWithCart);
    expect(preview[6].key).toBe("add_to_cart");
  });

  it("always returns exactly 8 metrics", () => {
    expect(defaultMetaSelection("RESULTS", "COST PER RESULT", META_HEADERS)).toHaveLength(8);
  });

  // Regression for the Metric Review step's "Website Leads shows as both a
  // card and an Add-another-metric option" bug: the generic "Results"
  // column (key "results") gets relabeled "WEBSITE LEADS" for this
  // objective, while the CSV's own separate "Website Leads" column maps to
  // a *different* dictionary key ("website_leads") with that same label —
  // a key-only duplicate check misses this. The wizard's own filter
  // (report-upload-wizard.tsx's unselectedAvailableMetrics) was fixed to
  // also check label; this test pins the underlying data collision that
  // made that necessary, using headers that include both columns.
  it("produces a label collision with listSelectableMetrics for a CSV that has its own separate Website Leads column", () => {
    const headersWithWebsiteLeadsColumn = [...META_HEADERS, "Website Leads"];
    const selection = defaultMetaSelection("WEBSITE LEADS", "COST PER LEAD", headersWithWebsiteLeadsColumn);
    const available = listSelectableMetrics(headersWithWebsiteLeadsColumn, "META");

    const slot4 = selection[3];
    expect(slot4.label).toBe("WEBSITE LEADS");
    expect(slot4.key).toBe("results");

    const availableWebsiteLeads = available.find((m) => m.label === "WEBSITE LEADS");
    expect(availableWebsiteLeads?.key).toBe("website_leads");
    // Same label, different key — a key-only filter would let this through.
    expect(availableWebsiteLeads?.key).not.toBe(slot4.key);
  });
});

describe("defaultMetaSelection / buildMetaSlots — META FORM LEADS dedicated-column priority", () => {
  it("with no dedicated 'on-facebook leads' column, both fall back to the Results/Cost per result columns under the META FORM LEADS/COST PER LEAD labels", () => {
    const preview = defaultMetaSelection("META FORM LEADS", "COST PER LEAD", META_HEADERS);
    expect(preview[3]).toMatchObject({ key: "results", label: "META FORM LEADS" });
    expect(preview[4]).toMatchObject({ key: "cost_per_result", label: "COST PER LEAD" });

    const real = buildMetaSlots(
      { resultLabel: "META FORM LEADS", costLabel: "COST PER LEAD", spend: "$1", reach: "1", impressions: "1", ctr: "1%", resultValue: "5", cprValue: "$40.00" },
      [{ _raw: { "Amount spent": "500", Reach: "10000", Impressions: "40000", "Link clicks": "800", "Landing page views": "300" } }],
      "$",
    );
    expect(real[3]).toMatchObject({ key: "results", label: "META FORM LEADS", value: "5" });
    expect(real[4]).toMatchObject({ key: "cost_per_result", label: "COST PER LEAD", value: "$40.00" });
  });

  it("prefers a dedicated 'on-facebook leads'/'cost per on-facebook lead' column over the generic Results fallback when the CSV has one", () => {
    const headersWithDedicated = [...META_HEADERS, "On-Facebook leads", "Cost per on-facebook lead"];
    const preview = defaultMetaSelection("META FORM LEADS", "COST PER LEAD", headersWithDedicated);
    expect(preview[3]).toMatchObject({ key: "meta_form_leads" });
    expect(preview[4]).toMatchObject({ key: "cost_per_meta_form_lead" });

    // cost_per_meta_form_lead is a perUnitOf ("meta_form_leads") metric —
    // computed as sum(spend) / sum(on-facebook leads), same convention as
    // every other cost-per-X entry in the dictionary (e.g.
    // cost_per_website_lead) — not read directly off a "cost per..." column.
    const real = buildMetaSlots(
      { resultLabel: "META FORM LEADS", costLabel: "COST PER LEAD", spend: "$1", reach: "1", impressions: "1", ctr: "1%", resultValue: "5", cprValue: "$40.00" },
      [{ _raw: { "On-Facebook leads": "9", "Amount spent": "198" } }],
      "$",
    );
    expect(real[3]).toMatchObject({ key: "meta_form_leads", label: "META FORM LEADS", value: "9" });
    expect(real[4]).toMatchObject({ key: "cost_per_meta_form_lead", label: "COST PER LEAD", value: "$22.00" });
  });

  // Reported bug: some real InstantForms exports have a plain "Cost per
  // lead" column (column V) instead of "Cost per on-facebook lead" — the
  // wizard's Metric Cards preview must recognize it as the slot 5
  // candidate, second in priority after "cost per on-facebook lead".
  it("recognizes a plain 'cost per lead' column as the wizard preview's slot 5 pick when 'cost per on-facebook lead' is absent", () => {
    const headersWithCostPerLead = [...META_HEADERS, "Cost per lead"];
    const preview = defaultMetaSelection("META FORM LEADS", "COST PER LEAD", headersWithCostPerLead);
    expect(preview[4]).toMatchObject({ key: "cost_per_lead", label: "COST PER LEAD" });
  });

  // cost_per_lead's own perUnitOf ("website_leads") means buildMetaSlots'
  // real, value-checked dedicated-column attempt safely evaluates to no
  // data (a Meta Form Leads CSV has no "Website leads" column) and falls
  // through to the same Results/Cost-per-result baseline math the no-
  // dedicated-column case already uses — exactly the "calculated correctly
  // from spend/leads" result the reported bug asked for, whether or not a
  // literal "Cost per lead" column happens to be present.
  it("buildMetaSlots falls through to the Results/Cost-per-result baseline when the CSV has a 'cost per lead' column but no 'website leads' column to divide it by", () => {
    const real = buildMetaSlots(
      { resultLabel: "META FORM LEADS", costLabel: "COST PER LEAD", spend: "$1", reach: "1", impressions: "1", ctr: "1%", resultValue: "25", cprValue: "$8.00" },
      [{ _raw: { "Amount spent": "200", "Cost per lead": "8.33" } }],
      "$",
    );
    expect(real[3]).toMatchObject({ key: "results", label: "META FORM LEADS", value: "25" });
    expect(real[4]).toMatchObject({ key: "cost_per_result", label: "COST PER LEAD", value: "$8.00" });
  });
});

describe("defaultGoogleSelection — matches slot-assignment.ts's own automatic picks", () => {
  it.each(["search", "shopping", "performance_max", "display", "video", "youtube"] as const)(
    "produces the same 8 keys, in the same order, as buildGoogleSlots for %s",
    (objectiveKey) => {
      const preview = defaultGoogleSelection(objectiveKey);
      const real = buildGoogleSlots(objectiveKey, { spend: "$1", reach: "1", impressions: "1", ctr: "1%", cpc: "$1", results: "1", cpr: "$1" }, [], "$");
      expect(preview.map((m) => m.key)).toEqual(real.map((m) => m.key));
    },
  );
});

function metric(key: string, priority = 60): AvailableMetric {
  return { key, label: key.toUpperCase(), format: "number", csvName: key, priority, isAutoCatch: false };
}

function selected(key: string): SelectedMetric {
  return { key, label: key.toUpperCase(), format: "number", csvName: key };
}

describe("splitMetricsForSlides — Part 4", () => {
  it("returns a single slide's worth unchanged when 8 or fewer are selected", () => {
    const sel = Array.from({ length: 5 }, (_, i) => selected(`m${i}`));
    expect(splitMetricsForSlides(sel, [])).toEqual([sel]);
  });

  it("splits into slide 1 (first 8) + slide 2 (the rest) for 9-16 selected", () => {
    const sel = Array.from({ length: 10 }, (_, i) => selected(`m${i}`));
    const [slide1, slide2] = splitMetricsForSlides(sel, []);
    expect(slide1).toHaveLength(8);
    expect(slide1.map((m) => m.key)).toEqual(["m0", "m1", "m2", "m3", "m4", "m5", "m6", "m7"]);
    expect(slide2.map((m) => m.key)).toEqual(["m8", "m9"]);
  });

  it("pads slide 2 up to MIN_SECOND_SLIDE_METRICS with the highest-priority unselected available metrics", () => {
    const sel = Array.from({ length: 9 }, (_, i) => selected(`m${i}`)); // slide 2 would be just ["m8"]
    const available = [metric("pad_low", 40), metric("pad_high", 90), metric("pad_mid", 60)];
    const [, slide2] = splitMetricsForSlides(sel, available);
    expect(slide2).toHaveLength(MIN_SECOND_SLIDE_METRICS);
    expect(slide2.map((m) => m.key)).toEqual(["m8", "pad_high", "pad_mid", "pad_low"]);
  });

  it("never pads with a metric that's already selected", () => {
    const sel = Array.from({ length: 9 }, (_, i) => selected(`m${i}`));
    const available = [metric("m0", 99), metric("pad", 50)];
    const [, slide2] = splitMetricsForSlides(sel, available);
    expect(slide2.map((m) => m.key)).not.toContain("m0");
    expect(slide2.map((m) => m.key)).toContain("pad");
  });

  it("caps at MAX_TOTAL_METRICS, dropping anything beyond it", () => {
    const sel = Array.from({ length: 20 }, (_, i) => selected(`m${i}`));
    const [slide1, slide2] = splitMetricsForSlides(sel, []);
    expect(slide1.length + slide2.length).toBe(MAX_TOTAL_METRICS);
  });
});
