import { beforeEach, describe, it, expect, vi } from "vitest";
vi.mock("../../ga4-api", () => ({
  runGa4Report: vi.fn(),
  fetchGa4PropertyMetadata: vi.fn(),
}));
import { runGa4Report, fetchGa4PropertyMetadata } from "../../ga4-api";
import { fetchWebsiteSnapshot, ga4Number } from "../fetch";
import {
  WEBSITE_METRICS,
  websitePeriods,
  websiteInsights,
  parseWebsiteSnapshot,
  websiteSnapshotFresh,
} from "../model";
const now = new Date("2026-11-20T12:00:00Z");
const current = {
  sessions: 100,
  totalUsers: 80,
  newUsers: 60,
  engagedSessions: 70,
  engagementRate: 0.7,
  bounceRate: 0.3,
  screenPageViews: 150,
  keyEvents: 25,
  sessionKeyEventRate: 0.1,
  averageSessionDuration: 90,
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchGa4PropertyMetadata).mockResolvedValue({
    propertyId: "552954256",
    displayName: "NextReport",
    timezone: "Asia/Kolkata",
    currency: "INR",
  });
  vi.mocked(runGa4Report).mockImplementation(
    async (_token, _property, body) => {
      const metricNames = body.metrics.map((m) => m.name),
        dimensionNames = body.dimensions?.map((d) => d.name) ?? [];
      let values = metricNames.map((name) =>
        String(current[name as keyof typeof current]),
      );
      let dimensions: string[] = [];
      if (dimensionNames[0] === "sessionDefaultChannelGroup") {
        dimensions = ["Organic Search"];
        values = metricNames.map((name) =>
          String(current[name as keyof typeof current]),
        );
      }
      if (dimensionNames[0] === "landingPage") {
        dimensions = ["/pricing"];
        values = metricNames.map((name) =>
          String(current[name as keyof typeof current]),
        );
      }
      if (dimensionNames[0] === "date") {
        dimensions = ["20261119"];
        values = metricNames.map((name) =>
          String(current[name as keyof typeof current]),
        );
      }
      return {
        metricHeaders: metricNames.map((name) => ({ name })),
        dimensionHeaders: dimensionNames.map((name) => ({ name })),
        rows: [
          {
            dimensionValues: dimensions.map((value) => ({ value })),
            metricValues: values.map((value) => ({ value })),
          },
        ],
        rowCount: 1,
      };
    },
  );
});
describe("GA4 data contracts", () => {
  it("reads period metrics from rows, not absent totals, in property timezone", async () => {
    const s = await fetchWebsiteSnapshot("token", "552954256", 7, now);
    expect(s.current).toEqual(current);
    expect(s.property.timezone).toBe("Asia/Kolkata");
    expect(s.currentPeriod).toEqual({
      startIso: "2026-11-13",
      endIso: "2026-11-19",
    });
    expect(s.channels[0].name).toBe("Organic Search");
    expect(s.pages[0].name).toBe("/pricing");
    expect(s.current.sessionKeyEventRate).toBe(0.1);
    expect(s.current.keyEvents! / s.current.sessions!).toBe(0.25);
  });
  it("keeps each request within ten metrics and excludes landing query strings", async () => {
    await fetchWebsiteSnapshot("token", "552954256", 30, now);
    for (const call of vi.mocked(runGa4Report).mock.calls) {
      expect(call[2].metrics.length).toBeLessThanOrEqual(10);
      expect(
        call[2].dimensions?.some(
          (d) => d.name === "landingPagePlusQueryString",
        ),
      ).not.toBe(true);
    }
  });
  it("keeps missing metric values unavailable", async () => {
    vi.mocked(runGa4Report).mockResolvedValue({
      metricHeaders: WEBSITE_METRICS.map((name) => ({ name })),
      rows: [{ metricValues: [] }],
    });
    await expect(
      fetchWebsiteSnapshot("token", "552954256", 7, now),
    ).rejects.toThrow("headers");
    expect(ga4Number("")).toBeNull();
    expect(ga4Number("not set")).toBeNull();
    expect(ga4Number("0")).toBe(0);
  });
  it("does not silently turn an invalid response into zero traffic", async () => {
    vi.mocked(runGa4Report).mockResolvedValue({});
    await expect(
      fetchWebsiteSnapshot("token", "552954256", 7, now),
    ).rejects.toThrow("headers");
  });
  it("suppresses confident interpretations when GA4 reports thresholds", async () => {
    const original = vi.mocked(runGa4Report).getMockImplementation()!;
    vi.mocked(runGa4Report).mockImplementation(async (...args) => ({
      ...(await original(...args)),
      metadata: { subjectToThresholding: true },
    }));
    const s = await fetchWebsiteSnapshot("token", "552954256", 7, now);
    expect(s.warnings).toHaveLength(1);
    expect(websiteInsights(s)).toEqual([
      expect.stringContaining("data-quality limits"),
    ]);
  });
  it("keeps channel pages complete instead of truncating to top channels", async () => {
    const original = vi.mocked(runGa4Report).getMockImplementation()!;
    vi.mocked(runGa4Report).mockImplementation(async (...args) => {
      const r = await original(...args);
      if (args[2].dimensions?.[0]?.name !== "sessionDefaultChannelGroup")
        return r;
      return {
        ...r,
        rowCount: 101,
        rows:
          args[2].offset === 100
            ? [
                {
                  dimensionValues: [{ value: "Unassigned" }],
                  metricValues: args[2].metrics.map(() => ({ value: "1" })),
                },
              ]
            : Array.from({ length: 100 }, (_, i) => ({
                dimensionValues: [{ value: `Channel ${i}` }],
                metricValues: args[2].metrics.map(() => ({ value: "1" })),
              })),
      };
    });
    const s = await fetchWebsiteSnapshot("token", "552954256", 7, now);
    expect(s.channels).toHaveLength(101);
    expect(s.channels[100].name).toBe("Unassigned");
  });
});
describe("calendar and summary", () => {
  it("uses the GA4 local day across year boundaries", () =>
    expect(
      websitePeriods(7, "Asia/Kolkata", new Date("2026-12-31T20:00Z")),
    ).toEqual({
      currentPeriod: { startIso: "2026-12-25", endIso: "2026-12-31" },
      previousPeriod: { startIso: "2026-12-18", endIso: "2026-12-24" },
    }));
  it("compares rates in percentage points, not event count/session ratios", async () => {
    const s = await fetchWebsiteSnapshot("token", "552954256", 7, now);
    s.previous.engagementRate = 0.5;
    expect(websiteInsights(s)).toContain(
      "Engagement rate increased by 20.0 percentage points.",
    );
    expect(websiteInsights(s).join(" ")).not.toContain("25%");
  });
  it("invalidates old periods and wrong properties in cached data", async () => {
    const s = await fetchWebsiteSnapshot("token", "552954256", 7, now);
    s.checkedAt = now.toISOString();
    expect(websiteSnapshotFresh(s, now)).toBe(true);
    expect(websiteSnapshotFresh(s, new Date("2026-11-21T12:00Z"))).toBe(false);
    expect(parseWebsiteSnapshot(JSON.stringify(s), "wrong", 7)).toBeNull();
    expect(parseWebsiteSnapshot(JSON.stringify(s), "552954256", 30)).toBeNull();
  });
});

