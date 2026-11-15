import { afterEach, describe, expect, it, vi } from "vitest";
import {
  META_ADS_SCOPES,
  buildMetaConnectUrl,
  createMetaDeletionConfirmationCode,
  exchangeForLongLivedToken,
  exchangeMetaAuthCode,
  fetchMetaAdAccountInsights,
  fetchMetaAdSetInstantFormIds,
  fetchMetaAdSetInstantFormDestinations,
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
    expect(META_ADS_SCOPES).toEqual(["ads_read"]);
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
    expect(url.searchParams.get("scope")).toBe("ads_read");
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

describe("Meta read credential boundaries", () => {
  it("paginates accounts, strips URL tokens and adds app-secret proof", async () => {
    process.env.META_APP_SECRET = "test-app-secret";
    const fetchMock = vi.fn().mockResolvedValueOnce({ok:true,json:async()=>({data:[{id:"act_1",name:"First"}],paging:{next:"https://graph.facebook.com/v26.0/me/adaccounts?after=next&access_token=leaked-url-token"}})}).mockResolvedValueOnce({ok:true,json:async()=>({data:[{id:"act_2",name:"Second"}]})});
    vi.stubGlobal("fetch",fetchMock);
    expect(await fetchMetaAdAccounts("private-token")).toHaveLength(2);
    for(const [url,init] of fetchMock.mock.calls){expect(url).not.toContain("access_token=");expect(url).not.toContain("private-token");expect(url).toContain("appsecret_proof=");expect(init.headers.Authorization).toBe("Bearer private-token");expect(init.method).toBe("GET");expect(init.cache).toBe("no-store");}
  });
  it("rejects cross-origin pagination before forwarding credentials", async () => {
    const fetchMock=vi.fn().mockResolvedValue({ok:true,json:async()=>({data:[],paging:{next:"https://untrusted.example/collect?access_token=token"}})});
    vi.stubGlobal("fetch",fetchMock);await expect(fetchMetaAdAccounts("private-token")).rejects.toThrow(/Invalid Meta/);expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("does not expose raw OAuth errors or provider tokens in exceptions", async () => {
    process.env.META_APP_ID="app";process.env.META_APP_SECRET="secret";
    vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:false,status:400,text:async()=>"access_token=private-token"}));
    await expect(exchangeMetaAuthCode("code","https://nextreport.in/api/meta/callback")).rejects.toThrow("Could not connect to Meta");
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

  it("fetches multi-week ranges in weekly chunks (avoids one slow 30-day insights call)", async () => {
    vi.useFakeTimers();
    const ranges: string[] = [];
    const fetchMock = vi.fn(async (url: string) => {
      const parsed = new URL(url);
      const range = JSON.parse(parsed.searchParams.get("time_range") ?? "{}") as {
        since?: string;
        until?: string;
      };
      ranges.push(`${range.since}:${range.until}`);

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

    expect(ranges.some((r) => r.startsWith("2026-09-01:2026-09-07"))).toBe(true);
    expect(ranges.some((r) => r.startsWith("2026-09-08:2026-09-14"))).toBe(true);
    expect(rows.length).toBeGreaterThan(1);
    vi.useRealTimers();
  });

  it("uses smaller windows for ad-set level sync", async () => {
    const ranges: string[] = [];
    const fetchMock = vi.fn(async (url: string) => {
      const parsed = new URL(url);
      const range = JSON.parse(parsed.searchParams.get("time_range") ?? "{}") as {
        since?: string;
        until?: string;
      };
      ranges.push(`${range.since}:${range.until}`);
      return {
        ok: true,
        json: async () => ({
          data: [{ campaign_name: "A", adset_name: "B", date_start: range.since, spend: "1" }],
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    await fetchMetaAdAccountInsights({
      accessToken: "token",
      adAccountId: "act_123",
      sinceIso: "2026-09-01",
      untilIso: "2026-09-12",
      level: "adset",
    });

    expect(ranges).toContain("2026-09-01:2026-09-05");
    expect(ranges).toContain("2026-09-06:2026-09-10");
    expect(ranges).toContain("2026-09-11:2026-09-12");
  });
});

describe("strict wizard insight source contract", () => {
  it("keeps action-only fields and attribution settings across chunks and pagination", async () => {
    const urls: URL[] = [];
    vi.stubGlobal("fetch", vi.fn(async (rawUrl: string) => {
      const url = new URL(rawUrl); urls.push(url);
      const range = JSON.parse(url.searchParams.get("time_range")!);
      if (range.since === "2026-10-01" && !url.searchParams.has("after")) {
        const next = new URL(url); next.searchParams.set("after", "next-page");
        return new Response(JSON.stringify({ data: [], paging: { next: next.toString() } }));
      }
      return new Response(JSON.stringify({ data: [] }));
    }));
    await fetchMetaAdAccountInsights({ accessToken: "fixture-token", adAccountId: "123", sinceIso: "2026-10-01", untilIso: "2026-10-12", level: "adset", includeResultChannels: false });
    expect(urls).toHaveLength(4);
    for (const url of urls) {
      const fields = url.searchParams.get("fields")!.split(",");
      expect(fields).toContain("actions"); expect(fields).toContain("spend"); expect(fields).toContain("clicks");
      for (const field of ["results", "objective_results", "cost_per_result", "cost_per_objective_result"]) expect(fields).not.toContain(field);
      expect(url.searchParams.get("use_unified_attribution_setting")).toBe("true");
      expect(url.searchParams.get("fields")?.split(",")).toContain("conversions");
      expect(url.searchParams.get("action_report_time")).toBe("impression");
      expect(url.searchParams.get("time_increment")).toBe("1");
      expect(url.searchParams.has("access_token")).toBe(false);
    }
  });
  it("retains the legacy result fields for existing non-wizard callers", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [] }))); vi.stubGlobal("fetch", fetch);
    await fetchMetaAdAccountInsights({ accessToken: "fixture-token", adAccountId: "123", sinceIso: "2026-10-01", untilIso: "2026-10-01" });
    expect(new URL(fetch.mock.calls[0][0]).searchParams.get("fields")!.split(",")).toContain("results");
  });
});

describe("form evidence request isolation", () => {
  it.each(["destination", "conversion_destination", "attribution"] as const)("builds a minimal %s query scoped to the failed ad set", async kind => {
    const provider = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [] })));
    vi.stubGlobal("fetch", provider);
    await fetchMetaAdAccountInsights({ accessToken: "fixture-secret", adAccountId: "123", sinceIso: "2026-10-24", untilIso: "2026-10-24", level: "adset", formEvidence: { kind, adSetId: "20" } });
    const url = new URL(provider.mock.calls[0][0]);
    expect(JSON.parse(url.searchParams.get("filtering")!)).toEqual([{ field: "adset.id", operator: "IN", value: ["20"] }]);
    expect(JSON.parse(url.searchParams.get("action_breakdowns")!)).toEqual(kind === "attribution" ? ["action_type"] : ["action_type", kind === "destination" ? "action_destination" : "conversion_destination"]);
    expect(url.searchParams.get("fields")).toBe("campaign_id,adset_id,date_start,date_stop,spend,actions,cost_per_action_type");
    if (kind === "attribution") expect(JSON.parse(url.searchParams.get("action_attribution_windows")!)).toEqual(["7d_click", "1d_view"]);
    expect(url.searchParams.has("access_token")).toBe(false);
    expect(url.searchParams.get("use_unified_attribution_setting")).toBe(kind === "attribution" ? "false" : "true");
  });
});

