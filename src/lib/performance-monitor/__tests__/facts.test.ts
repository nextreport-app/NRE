import { describe, it, expect } from "vitest";
import { parseCsvText } from "../../nre/parse-csv";
import {
  buildPerformanceFacts,
  campaignSignals,
  isPerformanceFresh,
  readPerformanceSnapshot,
  type PeriodMetrics,
} from "../facts";
import { overviewRow } from "../../agency-overview";
const config = { metaAdAccountId: "123", currency: "USD", timezone: "UTC" };
const now = new Date("2026-11-20T12:00Z");
const base: PeriodMetrics = {
  spend: 100,
  impressions: 10000,
  clicks: 100,
  ctr: 1,
  cpc: 1,
  results: 20,
  cpr: 5,
};
function fixture() {
  const parsed = parseCsvText(
    "Campaign name,Day,Amount spent (USD),Results,Result type,Impressions,Clicks (all),Link clicks\n" +
      [
        "Leads,2026-11-19,100,10,On-Facebook leads,10000,50,20",
        "Leads,2026-11-12,100,20,On-Facebook leads,10000,100,30",
        "Traffic,2026-11-19,80,200,Link clicks,10000,250,200",
        "Traffic,2026-11-12,100,100,Link clicks,10000,200,100",
      ].join("\n"),
  );
  return {
    parsed,
    facts: buildPerformanceFacts(parsed.rows, parsed.headers, config, now),
  };
}
describe("objective-aware performance facts", () => {
  it("keeps lead and traffic results separate and ratios weighted", () => {
    const { facts } = fixture();
    expect(facts.current).toMatchObject({
      spend: 180,
      impressions: 20000,
      clicks: 300,
      ctr: 1.5,
      cpc: 0.6,
      results: null,
      cpr: null,
    });
    expect(facts.campaigns.find((c) => c.name === "Leads")).toMatchObject({
      objective: "META FORM LEADS",
      current: { results: 10, cpr: 10 },
      previous: { results: 20, cpr: 5 },
      comparableResults: true,
    });
    expect(facts.campaigns.find((c) => c.name === "Traffic")).toMatchObject({
      objective: "LINK CLICKS",
      current: { results: 200, cpr: 0.4 },
    });
  });
  it("anchors closed windows to account timezone", () => {
    const { parsed } = fixture();
    const f = buildPerformanceFacts(
      parsed.rows,
      parsed.headers,
      { ...config, timezone: "Asia/Kolkata" },
      new Date("2026-11-20T20:00Z"),
    );
    expect(f.periodA).toEqual({ startIso: "2026-11-14", endIso: "2026-11-20" });
    expect(f.periodB).toEqual({ startIso: "2026-11-07", endIso: "2026-11-13" });
  });
  it("never invents missing all-click or result data", () => {
    const { parsed } = fixture();
    parsed.rows[0]._raw["Clicks (all)"] = "";
    parsed.rows[0].results = "";
    const f = buildPerformanceFacts(parsed.rows, parsed.headers, config, now);
    const c = f.campaigns.find((c) => c.name === "Leads")!;
    expect(c.current.ctr).toBeNull();
    expect(c.current.cpc).toBeNull();
    expect(c.current.results).toBeNull();
    expect(c.signals).toEqual([]);
  });
  it("suppresses result alerts if goals change", () => {
    const { parsed } = fixture();
    parsed.rows[0].result_type = "Purchases";
    const f = buildPerformanceFacts(parsed.rows, parsed.headers, config, now);
    expect(f.campaigns.find((c) => c.name === "Leads")).toMatchObject({
      comparableResults: false,
      current: { results: null, cpr: null },
    });
  });
  it("rejects incomplete delivery metrics", () => {
    const { parsed } = fixture();
    parsed.rows[0].impressions = "";
    expect(() =>
      buildPerformanceFacts(parsed.rows, parsed.headers, config, now),
    ).toThrow("incomplete");
  });
  it("represents a successful empty response as no delivery", () => {
    const f = buildPerformanceFacts([], [], config, now);
    expect(f.empty).toBe(true);
    expect(f.campaigns).toEqual([]);
  });
});
describe("signals with evidence thresholds", () => {
  it("flags CTR and CPC changes only with enough delivery", () => {
    const current = { ...base, ctr: 0.5, cpc: 2, clicks: 50 };
    expect(campaignSignals(current, base, false).map((s) => s.key)).toEqual([
      "ctr-down",
      "cpc-up",
    ]);
    expect(
      campaignSignals({ ...current, impressions: 100 }, base, false),
    ).toEqual([]);
  });
  it("ignores new/low-volume baselines and zero denominators", () => {
    expect(
      campaignSignals(
        { ...base, cpr: 20, results: 2 },
        { ...base, results: 0, cpr: null },
        true,
      ),
    ).toEqual([]);
    expect(
      campaignSignals({ ...base, cpr: 20, results: 2 }, base, true).some(
        (s) => s.key === "cpr-up",
      ),
    ).toBe(false);
  });
  it("shows real zero results as a decline without infinite CPR", () => {
    const signals = campaignSignals(
      { ...base, results: 0, cpr: null },
      base,
      true,
    );
    expect(signals.map((s) => s.key)).toEqual(["results-stopped"]);
    expect(signals[0].change).toBe(-100);
  });
  it("does not diagnose falling results when spend falls substantially", () =>
    expect(
      campaignSignals(
        { ...base, spend: 20, results: 5, cpr: 4 },
        base,
        true,
      ).some((s) => s.key === "results-down"),
    ).toBe(false));
  it("recognizes improved cost efficiency without generic scaling advice", () => {
    const s = campaignSignals({ ...base, cpr: 4, results: 25 }, base, true);
    expect(s.map((s) => s.key)).toEqual(["cpr-down", "results-up"]);
    expect(s[0]).toMatchObject({ key: "cpr-down", tone: "positive" });
  });
  it("never compares unlike goals", () =>
    expect(
      campaignSignals({ ...base, cpr: 20, results: 5 }, base, false),
    ).toEqual([]));
});
describe("cache and overview safety", () => {
  const snap = () => ({
    version: 2 as const,
    config,
    checkedAt: now.toISOString(),
    facts: fixture().facts,
  });
  it("validates snapshots and invalidates account/currency changes", () => {
    expect(
      readPerformanceSnapshot(JSON.stringify(snap()), config, now),
    ).not.toBeNull();
    expect(
      readPerformanceSnapshot(
        JSON.stringify(snap()),
        { ...config, currency: "INR" },
        now,
      ),
    ).toBeNull();
    expect(readPerformanceSnapshot('{"version":1}', config, now)).toBeNull();
  });
  it("does not treat yesterday's report window as current after midnight", () => {
    expect(isPerformanceFresh(snap(), now)).toBe(true);
    expect(isPerformanceFresh(snap(), new Date("2026-11-21T01:00Z"))).toBe(
      false,
    );
    expect(isPerformanceFresh({ ...snap(), error: "offline" }, now)).toBe(
      false,
    );
  });
  it("does not count stale/disabled signals as active warnings", () => {
    const client = {
      ...config,
      id: "client",
      accountName: "Test",
      monthlyBudget: 750,
      budgetMonitorEnabled: false,
      budgetMonitorSnapshot: null,
      performanceMonitorEnabled: true,
      performanceMonitorEmailEnabled: true,
      performanceMonitorSnapshot: JSON.stringify(snap()),
    };
    expect(overviewRow(client, now).needsAttention).toBe(true);
    expect(overviewRow(client, new Date("2026-11-21T01:00Z"))).toMatchObject({
      warnings: 0,
      needsAttention: false,
      unavailable: true,
    });
    expect(
      overviewRow({ ...client, performanceMonitorEnabled: false }, now),
    ).toMatchObject({ warnings: 0, performance: null });
  });
});

it("uses exact purchase actions and campaign period spend for ROAS, without alias sums", () => {
  const parsed = parseCsvText(
    "Campaign name,Campaign ID,Day,Amount spent (USD),Results,Result type,Impressions,Clicks (all),NRE API result action\nShop,123,2026-11-19,100,10,Website purchases,10000,100,offsite_conversion.fb_pixel_purchase\nShop,123,2026-11-12,100,10,Website purchases,10000,100,offsite_conversion.fb_pixel_purchase",
  );
  const facts = buildPerformanceFacts(
    parsed.rows,
    parsed.headers,
    config,
    now,
    {
      "123": {
        current: {
          spend: 120,
          values: {
            "offsite_conversion.fb_pixel_purchase": 360,
            omni_purchase: 999,
          },
        },
        previous: {
          spend: 100,
          values: { "offsite_conversion.fb_pixel_purchase": 200 },
        },
      },
    },
  );
  expect(facts.campaigns[0].current).toMatchObject({
    spend: 100,
    purchaseValue: 360,
    roasSpend: 120,
    roas: 3,
  });
  expect(facts.campaigns[0].previous.roas).toBe(2);
  expect(facts.campaigns[0].signals.some((s) => s.key === "roas-up")).toBe(
    true,
  );
});
