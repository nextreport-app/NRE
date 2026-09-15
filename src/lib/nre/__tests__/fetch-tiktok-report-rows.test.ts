import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fetchTikTokReportCsv, TIKTOK_AS_META_CSV_HEADERS } from "../fetch-tiktok-report-rows";
import { parseMtdCsvForAdPlatform } from "../tiktok-columns";
import { validateMtdDailyCsv } from "../validate";

describe("fetchTikTokReportCsv", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          code: 0,
          message: "OK",
          data: {
            list: [
              {
                dimensions: { stat_time_day: "2026-07-13" },
                metrics: {
                  campaign_name: "Brand Awareness",
                  adgroup_name: "Broad",
                  spend: "100.00",
                  reach: "50000",
                  impressions: "80000",
                  ctr: "0.015",
                  cpc: "0.40",
                  clicks: "200",
                  frequency: "1.6",
                  conversion: "0",
                },
              },
            ],
            page_info: { total_page: 1 },
          },
        }),
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("falls back to weekly chunks when the full range keeps failing with rate limit", async () => {
    vi.useFakeTimers();
    let fullRangeAttempts = 0;
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { start_date?: string; end_date?: string };
      const fullRange = body.start_date === "2026-09-01" && body.end_date === "2026-09-14";

      if (fullRange) {
        fullRangeAttempts += 1;
        return {
          ok: true,
          json: async () => ({ code: 40100, message: "Too many requests" }),
        };
      }

      return {
        ok: true,
        json: async () => ({
          code: 0,
          message: "OK",
          data: {
            list: [
              {
                dimensions: { stat_time_day: `${body.start_date} 00:00:00` },
                metrics: {
                  campaign_name: "Chunked",
                  adgroup_name: "Broad",
                  spend: "10.00",
                  reach: "1000",
                  impressions: "2000",
                  ctr: "0.01",
                  cpc: "0.50",
                  clicks: "20",
                  frequency: "2",
                  conversion: "0",
                },
              },
            ],
            page_info: { total_page: 1 },
          },
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const promise = fetchTikTokReportCsv({
      accessToken: "token",
      advertiserId: "123",
      timezone: "UTC",
      sinceIso: "2026-09-01",
      untilIso: "2026-09-14",
    });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(fullRangeAttempts).toBeGreaterThan(0);
    expect(result.rowCount).toBeGreaterThan(1);
    vi.useRealTimers();
  });

  it("produces Meta-shaped CSV with Complete payment when purchase metrics are present", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          code: 0,
          message: "OK",
          data: {
            list: [
              {
                dimensions: { stat_time_day: "2026-07-13" },
                metrics: {
                  campaign_name: "Sales",
                  adgroup_name: "Broad",
                  spend: "250.00",
                  reach: "20000",
                  impressions: "35000",
                  ctr: "0.02",
                  cpc: "0.55",
                  clicks: "450",
                  frequency: "1.75",
                  conversion: "0",
                  complete_payment: "8",
                  cost_per_complete_payment: "31.25",
                },
              },
            ],
            page_info: { total_page: 1 },
          },
        }),
      })),
    );

    const result = await fetchTikTokReportCsv({
      accessToken: "token",
      advertiserId: "123",
      timezone: "UTC",
      now: new Date("2026-07-20T12:00:00Z"),
      days: 30,
    });

    const parsed = parseMtdCsvForAdPlatform(Buffer.from(result.csvText, "utf8"), "TIKTOK");
    expect(parsed.rows[0].result_type).toBe("Complete payment");
    expect(parsed.rows[0].results).toBe("8");
  });

  it("produces Meta-shaped CSV that passes validation with Reach result type", async () => {
    const result = await fetchTikTokReportCsv({
      accessToken: "token",
      advertiserId: "123",
      timezone: "UTC",
      now: new Date("2026-07-20T12:00:00Z"),
      days: 30,
    });

    expect(result.rowCount).toBe(1);
    expect(TIKTOK_AS_META_CSV_HEADERS).toContain("Amount spent");
    expect(TIKTOK_AS_META_CSV_HEADERS).not.toContain("Amount spent (USD)");

    const parsed = parseMtdCsvForAdPlatform(Buffer.from(result.csvText, "utf8"), "TIKTOK");
    const validation = validateMtdDailyCsv(parsed.colMap, parsed.rows, new Date("2026-07-20T12:00:00Z"), parsed.headers, "TIKTOK");
    expect(validation.valid).toBe(true);
    expect(parsed.rows[0].result_type?.toLowerCase()).toBe("reach");
  });
});
