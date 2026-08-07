import { describe, it, expect } from "vitest";
import { getAvailableMetrics, selectMetrics } from "../metric-selector";

// Baseline columns every Meta CSV export has regardless of objective — the
// 7 dictionary PRIMARY entries.
const META_PRIMARY_COLUMNS = [
  "amount spent",
  "reach",
  "impressions",
  "results",
  "cost per result",
  "ctr (all)",
];

const GOOGLE_PRIMARY_COLUMNS = ["cost", "impr.", "clicks", "ctr", "avg. cpc", "conversions"];

describe("selectMetrics — required test scenarios (Meta leads CSV)", () => {
  it("includes WEBSITE LEADS and COST PER LEAD when the CSV has those columns and the objective is 'leads'", () => {
    const columns = [...META_PRIMARY_COLUMNS, "website leads", "cost per lead"];
    const selected = selectMetrics(columns, "meta", "leads");
    const keys = selected.map((m) => m.key);
    expect(keys).toContain("website_leads");
    expect(keys).toContain("cost_per_lead");
  });

  it("does not include leads-only secondary metrics when the objective isn't 'leads'", () => {
    const columns = [...META_PRIMARY_COLUMNS, "website leads", "cost per lead"];
    const selected = selectMetrics(columns, "meta", "traffic");
    const keys = selected.map((m) => m.key);
    expect(keys).not.toContain("website_leads");
    expect(keys).not.toContain("cost_per_lead");
  });
});

describe("selectMetrics — required test scenarios (Meta video views CSV)", () => {
  it("includes VIDEO VIEWS, THRUPLAYS, and VIDEO AT 100% for a video_views objective", () => {
    const columns = [...META_PRIMARY_COLUMNS, "views", "thruplays", "video plays at 100%"];
    const selected = selectMetrics(columns, "meta", "video_views");
    const keys = selected.map((m) => m.key);
    expect(keys).toContain("video_views");
    expect(keys).toContain("thruplays");
    expect(keys).toContain("video_p100");
  });
});

describe("selectMetrics — required test scenarios (Meta engagement CSV)", () => {
  it("includes PAGE ENGAGEMENT, POST ENGAGEMENTS, and POST REACTIONS for an engagement objective", () => {
    const columns = [...META_PRIMARY_COLUMNS, "page engagement", "post engagements", "post reactions"];
    const selected = selectMetrics(columns, "meta", "engagement");
    const keys = selected.map((m) => m.key);
    expect(keys).toContain("page_engagement");
    expect(keys).toContain("post_engagements");
    expect(keys).toContain("post_reactions");
  });
});

describe("selectMetrics — required test scenarios (Google Ads CSV)", () => {
  it("includes COST, CLICKS, CONVERSIONS, and CTR", () => {
    const selected = selectMetrics(GOOGLE_PRIMARY_COLUMNS, "google", "search");
    const keys = selected.map((m) => m.key);
    expect(keys).toContain("cost");
    expect(keys).toContain("clicks");
    expect(keys).toContain("conversions");
    expect(keys).toContain("ctr");
  });
});

