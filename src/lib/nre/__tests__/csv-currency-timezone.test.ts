import { describe, expect, it, vi } from "vitest";
import { parseCsvText } from "../parse-csv";
import {
  detectCsvCurrency,
  resolveReportCurrencySymbol,
} from "../csv-currency";
import { getCalendarYesterday, toIsoDate } from "../date-range";
import { buildStandardReportForWizard } from "../report-engine/build-standard-from-wizard";
import {
  serializeReportGenerationJob,
  parseReportGenerationJob,
} from "../report-generation-job-payload";
import { renderPptx } from "@/lib/pptx/render";
import { readFileSync } from "node:fs";
import JSZip from "jszip";
import type { Client } from "@/generated/prisma/client";
vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: async () => null } },
}));
vi.mock("../previous-month-data", () => ({
  loadPreviousMonthDataRows: async () => undefined,
}));

const source = (currency: string) =>
  parseCsvText(
    `Campaign name,Ad set name,Day,Amount spent (${currency}),Results,Result type,Reach,Impressions\nExample,Set,2026-11-01,100,10,Link clicks,100,200\nExample,Set,2026-11-02,50,5,Link clicks,100,200`,
  );
describe("CSV currency and client-timezone hygiene", () => {
  it.each([
    ["USD", "$"],
    ["AUD", "A$"],
    ["INR", "₹"],
    ["CAD", "C$"],
    ["EUR", "€"],
    ["JPY", "JPY "],
  ])("detects %s without converting the numeric amounts", (code, symbol) => {
    const csv = source(code);
    expect(resolveReportCurrencySymbol(csv.headers, csv.rows, "₹")).toBe(
      symbol,
    );
    expect(csv.rows[0].spend).toBe("100");
  });
  it("does not confuse Meta all-click scopes with Albanian lek", () => {
    const csv = parseCsvText(
      "Campaign name,Day,Amount spent (USD),CPC (all),CTR (all)\nA,2026-11-02,100,1,2",
    );
    expect(detectCsvCurrency(csv.headers, csv.rows)).toEqual({ code: "USD" });
    expect(detectCsvCurrency(["Amount spent (ALL)", "CPC (all)"], [])).toEqual({
      code: "ALL",
    });
  });
  it("does not interpret a custom conversion name as an ISO currency", () => {
    expect(
      detectCsvCurrency(
        ["Amount spent (USD)", "Cost per TRY", "Cost per MAD"],
        [],
      ),
    ).toEqual({ code: "USD" });
  });
  it("does not guess an ISO currency from a bare dollar sign", () => {
    const csv = parseCsvText(
      "Campaign name,Day,Amount spent\nA,2026-11-02,$100",
    );
    expect(detectCsvCurrency(csv.headers, csv.rows).code).toBeNull();
    expect(resolveReportCurrencySymbol(csv.headers, csv.rows, "A$")).toBe("A$");
  });
  it("rejects mixed ad-account currencies", () => {
    const csv = parseCsvText(
      "Campaign name,Day,Amount spent,Account currency\nA,2026-11-02,100,USD\nB,2026-11-02,100,AUD",
    );
    expect(detectCsvCurrency(csv.headers, csv.rows).error).toContain(
      "mixes currencies",
    );
  });
  it("uses the client ad-account timezone across midnight and DST", () => {
    const now = new Date("2026-11-03T15:30:00Z");
    expect(toIsoDate(getCalendarYesterday(now, "Asia/Kolkata"))).toBe(
      "2026-11-02",
    );
    expect(toIsoDate(getCalendarYesterday(now, "Australia/Sydney"))).toBe(
      "2026-11-03",
    );
    expect(
      toIsoDate(
        getCalendarYesterday(
          new Date("2026-10-03T15:30:00Z"),
          "Australia/Sydney",
        ),
      ),
    ).toBe("2026-10-03");
    expect(
      toIsoDate(
        getCalendarYesterday(new Date("2026-10-03T15:30:00Z"), "Asia/Kolkata"),
      ),
    ).toBe("2026-10-02");
  });
  it("carries AUD through wizard assembly, job serialization, and actual PowerPoint XML despite an INR client default", async () => {
    const csv = source("AUD");
    const formData = new FormData();
    formData.set("reportType", '"WEEKLY"');
    formData.set(
      "dateSelection",
      JSON.stringify({
        mode: "custom",
        customStart: "2026-11-01",
        customEnd: "2026-11-02",
      }),
    );
    const result = await buildStandardReportForWizard({
      client: {
        id: "client",
        userId: "owner",
        accountName: "Example",
        currency: "INR",
        timezone: "Australia/Sydney",
        monthlyBudget: 10000,
        showBudgetPacingOnCover: true,
      } as Client,
      mtdParsed: csv,
      formData,
      platform: "META",
      now: new Date("2026-11-03T12:00:00Z"),
    });
    expect("data" in result).toBe(true);
    if (!("data" in result)) throw Error(result.error);
    expect(result.data.currencySymbol).toBe("A$");
    expect(result.data.campaignSlides[0].metrics.spend).toBe("A$150");
    expect(result.data.cover.budgetSummary).toBeFalsy();
    const job = parseReportGenerationJob(
      serializeReportGenerationJob({
        version: 1,
        kind: "STANDARD",
        userId: "owner",
        clientId: "client",
        platform: "META",
        reportData: result.data,
      }),
    );
    expect(job?.kind === "STANDARD" && job.reportData.currencySymbol).toBe(
      "A$",
    );
    const pptx = await renderPptx({
      templateBuffer: readFileSync("templates/dark.pptx"),
      data: result.data,
      currencySymbol: result.data.currencySymbol!,
      aiCopyBySlideKey: new Map(),
    });
    const zip = await JSZip.loadAsync(pptx);
    const xml = (
      await Promise.all(
        Object.keys(zip.files)
          .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
          .map((name) => zip.file(name)!.async("string")),
      )
    ).join("\n");
    expect(xml).toContain("A$150");
    expect(xml).not.toContain("₹");
  }, 30000);
});
