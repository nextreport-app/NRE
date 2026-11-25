import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import {
  buildGscConnectUrl,
  GSC_SCOPE,
  isGscConfigured,
  listGscSites,
  queryGsc,
  refreshGscToken,
  gscSiteSchema,
} from "../api";
import { gscPeriods, gscDateBounds, formatGscMetric } from "../model";
const now = new Date("2026-11-25T02:00:00Z");
beforeEach(() => {
  vi.stubEnv("GSC_CLIENT_ID", "gsc-id");
  vi.stubEnv("GSC_CLIENT_SECRET", "gsc-secret");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("Search Console calendars", () => {
  it("clamps month-end retention dates instead of overflowing into another month", () => {
    expect(gscDateBounds(new Date("2026-03-31T18:00:00Z")).minDate).toBe(
      "2024-11-30",
    );
  });
  it("uses Pacific dates, a three-day lag and preceding equal periods", () => {
    expect(gscDateBounds(now).maxDate).toBe("2026-11-21");
    expect(gscPeriods(7, now)).toMatchObject({
      current: { startIso: "2026-11-15", endIso: "2026-11-21" },
      previous: { startIso: "2026-11-08", endIso: "2026-11-14" },
      days: 7,
    });
    expect(gscPeriods(30, now).days).toBe(30);
  });
  it.each([
    { startIso: "2026-11-22", endIso: "2026-11-24" },
    { startIso: "2020-01-01", endIso: "2020-01-07" },
    { startIso: "2026-11-10", endIso: "2026-11-01" },
    { startIso: "2026-02-30", endIso: "2026-03-03" },
  ])("rejects unavailable/invalid custom dates %s", (range) => {
    expect(() => gscPeriods(range, now)).toThrow();
  });
  it("preserves a custom period and its exact previous window", () => {
    expect(
      gscPeriods({ startIso: "2026-10-01", endIso: "2026-10-10" }, now),
    ).toMatchObject({
      days: 10,
      rangeKey: "2026-10-01:2026-10-10",
      previous: { startIso: "2026-09-21", endIso: "2026-09-30" },
    });
  });
  it("formats missing rankings without inventing zero rank", () => {
    expect(formatGscMetric("position", null)).toBe("—");
    expect(formatGscMetric("ctr", 0.1234)).toBe("12.34%");
  });
});
describe("read-only Google API", () => {
  it("requests its own read-only scope with account selection and PKCE", () => {
    const url = new URL(
      buildGscConnectUrl(
        "https://app.test/api/gsc/callback",
        "nonce",
        "challenge",
      ),
    );
    expect(url.searchParams.get("scope")).toContain(GSC_SCOPE);
    expect(url.searchParams.get("scope")).not.toContain("analytics.readonly");
    expect(url.searchParams.get("prompt")).toBe("consent select_account");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("state")).toBe("nonce");
  });
  it("does not combine mismatched OAuth client/secret pairs", () => {
    vi.stubEnv("GSC_CLIENT_SECRET", "");
    vi.stubEnv("GA4_CLIENT_ID", "");
    vi.stubEnv("GA4_CLIENT_SECRET", "another-secret");
    vi.stubEnv("GOOGLE_ADS_CLIENT_ID", "");
    vi.stubEnv("GOOGLE_ADS_CLIENT_SECRET", "");
    expect(isGscConfigured()).toBe(false);
  });
  it("lists URL-prefix/domain sites but excludes unverified access", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          siteEntry: [
            { siteUrl: "sc-domain:example.com", permissionLevel: "siteOwner" },
            {
              siteUrl: "https://example.com/blog/",
              permissionLevel: "siteRestrictedUser",
            },
            {
              siteUrl: "https://unverified.test/",
              permissionLevel: "siteUnverifiedUser",
            },
          ],
        }),
      ),
    );
    expect(await listGscSites("private-token")).toHaveLength(2);
    expect(gscSiteSchema.safeParse("javascript:alert(1)").success).toBe(false);
    expect(gscSiteSchema.safeParse("sc-domain:例子.测试").success).toBe(true);
    expect(
      gscSiteSchema.safeParse("https://user:pass@example.com").success,
    ).toBe(false);
  });
  it("encodes site identifiers on a fixed Google host and only asks for final web data", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({}));
    vi.stubGlobal("fetch", fetch);
    expect(
      await queryGsc(
        "token",
        "sc-domain:example.com",
        "2026-11-01",
        "2026-11-10",
        ["query"],
        20,
      ),
    ).toEqual([]);
    const [url, request] = fetch.mock.calls[0];
    expect(url).toBe(
      "https://www.googleapis.com/webmasters/v3/sites/sc-domain%3Aexample.com/searchAnalytics/query",
    );
    expect(JSON.parse(request.body)).toMatchObject({
      type: "web",
      dataState: "final",
      rowLimit: 20,
      dimensions: ["query"],
    });
  });
  it("fails closed for malformed returned dimensions", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          rows: [{ clicks: 1, impressions: 3, ctr: 0.333, position: 2 }],
        }),
      ),
    );
    await expect(
      queryGsc(
        "t",
        "https://example.com/",
        "2026-11-01",
        "2026-11-10",
        ["page"],
        20,
      ),
    ).rejects.toThrow("dimensions");
  });
  it.each([401, 403, 404, 429, 500])(
    "returns safe actionable diagnostics for HTTP %s",
    async (status) => {
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValue(
            Response.json(
              { error: { message: "private provider payload" } },
              { status },
            ),
          ),
      );
      await expect(
        queryGsc(
          "private-token",
          "https://example.com/",
          "2026-11-01",
          "2026-11-10",
          [],
          1,
        ),
      ).rejects.toThrow(`GSC_HTTP_${status}`);
    },
  );
  it("recognizes disabled APIs without asking users to relink their site", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json(
            { error: { details: [{ reason: "SERVICE_DISABLED" }] } },
            { status: 403 },
          ),
        ),
    );
    await expect(listGscSites("token")).rejects.toThrow("disabled");
  });
  it("never falls back to an old access token after authorization fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ error: "invalid_grant" }, { status: 400 }),
        ),
    );
    await expect(refreshGscToken("secret")).rejects.toThrow(
      "expired or was revoked",
    );
  });
});

it("treats Google's HTTP 403 quota responses as retryable limits, not site permission failures", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        Response.json(
          { error: { errors: [{ reason: "userRateLimitExceeded" }] } },
          { status: 403 },
        ),
      ),
  );
  await expect(listGscSites("private-token")).rejects.toMatchObject({
    status: 429,
    retryAfter: 300,
    message: expect.stringContaining("GSC_QUOTA_403"),
  });
});
