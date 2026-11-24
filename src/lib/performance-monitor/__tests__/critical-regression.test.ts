import { describe, it, expect } from "vitest";
import {
  decisionSignals,
  campaignVerdict,
  evaluatePerformanceFacts,
  applySignalLifecycle,
} from "../decision";
import { overviewRow, type OverviewClient } from "../../agency-overview";
import {
  readPerformanceSnapshot,
  type PeriodMetrics,
  type CampaignPerformance,
  type PerformanceFacts,
} from "../facts";
import {
  budgetAlertPresentation,
  budgetFacts,
  budgetWindow,
} from "../../budget-monitor-facts";
const now = new Date("2026-11-24T12:00:00Z"),
  config = { currency: "USD", timezone: "UTC", metaAdAccountId: "123" };
const previous: PeriodMetrics = {
  spend: 107.16,
  impressions: 1335,
  clicks: 77,
  ctr: 5.77,
  cpc: 107.16 / 77,
  results: 8,
  cpr: 107.16 / 8,
};
const current: PeriodMetrics = {
  spend: 102.27,
  impressions: 1392,
  clicks: 94,
  ctr: 6.75,
  cpc: 102.27 / 94,
  results: 2,
  cpr: 102.27 / 2,
};
const campaign = (
  a = current,
  b = previous,
  comparable = true,
): CampaignPerformance => ({
  id: "1",
  name: "DC Leads Campaign Main",
  objective: "WEBSITE LEADS",
  costLabel: "Cost per website lead",
  current: a,
  previous: b,
  comparableResults: comparable,
  signals: decisionSignals(a, b, comparable, { objective: "WEBSITE LEADS" }),
});
const facts = (c = campaign()): PerformanceFacts => ({
  periodA: { startIso: "2026-11-17", endIso: "2026-11-23" },
  periodB: { startIso: "2026-11-10", endIso: "2026-11-16" },
  current: c.current,
  previous: c.previous,
  campaigns: [c],
  empty: false,
});
describe("material primary-outcome deterioration", () => {
  it("marks 8 to 2 website leads with maintained spend and +281.7% CPL as critical", () => {
    const c = campaign();
    expect(campaignVerdict(c)).toBe("critical");
    expect(c.signals.find((s) => s.key === "results-down")).toMatchObject({
      tone: "critical",
      change: -75,
    });
    expect(c.signals.find((s) => s.key === "cpr-up")).toMatchObject({
      tone: "critical",
      change: expect.closeTo(281.7, 0),
    });
  });
  it("distinguishes moderate deterioration and sufficiently stable outcomes", () => {
    const moderate = campaign({
      ...previous,
      results: 5,
      cpr: previous.spend / 5,
    });
    expect(campaignVerdict(moderate)).toBe("review");
    expect(moderate.signals.some((s) => s.tone === "critical")).toBe(false);
    expect(campaignVerdict(campaign(previous, previous))).toBe("neutral");
  });
  it("treats doubling cost for unchanged results as critical when delivery and spend support it", () =>
    expect(
      campaign({
        ...previous,
        spend: previous.spend * 2,
        cpr: previous.cpr! * 2,
      }).signals.find((s) => s.key === "cpr-up")?.tone,
    ).toBe("critical"));
  it("does not call tiny baselines, changed goals, missing evidence or planned spend cuts critical", () => {
    const tiny = campaign(
      { ...previous, results: 1, cpr: 100 },
      { ...previous, results: 2, cpr: 50 },
    );
    expect(tiny.signals.some((s) => s.role === "primary")).toBe(false);
    expect(
      campaign(current, previous, false).signals.some(
        (s) => s.role === "primary",
      ),
    ).toBe(false);
    expect(
      campaign({ ...current, results: null, cpr: null }).signals.some(
        (s) => s.role === "primary",
      ),
    ).toBe(false);
    expect(
      campaign({
        ...previous,
        spend: previous.spend / 4,
        results: 2,
        cpr: previous.cpr,
      }).signals.some((s) => s.role === "primary" && s.tone !== "positive"),
    ).toBe(false);
  });
  it("reassesses saved figures immediately without changing the raw snapshot or suppressing future email", () => {
    const raw = facts({ ...campaign(), signals: [] }),
      before = JSON.stringify(raw);
    const snapshot = JSON.stringify({
      version: 2,
      config,
      checkedAt: now.toISOString(),
      facts: raw,
    });
    const client: OverviewClient = {
      ...config,
      id: "c",
      accountName: "A",
      monthlyBudget: null,
      budgetMonitorEnabled: false,
      budgetMonitorSnapshot: null,
      performanceMonitorEnabled: true,
      performanceMonitorEmailEnabled: true,
      performanceMonitorSnapshot: snapshot,
    };
    expect(overviewRow(client, now).verdict).toBe("critical");
    expect(
      evaluatePerformanceFacts(raw).campaigns[0].signals.some(
        (s) => s.tone === "critical",
      ),
    ).toBe(true);
    expect(JSON.stringify(raw)).toBe(before);
    expect(
      readPerformanceSnapshot(snapshot, config, now)?.facts?.campaigns[0]
        .signals,
    ).toEqual([]);
  });
  it("marks escalations as new, continuing criticals as ongoing, and recovery only when resolved", () => {
    const prior = facts(
      campaign({ ...previous, results: 5, cpr: previous.spend / 5 }),
    );
    const first = facts();
    applySignalLifecycle(
      first,
      { version: 2, config, checkedAt: now.toISOString(), facts: prior },
      now,
    );
    expect(
      first.campaigns[0].signals
        .filter((s) => s.tone === "critical")
        .every((s) => s.state === "new"),
    ).toBe(true);
    const second = facts();
    applySignalLifecycle(
      second,
      { version: 2, config, checkedAt: now.toISOString(), facts: first },
      now,
    );
    expect(
      second.campaigns[0].signals
        .filter((s) => s.tone === "critical")
        .every((s) => s.state === "continuing"),
    ).toBe(true);
    const recovered = facts(campaign(previous, previous));
    applySignalLifecycle(
      recovered,
      { version: 2, config, checkedAt: now.toISOString(), facts: first },
      now,
    );
    expect(
      recovered.campaigns[0].signals.some(
        (s) => s.key === "recovered:results-down" && s.state === "recovered",
      ),
    ).toBe(true);
  });
});
describe("budget warning presentation", () => {
  it("marks the user's $357.99 against $300 example critical and formats the exact overage", () => {
    const f = budgetFacts(300, 357.99, 350, budgetWindow("UTC", now), 3);
    const alert = budgetAlertPresentation(f, 300, "USD", 7);
    expect(alert).toMatchObject({
      tone: "critical",
      title: "Approved budget exceeded",
    });
    expect(alert.description).toContain("$57.99");
  });
  it("distinguishes approaching, forecast risk, tolerated overages and no alert", () => {
    const w = budgetWindow("UTC", now);
    expect(
      budgetAlertPresentation(budgetFacts(300, 240, 230, w, 3), 300, "USD", 7)
        .tone,
    ).toBe("warning");
    expect(
      budgetAlertPresentation(budgetFacts(300, 230, 300, w, 3), 300, "USD", 10)
        .title,
    ).toBe("Projected to exceed budget");
    const end = budgetWindow("UTC", new Date("2026-11-30T12:00Z"));
    expect(
      budgetAlertPresentation(budgetFacts(300, 301, 280, end, 3), 300, "USD", 1)
        .tone,
    ).not.toBe("critical");
    expect(
      budgetAlertPresentation(budgetFacts(300, 100, null, w, 3), 300, "USD", 7)
        .tone,
    ).toBe("neutral");
  });
});
