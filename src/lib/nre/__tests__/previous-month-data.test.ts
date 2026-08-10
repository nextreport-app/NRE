import { describe, expect, it, vi } from "vitest";
import { loadPreviousMonthDataRows } from "../previous-month-data";

vi.mock("@/lib/storage", () => ({
  readPreviousMonthDataFile: vi.fn(),
}));

import { readPreviousMonthDataFile } from "@/lib/storage";

const CSV_HEADER =
  "Campaign name,Delivery status,Amount spent,Reach,Impressions,Results,CTR,CPC,Reporting starts,Reporting ends";

/**
 * Regression coverage for the Previous Month Data / Combined Total bug: a
 * client selects 2 campaigns for Previous Month Data (one of them PAUSED,
 * with real spend) and both must come back from loadPreviousMonthDataRows —
 * neither silently dropped for being the "second" match nor excluded for
 * being paused.
 */
describe("loadPreviousMonthDataRows — previousMonthSelectedCampaigns bug fix", () => {
  const csv = [
    CSV_HEADER,
    "Campaign A,active,500,2000,4000,10,2%,3,01-06-2026,30-06-2026",
    "Campaign B,paused,300,1000,2000,5,1.5%,2,01-06-2026,30-06-2026",
    "Campaign C,active,900,5000,8000,0,0.5%,0,01-06-2026,30-06-2026",
  ].join("\n");

  it("includes ALL campaigns listed in previousMonthSelectedCampaigns, regardless of delivery status", async () => {
    vi.mocked(readPreviousMonthDataFile).mockResolvedValue(Buffer.from(csv));

    const rows = await loadPreviousMonthDataRows({
      previousMonthDataUrl: "https://blob.example/previous-month-data/client1/file.csv",
      previousMonthSelectedCampaigns: JSON.stringify(["Campaign A", "Campaign B"]),
    });

    expect(rows?.map((r) => r.campaign_name)).toEqual(["Campaign A", "Campaign B"]);
    // Campaign B is paused but still included — delivery status must never
    // exclude a selected campaign's previous-month spend.
    expect(rows?.find((r) => r.campaign_name === "Campaign B")?.spend).toBe("300");
  });

  it("matches campaign names case-insensitively", async () => {
    vi.mocked(readPreviousMonthDataFile).mockResolvedValue(Buffer.from(csv));

    const rows = await loadPreviousMonthDataRows({
      previousMonthDataUrl: "https://blob.example/previous-month-data/client1/file.csv",
      previousMonthSelectedCampaigns: JSON.stringify(["campaign a", "CAMPAIGN B"]),
    });

    expect(rows?.map((r) => r.campaign_name).sort()).toEqual(["Campaign A", "Campaign B"]);
  });

  it("excludes a campaign not present in previousMonthSelectedCampaigns", async () => {
    vi.mocked(readPreviousMonthDataFile).mockResolvedValue(Buffer.from(csv));

    const rows = await loadPreviousMonthDataRows({
      previousMonthDataUrl: "https://blob.example/previous-month-data/client1/file.csv",
      previousMonthSelectedCampaigns: JSON.stringify(["Campaign A"]),
    });

    expect(rows?.map((r) => r.campaign_name)).toEqual(["Campaign A"]);
  });
});
