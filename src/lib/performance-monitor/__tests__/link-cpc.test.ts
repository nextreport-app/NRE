import { expect, it } from "vitest";
import { decisionSignals, applySignalLifecycle } from "../decision";
import { signalObservation } from "../portfolio";
import type {
  PeriodMetrics,
  CampaignPerformance,
  PerformanceFacts,
} from "../facts";
const prior: PeriodMetrics = {
  spend: 100,
  impressions: 10000,
  clicks: 100,
  ctr: 1,
  cpc: 1,
  linkClicks: 100,
  linkCpc: 1,
  results: 10,
  cpr: 10,
};
const campaign = (current: PeriodMetrics): CampaignPerformance => ({
  name: "A",
  id: "1",
  objective: "WEBSITE LEADS",
  costLabel: "Cost per website lead",
  current,
  previous: prior,
  comparableResults: true,
  signals: decisionSignals(current, prior, true),
});
it("warns on link-click cost even if all-click CPC improves", () => {
  const c = campaign({ ...prior, cpc: 0.5, linkClicks: 50, linkCpc: 2 });
  expect(c.signals.find((s) => s.key === "link-cpc-up")).toMatchObject({
    metric: "CPC (link click)",
    change: 100,
    tone: "warning",
  });
  expect(c.signals.some((s) => s.key === "cpc-down")).toBe(false);
  expect(
    signalObservation(
      c,
      c.signals.find((s) => s.key === "link-cpc-up"),
    ),
  ).toMatchObject({ current: 2, previous: 1, unit: "money" });
});
it("requires enough link clicks and retains explicitly labeled legacy fallback", () => {
  expect(
    campaign({ ...prior, linkClicks: 10, linkCpc: 10 }).signals.some(
      (s) => s.key === "link-cpc-up",
    ),
  ).toBe(false);
  const c = campaign({
    ...prior,
    cpc: 2,
    linkClicks: undefined,
    linkCpc: undefined,
  });
  expect(c.signals.find((s) => s.key === "cpc-up")?.metric).toBe("CPC (all)");
});
it("tracks recovery of a link-CPC warning without confusing all-click CPC", () => {
  const before = campaign({ ...prior, linkCpc: 2 });
  const after = campaign({ ...prior, linkCpc: 1.05 });
  const facts: PerformanceFacts = {
    periodA: { startIso: "2026-11-13", endIso: "2026-11-19" },
    periodB: { startIso: "2026-11-06", endIso: "2026-11-12" },
    current: after.current,
    previous: prior,
    campaigns: [after],
    empty: false,
  };
  applySignalLifecycle(
    facts,
    {
      version: 2,
      config: { currency: "USD", timezone: "UTC", metaAdAccountId: "123" },
      checkedAt: "2026-11-20T10:00:00Z",
      facts: { ...facts, campaigns: [before] },
    },
    new Date("2026-11-20T12:00:00Z"),
  );
  expect(
    after.signals.some(
      (s) => s.key === "recovered:link-cpc-up" && s.state === "recovered",
    ),
  ).toBe(true);
});
