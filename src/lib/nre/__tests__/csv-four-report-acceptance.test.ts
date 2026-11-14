import { expect, it, vi } from "vitest";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import Papa from "papaparse";
import JSZip from "jszip";
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: vi.fn().mockResolvedValue(null) } } }));
import type { Client } from "@/generated/prisma/client";
import { parseCsvText } from "../parse-csv";
import { buildReportData, buildComparisonReportData } from "../report-data";
import { buildDayBreakdownReportData } from "../day-breakdown-report-data";
import { buildStandardReportForWizard } from "../report-engine/build-standard-from-wizard";
import { reconcileStandardReportWithCsv } from "../csv-report-reconciliation";
import { adSetKey } from "../ad-sets";
import { renderPptx, renderComparisonPptx, renderDayBreakdownPptx } from "../../pptx/render";

/** A separate raw CSV ledger supplies the expected cents and event counts. */
function syntheticCsv() {
  const lines = ["Campaign name,Ad set name,Day,Result type,Results,Amount spent (USD),Reach,Impressions,CTR (all),Link clicks,Landing page views"];
  for (let day = 0; day < 44; day++) {
    const iso = new Date(Date.UTC(2026, 9, 1 + day)).toISOString().slice(0, 10);
    lines.push(`Agency - LEADS - INSTANT FORMS - Q3 - JUN 2026,Form set,${iso},Leads (form),${day % 4 ? 3 : 0},${day % 4 ? "20.12" : "8.34"},100,200,2,4,1`);
    lines.push(`Agency - TRAFFIC - RETARGETING - Q3 - AUG 2026,Traffic A,${iso},Link clicks,20,5.67,200,400,5,20,10`);
    lines.push(`Agency - TRAFFIC - RETARGETING - Q3 - AUG 2026,Traffic B,${iso},Link clicks,${day >= 37 ? 0 : 10},${day >= 37 ? "0" : "0.20"},100,200,5,${day >= 37 ? 0 : 10},5`);
  }
  return lines.join("\n");
}

