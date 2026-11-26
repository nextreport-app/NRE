import { describe, it, expect } from "vitest";
import {
  decisionSignals,
  campaignVerdict,
  applySignalLifecycle,
  decisionAlertKey,
  actionableSignals,
} from "../decision";
import { decisionPeriods, readCampaignTargets } from "../settings";
import { purchasePeriodMap } from "../purchase-values";
import type {
  PeriodMetrics,
  CampaignPerformance,
  PerformanceFacts,
  PerformanceSnapshot,
} from "../facts";
const now = new Date("2026-11-20T12:00Z");
const b: PeriodMetrics = {
  spend: 100,
  impressions: 10000,
  clicks: 100,
  ctr: 1,
  cpc: 1,
  results: 20,
  cpr: 5,
};
function campaign(a: PeriodMetrics = b, prior = b): CampaignPerformance {
  return {
    id: "123",
    name: "Any client",
    objective: "PURCHASES",
    costLabel: "Cost per purchase",
    current: a,
    previous: prior,
    comparableResults: true,
    signals: decisionSignals(a, prior, true, {
      purchase: true,
      objective: "PURCHASES",
    }),
  };
}
function facts(c: CampaignPerformance): PerformanceFacts {
  return {
    periodA: { startIso: "2026-11-13", endIso: "2026-11-19" },
    periodB: { startIso: "2026-11-06", endIso: "2026-11-12" },
    campaigns: [c],
    current: b,
    previous: b,
    empty: false,
  };
}
function previous(c: CampaignPerformance): PerformanceSnapshot {
  return {
    version: 2,
    config: { currency: "USD", timezone: "UTC", metaAdAccountId: "123" },
    checkedAt: now.toISOString(),
    facts: facts(c),
  };
}
describe("decision priorities", () => {
  it("flags 8 to zero with continued spend as critical without infinite cost", () => {
    const c = campaign(
      { ...b, results: 0, cpr: null },
      { ...b, results: 8, cpr: 12.5 },
    );
    expect(campaignVerdict(c)).toBe("critical");
    expect(c.signals.find((s) => s.key === "results-stopped")?.change).toBe(
      -100,
    );
  });
  it("does not infer stopped conversions when spend stopped or the goal changed", () => {
    expect(
      decisionSignals({ ...b, spend: 0, results: 0, cpr: null }, b, true).some(
        (s) => s.tone === "critical",
      ),
    ).toBe(false);
    expect(
      decisionSignals({ ...b, results: 0 }, b, false).some(
        (s) => s.role === "primary",
      ),
    ).toBe(false);
  });
  it("does not let cheaper clicks hide worse purchase costs", () => {
    const c = campaign(
      { ...b, clicks: 200, ctr: 2, cpc: 0.5, results: 10, cpr: 10, roas: 1 },
      { ...b, roas: 2 },
    );
    expect(campaignVerdict(c)).toBe("critical");
    expect(c.signals.some((s) => s.key === "roas-down")).toBe(true);
  });
  it("prioritizes a supporting CTR warning over primary efficiency improvement", () => {
    const c = campaign(
      { ...b, ctr: 0.7, results: 30, cpr: 100 / 30, roas: 2 },
      { ...b, roas: 2 },
    );
    expect(campaignVerdict(c)).toBe("review");
    expect(actionableSignals(c).some(s => s.key === "ctr-down")).toBe(true);
  });
  it("an improvement above the saved target remains amber", () => {
    const a = { ...b, cpr: 4, results: 25 };
    const c = campaign(a);
    c.signals = decisionSignals(a, b, true, {
      target: { objective: "PURCHASES", maxCpr: 2 },
    });
    expect(campaignVerdict(c)).toBe("review");
  });
  it("never applies purchase ROAS signals to lead campaigns", () => {
    expect(
      decisionSignals({ ...b, roas: 1 }, { ...b, roas: 4 }, true).some((s) =>
        s.key.startsWith("roas"),
      ),
    ).toBe(false);
  });
  it("makes missing purchase values explicit rather than calling them zero ROAS", () => {
    expect(campaign().signals.some((s) => s.key === "roas-unavailable")).toBe(
      true,
    );
  });
  it("marks recurring issues continuing and recovery only with evidence", () => {
    const bad = campaign({ ...b, results: 0, cpr: null });
    const continuing = facts(campaign({ ...b, results: 0, cpr: null }));
    applySignalLifecycle(continuing, previous(bad), now);
    expect(
      continuing.campaigns[0].signals.find((s) => s.key === "results-stopped")
        ?.state,
    ).toBe("continuing");
    const good = facts(campaign({ ...b, roas: 2 }, { ...b, roas: 2 }));
    applySignalLifecycle(good, previous(bad), now);
    expect(good.campaigns[0].signals.some((s) => s.state === "recovered")).toBe(
      true,
    );
    const missing = facts(campaign({ ...b, results: null, cpr: null }));
    applySignalLifecycle(missing, previous(bad), now);
    expect(
      missing.campaigns[0].signals.some((s) => s.state === "recovered"),
    ).toBe(false);
  });
  it("does not recover changed objectives or unavailable source snapshots", () => {
    const bad = campaign({ ...b, results: 0, cpr: null });
    const f = facts({ ...campaign(), objective: "LEADS" });
    applySignalLifecycle(f, previous(bad), now);
    expect(f.campaigns[0].signals.some((s) => s.state === "recovered")).toBe(
      false,
    );
    const p = previous(bad);
    p.error = "API unavailable";
    const g = facts(campaign());
    applySignalLifecycle(g, p, now);
    expect(g.campaigns[0].signals.some((s) => s.state === "recovered")).toBe(
      false,
    );
  });
  it("gives critical escalation a separate immutable email key", () => {
    expect(
      decisionAlertKey("x", "2026-11-19", "2026-11-13", "review"),
    ).not.toBe(decisionAlertKey("x", "2026-11-19", "2026-11-13", "critical"));
  });
});
describe("comparison settings and target binding", () => {
  it.each([7, 15, 30])(
    "compares %i completed days in the account timezone",
    (days) => {
      const p = decisionPeriods(
        "Asia/Kolkata",
        { performanceWindowDays: days },
        now,
      );
      expect(p.periodA.endIso).toBe("2026-11-19");
      expect(
        (Date.parse(p.periodA.endIso) - Date.parse(p.periodA.startIso)) /
          86400000 +
          1,
      ).toBe(days);
      expect(
        Date.parse(p.periodA.startIso) - Date.parse(p.periodB.endIso),
      ).toBe(86400000);
    },
  );
  it("custom ranges get an adjacent equal baseline", () => {
    expect(
      decisionPeriods(
        "UTC",
        {
          performanceCustomStart: "2026-10-01",
          performanceCustomEnd: "2026-10-31",
        },
        now,
      ),
    ).toMatchObject({
      days: 31,
      custom: true,
      periodB: { startIso: "2026-08-31", endIso: "2026-09-30" },
    });
  });
  it.each([
    ["2026-02-30", "2026-03-01"],
    ["2026-11-20", "2026-11-20"],
    ["2026-10-01", "2026-11-19"],
    ["2026-11-10", ""],
  ])("rejects incomplete, future or too-long custom dates", (start, end) => {
    expect(() =>
      decisionPeriods(
        "UTC",
        { performanceCustomStart: start, performanceCustomEnd: end },
        now,
      ),
    ).toThrow();
  });
  it("does not reuse targets across account or currency changes", () => {
    const raw = JSON.stringify({
      accountId: "123",
      currency: "USD",
      rules: { "456": { objective: "LEADS", maxCpr: 20 } },
    });
    expect(readCampaignTargets(raw, "act_123", "USD")["456"].maxCpr).toBe(20);
    expect(readCampaignTargets(raw, "124", "USD")).toEqual({});
    expect(readCampaignTargets(raw, "123", "INR")).toEqual({});
  });
});
describe("purchase value evidence", () => {
  it("keeps overlapping purchase aliases separate", () => {
    const p = purchasePeriodMap([
      {
        campaign_id: "123",
        spend: "100",
        action_values: [
          { action_type: "purchase", value: "300" },
          { action_type: "omni_purchase", value: "350" },
        ],
      },
    ]);
    expect(p["123"].values.purchase).toBe(300);
    expect(p["123"].values.omni_purchase).toBe(350);
  });
  it("distinguishes explicit zero, missing positive-purchase value and malformed value", () => {
    const p = purchasePeriodMap([
      {
        campaign_id: "1",
        spend: "100",
        actions: [{ action_type: "purchase", value: "5" }],
      },
      { campaign_id: "2", spend: "100", actions: [] },
      {
        campaign_id: "3",
        spend: "100",
        actions: [],
        action_values: [{ action_type: "purchase", value: "bad" }],
      },
    ]);
    expect(p["1"].values.purchase).toBeNull();
    expect(p["2"].values.purchase).toBe(0);
    expect(p["3"].values.purchase).toBeNull();
  });
  it("rejects duplicate period rows and overlapping value rows", () => {
    expect(() =>
      purchasePeriodMap([
        { campaign_id: "1", spend: "10" },
        { campaign_id: "1", spend: "20" },
      ]),
    ).toThrow();
    expect(() =>
      purchasePeriodMap([
        {
          campaign_id: "1",
          spend: "10",
          action_values: [
            { action_type: "purchase", value: "1" },
            { action_type: "purchase", value: "2" },
          ],
        },
      ]),
    ).toThrow();
  });
});