describe("read-only ad-creative instant form verification", () => {
  it("collects only explicit lead_gen_form_id values across creative formats and pagination", async () => {
    const provider = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ creative: { object_story_spec: { link_data: { call_to_action: { value: { lead_gen_form_id: "200", page_id: "999" } } } } } }], paging: { next: "https://graph.facebook.com/v26.0/20/ads?after=next" } }))).mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ creative: { object_story_spec: { video_data: { call_to_action: { value: { lead_gen_form_id: "201" } } } } } }, { creative: { asset_feed_spec: { call_to_actions: [{ value: { lead_gen_form_id: "200" } }] } } }] })));
    vi.stubGlobal("fetch", provider);
    expect(await fetchMetaAdSetInstantFormIds("fixture", "20")).toEqual(["200", "201"]);
    expect(new URL(provider.mock.calls[0][0]).searchParams.get("fields")).toBe("id,creative{id,object_story_spec,asset_feed_spec,object_story_id,effective_object_story_id}");
  });
  it("does not follow form-configuration pagination to another origin", async () => {
    const provider = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [], paging: { next: "https://example.invalid/steal" } })));
    vi.stubGlobal("fetch", provider);
    await expect(fetchMetaAdSetInstantFormIds("fixture", "20")).rejects.toThrow(/pagination/);
    expect(provider).toHaveBeenCalledTimes(1);
  });
});

