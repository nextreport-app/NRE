import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fetchMetaReportCsv } from "../fetch-meta-report-rows";
import { readRowsWithAutoMap } from "../columns";
import { validateMtdDailyCsv } from "../validate";

describe("fetchMetaReportCsv", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).includes("/insights")) {
          return {
            ok: true,
            json: async () => ({
              data: [
                {
                  campaign_name: "Shoes Campaign",
                  adset_name: "Broad",
                  date_start: "2026-07-19",
                  spend: "50.00",
                  reach: "1000",
                  impressions: "5000",
                  ctr: "0.02",
                  cpc: "0.85",
                  inline_link_clicks: "40",
                  frequency: "1.5",
                  actions: [{ action_type: "link_click", value: "40" }],
                  cost_per_action_type: [{ action_type: "link_click", value: "1.25" }],
                },
              ],
            }),
          };
        }
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("produces CSV that passes Meta validation", async () => {
    const result = await fetchMetaReportCsv({
      accessToken: "token",
      adAccountId: "act_123",
      timezone: "UTC",
      now: new Date("2026-07-20T12:00:00Z"),
      days: 30,
    });

    expect(result.rowCount).toBe(1);
    const lines = result.csvText.split("\n");
    const headers = lines[0].split(",");
    const dataRows = lines.slice(1).map((line) => line.split(","));
    const { colMap, rows } = readRowsWithAutoMap(headers, dataRows);
    const validation = validateMtdDailyCsv(colMap, rows, new Date("2026-07-20T12:00:00Z"), headers);
    expect(validation.valid).toBe(true);
  });
});