describe("budget decision urgency", () => {
  it("makes actual overspend critical and forecasts review, respecting tolerance", async () => {
    const { overviewRow } = await import("../../agency-overview");
    const { budgetFacts, budgetWindow } =
      await import("../../budget-monitor-facts");
    const date = new Date("2026-11-27T12:00Z"),
      config = {
        monthlyBudget: 750,
        currency: "USD",
        timezone: "UTC",
        metaAdAccountId: "123",
        budgetMonitorTolerance: 10,
      };
    const row = (spent: number, completed: number) =>
      overviewRow(
        {
          ...config,
          id: "client",
          accountName: "Any client",
          budgetMonitorEnabled: true,
          performanceMonitorEnabled: false,
          performanceMonitorEmailEnabled: false,
          performanceMonitorSnapshot: null,
          budgetMonitorSnapshot: JSON.stringify({
            version: 2,
            config,
            month: "2026-11",
            checkedAt: date.toISOString(),
            facts: budgetFacts(
              750,
              spent,
              completed,
              budgetWindow("UTC", date),
              10,
            ),
          }),
        },
        date,
      );
    expect(row(800, 780).verdict).toBe("critical");
    expect(row(300, 290).verdict).toBe("review");
    expect(row(755, 650).budgetCritical).toBe(false);
    expect(row(700, 650).dailyAllowance).toBe(12.5);
  });
});