it("rejects daily rows outside the requested reporting window", async () => {
  const original = vi.mocked(runGa4Report).getMockImplementation()!;
  vi.mocked(runGa4Report).mockImplementation(async (...args) => {
    const r = await original(...args);
    if (args[2].dimensions?.[0]?.name !== "date") return r;
    return {
      ...r,
      rows: r.rows?.map((row) => ({
        ...row,
        dimensionValues: [{ value: "20260101" }],
      })),
    };
  });
  await expect(
    fetchWebsiteSnapshot("token", "552954256", 7, now),
  ).rejects.toThrow("outside");
});
it("rejects duplicate channel rows instead of displaying duplicated delivery", async () => {
  const original = vi.mocked(runGa4Report).getMockImplementation()!;
  vi.mocked(runGa4Report).mockImplementation(async (...args) => {
    const r = await original(...args);
    return args[2].dimensions?.[0]?.name === "sessionDefaultChannelGroup"
      ? { ...r, rowCount: 2, rows: [r.rows![0], r.rows![0]] }
      : r;
  });
  await expect(
    fetchWebsiteSnapshot("token", "552954256", 7, now),
  ).rejects.toThrow("duplicate channel");
});

it("does not call unchanged values an increase or round a small decline into zero", async () => {
  const s = await fetchWebsiteSnapshot("token", "552954256", 7, now);
  s.previous.sessions = s.current.sessions;
  s.previous.engagementRate = 0.7001;
  const copy = websiteInsights(s).join(" ");
  expect(copy).toContain("Sessions were unchanged");
  expect(copy).toContain("decreased by less than 0.1 percentage points");
  expect(copy).not.toContain("-0.0");
});

