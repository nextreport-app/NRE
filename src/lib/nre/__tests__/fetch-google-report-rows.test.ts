import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fetchGoogleReportCsv } from "../fetch-google-report-rows";
import { readGoogleRowsWithAutoMap } from "../google-columns";
import { validateGoogleAdsCsv } from "../validate-google";

describe("fetchGoogleReportCsv", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          results: [
            {
              campaign: { name: "Shoes - Search" },
              adGroup: { name: "Brand Terms" },
              segments: { date: "2026-07-13" },
              metrics: {
                costMicros: "100000000",
                clicks: "50",
                impressions: "3000",
                ctr: 0.015,
                averageCpc: 2000000,
                conversions: 4,
                costPerConversion: 25,
              },
            },
          ],
        }),
      })),
    );
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN = "dev-token";
    process.env.GOOGLE_ADS_CLIENT_ID = "client-id";
    process.env.GOOGLE_ADS_CLIENT_SECRET = "client-secret";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("falls back to weekly chunks when the full range keeps failing with 503", async () => {
    vi.useFakeTimers();
    let fullRangeAttempts = 0;
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { query?: string };
      const query = body.query ?? "";
      const fullRange = query.includes("BETWEEN '2026-09-01' AND '2026-09-14'");

      if (fullRange) {
        fullRangeAttempts += 1;
        return {
          ok: false,
          status: 503,
          text: async () => JSON.stringify({ error: { message: "Unavailable", status: "UNAVAILABLE" } }),
        };
      }

      return {
        ok: true,
        json: async () => ({
          results: [
            {
              campaign: { name: "Chunked" },
              adGroup: { name: "Broad" },
              segments: { date: "2026-09-02" },
              metrics: { costMicros: "1000000", clicks: "1", impressions: "100", ctr: 0.01, averageCpc: 1000000 },
            },
          ],
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const promise = fetchGoogleReportCsv({
      accessToken: "token",
      customerId: "8983705082",
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

  it("produces CSV that passes Google validation", async () => {
    const result = await fetchGoogleReportCsv({
      accessToken: "token",
      customerId: "8983705082",
      timezone: "UTC",
      now: new Date("2026-07-20T12:00:00Z"),
      days: 30,
    });

    expect(result.rowCount).toBe(1);
    const lines = result.csvText.split("\n");
    const headers = lines[0].split(",");
    const dataRows = lines.slice(1).map((line) => line.split(","));
    const { colMap, rows } = readGoogleRowsWithAutoMap(headers, dataRows);
    const validation = validateGoogleAdsCsv(colMap, rows, new Date("2026-07-20T12:00:00Z"), headers);
    expect(validation.valid).toBe(true);
    expect(rows[0].cost).toBe("100.00");
    expect(rows[0].conversions).toBe("4");
    expect(rows[0].ad_group_name).toBe("Brand Terms");
  });
});
