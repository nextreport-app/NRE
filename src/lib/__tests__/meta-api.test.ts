import { afterEach, describe, expect, it, vi } from "vitest";
import {
  META_ADS_SCOPES,
  buildMetaConnectUrl,
  createMetaDeletionConfirmationCode,
  exchangeForLongLivedToken,
  exchangeMetaAuthCode,
  fetchMetaAdAccountInsights,
  fetchMetaAdAccounts,
  fetchMetaUserProfile,
  formatMetaInsightsErrorMessage,
  metaApiVersion,
  metaGraphBase,
  parseMetaSignedRequest,
  splitIsoDateRangeIntoChunks,
} from "../meta-api";
import { createHmac } from "node:crypto";

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.META_APP_ID;
  delete process.env.META_APP_SECRET;
  delete process.env.META_API_VERSION;
});

describe("META_ADS_SCOPES", () => {
  it("requests read-only ads scopes, not ads_management", () => {
    expect(META_ADS_SCOPES).toEqual(["ads_read", "business_management"]);
    expect(META_ADS_SCOPES).not.toContain("ads_management");
  });
});

describe("metaApiVersion", () => {
  it("defaults to v26.0", () => {
    expect(metaApiVersion()).toBe("v26.0");
    expect(metaGraphBase()).toBe("https://graph.facebook.com/v26.0");
  });

  it("respects META_API_VERSION override", () => {
    process.env.META_API_VERSION = "v25.0";
    expect(metaApiVersion()).toBe("v25.0");
  });
});

describe("buildMetaConnectUrl", () => {
  it("builds a Facebook OAuth URL with ads_read scopes", () => {
    process.env.META_APP_ID = "app-123";
    const url = new URL(buildMetaConnectUrl("https://nextreport.in/api/meta/callback", "state-abc"));
    expect(url.hostname).toBe("www.facebook.com");
    expect(url.searchParams.get("client_id")).toBe("app-123");
    expect(url.searchParams.get("redirect_uri")).toBe("https://nextreport.in/api/meta/callback");
    expect(url.searchParams.get("scope")).toBe("ads_read,business_management");
    expect(url.searchParams.get("state")).toBe("state-abc");
  });
});

describe("exchangeMetaAuthCode", () => {
  it("exchanges an authorization code for tokens", async () => {
    process.env.META_APP_ID = "app-123";
    process.env.META_APP_SECRET = "secret-456";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: "short-token", expires_in: 3600 }),
      }),
    );

    const tokens = await exchangeMetaAuthCode("code-xyz", "https://nextreport.in/api/meta/callback");
    expect(tokens.access_token).toBe("short-token");
  });
});

describe("exchangeForLongLivedToken", () => {
  it("requests fb_exchange_token grant", async () => {
    process.env.META_APP_ID = "app-123";
    process.env.META_APP_SECRET = "secret-456";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "long-token", expires_in: 5184000 }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const tokens = await exchangeForLongLivedToken("short-token");
    expect(tokens.access_token).toBe("long-token");

    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain("grant_type=fb_exchange_token");
    expect(calledUrl).toContain("fb_exchange_token=short-token");
  });
});

describe("fetchMetaUserProfile", () => {
  it("returns id and name from /me", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: "meta-user-1", name: "Reviewer" }),
      }),
    );

    const profile = await fetchMetaUserProfile("token");
    expect(profile).toEqual({ id: "meta-user-1", name: "Reviewer" });
  });
});

describe("fetchMetaAdAccounts", () => {
  it("returns ad account rows from /me/adaccounts", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ id: "act_123", name: "Test Account", account_id: "123", account_status: 1 }],
        }),
      }),
    );

    const accounts = await fetchMetaAdAccounts("token");
    expect(accounts).toHaveLength(1);
    expect(accounts[0].name).toBe("Test Account");
  });
});

describe("parseMetaSignedRequest", () => {
  function signPayload(payload: object, secret: string): string {
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const encodedSig = createHmac("sha256", secret).update(encodedPayload).digest("base64url");
    return `${encodedSig}.${encodedPayload}`;
  }

  it("parses a valid signed_request", () => {
    const secret = "test-secret";
    const signed = signPayload({ user_id: "999", algorithm: "HMAC-SHA256" }, secret);
    const parsed = parseMetaSignedRequest(signed, secret);
    expect(parsed?.user_id).toBe("999");
  });

  it("returns null for invalid signatures", () => {
    const signed = signPayload({ user_id: "999" }, "secret-a");
    expect(parseMetaSignedRequest(signed, "secret-b")).toBeNull();
  });
});

describe("createMetaDeletionConfirmationCode", () => {
  it("includes the Meta user id", () => {
    const code = createMetaDeletionConfirmationCode("meta-42");
    expect(code).toMatch(/^nre-del-meta-42-/);
  });
});

describe("formatMetaInsightsErrorMessage", () => {
  it("replaces Meta's generic unknown error with actionable guidance", () => {
    const message = formatMetaInsightsErrorMessage({ message: "An unknown error occurred", code: 1 });
    expect(message).toContain("Wait a few seconds");
    expect(message).not.toBe("An unknown error occurred");
  });
});

describe("splitIsoDateRangeIntoChunks", () => {
  it("splits a 30-day range into weekly chunks", () => {
    const chunks = splitIsoDateRangeIntoChunks("2026-08-15", "2026-09-13", 7);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]).toEqual({ sinceIso: "2026-08-15", untilIso: "2026-08-21" });
    expect(chunks.at(-1)?.untilIso).toBe("2026-09-13");
  });
});

describe("fetchMetaAdAccountInsights", () => {
  it("retries transient Meta code 1 errors before succeeding", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: { message: "An unknown error occurred", code: 1 } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ campaign_name: "Test", adset_name: "Broad", date_start: "2026-09-01", spend: "10" }],
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const promise = fetchMetaAdAccountInsights({
      accessToken: "token",
      adAccountId: "act_123",
      sinceIso: "2026-09-01",
      untilIso: "2026-09-01",
    });
    await vi.runAllTimersAsync();
    const rows = await promise;

    expect(rows).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("falls back to weekly chunks when the full range keeps failing with code 1", async () => {
    vi.useFakeTimers();
    let fullRangeAttempts = 0;
    const fetchMock = vi.fn(async (url: string) => {
      const parsed = new URL(url);
      const range = JSON.parse(parsed.searchParams.get("time_range") ?? "{}") as {
        since?: string;
        until?: string;
      };

      if (range.since === "2026-09-01" && range.until === "2026-09-14") {
        fullRangeAttempts += 1;
        return {
          ok: false,
          json: async () => ({ error: { message: "An unknown error occurred", code: 1 } }),
        };
      }

      return {
        ok: true,
        json: async () => ({
          data: [
            {
              campaign_name: "Chunked",
              adset_name: "Broad",
              date_start: range.since,
              spend: "5",
            },
          ],
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const promise = fetchMetaAdAccountInsights({
      accessToken: "token",
      adAccountId: "act_123",
      sinceIso: "2026-09-01",
      untilIso: "2026-09-14",
    });
    await vi.runAllTimersAsync();
    const rows = await promise;

    expect(fullRangeAttempts).toBeGreaterThan(0);
    expect(rows.length).toBeGreaterThan(1);
    vi.useRealTimers();
  });
});