it("reconciles mixed-objective daily CSV facts through all four reports and both PPT themes", async () => {
  // Optional private input never enters version control. This fixed acceptance
  // window requires coverage from 1 October through 13 November 2026.
  const raw = process.env.REPORT_ACCEPTANCE_CSV ? readFileSync(process.env.REPORT_ACCEPTANCE_CSV, "utf8") : syntheticCsv();
  const ledger = Papa.parse<Record<string, string>>(raw, { header: true, skipEmptyLines: true }).data;
  expect(ledger.some(row => row.Day === "2026-10-01")).toBe(true);
  expect(ledger.some(row => row.Day === "2026-11-13")).toBe(true);
  const parsed = parseCsvText(raw);
  const rows = parsed.rows;
  const money = (s: string) => Number(s.replace(/[^0-9.-]/g, ""));
  const windowRows = (start: string, end: string) => ledger.filter(row => start <= row.Day && row.Day <= end);
  const cents = (rs: typeof ledger) => rs.reduce((sum, row) => sum + Math.round(Number(row["Amount spent (USD)"] || 0) * 100), 0) / 100;
  const sum = (start: string, end: string) => cents(windowRows(start, end));
  const count = (rs: typeof ledger) => rs.reduce((sum, row) => sum + Number(row.Results || 0), 0);
  const timezone = process.env.REPORT_ACCEPTANCE_TIMEZONE ?? "UTC";
  const accountName = process.env.REPORT_ACCEPTANCE_CLIENT ?? "Acceptance sample";
  const base = { accountName, currencySymbol: "$", timezone, monthlyBudget: null, mtdDailyRows: rows, now: new Date("2026-11-14T12:00:00Z"), selectedAdSets: [...new Set(rows.map(row => adSetKey(String(row.campaign_name), String(row.ad_set_name))))] };
  const weekly = buildReportData({ ...base, reportType: "WEEKLY", weeklyRange: { startIso: "2026-11-07", endIso: "2026-11-13" } });
  const form = new FormData();
  form.set("reportType", JSON.stringify("MONTHLY"));
  form.set("dateSelection", JSON.stringify({ mode: "custom", customStart: "2026-10-01", customEnd: "2026-10-31" }));
  form.set("selectedAdSets", JSON.stringify(base.selectedAdSets));
  const monthlyBuilt = await buildStandardReportForWizard({ client: { id: "test", userId: "test", accountName, currency: "USD", timezone, monthlyBudget: null, campaignObjectiveCache: null, showBudgetPacingOnCover: false } as Client, platform: "META", mtdParsed: parsed, formData: form, now: base.now });
  if (!("data" in monthlyBuilt)) throw new Error(monthlyBuilt.error);
  const monthly = monthlyBuilt.data;
  const comparison = buildComparisonReportData({ ...base, periodA: { startIso: "2026-11-07", endIso: "2026-11-13" }, periodB: { startIso: "2026-10-31", endIso: "2026-11-06" } });
  const daily = buildDayBreakdownReportData({ ...base, dateRange: { startIso: "2026-11-01", endIso: "2026-11-13" }, dailyExcludedMetricKeys: ["cpc_all", "objective_cost"] });
  expect(money(weekly.mtdRow.spend)).toBe(sum("2026-11-01", "2026-11-13"));
  expect(weekly.chart!.totalAllSpend).toBeCloseTo(sum("2026-10-15", "2026-11-13"), 2);
  expect(weekly.campaignSlides.reduce((sum, c) => sum + money(c.metrics.spend), 0)).toBeCloseTo(sum("2026-11-07", "2026-11-13"), 2);
  expect(money(monthly.mtdRow.spend)).toBe(sum("2026-10-01", "2026-10-31"));
  expect(comparison.totals.metricsA.spend.value).toBeCloseTo(sum("2026-11-07", "2026-11-13"), 2);
  expect(comparison.totals.metricsB.spend.value).toBeCloseTo(sum("2026-10-31", "2026-11-06"), 2);
  expect(daily.dayRows.reduce((sum, row) => sum + money(row.spend), 0)).toBeCloseTo(sum("2026-11-01", "2026-11-13"), 2);
  for (const [data, start, end] of [[weekly, "2026-11-07", "2026-11-13"], [monthly, "2026-10-01", "2026-10-31"]] as const) {
    for (const slide of data.campaignSlides) {
      const rs = windowRows(start, end).filter(row => row["Campaign name"] === slide.campaignName);
      expect(money(slide.metrics.spend)).toBeCloseTo(cents(rs), 2);
      expect(money(slide.metrics.spend)).toBeGreaterThan(0);
      expect(money(slide.metrics.results)).toBe(count(rs));
      if (count(rs)) expect(money(slide.metrics.cpr)).toBeCloseTo(cents(rs) / count(rs), 2);
    }
    for (const slide of data.adSetSlides) expect(money(slide.metrics.spend)).toBeGreaterThan(0);
    for (let i = 1; i < data.campaignSlides.length; i++) expect(money(data.campaignSlides[i - 1].metrics.spend)).toBeGreaterThanOrEqual(money(data.campaignSlides[i].metrics.spend));
  }
  for (const campaign of comparison.campaigns) {
    for (const [metrics, start, end] of [[campaign.metricsA, "2026-11-07", "2026-11-13"], [campaign.metricsB, "2026-10-31", "2026-11-06"]] as const) {
      const rs = windowRows(start, end).filter(row => row["Campaign name"] === campaign.campaignName);
      expect(metrics.spend.value).toBeCloseTo(cents(rs), 2);
      expect(metrics.results.value).toBe(count(rs));
    }
  }
  for (const day of daily.dayRows) {
    if (!day.dateIso) throw new Error("Daily row is missing its date");
    const rs = windowRows(day.dateIso, day.dateIso);
    expect(money(day.spend)).toBeCloseTo(cents(rs), 2);
    for (const [sourceType, label] of [["Leads (form)", "META FORM LEADS"], ["Link clicks", "LINK CLICKS"]]) {
      const ownRows = rs.filter(row => row["Result type"] === sourceType);
      const result = day.resultColumns.find(column => column.label === label);
      expect(result).toBeDefined();
      expect(money(result!.value)).toBe(count(ownRows));
    }
  }
  const verification = reconcileStandardReportWithCsv({ report: weekly, mtdDailyRows: rows, reportType: "WEEKLY", timezone, currencySymbol: "$", now: base.now });
  expect(verification.status).toBe("ok");
  const outputDir = process.env.REPORT_ACCEPTANCE_ARTIFACT_DIR;
  if (outputDir) {
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(join(outputDir, "data.json"), JSON.stringify({ weekly, monthly, comparison, daily }, null, 2));
    writeFileSync(join(outputDir, "reconciliation.json"), JSON.stringify(verification, null, 2));
  }
  for (const light of [false, true]) {
    const templateBuffer = readFileSync(light ? "templates/meta-ads-light.pptx" : "templates/dark.pptx");
    for (const [name, buffer] of [
      ["weekly", await renderPptx({ templateBuffer, data: weekly, currencySymbol: "$", isLightTemplate: light })],
      ["monthly", await renderPptx({ templateBuffer, data: monthly, currencySymbol: "$", isLightTemplate: light })],
      ["comparison", await renderComparisonPptx({ templateBuffer, data: comparison, isLightTemplate: light })],
      ["daily", await renderDayBreakdownPptx({ templateBuffer, data: daily, isLightTemplate: light })],
    ] as const) {
      const zip = await JSZip.loadAsync(buffer);
      const text = await Promise.all(Object.keys(zip.files).filter(path => /^ppt\/slides\/slide\d+\.xml$/.test(path)).map(async path => [...(await zip.file(path)!.async("string")).matchAll(/<a:t>([^<]*)<\/a:t>/g)].map(match => match[1]).join(" | ")));
      expect(text.filter(slide => slide.includes("METRIC ABBREVIATION GUIDE"))).toHaveLength(1);
      expect(text.join(" ")).not.toMatch(/\{\{[A-Z_]+\}\}/);
      if (outputDir) writeFileSync(join(outputDir, `${name}-${light ? "light" : "dark"}.pptx`), buffer);
    }
  }
}, 120_000);
