import { describe, it, expect, vi } from "vitest";
import {
  campaignState,
  campaignBrief,
  signalObservation,
  portfolioRank,
} from "../portfolio";
import { decisionSignals } from "../decision";
import { overviewRow, type OverviewClient } from "../../agency-overview";
import { dueChecks, runDueChecks } from "../refresh-queue";
import type {
  CampaignPerformance,
  PeriodMetrics,
  PerformanceSnapshot,
} from "../facts";
const now = new Date("2026-11-20T12:00Z"),
  config = { currency: "USD", timezone: "UTC", metaAdAccountId: "123" };
const metrics: PeriodMetrics = {
  spend: 100,
  impressions: 10000,
  clicks: 100,
  ctr: 1,
  cpc: 1,
  results: 20,
  cpr: 5,
};
function campaign(a = metrics, b = metrics): CampaignPerformance {
  return {
    id: "456",
    name: "Any campaign",
    objective: "META FORM LEADS",
    costLabel: "Cost per lead",
    current: a,
    previous: b,
    comparableResults: true,
    signals: decisionSignals(a, b, true, { objective: "META FORM LEADS" }),
  };
}
function client(
  campaigns: CampaignPerformance[] = [campaign()],
): OverviewClient {
  const snapshot: PerformanceSnapshot = {
    version: 2,
    config,
    checkedAt: now.toISOString(),
    facts: {
      periodA: { startIso: "2026-11-13", endIso: "2026-11-19" },
      periodB: { startIso: "2026-11-06", endIso: "2026-11-12" },
      current: metrics,
      previous: metrics,
      campaigns,
      empty: !campaigns.length,
    },
  };
  return {
    ...config,
    id: "c",
    accountName: "Any account",
    monthlyBudget: 750,
    budgetMonitorEnabled: false,
    budgetMonitorSnapshot: null,
    performanceMonitorEnabled: true,
    performanceMonitorEmailEnabled: false,
    performanceMonitorSnapshot: JSON.stringify(snapshot),
  };
}
describe("portfolio evidence and coverage", () => {
  it("distinguishes stable outcomes, too little evidence, no delivery and changed goals", () => {
    expect(campaignState(campaign())).toBe("neutral");
    expect(
      campaignState(
        campaign(
          { ...metrics, results: 2, cpr: 50 },
          { ...metrics, results: 2, cpr: 50 },
        ),
      ),
    ).toBe("insufficient");
    expect(campaignState({ ...campaign(), comparableResults: false })).toBe(
      "insufficient",
    );
    expect(
      campaignState(
        campaign({
          ...metrics,
          spend: 0,
          impressions: 0,
          results: null,
          cpr: null,
          clicks: 0,
          ctr: null,
          cpc: null,
        }),
      ),
    ).toBe("no-delivery");
  });
  it("keeps qualified improvement distinct from stable, while respecting primary warnings", () => {
    const good = campaign({ ...metrics, results: 40, cpr: 2.5 });
    expect(campaignState(good)).toBe("positive");
    expect(campaignBrief(good).observation).toMatchObject({
      metric: "Cost per result",
      current: 2.5,
      previous: 5,
      change: -50,
      unit: "money",
    });
    const bad = campaign(
      { ...metrics, results: 0, cpr: null },
      { ...metrics, results: 8, cpr: 12.5 },
    );
    expect(campaignBrief(bad)).toMatchObject({
      state: "critical",
      observation: { current: 0, previous: 8, change: -100 },
    });
  });
  it("does not lead a positive campaign with a supporting concern", () => {
    const c = campaign({ ...metrics, ctr: 0.5, results: 40, cpr: 2.5 });
    expect(campaignBrief(c).observation?.metric).toBe("Cost per result");
  });
  it("labels target comparisons as targets instead of previous-period results", () => {
    const c = campaign();
    c.target = { objective: c.objective, maxCpr: 2 };
    const signal = {
      key: "cost-above-target",
      metric: "Cost vs target",
      tone: "warning" as const,
      change: 150,
      message: "",
    };
    expect(signalObservation(c, signal)).toMatchObject({
      current: 5,
      previous: 2,
      reference: "target",
    });
  });
  it("does not label stale/missing snapshots or monitoring-off accounts neutral", () => {
    const c = client();
    expect(overviewRow(c, now).portfolio.state).toBe("neutral");
    expect(overviewRow(c, new Date("2026-11-22T12:00Z")).portfolio.state).toBe(
      "check",
    );
    expect(
      overviewRow({ ...c, performanceMonitorSnapshot: null }, now).portfolio
        .state,
    ).toBe("check");
    expect(
      overviewRow({ ...c, performanceMonitorEnabled: false }, now).portfolio
        .state,
    ).toBe("setup");
    expect(
      overviewRow({ ...c, metaAdAccountId: null }, now).portfolio.state,
    ).toBe("setup");
  });
  it("shows primary outcome coverage alongside mixed positive and insufficient campaigns", () => {
    const c = client([
      campaign({ ...metrics, results: 40, cpr: 2.5 }),
      {
        ...campaign(
          { ...metrics, results: 1, cpr: 100 },
          { ...metrics, results: 1, cpr: 100 },
        ),
        id: "789",
        name: "New campaign",
      },
    ]);
    const row = overviewRow(c, now);
    expect(row.portfolio).toMatchObject({
      state: "positive",
      coverage: { assessed: 1, insufficient: 1, total: 2 },
      positiveCampaigns: 1,
      lead: { name: "Any campaign", state: "positive" },
    });
  });
  it("does not call an empty account stable", () => {
    expect(overviewRow(client([]), now).portfolio.state).toBe("no-delivery");
  });
  it("excludes future-dated budget snapshots from freshness", () => {
    const c = client();
    const row = overviewRow(
      {
        ...c,
        budgetMonitorEnabled: true,
        budgetMonitorSnapshot: JSON.stringify({
          version: 2,
          config: { ...config, monthlyBudget: 750 },
          month: "2026-11",
          checkedAt: "2026-11-21T12:00Z",
          facts: { level: "within" },
        }),
      },
      now,
    );
    expect(row.budgetFresh).toBe(false);
    expect(row.portfolio.state).toBe("check");
  });
  it("sorts critical and review before unknown, positive and neutral", () => {
    expect(portfolioRank.critical).toBeLessThan(portfolioRank.review);
    expect(portfolioRank.review).toBeLessThan(portfolioRank.check);
    expect(portfolioRank.check).toBeLessThan(portfolioRank.positive);
    expect(portfolioRank.positive).toBeLessThan(portfolioRank.neutral);
  });
});
describe("bounded due-account refresh", () => {
  const row = () =>
    overviewRow({ ...client(), performanceMonitorSnapshot: null }, now);
  it("only queues enabled linked stale sources and excludes fixed custom performance comparisons", () => {
    const r = row();
    const jobs = dueChecks([
      r,
      { ...r, id: "fresh", performanceFresh: true },
      { ...r, id: "off", performanceEnabled: false },
      { ...r, id: "unlinked", linked: false },
      {
        ...r,
        id: "custom",
        comparison: {
          days: 7,
          customStart: "2026-10-01",
          customEnd: "2026-10-31",
        },
      },
      {
        ...r,
        id: "budget",
        performanceEnabled: false,
        budgetEnabled: true,
        budgetFresh: false,
      },
    ]);
    expect(jobs.map((j) => [j.id, j.kind])).toEqual([
      ["c", "performance-monitor"],
      ["budget", "budget-monitor"],
    ]);
  });
  it("bounds concurrency to two, records failures and continues other accounts", async () => {
    let active = 0,
      max = 0;
    const jobs = Array.from({ length: 6 }, (_, i) => ({
      id: String(i),
      name: String(i),
      kind: "performance-monitor" as const,
    }));
    const progress = vi.fn();
    const result = await runDueChecks(
      jobs,
      async (job) => {
        active++;
        max = Math.max(max, active);
        await new Promise((r) => setTimeout(r, 1));
        active--;
        if (job.id === "1") throw Error("Reconnect Meta");
      },
      () => false,
      progress,
    );
    expect(max).toBe(2);
    expect(result).toMatchObject({
      finished: 6,
      unstarted: 0,
      failed: [{ job: { id: "1" }, error: "Reconnect Meta" }],
    });
    expect(progress).toHaveBeenLastCalledWith(6);
  });
  it("stops queued checks without misreporting them as successful", async () => {
    let stop = false;
    const jobs = Array.from({ length: 5 }, (_, i) => ({
      id: String(i),
      name: String(i),
      kind: "budget-monitor" as const,
    }));
    const result = await runDueChecks(
      jobs,
      async () => {
        stop = true;
      },
      () => stop,
      () => {},
    );
    expect(result.finished).toBe(1);
    expect(result.unstarted).toBe(4);
  });
  it("does not start any request when already cancelled", async () => {
    const check = vi.fn();
    const result = await runDueChecks(
      [{ id: "1", name: "Account", kind: "budget-monitor" }],
      check,
      () => true,
      () => {},
    );
    expect(check).not.toHaveBeenCalled();
    expect(result).toMatchObject({ finished: 0, unstarted: 1 });
  });
});
