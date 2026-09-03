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
              segments: { date: "2026-07-13" },
              metrics: {
                costMicros: "100000000",
                clicks: "50",
                impressions: "3000",
                ctr: 0.015,
                averageCpc: 2000000,
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
  });
});
