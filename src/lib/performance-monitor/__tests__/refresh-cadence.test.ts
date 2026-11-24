import { describe, expect, it } from "vitest";
import type { OverviewRow } from "../../agency-overview";
import { refreshableChecks, REFRESH_INTERVAL_MS } from "../refresh-queue";
const now = Date.parse("2026-11-24T12:00:00Z");
function row(overrides: Partial<OverviewRow> = {}): OverviewRow {
  return {
    id: "one",
    name: "Client",
    linked: true,
    performanceEnabled: true,
    budgetEnabled: true,
    comparison: { days: 7 },
    performance: {
      checkedAt: new Date(now - REFRESH_INTERVAL_MS).toISOString(),
    },
    budget: { checkedAt: new Date(now - REFRESH_INTERVAL_MS).toISOString() },
    ...overrides,
  } as OverviewRow;
}
describe("visible-screen refresh planner", () => {
  it("refreshes eligible snapshots at five minutes even within the daily freshness window", () => {
    expect(
      refreshableChecks(
        [row({ performanceFresh: true, budgetFresh: true })],
        now,
        new Map(),
      ),
    ).toHaveLength(2);
    expect(refreshableChecks([row()], now - 1, new Map())).toEqual([]);
  });
  it("never enables monitoring or checks an unlinked account", () => {
    expect(
      refreshableChecks(
        [
          row({ linked: false }),
          row({ performanceEnabled: false, budgetEnabled: false }),
        ],
        now,
        new Map(),
      ),
    ).toEqual([]);
  });
  it("leaves custom performance comparisons manual and respects selected account scope", () => {
    const custom = row({
      comparison: {
        days: 7,
        customStart: "2026-11-01",
        customEnd: "2026-11-07",
      },
    });
    expect(
      refreshableChecks([custom], now, new Map()).map((j) => j.kind),
    ).toEqual(["budget-monitor"]);
    expect(
      refreshableChecks([custom], now, new Map(), "one", true),
    ).toHaveLength(2);
    expect(refreshableChecks([row()], now, new Map(), "another", true)).toEqual(
      [],
    );
  });
  it("backs off failed attempts and uses the more recent snapshot or attempt", () => {
    const attempts = new Map([["one:performance-monitor", now]]);
    expect(
      refreshableChecks([row()], now, attempts).map((j) => j.kind),
    ).toEqual(["budget-monitor"]);
    attempts.set("one:budget-monitor", now);
    expect(refreshableChecks([row()], now, attempts, "", true)).toEqual([]);
    expect(
      refreshableChecks([row()], now + REFRESH_INTERVAL_MS, attempts),
    ).toHaveLength(2);
  });
});
