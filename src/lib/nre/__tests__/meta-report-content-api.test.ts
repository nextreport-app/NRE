import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/meta-api", async (original) => ({
  ...(await original<typeof import("@/lib/meta-api")>()),
  fetchMetaAdSetReportingConfigs: vi.fn(),
  fetchMetaCustomConversions: vi.fn().mockResolvedValue([]),
}));
import { fetchMetaAdSetReportingConfigs } from "@/lib/meta-api";
import {
  fetchMetaContentSources,
  fetchCreativeSnapshots,
  snapshotCreativeImage,
  metaContentGraph,
} from "../meta-report-content/api";
import sharp from "sharp";
import { parseCsvText } from "../parse-csv";
const primary = parseCsvText(
  "Campaign name,Ad set name,Campaign ID,Ad set ID,Day,Amount spent (USD)\nExample,Set,1,11,2026-11-10,10",
).rows;
const range = { startIso: "2026-11-10", endIso: "2026-11-11" };
const options = {
  audience: ["age" as const],
  creatives: false,
  includeStandard: true,
  ranking: "cpr" as const,
  minSpend: 0,
  minResults: 5,
};
const base = {
  campaign_id: "1",
  campaign_name: "Example",
  date_start: "2026-11-10",
  date_stop: "2026-11-10",
  spend: "10",
  impressions: "100",
  clicks: "5",
  inline_link_clicks: "3",
  actions: [{ action_type: "onsite_conversion.lead_grouped", value: "2" }],
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchMetaAdSetReportingConfigs).mockResolvedValue([
    { id: "11", optimization_goal: "LEAD_GENERATION" },
  ]);
});
afterEach(() => vi.unstubAllGlobals());
describe("Meta content API capability boundaries", () => {
  it("rejects a period response that does not cover the requested dates", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({data: [{...base, age: "25-34"}]})));
    await expect(fetchMetaContentSources({token: "test", account: "123", currency: "USD", range,
      periodTotals: true, options, primaryRows: primary})).rejects.toThrow("different dates");
  });
  it.each([false, true])("requests a single exact period for standalone reports (creative=%s), preserving unavailable values", async creatives => {
    const period = {startIso: "2026-10-21", endIso: "2026-11-19"};
    const fetcher = vi.fn<(raw: unknown) => Promise<Response>>(async () => Response.json({data: [
      {...base, date_start: period.startIso, date_stop: period.endIso, age: "25-34", adset_id: "11", ad_id: "100", ad_name: "Image"},
      {...base, date_start: period.startIso, date_stop: period.endIso, age: "35-44", adset_id: "11", ad_id: "101", ad_name: "Video", actions: undefined},
    ]}));
    vi.stubGlobal("fetch", fetcher);
    const [source] = await fetchMetaContentSources({token: "test", account: "123", currency: "USD", range: period,
      periodTotals: true, options: {...options, audience: creatives ? [] : ["age"], creatives}, primaryRows: primary});
    expect(fetcher).toHaveBeenCalledTimes(1);
    const params = new URL(String(fetcher.mock.calls[0][0])).searchParams;
    expect(params.get("time_increment")).toBe("all_days");
    expect(JSON.parse(params.get("time_range")!)).toEqual({since: period.startIso, until: period.endIso});
    expect(source).toMatchObject({granularity: "period", coverage: period});
    expect(source.rows.map(row => row.results)).toEqual([2, null]);
  });
  it("keeps optional weekly/monthly sections daily and chunks their date range", async () => {
    const fetcher = vi.fn(async (raw: unknown) => {
      const params = new URL(String(raw)).searchParams;
      const {since} = JSON.parse(params.get("time_range")!);
      expect(params.get("time_increment")).toBe("1");
      return Response.json({data: [{...base, date_start: since, date_stop: since, age: "25-34"}]});
    });
    vi.stubGlobal("fetch", fetcher);
    const [source] = await fetchMetaContentSources({token: "test", account: "123", currency: "USD",
      range: {startIso: "2026-10-21", endIso: "2026-11-19"}, options, primaryRows: primary});
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(source.granularity).toBe("daily");
  });

  it("fetches audience at campaign level and creatives at ad level with unified attribution", async () => {
    const fetcher = vi.fn(async (raw: unknown) => {
      const url = new URL(String(raw));
      return Response.json({
        data: [
          url.searchParams.get("level") === "ad"
            ? {
                ...base,
                adset_id: "11",
                adset_name: "Set",
                ad_id: "100",
                ad_name: "Image",
              }
            : { ...base, age: "25-34" },
        ],
      });
    });
    vi.stubGlobal("fetch", fetcher);
    const sources = await fetchMetaContentSources({
      token: "test-token",
      account: "123",
      currency: "USD",
      range,
      options: { ...options, creatives: true },
      primaryRows: primary,
    });
    expect(sources.map((s) => s.kind)).toEqual(["age", "creative"]);
    expect(sources[0].rows[0]).toMatchObject({ results: 2, age: "25-34" });
    expect(sources[1].rows[0]).toMatchObject({ adId: "100", results: 2 });
    const urls = fetcher.mock.calls.map((call) => new URL(String(call[0])));
    expect(urls[0].searchParams.get("level")).toBe("campaign");
    expect(urls[0].searchParams.get("breakdowns")).toBe("age");
    expect(urls[1].searchParams.get("level")).toBe("ad");
    expect(
      urls.every(
        (url) =>
          url.searchParams.get("use_unified_attribution_setting") === "true",
      ),
    ).toBe(true);
    expect(urls.every((url) => !url.href.includes("test-token"))).toBe(true);
  });
  it("uses one joint platform/placement request", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({
        data: [
          {
            ...base,
            publisher_platform: "facebook",
            platform_position: "feed",
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetcher);
    const sources = await fetchMetaContentSources({
      token: "test",
      account: "123",
      currency: "USD",
      range,
      options: { ...options, audience: ["platform", "placement"] },
      primaryRows: primary,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(
      new URL(String((fetcher.mock.calls[0] as unknown[])[0])).searchParams.get(
        "breakdowns",
      ),
    ).toBe("publisher_platform,platform_position");
    expect(sources).toHaveLength(1);
  });
  it("follows cursors rather than untrusted absolute next links", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          data: [{ id: 1 }],
          paging: {
            next: "https://evil.invalid/?access_token=secret",
            cursors: { after: "next-page" },
          },
        }),
      )
      .mockResolvedValueOnce(Response.json({ data: [{ id: 2 }] }));
    vi.stubGlobal("fetch", fetcher);
    // Exercise the public fetch path's pagination, with distinct segment facts.
    fetcher
      .mockReset()
      .mockResolvedValueOnce(
        Response.json({
          data: [{ ...base, age: "18-24" }],
          paging: {
            next: "https://evil.invalid",
            cursors: { after: "cursor" },
          },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({ data: [{ ...base, age: "25-34" }] }),
      );
    const sources = await fetchMetaContentSources({
      token: "test",
      account: "123",
      currency: "USD",
      range,
      options,
      primaryRows: primary,
    });
    expect(sources[0].rows).toHaveLength(2);
    expect(new URL(String(fetcher.mock.calls[1][0])).hostname).toBe(
      "graph.facebook.com",
    );
    expect(
      new URL(String(fetcher.mock.calls[1][0])).searchParams.get("after"),
    ).toBe("cursor");
  });
  it("keeps omitted attributed results unavailable rather than reporting zero", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          data: [{ ...base, actions: undefined, age: "25-34" }],
        }),
      ),
    );
    const sources = await fetchMetaContentSources({
      token: "test",
      account: "123",
      currency: "USD",
      range,
      options,
      primaryRows: primary,
    });
    expect(sources[0].rows[0].results).toBeNull();
  });
  it("chunks long periods into non-overlapping 28-day requests", async () => {
    const fetcher = vi.fn(async () => Response.json({ data: [] }));
    vi.stubGlobal("fetch", fetcher);
    await fetchMetaContentSources({
      token: "test",
      account: "123",
      currency: "USD",
      range: { startIso: "2026-10-01", endIso: "2026-11-17" },
      options,
      primaryRows: primary,
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(
      fetcher.mock.calls.map((call) =>
        JSON.parse(
          new URL(String((call as unknown[])[0])).searchParams.get(
            "time_range",
          )!,
        ),
      ),
    ).toEqual([
      { since: "2026-10-01", until: "2026-10-28" },
      { since: "2026-10-29", until: "2026-11-17" },
    ]);
  });
  it("rejects mixed attribution windows instead of ranking incomparable ads", async () => {
    vi.mocked(fetchMetaAdSetReportingConfigs).mockResolvedValue([
      {
        id: "11",
        optimization_goal: "LEAD_GENERATION",
        attribution_spec: [{ event_type: "CLICK_THROUGH", window_days: 7 }],
      },
      {
        id: "12",
        optimization_goal: "LEAD_GENERATION",
        attribution_spec: [{ event_type: "CLICK_THROUGH", window_days: 1 }],
      },
    ]);
    const more = parseCsvText(
      "Campaign name,Ad set name,Campaign ID,Ad set ID,Day,Amount spent (USD)\nExample,Set,1,12,2026-11-10,10",
    ).rows;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ data: [{ ...base, age: "25-34" }] })),
    );
    await expect(
      fetchMetaContentSources({
        token: "test",
        account: "123",
        currency: "USD",
        range,
        options,
        primaryRows: [...primary, ...more],
      }),
    ).rejects.toThrow(/attribution windows/);
  });
  it("retains website application conversions in audience and creative sections",async()=>{
    vi.mocked(fetchMetaAdSetReportingConfigs).mockResolvedValue([{id:"11",optimization_goal:"OFFSITE_CONVERSIONS",promoted_object:{pixel_id:"9",custom_event_type:"SUBMIT_APPLICATION"}}]);
    const fetcher=vi.fn(async(raw:unknown)=>{const url=new URL(String(raw));expect(url.searchParams.get("fields")).toContain("conversions");return Response.json({data:[{...base,age:"25-34",adset_id:"11",ad_id:"100",ad_name:"Application creative",actions:[],conversions:[{action_type:"submit_application_website",value:"1"}]}]})});vi.stubGlobal("fetch",fetcher);
    const sources=await fetchMetaContentSources({token:"test",account:"123",currency:"USD",range,options:{...options,creatives:true},primaryRows:primary});
    expect(sources.map(source=>source.rows[0].results)).toEqual([1,1]);
    expect(sources.every(source=>source.rows[0].resultLabel==="WEBSITE SUBMIT APPLICATIONS")).toBe(true);
  });
  it("does not combine purchase value aliases", async () => {
    vi.mocked(fetchMetaAdSetReportingConfigs).mockResolvedValue([
      {
        id: "11",
        optimization_goal: "OFFSITE_CONVERSIONS",
        promoted_object: { pixel_id: "42", custom_event_type: "PURCHASE" },
      },
    ]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          data: [
            {
              ...base,
              adset_id: "11",
              adset_name: "Set",
              ad_id: "100",
              ad_name: "Sale",
              actions: [
                {
                  action_type: "offsite_conversion.fb_pixel_purchase",
                  value: "2",
                },
                { action_type: "omni_purchase", value: "2" },
              ],
              action_values: [
                {
                  action_type: "offsite_conversion.fb_pixel_purchase",
                  value: "100",
                },
                { action_type: "omni_purchase", value: "100" },
              ],
            },
          ],
        }),
      ),
    );
    const sources = await fetchMetaContentSources({
      token: "test",
      account: "123",
      currency: "USD",
      range,
      options: { ...options, audience: [], creatives: true },
      primaryRows: primary,
    });
    expect(sources[0].rows[0]).toMatchObject({
      results: 2,
      purchaseValue: 100,
    });
  });
  it("retries a transient Graph error without putting credentials in its URL", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ error: { message: "busy", code: 2 } }, { status: 503 }),
      )
      .mockResolvedValueOnce(Response.json({ id: "ok" }));
    vi.stubGlobal("fetch", fetcher);
    expect(await metaContentGraph("secret", "100")).toEqual({ id: "ok" });
    expect(
      fetcher.mock.calls.every((call) => !String(call[0]).includes("secret")),
    ).toBe(true);
  });
  it("does not fetch arbitrary external creative image URLs", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({ creative: { image_url: "https://127.0.0.1/private" } }),
    );
    vi.stubGlobal("fetch", fetcher);
    expect(await fetchCreativeSnapshots("test", ["100"])).toEqual({
      media: {},
      missing: 1,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("turns a supplied raster image into a stable JPEG snapshot and rejects SVG", async () => {
    const png = await sharp({
      create: { width: 1, height: 1, channels: 3, background: "#123456" },
    })
      .png()
      .toBuffer();
    const image = await snapshotCreativeImage(png);
    expect(image.data).toMatch(/^data:image\/jpeg;base64,/);
    expect(image.width).toBe(1);
    await expect(
      snapshotCreativeImage(
        Buffer.from(
          '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>',
        ),
      ),
    ).rejects.toThrow(/PNG, JPEG or WebP/);
  });
});