it("fetches prior-period channels separately and keeps their values distinct", async () => {
  const original = vi.mocked(runGa4Report).getMockImplementation()!;
  vi.mocked(runGa4Report).mockImplementation(async (...args) => {
    const response = await original(...args);
    if (
      args[2].dimensions?.[0]?.name === "sessionDefaultChannelGroup" &&
      args[2].dateRanges[0].endDate === "2026-11-12"
    ) {
      const index = args[2].metrics.findIndex((m) => m.name === "sessions");
      response.rows![0].metricValues![index].value = "40";
    }
    return response;
  });
  const snapshot = await fetchWebsiteSnapshot("token", "552954256", 7, now);
  expect(snapshot.channels[0].sessions).toBe(100);
  expect(snapshot.previousChannels?.[0].sessions).toBe(40);
  const calls = vi
    .mocked(runGa4Report)
    .mock.calls.filter(
      (c) => c[2].dimensions?.[0]?.name === "sessionDefaultChannelGroup",
    );
  expect(calls).toHaveLength(2);
  expect(calls.map((c) => c[2].dateRanges[0])).toEqual(
    expect.arrayContaining([
      { startDate: "2026-11-13", endDate: "2026-11-19" },
      { startDate: "2026-11-06", endDate: "2026-11-12" },
    ]),
  );
});
it("applies prior-only data-quality notices to the whole comparison", async () => {
  const original = vi.mocked(runGa4Report).getMockImplementation()!;
  vi.mocked(runGa4Report).mockImplementation(async (...args) => {
    const response = await original(...args);
    return args[2].dimensions?.[0]?.name === "sessionDefaultChannelGroup" &&
      args[2].dateRanges[0].endDate === "2026-11-12"
      ? { ...response, metadata: { subjectToThresholding: true } }
      : response;
  });
  const snapshot = await fetchWebsiteSnapshot("token", "552954256", 7, now);
  expect(snapshot.warnings).toContain(
    "GA4 privacy thresholds may limit reported data.",
  );
});
it("rejects duplicate rows only present in prior channels", async () => {
  const original = vi.mocked(runGa4Report).getMockImplementation()!;
  vi.mocked(runGa4Report).mockImplementation(async (...args) => {
    const response = await original(...args);
    return args[2].dimensions?.[0]?.name === "sessionDefaultChannelGroup" &&
      args[2].dateRanges[0].endDate === "2026-11-12"
      ? {
          ...response,
          rowCount: 2,
          rows: [response.rows![0], response.rows![0]],
        }
      : response;
  });
  await expect(
    fetchWebsiteSnapshot("token", "552954256", 7, now),
  ).rejects.toThrow("duplicate channel");
});

it("keeps per-snapshot GA4 concurrency at five after adding prior channels", async () => {
  const original = vi.mocked(runGa4Report).getMockImplementation()!;
  let active = 0,
    max = 0;
  vi.mocked(runGa4Report).mockImplementation(async (...args) => {
    active++;
    max = Math.max(max, active);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1));
      return await original(...args);
    } finally {
      active--;
    }
  });
  await fetchWebsiteSnapshot("token", "552954256", 7, now);
  expect(max).toBeLessThanOrEqual(5);
  expect(
    vi
      .mocked(runGa4Report)
      .mock.calls.filter(
        (c) => c[2].dimensions?.[0]?.name === "sessionDefaultChannelGroup",
      ),
  ).toHaveLength(2);
});
