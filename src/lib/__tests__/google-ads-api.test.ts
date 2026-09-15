import { afterEach, describe, expect, it, vi } from "vitest";
import { isGoogleAdsApiConfigured } from "../integrations-config";
import {
  formatGoogleAdsErrorMessage,
  googleAdsDeveloperToken,
  isGoogleAdsOAuthConfigured,
  isRetryableGoogleAdsError,
  searchGoogleAds,
} from "../google-ads-api";

describe("googleAdsDeveloperToken", () => {
  afterEach(() => {
    delete process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  });

  it("returns undefined when unset or blank", () => {
    expect(googleAdsDeveloperToken()).toBeUndefined();
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN = "   ";
    expect(googleAdsDeveloperToken()).toBeUndefined();
  });

  it("returns trimmed token when set", () => {
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN = "  abc123  ";
    expect(googleAdsDeveloperToken()).toBe("abc123");
  });
});

describe("isGoogleAdsOAuthConfigured", () => {
  afterEach(() => {
    delete process.env.GOOGLE_ADS_CLIENT_ID;
    delete process.env.GOOGLE_ADS_CLIENT_SECRET;
    delete process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  });

  it("is true with OAuth client only — developer token not required", () => {
    process.env.GOOGLE_ADS_CLIENT_ID = "client-id";
    process.env.GOOGLE_ADS_CLIENT_SECRET = "client-secret";
    expect(isGoogleAdsOAuthConfigured()).toBe(true);
  });

  it("is false without client id or secret", () => {
    process.env.GOOGLE_ADS_CLIENT_SECRET = "secret";
    expect(isGoogleAdsOAuthConfigured()).toBe(false);
  });
});

describe("isRetryableGoogleAdsError", () => {
  it("treats 429 and 5xx as retryable", () => {
    expect(isRetryableGoogleAdsError({ message: "rate limit", httpStatus: 429 })).toBe(true);
    expect(isRetryableGoogleAdsError({ message: "server error", httpStatus: 503 })).toBe(true);
    expect(isRetryableGoogleAdsError({ message: "bad request", httpStatus: 400 })).toBe(false);
  });

  it("treats transient Google statuses as retryable", () => {
    expect(isRetryableGoogleAdsError({ message: "internal", status: "INTERNAL" })).toBe(true);
    expect(isRetryableGoogleAdsError({ message: "quota", status: "RESOURCE_EXHAUSTED" })).toBe(true);
  });
});

describe("formatGoogleAdsErrorMessage", () => {
  it("returns actionable copy for rate limits", () => {
    const message = formatGoogleAdsErrorMessage({ message: "Quota exceeded", httpStatus: 429 });
    expect(message).toContain("rate limit");
  });
});

describe("searchGoogleAds", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.GOOGLE_ADS_API_VERSION;
  });

  it("retries transient 503 errors before succeeding", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: async () => JSON.stringify({ error: { message: "Unavailable", status: "UNAVAILABLE" } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{ campaign: { name: "Test" }, segments: { date: "2026-09-01" }, metrics: { impressions: "1" } }],
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const promise = searchGoogleAds({
      accessToken: "token",
      customerId: "1234567890",
      query: "SELECT campaign.name FROM campaign",
    });
    await vi.runAllTimersAsync();
    const rows = await promise;

    expect(rows).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});

describe("isGoogleAdsApiConfigured", () => {
  afterEach(() => {
    delete process.env.GOOGLE_ADS_CLIENT_ID;
    delete process.env.GOOGLE_ADS_CLIENT_SECRET;
    delete process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  });

  it("matches OAuth client check — developer token not required", () => {
    process.env.GOOGLE_ADS_CLIENT_ID = "client-id";
    process.env.GOOGLE_ADS_CLIENT_SECRET = "client-secret";
    expect(isGoogleAdsApiConfigured()).toBe(true);
    expect(isGoogleAdsOAuthConfigured()).toBe(true);
  });
});
