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
    const selected = selectMetrics(columns, "meta", "leads", 8);
    const keys = selected.map((m) => m.key);
    expect(keys).toContain("website_leads");
    expect(keys).toContain("cost_per_lead");
  });

  it("does not include leads-only secondary metrics when the objective isn't 'leads'", () => {
    const columns = [...META_PRIMARY_COLUMNS, "website leads", "cost per lead"];
    const selected = selectMetrics(columns, "meta", "traffic", 8);
    const keys = selected.map((m) => m.key);
    expect(keys).not.toContain("website_leads");
    expect(keys).not.toContain("cost_per_lead");
  });
});

describe("selectMetrics — required test scenarios (Meta video views CSV)", () => {
  // maxMetrics raised to 10 here (the wizard's real default is 8, but the 6
  // always-included primaries alone already fill 6 of those 8 slots) — this
  // isolates and confirms the objective-filtered secondary selection logic
  // itself picks up all 3 video metrics, rather than asserting on how many
  // of them survive competing against each other for 2 leftover slots
  // (covered separately below in "fills remaining slots...").
  it("includes VIDEO VIEWS, THRUPLAYS, and VIDEO AT 100% for a video_views objective", () => {
    const columns = [...META_PRIMARY_COLUMNS, "views", "thruplays", "video plays at 100%"];
    const selected = selectMetrics(columns, "meta", "video_views", 10);
    const keys = selected.map((m) => m.key);
    expect(keys).toContain("video_views");
    expect(keys).toContain("thruplays");
    expect(keys).toContain("video_p100");
  });
});

describe("selectMetrics — required test scenarios (Meta engagement CSV)", () => {
  it("includes PAGE ENGAGEMENT, POST ENGAGEMENTS, and POST REACTIONS for an engagement objective", () => {
    const columns = [...META_PRIMARY_COLUMNS, "page engagement", "post engagements", "post reactions"];
    const selected = selectMetrics(columns, "meta", "engagement", 10);
    const keys = selected.map((m) => m.key);
    expect(keys).toContain("page_engagement");
    expect(keys).toContain("post_engagements");
    expect(keys).toContain("post_reactions");
  });
});

describe("selectMetrics — required test scenarios (Google Ads CSV)", () => {
  it("includes COST, CLICKS, CONVERSIONS, and CTR", () => {
    const selected = selectMetrics(GOOGLE_PRIMARY_COLUMNS, "google", "search", 8);
    const keys = selected.map((m) => m.key);
    expect(keys).toContain("cost");
    expect(keys).toContain("clicks");
    expect(keys).toContain("conversions");
    expect(keys).toContain("ctr");
  });
});

describe("selectMetrics — general algorithm behavior", () => {
  it("always includes every matched primary metric first, sorted by priority descending", () => {
    const selected = selectMetrics(META_PRIMARY_COLUMNS, "meta", "traffic", 8);
    expect(selected.every((m) => m.type === "primary")).toBe(true);
    const priorities = selected.map((m) => m.priority);
    expect(priorities).toEqual([...priorities].sort((a, b) => b - a));
  });

  it("fills remaining slots with the highest-priority secondary matches up to maxMetrics", () => {
    const columns = [
      ...META_PRIMARY_COLUMNS,
      "link clicks", // priority 70
      "cpc (cost per link click)", // priority 68
      "cpc (all)", // priority 65, traffic-only
    ];
    // The 6 always-included primaries already fill 6 of the 8 slots, so
    // only the top-2-priority secondaries (of the 3 available) make it in.
    const selected = selectMetrics(columns, "meta", "traffic", 8);
    expect(selected.length).toBe(8);
    const secondaries = selected.filter((m) => m.type === "secondary");
    expect(secondaries.map((m) => m.key)).toEqual(["link_clicks", "cpc_link_click"]);

    // With enough room, all 3 objective-matching secondaries are selected,
    // still ordered by priority descending.
    const selectedWithRoom = selectMetrics(columns, "meta", "traffic", 10);
    const secondariesWithRoom = selectedWithRoom.filter((m) => m.type === "secondary");
    expect(secondariesWithRoom.map((m) => m.key)).toEqual(["link_clicks", "cpc_link_click", "cpc_all"]);
  });

  it("caps total selections at maxMetrics", () => {
    const columns = [
      ...META_PRIMARY_COLUMNS,
      "link clicks",
      "landing page views",
      "cost per landing page view",
      "frequency",
      "cpm (cost per 1,000 impressions)",
    ];
    const selected = selectMetrics(columns, "meta", "traffic", 8);
    expect(selected.length).toBe(8);
  });

  it("ignores dimension/metadata/never-type columns entirely", () => {
    const columns = [...META_PRIMARY_COLUMNS, "campaign name", "delivery status", "quality ranking"];
    const selected = selectMetrics(columns, "meta", "traffic", 8);
    const keys = selected.map((m) => m.key);
    expect(keys).not.toContain("campaign_name");
    expect(keys).not.toContain("delivery_status");
    expect(keys).not.toContain("quality_ranking");
  });

  it("ignores columns not present in the CSV at all", () => {
    const selected = selectMetrics(META_PRIMARY_COLUMNS, "meta", "leads", 8);
    const keys = selected.map((m) => m.key);
    expect(keys).not.toContain("website_leads");
  });

  it("is case-insensitive and trims whitespace on detected column names", () => {
    const selected = selectMetrics(["  Amount Spent  ", "REACH"], "meta", "traffic", 8);
    const keys = selected.map((m) => m.key);
    expect(keys).toContain("spend");
    expect(keys).toContain("reach");
  });
});

describe("getAvailableMetrics — the wizard's full candidate pool, uncapped", () => {
  it("returns every matched primary/secondary metric with no maxMetrics limit", () => {
    const columns = [
      ...META_PRIMARY_COLUMNS,
      "link clicks",
      "landing page views",
      "cost per landing page view",
      "frequency",
      "cpm (cost per 1,000 impressions)",
    ];
    const available = getAvailableMetrics(columns, "meta", "traffic");
    expect(available.length).toBeGreaterThan(8);
  });

  it("selectMetrics' output is always a subset of getAvailableMetrics' pool", () => {
    const columns = [...META_PRIMARY_COLUMNS, "website leads", "cost per lead", "link clicks"];
    const available = getAvailableMetrics(columns, "meta", "leads");
    const selected = selectMetrics(columns, "meta", "leads", 8);
    const availableKeys = new Set(available.map((m) => m.key));
    expect(selected.every((m) => availableKeys.has(m.key))).toBe(true);
  });
});
