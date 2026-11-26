import { describe, expect, it } from "vitest";
import { isMeaningfulImprovement } from "../meaningful-improvement";
import { decisionSignals } from "../decision";
import type { CampaignPerformance, PerformanceSignal } from "../facts";
const metrics = {
  spend: 100,
  impressions: 10000,
  clicks: 200,
  ctr: 2,
  cpc: 0.5,
  results: 10,
  cpr: 10,
};
const campaign = (
  overrides: Partial<CampaignPerformance> = {},
): CampaignPerformance => ({
  id: "1",
  name: "Campaign",
  objective: "WEBSITE LEADS",
  costLabel: "Cost per website lead",
  comparableResults: true,
  current: metrics,
  previous: metrics,
  signals: [],
  ...overrides,
});
const signal = (key: string, change: number | null): PerformanceSignal => ({
  key,
  change,
  metric: key,
  message: "",
  tone: "positive",
  role: "primary",
  state: "continuing",
});
describe("meaningful dashboard improvements", () => {
  it.each([
    "target-met",
    "results-resumed",
    "recovered:cpr-up",
    "recovered:ctr-down",
  ])("does not celebrate target compliance or recovery (%s)", (key) => {
    expect(isMeaningfulImprovement(campaign(), signal(key, null))).toBe(false);
  });
  it.each([
    ["cpr-down", -20, true],
    ["cpr-down", -19.9, false],
    ["results-up", 25, true],
    ["results-up", 24.9, false],
    ["ctr-up", 30, true],
    ["ctr-up", 29.9, false],
    ["cpc-down", -25, true],
    ["link-cpc-down", -25, true],
    ["cpc-down", -24.9, false],
  ] as const)(
    "requires a substantial %s change (%s)",
    (key, change, qualifies) => {
      expect(isMeaningfulImprovement(campaign(), signal(key, change))).toBe(
        qualifies,
      );
    },
  );
  it("requires stable primary outcomes before celebrating click metrics", () => {
    expect(
      isMeaningfulImprovement(
        campaign({ current: { ...metrics, results: 8 } }),
        signal("ctr-up", 50),
      ),
    ).toBe(false);
    expect(
      isMeaningfulImprovement(
        campaign({ current: { ...metrics, cpr: 12 } }),
        signal("cpc-down", -40),
      ),
    ).toBe(false);
    expect(
      isMeaningfulImprovement(
        campaign({ comparableResults: false }),
        signal("ctr-up", 50),
      ),
    ).toBe(false);
  });
  it("does not celebrate a campaign with a primary warning", () => {
    const warning: PerformanceSignal = {
      ...signal("results-down", -40),
      tone: "warning",
    };
    expect(
      isMeaningfulImprovement(
        campaign({ signals: [warning] }),
        signal("cpr-down", -30),
      ),
    ).toBe(false);
  });
  it("retains substantial purchase ROAS gains only for purchase objectives", () => {
    expect(
      isMeaningfulImprovement(
        campaign({ objective: "PURCHASES" }),
        signal("roas-up", 25),
      ),
    ).toBe(true);
    expect(isMeaningfulImprovement(campaign(), signal("roas-up", 25))).toBe(
      false,
    );
  });
  it("filters the real decision signals without inventing improvement evidence", () => {
    const c = campaign({
      current: { ...metrics, spend: 160, results: 20, cpr: 8 },
    });
    c.signals = decisionSignals(c.current, c.previous, true, {
      objective: c.objective,
    });
    expect(
      c.signals.filter((s) => isMeaningfulImprovement(c, s)).map((s) => s.key),
    ).toEqual(["cpr-down", "results-up"]);
  });
});