describe("selectMetrics — general algorithm behavior (uncapped, priority-sorted)", () => {
  it("includes every matched primary metric regardless of objective", () => {
    const selected = selectMetrics(META_PRIMARY_COLUMNS, "meta", "traffic");
    expect(selected.every((m) => m.type === "primary")).toBe(true);
    expect(selected.length).toBe(META_PRIMARY_COLUMNS.length);
  });

  it("sorts the whole combined primary+secondary list by priority descending, not primaries-block-first", () => {
    // website_leads (secondary, priority 85) and cost_per_lead (secondary,
    // priority 83) both outrank ctr (primary, priority 75) — the fixed
    // spec (Fix 1) requires a single combined ordering, so they must sort
    // ahead of it, not trail behind every primary regardless of priority.
    const columns = [...META_PRIMARY_COLUMNS, "website leads", "cost per lead"];
    const selected = selectMetrics(columns, "meta", "leads");
    const priorities = selected.map((m) => m.priority);
    expect(priorities).toEqual([...priorities].sort((a, b) => b - a));
    const ctrIndex = selected.findIndex((m) => m.key === "ctr");
    const leadsIndex = selected.findIndex((m) => m.key === "website_leads");
    expect(leadsIndex).toBeLessThan(ctrIndex);
  });

  it("includes every objective-matching secondary with no cap (Fix 2 — the old 8-metric cap is removed)", () => {
    const columns = [
      ...META_PRIMARY_COLUMNS,
      "link clicks",
      "landing page views",
      "cost per landing page view",
      "clicks (all)",
      "cpc (all)",
    ];
    const selected = selectMetrics(columns, "meta", "traffic");
    expect(selected.length).toBeGreaterThan(8);
    const keys = selected.map((m) => m.key);
    expect(keys).toContain("link_clicks");
    expect(keys).toContain("landing_page_views");
    expect(keys).toContain("cost_per_lpv");
    expect(keys).toContain("clicks_all");
  });

  it("includes REACH, IMPRESSIONS, CPM, and COST PER 1K REACHED for a reach objective — not lead/traffic secondaries (Fix 6)", () => {
    const columns = [
      ...META_PRIMARY_COLUMNS,
      "cpm (cost per 1,000 impressions)",
      "cost per 1,000 meta accounts reached",
      "website leads",
      "link clicks",
    ];
    const selected = selectMetrics(columns, "meta", "reach");
    const keys = selected.map((m) => m.key);
    expect(keys).toContain("reach");
    expect(keys).toContain("impressions");
    expect(keys).toContain("cpm");
    expect(keys).toContain("cost_per_1k_reached");
    expect(keys).not.toContain("website_leads");
  });

  it("accepts an array of objectives and unions their matching secondaries (multi-campaign account)", () => {
    const columns = [...META_PRIMARY_COLUMNS, "website leads", "cost per lead", "cpm (cost per 1,000 impressions)"];
    const selected = selectMetrics(columns, "meta", ["leads", "reach"]);
    const keys = selected.map((m) => m.key);
    expect(keys).toContain("website_leads");
    expect(keys).toContain("cost_per_lead");
    expect(keys).toContain("cpm");
  });

  it("ignores dimension/metadata/never-type columns entirely, including Frequency and Result rate (Step 6)", () => {
    const columns = [
      ...META_PRIMARY_COLUMNS,
      "campaign name",
      "delivery status",
      "quality ranking",
      "frequency",
      "result rate",
      "ad delivery",
      "campaign delivery",
      "ad set delivery",
      "result value type",
    ];
    const selected = selectMetrics(columns, "meta", "traffic");
    const keys = selected.map((m) => m.key);
    expect(keys).not.toContain("campaign_name");
    expect(keys).not.toContain("delivery_status");
    expect(keys).not.toContain("quality_ranking");
    expect(keys).not.toContain("frequency");
    expect(keys).not.toContain("result_rate");
    expect(keys).not.toContain("ad_delivery");
    expect(keys).not.toContain("campaign_delivery");
    expect(keys).not.toContain("ad_set_delivery");
    expect(keys).not.toContain("result_value_type");
  });

  it("ignores columns not present in the CSV at all", () => {
    const selected = selectMetrics(META_PRIMARY_COLUMNS, "meta", "leads");
    const keys = selected.map((m) => m.key);
    expect(keys).not.toContain("website_leads");
  });

  it("is case-insensitive and trims whitespace on detected column names", () => {
    const selected = selectMetrics(["  Amount Spent  ", "REACH"], "meta", "traffic");
    const keys = selected.map((m) => m.key);
    expect(keys).toContain("spend");
    expect(keys).toContain("reach");
  });
});

describe("getAvailableMetrics — the wizard's full candidate pool", () => {
  it("with no objective argument, returns every matched primary/secondary metric regardless of objective relevance — but never Frequency (Step 6)", () => {
    const columns = [...META_PRIMARY_COLUMNS, "website leads", "cost per lead", "frequency"];
    const available = getAvailableMetrics(columns, "meta");
    const keys = available.map((m) => m.key);
    expect(keys).toContain("website_leads"); // leads-only secondary
    expect(keys).not.toContain("frequency"); // metadata — already shown below the date range on every slide
  });

  it("with an objective argument, filters secondaries the same way selectMetrics does", () => {
    const columns = [...META_PRIMARY_COLUMNS, "website leads", "cost per lead"];
    const available = getAvailableMetrics(columns, "meta", "traffic");
    expect(available.map((m) => m.key)).not.toContain("website_leads");
  });

  it("selectMetrics' output is always a subset of the unfiltered getAvailableMetrics pool", () => {
    const columns = [...META_PRIMARY_COLUMNS, "website leads", "cost per lead", "link clicks"];
    const available = getAvailableMetrics(columns, "meta");
    const selected = selectMetrics(columns, "meta", "leads");
    const availableKeys = new Set(available.map((m) => m.key));
    expect(selected.every((m) => availableKeys.has(m.key))).toBe(true);
  });

  it("carries perUnitOf/perUnitScale through from the dictionary for per-unit cost metrics", () => {
    const columns = [...META_PRIMARY_COLUMNS, "cost per lead", "website leads"];
    const available = getAvailableMetrics(columns, "meta", "leads");
    const costPerLead = available.find((m) => m.key === "cost_per_lead");
    expect(costPerLead?.perUnitOf).toBe("website_leads");
  });
});
