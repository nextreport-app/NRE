import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseCsvText } from "../parse-csv";
import { buildReportData } from "../report-data";
import { buildCampaignObjectiveMap } from "../objective";
import { apiRowsFromManual } from "./golden-parity-helpers";

const USER_CSV = resolve(
  process.cwd(),
  "src/lib/nre/__tests__/fixtures/dc-credit-firm-user-upload-sep2026.csv",
);

describe("meta-api-sync module", () => {
  it("Credit Firm: API sync matches manual CSV report totals and WEBSITE LEADS objective", async () => {
    const { rows: manualRows } = parseCsvText(readFileSync(USER_CSV, "utf8"));
    const apiRows = await apiRowsFromManual(manualRows, {
      sinceIso: "2026-08-26",
      untilIso: "2026-09-24",
    });

    expect(buildCampaignObjectiveMap(apiRows).get("dc leads campaign main")?.resultLabel).toBe(
      "WEBSITE LEADS",
    );

    const opts = {
      accountName: "Credit Firm",
      currencySymbol: "$",
      timezone: "America/New_York",
      monthlyBudget: null,
      now: new Date("2026-09-25T12:00:00Z"),
      reportType: "WEEKLY" as const,
      selectedCampaigns: ["DC Leads Campaign Main"],
      weeklyRange: { startIso: "2026-09-18", endIso: "2026-09-24" },
    };

    const manualReport = buildReportData({ ...opts, mtdDailyRows: manualRows });
    const apiReport = buildReportData({ ...opts, mtdDailyRows: apiRows });

    expect(apiReport.mtdRow.resultColumns.find((c) => c.label === "WEBSITE LEADS")?.value).toBe("9");
    expect(apiReport.chart?.campaigns[0]?.results).toBe(12);
    expect(apiReport.campaignSlides[0]?.metrics.results).toBe("4");
    expect(apiReport.mtdRow.resultColumns.find((c) => c.label === "WEBSITE LEADS")?.value).toBe(
      manualReport.mtdRow.resultColumns.find((c) => c.label === "WEBSITE LEADS")?.value,
    );
  });
});
