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
