import { describe, it, expect } from "vitest";
import {
  trafficChanges,
  websiteChanges,
  relativeChange,
  channelComparisons,
} from "../changes";
import type { WebsiteSnapshot } from "../model";
const b = {
  sessions: 1000,
  engagementRate: 0.6,
  keyEvents: 50,
  sessionKeyEventRate: 0.05,
};
const base = {
  version: 1,
  days: 7,
  property: {
    propertyId: "552954256",
    displayName: "Any website",
    timezone: "Asia/Kolkata",
    currency: "INR",
  },
  checkedAt: "2026-11-20T12:00:00Z",
  currentPeriod: { startIso: "2026-11-13", endIso: "2026-11-19" },
  previousPeriod: { startIso: "2026-11-06", endIso: "2026-11-12" },
  current: {
    ...b,
    totalUsers: 800,
    newUsers: 700,
    engagedSessions: 600,
    screenPageViews: 1400,
    bounceRate: 0.4,
    averageSessionDuration: 90,
  },
  previous: {
    ...b,
    totalUsers: 800,
    newUsers: 700,
    engagedSessions: 600,
    screenPageViews: 1400,
    bounceRate: 0.4,
    averageSessionDuration: 90,
  },
  channels: [],
  previousChannels: [],
  pages: [],
  trend: [],
  warnings: [],
  empty: false,
} satisfies WebsiteSnapshot;
describe("website change interpretation", () => {
  it("uses percentage points for rates and percentages for session volume", () => {
    const change = trafficChanges(
      {
        ...b,
        sessions: 1300,
        engagementRate: 0.7,
        sessionKeyEventRate: 0.07,
        keyEvents: 100,
      },
      b,
    );
    expect(change.state).toBe("positive");
    expect(change.signals.find((s) => s.key === "key-rate-up")).toMatchObject({
      unit: "points",
      change: expect.closeTo(2, 8),
    });
    expect(change.signals.find((s) => s.key === "sessions-up")).toMatchObject({
      unit: "percent",
      change: expect.closeTo(30, 8),
    });
  });
  it("does not call traffic growth a business success when key-event performance declines", () => {
    const c = trafficChanges(
      { ...b, sessions: 1300, keyEvents: 13, sessionKeyEventRate: 0.01 },
      b,
    );
    expect(c.state).toBe("mixed");
    expect(c.signals.some((s) => s.key === "key-rate-down")).toBe(true);
    expect(c.signals.some((s) => s.key === "sessions-up")).toBe(true);
  });
  it("flags reported zero key-event sessions with continued volume without diagnosing tracking", () => {
    const c = trafficChanges({ ...b, keyEvents: 0, sessionKeyEventRate: 0 }, b);
    expect(c.state).toBe("review");
    expect(
      c.signals.find((s) => s.key === "key-events-stopped")?.note,
    ).not.toMatch(/pixel.*broken|tracking.*broken|landing.*poor/i);
  });
  it("does not treat zero/missing baselines as infinite percentages", () => {
    expect(relativeChange(100, 0)).toBeNull();
    expect(relativeChange(0, 0)).toBeNull();
    expect(relativeChange(null, 100)).toBeNull();
    expect(relativeChange(0, 100)).toBe(-100);
  });
  it("requires enough evidence before describing stable or positive rates", () => {
    expect(
      trafficChanges(
        { ...b, sessions: 20, keyEvents: 1 },
        { ...b, sessions: 20, keyEvents: 1 },
      ).state,
    ).toBe("insufficient");
    expect(trafficChanges({ ...b, engagementRate: null }, b).state).toBe(
      "insufficient",
    );
    expect(trafficChanges(b, b).state).toBe("neutral");
  });
  it("does not describe growth as a positive session signal when engagement substantially declines", () => {
    const c = trafficChanges({ ...b, sessions: 1400, engagementRate: 0.4 }, b);
    expect(c.signals.some((s) => s.key === "sessions-up")).toBe(false);
    expect(c.state).toBe("review");
  });
  it("suppresses confident signals for restricted and stale snapshots", () => {
    const snapshot = { ...base, current: { ...base.current, sessions: 1500 } };
    expect(websiteChanges(snapshot, false)).toMatchObject({
      state: "refresh",
      signals: [],
    });
    expect(
      websiteChanges({ ...snapshot, warnings: ["Privacy threshold"] }, true),
    ).toMatchObject({ state: "limited", signals: [] });
  });
});
describe("channel comparison evidence", () => {
  const channel = (name: string, sessions: number | null) => ({
    name,
    sessions,
    engagedSessions: 600,
    engagementRate: 0.6,
    keyEvents: 50,
    sessionKeyEventRate: 0.05,
  });
  it("unions paid, organic, direct and prior-only rows without inventing zero baselines", () => {
    const rows = channelComparisons({
      ...base,
      channels: [channel("Organic Search", 200), channel("Paid Social", 100)],
      previousChannels: [
        channel("Organic Search", 100),
        channel("Direct", 300),
      ],
    });
    expect(rows.find((r) => r.name === "Organic Search")).toMatchObject({
      change: 100,
      availability: null,
    });
    expect(rows.find((r) => r.name === "Paid Social")).toMatchObject({
      previous: null,
      change: null,
      availability: "Only current period",
    });
    expect(rows.find((r) => r.name === "Direct")).toMatchObject({
      current: null,
      change: null,
      availability: "Only previous period",
    });
  });
  it("preserves missing metrics and explicit zero as different states", () => {
    const rows = channelComparisons({
      ...base,
      channels: [channel("Direct", 0), channel("Referral", 10)],
      previousChannels: [channel("Direct", 100), channel("Referral", null)],
    });
    expect(rows.find((r) => r.name === "Direct")?.change).toBe(-100);
    expect(rows.find((r) => r.name === "Referral")?.change).toBeNull();
  });
  it("keeps legacy cached channels readable while requiring a refresh for previous channels", () => {
    const old = {
      ...base,
      channels: [channel("Organic Search", 100)],
      previousChannels: undefined,
    };
    expect(channelComparisons(old)[0]).toMatchObject({
      change: null,
      previous: null,
      availability: "Previous data not loaded",
    });
  });
  it("ranks known absolute session changes before unknown comparison rows", () => {
    const rows = channelComparisons({
      ...base,
      channels: [channel("New", 10000), channel("Organic", 200)],
      previousChannels: [channel("Organic", 100)],
    });
    expect(rows[0].name).toBe("Organic");
  });
});

it("does not assess event-rate performance from multiple key events in just one session", () => {
  const a = { ...b, keyEvents: 50, sessionKeyEventRate: 0.001 },
    prior = { ...b, keyEvents: 50, sessionKeyEventRate: 0.002 };
  expect(
    trafficChanges(a, prior).signals.some((s) => s.key.startsWith("key-rate")),
  ).toBe(false);
  expect(trafficChanges(a, prior).state).toBe("insufficient");
});
it("does not call missing key-event counts neutral", () => {
  expect(
    trafficChanges({ ...b, keyEvents: null }, { ...b, keyEvents: null }).state,
  ).toBe("insufficient");
});
