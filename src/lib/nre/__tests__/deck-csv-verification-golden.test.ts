/**
 * End-to-end: buildReportData + reconcileStandardReportWithCsv must stay green
 * on real customer-shaped fixtures (CI gate before production regressions).
 */

import { describe, expect, it } from "vitest";
import { buildReportData } from "../report-data";
import { reconcileStandardReportWithCsv } from "../csv-report-reconciliation";
import { DEFAULT_META_RESULT_COUNTING_MODE } from "../engine-defaults";
import { loadFixtureCsv } from "./golden-parity-helpers";

type Case = {
  name: string;
  fixture: string;
  timezone: string;
  currencySymbol: string;
  now: string;
  campaigns: string[] | "ALL_EXCEPT_RETARGETING";
  weeklyRange?: { startIso: string; endIso: string };
  selectedAdSets?: string[];
};

const CASES: Case[] = [
  {
    name: "The Belle instant forms weekly",
    fixture: "dc-weekly-the-belle-oct2026.csv",
    timezone: "America/Los_Angeles",
    currencySymbol: "$",
    now: "2026-10-20T12:00:00Z",
    campaigns: ["DC - LEADS - INSTANT FORMS - Q3 - JULY2026"],
    weeklyRange: { startIso: "2026-10-13", endIso: "2026-10-19" },
  },
  {
    name: "GZ Australia lead forms",
    fixture: "gz-australia-weekly-verify.csv",
    timezone: "Australia/Sydney",
    currencySymbol: "A$",
    now: "2026-10-05T12:00:00Z",
    campaigns: ["GZ Australia | Lead Forms | Top Funnel | A3HD"],
    weeklyRange: { startIso: "2026-09-28", endIso: "2026-10-04" },
  },
  {
    name: "BumperTech multi-campaign weekly",
    fixture: "bumpertech-weekly-oct.csv",
    timezone: "Australia/Sydney",
    currencySymbol: "A$",
    now: "2026-10-06T12:00:00Z",
    campaigns: "ALL_EXCEPT_RETARGETING",
    weeklyRange: { startIso: "2026-09-29", endIso: "2026-10-05" },
  },
];

describe("Deck ↔ CSV verification golden gate", () => {
  for (const c of CASES) {
    it(c.name, () => {
      const rows = loadFixtureCsv(c.fixture);
      const selectedCampaigns =
        c.campaigns === "ALL_EXCEPT_RETARGETING"
          ? [...new Set(rows.map((r) => String(r.campaign_name || "").trim()).filter(Boolean))].filter(
              (name) => !name.toLowerCase().includes("re-targeting"),
            )
          : c.campaigns;
      const now = new Date(c.now);
      const report = buildReportData({
        accountName: c.name,
        currencySymbol: c.currencySymbol,
        timezone: c.timezone,
        monthlyBudget: null,
        mtdDailyRows: rows,
        now,
        reportType: "WEEKLY",
        selectedCampaigns,
        weeklyRange: c.weeklyRange,
        selectedAdSets: c.selectedAdSets,
      });

      const verification = reconcileStandardReportWithCsv({
        report,
        mtdDailyRows: rows,
        selectedCampaigns,
        weeklyRange: c.weeklyRange,
        reportType: "WEEKLY",
        timezone: c.timezone,
        currencySymbol: c.currencySymbol,
        now,
        resultCountingMode: DEFAULT_META_RESULT_COUNTING_MODE,
      });

      if (verification.status !== "ok") {
        const bad = verification.checks.filter((x) => x.status === "mismatch");
        expect.soft(bad.map((b) => `${b.scope} | ${b.metric}: ${b.reportDisplay} vs ${b.csvDisplay}`)).toEqual([]);
      }
      expect(verification.status).toBe("ok");
    });
  }
});
