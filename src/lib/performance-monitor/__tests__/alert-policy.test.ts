import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import {
  AccountStatusBadges,
  matchesPortfolio,
} from "@/components/portfolio-board";
import {
  campaignVerdict,
  decisionSignals,
  evaluatePerformanceFacts,
  recentResultsStopped,
} from "../decision";
import { performanceAlertIntent } from "../alert-intent";
import {
  readPerformanceSnapshot,
  type CampaignPerformance,
  type PerformanceSnapshot,
} from "../facts";
import {
  overviewRow,
  type OverviewClient,
  type OverviewRow,
} from "@/lib/agency-overview";
const metrics = {
  spend: 100,
  impressions: 10000,
  clicks: 100,
  ctr: 1,
  cpc: 1,
  results: 10,
  cpr: 10,
};
const recent = {
  periodA: { startIso: "2026-11-19", endIso: "2026-11-25" },
  periodB: { startIso: "2026-11-12", endIso: "2026-11-18" },
  current: { ...metrics, results: 0, cpr: null },
  previous: metrics,
  comparableResults: true,
};
const campaign = (id = "1"): CampaignPerformance => ({
  id,
  name: id,
  objective: "WEBSITE LEADS",
  costLabel: "Cost per website lead",
  current: { ...metrics, results: 100, cpr: 1 },
  previous: { ...metrics, results: 90, cpr: 100 / 90 },
  comparableResults: true,
  signals: [],
  recent,
});
const snapshot = (campaigns = [campaign()]): PerformanceSnapshot => ({
  version: 2,
  checkedAt: "2026-11-26T12:00:00.000Z",
  config: {
    metaAdAccountId: "123",
    currency: "USD",
    timezone: "UTC",
    performanceWindowDays: 30,
  },
  facts: {
    current: metrics,
    previous: metrics,
    periodA: { startIso: "2026-10-27", endIso: "2026-11-25" },
    periodB: { startIso: "2026-09-27", endIso: "2026-10-26" },
    empty: false,
    campaigns,
  },
});
describe("shared dashboard and alert policy", () => {
  it("a target-met signal never outranks a CTR warning", () => {
    const c = {
      ...campaign(),
      recent: undefined,
      current: { ...metrics, ctr: 0.7 },
      previous: metrics,
      target: { objective: "WEBSITE LEADS", maxCpr: 20 },
    };
    c.signals = decisionSignals(c.current, c.previous, true, {
      target: c.target,
    });
    expect(c.signals.some((s) => s.key === "target-met")).toBe(true);
    expect(campaignVerdict(c)).toBe("review");
    c.signals = c.signals.filter((s) => s.key === "target-met");
    expect(campaignVerdict(c)).toBe("neutral");
  });
  it("detects recent stopped results even when 30-day totals look healthy", () => {
    const c = evaluatePerformanceFacts(snapshot().facts!).campaigns[0];
    expect(c.current.results).toBe(100);
    expect(
      c.signals.some(
        (s) => s.key === "results-stopped-7d" && s.tone === "critical",
      ),
    ).toBe(true);
    expect(campaignVerdict(c)).toBe("critical");
  });
  it.each([
    "missing results",
    "low spend",
    "low delivery",
    "changed objective",
    "no baseline",
  ])("does not manufacture stopped-results evidence: %s", (reason) => {
    const c = structuredClone(campaign());
    if (reason === "missing results") c.recent!.current.results = null;
    if (reason === "low spend") c.recent!.current.spend = 29;
    if (reason === "low delivery") c.recent!.current.impressions = 499;
    if (reason === "changed objective") c.recent!.comparableResults = false;
    if (reason === "no baseline") c.recent!.previous.results = 0;
    expect(recentResultsStopped(c)).toBeNull();
  });
  it("can use a saved objective cost target when a previous baseline is absent", () => {
    const c = structuredClone(campaign());
    c.recent!.previous.results = 0;
    c.target = { objective: c.objective, maxCpr: 20 };
    expect(recentResultsStopped(c)?.tone).toBe("critical");
  });
  it("persists recent-window evidence through the snapshot reader", () => {
    const s = snapshot();
    expect(
      readPerformanceSnapshot(
        JSON.stringify(s),
        s.config,
        new Date(s.checkedAt),
      )?.facts?.campaigns[0].recent,
    ).toEqual(recent);
  });
  it("keys remain stable across signal order, rechecks and parsed config property order", () => {
    const s = snapshot([campaign("a"), campaign("b")]);
    const first = performanceAlertIntent("c", s, false)!;
    s.facts!.campaigns.reverse();
    s.checkedAt = "2026-11-26T12:05:00.000Z";
    const parsed = readPerformanceSnapshot(
      JSON.stringify(s),
      s.config,
      new Date(s.checkedAt),
    )!;
    expect(performanceAlertIntent("c", parsed, true)!.key).toBe(first.key);
    expect(first.critical).toBe(true);
  });
  it("new critical campaigns get another key, resolved alerts become ineligible", () => {
    const s = snapshot();
    const first = performanceAlertIntent("c", s, false)!;
    s.facts!.campaigns.push(campaign("2"));
    expect(performanceAlertIntent("c", s, false)!.key).not.toBe(first.key);
    s.facts!.campaigns.forEach((c) => {
      c.recent = undefined;
    });
    expect(performanceAlertIntent("c", s, false)).toBeNull();
  });
  it("allows two account badges when different campaigns need review and improve", () => {
    const html = renderToStaticMarkup(
      createElement(AccountStatusBadges, {
        client: {
          portfolio: { state: "review" },
          counts: { improving: 1 },
        } as OverviewRow,
      }),
    );
    expect(html).toContain("Review");
    expect(html).toContain("Improvement");
    expect(html).not.toContain(">Positive<");
  });
});

it("large CPC/CTR swings alone remain Review when primary results are maintained", () => {
  const c = {
    ...campaign(),
    recent: undefined,
    current: { ...metrics, ctr: 0.4, cpc: 2.5 },
    previous: metrics,
  };
  c.signals = decisionSignals(c.current, c.previous, true);
  expect(c.signals.some((s) => s.key === "ctr-down")).toBe(true);
  expect(c.signals.some((s) => s.key === "cpc-up")).toBe(true);
  expect(c.signals.some((s) => s.tone === "critical")).toBe(false);
  expect(campaignVerdict(c)).toBe("review");
});

it("rolls up different campaigns as Review plus Improvement and includes the account in both filters", () => {
  const good = {
    ...campaign("good"),
    recent: undefined,
    current: { ...metrics, results: 20, cpr: 5 },
    previous: metrics,
  };
  const bad = {
    ...campaign("bad"),
    recent: undefined,
    current: { ...metrics, ctr: 0.7 },
    previous: metrics,
  };
  const s = snapshot([good, bad]);
  const row = overviewRow(
    {
      id: "c",
      accountName: "Mixed",
      currency: "USD",
      timezone: "UTC",
      metaAdAccountId: "123",
      monthlyBudget: null,
      budgetMonitorEnabled: false,
      budgetMonitorSnapshot: null,
      performanceWindowDays: 30,
      performanceMonitorEnabled: true,
      performanceMonitorEmailEnabled: false,
      performanceMonitorSnapshot: JSON.stringify(s),
    } as OverviewClient,
    new Date(s.checkedAt),
  );
  expect(row.portfolio.state).toBe("review");
  expect(row.counts.review).toBe(1);
  expect(row.counts.improving).toBe(1);
  expect(matchesPortfolio(row, "review")).toBe(true);
  expect(matchesPortfolio(row, "positive")).toBe(true);
});