it("associates Page IDs only with form-bearing creatives and ignores Instagram/unrelated Page IDs", async () => {
 const provider = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [
  { creative: { object_story_spec: { page_id: "300", instagram_actor_id: "888", link_data: { call_to_action: { value: { lead_gen_form_id: "200" } } } } } },
  { creative: { object_story_spec: { page_id: "999", link_data: { link: "https://example.invalid" } } } },
  { creative: { object_story_spec: { page_id: "300" }, asset_feed_spec: { call_to_actions: [{ value: { lead_gen_form_id: "201" } }] } } },
 ] })));
 vi.stubGlobal("fetch", provider);
 expect(await fetchMetaAdSetInstantFormDestinations("fixture", "20")).toEqual({ formIds: ["200", "201"], pageIds: ["300"], storyIds: [] });
});

describe("report-period ad/creative identity joins", () => {
 it("reads the ads delivering in the requested period, never today's ad-set listing", async () => {
  const urls: URL[] = [];
  vi.stubGlobal("fetch", vi.fn().mockImplementation(async (raw: string) => {
   const url = new URL(raw); urls.push(url);
   if (url.pathname.endsWith("/insights")) return new Response(JSON.stringify({ data: [{ ad_id: "700", adset_id: "20", campaign_id: "10", date_start: "2026-10-24", date_stop: "2026-10-24", spend: "44.5", impressions: "1169" }] }));
   if (url.pathname.endsWith("/700")) return new Response(JSON.stringify({ id: "700", adset_id: "20", creative: { effective_object_story_id: "300_500", object_story_spec: { page_id: "300", link_data: { call_to_action: { value: { lead_gen_form_id: "200" } } } } } }));
   throw new Error("Unexpected current-configuration lookup");
  }));
  const config = await fetchMetaAdSetInstantFormDestinations("fixture", "20", { adAccountId: "123", sinceIso: "2026-10-24", untilIso: "2026-10-24" });
  expect(config).toMatchObject({ formIds: ["200"], pageIds: ["300"], storyIds: ["300_500", "500"], adIds: ["700"], creativeIdentities: [{ adId: "700", formIds: ["200"], storyIds: ["300_500", "500"] }] });
  expect(urls[0].searchParams.get("level")).toBe("ad");
  expect(JSON.parse(urls[0].searchParams.get("time_range")!)).toEqual({ since: "2026-10-24", until: "2026-10-24" });
  expect(JSON.parse(urls[0].searchParams.get("filtering")!)).toEqual([{ field: "adset.id", operator: "IN", value: ["20"] }]);
  expect(urls.some(url => url.pathname.endsWith("/20/ads"))).toBe(false);
 });
 it("rejects metadata for another ad set instead of falling back to current creatives", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ ad_id: "700", adset_id: "20", date_start: "2026-10-24", spend: "1" }] }))).mockResolvedValueOnce(new Response(JSON.stringify({ id: "700", adset_id: "99", creative: {} }))));
  await expect(fetchMetaAdSetInstantFormDestinations("fixture", "20", { adAccountId: "123", sinceIso: "2026-10-24", untilIso: "2026-10-24" })).rejects.toMatchObject({ evidence: { stage: "creative_scope_mismatch", adIds: ["700"] } });
 });
});
