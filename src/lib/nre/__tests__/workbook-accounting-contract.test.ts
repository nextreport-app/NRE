import { describe, expect, it } from "vitest";
import { objectiveKeyFromConversionEvent, objectiveKeyFromPerformanceGoal } from "../meta-campaign-objective-matrix";
import { sourceNumericIssues, validSourceNumber } from "../source-contract";
import { buildGoogleColumnMap, normalizeGoogleCsvHeaders } from "../google-columns";
import { buildColumnMap } from "../columns";
import { sumRawColumnByKeywords } from "../objective";
import { findMetaMetric } from "../meta-dictionary";
import { findGoogleMetric } from "../google-dictionary";
import { aggregateDynamicMetrics, type MetricRef } from "../dynamic-metrics";
import { resolveObjectiveFromResultType } from "../result-type-map";
import { parseMtdCsvForAdPlatform } from "../tiktok-columns";
import { parseCsvText } from "../parse-csv";
import { buildReportData } from "../report-data";

const raw = (data: Record<string, string>) => ({ _raw: data });
describe("uploaded workbook accounting contracts", () => {
  it("preserves Google daily Clicks and Impr. through the report without Meta reach estimation or rounded CTR inference", () => {
    const rows = parseMtdCsvForAdPlatform(Buffer.from("Campaign,Ad group,Day,Cost,Clicks,Impr.,CTR,Avg. CPC,Conversions\nSearch,A,2026-10-01,100,1,1000000,0.00%,100,1\nSearch,A,2026-10-02,100,1,1000000,0.00%,100,1"), "GOOGLE").rows;
    const report = buildReportData({ platform: "GOOGLE", accountName: "Google daily", currencySymbol: "$", timezone: "UTC", monthlyBudget: null, mtdDailyRows: rows, now: new Date("2026-10-03T12:00:00Z"), weeklyRange: { startIso: "2026-10-01", endIso: "2026-10-02" } });
    expect(report.mtdRow.reach).toBe("2");
    expect(report.mtdRow.impressions).toBe("2,000,000");
    expect(report.mtdRow.cpc).toBe("$100.00");
  });
  it("never treats conversion values as primary Results or event counts", () => {
    const headers = ["Results value", "Purchases conversion value", "Website leads conversion value", "Meta leads conversion value", "Results", "Purchases", "Website leads", "Meta leads"];
    expect(buildColumnMap(headers)).toMatchObject({ results: "Results", purchases: "Purchases", website_leads: "Website leads", meta_leads: "Meta leads" });
    expect(buildColumnMap(headers.slice(0, 4))).not.toHaveProperty("results");
    expect(buildColumnMap(headers.slice(0, 4))).not.toHaveProperty("purchases");
  });
  it("does not let additional Google cost/conversion variants hijack base spend and counts", () => {
    expect(buildGoogleColumnMap(["Campaign ID", "Campaign", "Cost / conv.", "Cost / all conv.", "All conv.", "Conversions", "Cost", "Conv. value / click", "Conv. value"])).toMatchObject({ campaign_name: "Campaign", cost: "Cost", conversions: "Conversions", conv_value: "Conv. value", cost_per_conv: "Cost / conv." });
  });
  it("does not treat credit-spend events as monetary ad spend", () => {
    expect(buildColumnMap(["Credit spends", "Cost per credit spend", "Credit spends conversion value", "Amount spent (USD)"]).spend).toBe("Amount spent (USD)");
    expect(buildColumnMap(["Credit spends", "Credit spends conversion value"])).not.toHaveProperty("spend");
  });
  it("never groups campaigns by a budget or ID column when name columns are absent", () => {
    const headers = ["Campaign ID", "Campaign budget", "Campaign delivery", "Ad set budget", "Ad set ID"];
    expect(buildColumnMap(headers)).not.toHaveProperty("campaign_name");
    expect(buildColumnMap(headers)).not.toHaveProperty("ad_set_name");
    expect(buildGoogleColumnMap(headers)).not.toHaveProperty("campaign_name");
    expect(buildGoogleColumnMap(["Cost of goods sold", "Measurable cost"])).not.toHaveProperty("cost");
  });
  it("preserves distinct Google interactions and conversion scopes during normalization", () => {
    const headers = ["Campaign", "Day", "Cost", "Clicks", "Interactions", "CTR", "Interaction rate", "Avg. CPC", "Avg. cost", "Conversions", "All conv.", "Cost / conv.", "Cost / all conv.", "Campaign status", "Status"];
    const normalized = normalizeGoogleCsvHeaders(headers);
    expect(new Set(normalized).size).toBe(headers.length);
    const csv = headers.join(",") + "\nA,2026-10-01,100,10,50,1,5,10,2,2,8,50,12.5,Enabled,Eligible";
    const parsed = parseMtdCsvForAdPlatform(Buffer.from(csv), "GOOGLE");
    expect(parsed.rows[0]).toMatchObject({ campaign_name: "A", spend: "100", link_clicks: "10", ctr: "1", cpc: "10", results: "2", cpr: "50" });
    expect(parsed.rows[0]._raw).toMatchObject({ Interactions: "50", "All conv.": "8", "Avg. cost": "2", Status: "Eligible" });
  });
  it("excludes monetary conversion value from raw event extraction", () => {
    expect(sumRawColumnByKeywords({ "Checkouts initiated": "2", "Checkouts initiated conversion value": "1000" }, ["checkouts initiated"])).toBe(2);
  });
  it("prefers actual all-impressions and all-click CTR headers over derivative headers", () => {
    expect(buildColumnMap(["Gross impressions", "CTR (link click-through rate)", "Impressions", "CTR (all)"])).toMatchObject({ impressions: "Impressions", ctr: "CTR (all)" });
  });
  it.each([
    ["meta", "Average purchases conversion value", [raw({ "Purchases conversion value": "30", Purchases: "3", "Average purchases conversion value": "10" }), raw({ "Purchases conversion value": "1000", Purchases: "10", "Average purchases conversion value": "100" })], 1030 / 13],
    ["google", "Avg. order value", [raw({ Revenue: "30", Orders: "3", "Avg. order value": "10" }), raw({ Revenue: "1000", Orders: "10", "Avg. order value": "100" })], 1030 / 13],
    ["google", "Value / conv.", [raw({ "Conv. value": "30", Conversions: "3", "Value / conv.": "10" }), raw({ "Conv. value": "1000", Conversions: "10", "Value / conv.": "100" })], 1030 / 13],
    ["google", "Conv. value / click", [raw({ "Conv. value": "30", Clicks: "3", "Conv. value / click": "10" }), raw({ "Conv. value": "1000", Clicks: "10", "Conv. value / click": "100" })], 1030 / 13],
  ] as const)("derives %s %s from totals rather than summing averages", (platform, header, rows, expected) => {
    const metric = platform === "meta" ? findMetaMetric(header)! : findGoogleMetric(header)!;
    expect(aggregateDynamicMetrics([...rows], [metric as typeof metric & { format: "currency" }], platform)[metric.key]).toBeCloseTo(expected);
  });
  it("uses Google Clicks and Impr. for CTR rather than averaging exported rates", () => {
    const metric = findGoogleMetric("CTR")!;
    expect(aggregateDynamicMetrics([raw({ Clicks: "2", "Impr.": "1000", CTR: "99" }), raw({ Clicks: "10", "Impr.": "100", CTR: "99" })], [metric as typeof metric & { format: "percentage" }], "google").ctr).toBeCloseTo(12 / 1100 * 100);
  });
  it("does not relabel link-click CPC as all-click CPC when all-click evidence is absent", () => {
    const all = findMetaMetric("CPC (all)")!;
    const link = findMetaMetric("CPC (cost per link click)")!;
    const rows = [raw({ "Amount spent (USD)": "100", "Link clicks": "10", "CPC (cost per link click)": "10" })];
    const values = aggregateDynamicMetrics(rows, [all, link] as MetricRef[], "meta");
    expect(values[all.key]).toBeNaN();
    expect(values[link.key]).toBe(10);
  });
  it("preserves an already-aggregated single source average but does not sum unsupported averages", () => {
    const metric = findGoogleMetric("Avg. order value")!;
    expect(aggregateDynamicMetrics([raw({ "Avg. order value": "12.50" })], [metric] as MetricRef[], "google")[metric.key]).toBe(12.5);
    expect(aggregateDynamicMetrics([raw({ "Avg. order value": "12.50" }), raw({ "Avg. order value": "20" })], [metric] as MetricRef[], "google")[metric.key]).toBeNaN();
  });
  it("keeps website and app ROAS on their own conversion-value sources", () => {
    const website = findMetaMetric("Website purchase ROAS (return on ad spend)")!;
    const app = findMetaMetric("In-app purchase ROAS (return on ad spend)")!;
    const rows = [raw({ "Amount spent (USD)": "100", "Purchases conversion value": "9999", "Website purchases conversion value": "200", "In-app purchases conversion value": "50" })];
    const values = aggregateDynamicMetrics(rows, [website, app] as MetricRef[], "meta");
    expect(values[website.key]).toBe(2);
    expect(values[app.key]).toBe(0.5);
  });
  it("recognizes checkout export wording without binding its monetary value to the count", () => {
    const count = findMetaMetric("Checkouts initiated")!;
    const cost = findMetaMetric("Cost per checkout initiated")!;
    const values = aggregateDynamicMetrics([raw({ "Amount spent (USD)": "100", "Checkouts initiated": "2", "Checkouts initiated conversion value": "900" })], [count, cost] as MetricRef[], "meta");
    expect(values[count.key]).toBe(2);
    expect(values[cost.key]).toBe(50);
  });
  it("validates known optional value metrics without treating metadata as numeric", () => {
    const parsed = parseCsvText("Campaign name,Ad set name,Day,Results,Amount spent (USD),Purchases conversion value,Objective\nA,S,2026-10-01,2,100,not-a-number,Sales");
    expect(sourceNumericIssues(parsed.rows, parsed.colMap)).toEqual([expect.stringContaining("Purchases conversion value")]);
  });
  it("accepts Indian thousands grouping while rejecting decimal-comma ambiguity", () => {
    expect(validSourceNumber("₹1,23,456.78")).toBe(true);
    expect(validSourceNumber("12,34")).toBe(false);
  });
  it("does not combine ThruPlay and two-second video goals into one result bucket", () => {
    const rows = parseCsvText("Campaign name,Ad set name,Day,Result type,Results,Amount spent (USD),ThruPlays,2-second continuous video plays,3-second video plays\nA,S,2026-10-01,ThruPlay,2,100,20,30,40\nB,S,2026-10-01,2-second continuous video plays,3,100,20,30,40").rows;
    const report = buildReportData({ accountName: "Video definitions", currencySymbol: "$", timezone: "UTC", monthlyBudget: null, mtdDailyRows: rows, now: new Date("2026-10-03T12:00:00Z"), weeklyRange: { startIso: "2026-10-01", endIso: "2026-10-02" } });
    expect(report.mtdRow.resultColumns).toHaveLength(2);
    for (const [label, value, cpr] of [["THRUPLAYS", "2", "$50.00"], ["2-SECOND VIDEO VIEWS", "3", "$33.33"]]) {
      expect(report.mtdRow.resultColumns).toContainEqual(expect.objectContaining({ label, value, cprValue: cpr }));
      const slide = report.campaignSlides.find(slide => slide.resultLabel === label)!;
      expect(slide.metrics).toMatchObject({ results: value, cpr });
      expect(slide.dynamicMetrics[3]?.value).toBe(value);
      expect(slide.dynamicMetrics[4]?.value).toBe(cpr);
    }
  });
  it("keeps reference taxonomy lookups consistent without guessing a single location for combined leads", () => {
    expect(objectiveKeyFromConversionEvent("Contact", "Website")).toBe("contacts");
    expect(objectiveKeyFromConversionEvent("Start trial", "Website")).toBe("trials_started");
    expect(objectiveKeyFromPerformanceGoal("Maximise ThruPlay views")).toBe("thruplays");
    expect(objectiveKeyFromPerformanceGoal("Maximise 2-second continuous video plays")).toBe("video_2s_plays");
    expect(objectiveKeyFromConversionEvent("Lead", "Website and instant forms")).toBe("leads");
    expect(objectiveKeyFromConversionEvent("Lead", "Instant forms")).toBe("meta_form_leads");
    expect(objectiveKeyFromConversionEvent("Lead", "Messenger")).toBe("leads");
    expect(objectiveKeyFromConversionEvent("Lead", "Website")).toBe("website_leads");
  });
  it("keeps Contact, Lead, Start trial and Subscribe as distinct source events", () => {
    expect(resolveObjectiveFromResultType("Contact")?.resultLabel).toBe("CONTACTS");
    expect(resolveObjectiveFromResultType("Start trial")?.resultLabel).toBe("TRIALS STARTED");
    const rows = parseCsvText("Campaign name,Ad set name,Day,Result type,Results,Amount spent (USD)\nA,S,2026-10-01,Contact,2,100\nB,S,2026-10-01,Website lead,3,60\nC,S,2026-10-01,Start trial,4,80\nD,S,2026-10-01,Subscribe,1,30").rows;
    const report = buildReportData({ accountName: "Distinct events", currencySymbol: "$", timezone: "UTC", monthlyBudget: null, mtdDailyRows: rows, now: new Date("2026-10-03T12:00:00Z"), weeklyRange: { startIso: "2026-10-01", endIso: "2026-10-02" } });
    expect(report.mtdRow.resultColumns).toHaveLength(4);
    for (const [label, value, cprValue] of [["CONTACTS", "2", "$50.00"], ["WEBSITE LEADS", "3", "$20.00"], ["TRIALS STARTED", "4", "$20.00"], ["SUBSCRIPTIONS", "1", "$30.00"]]) expect(report.mtdRow.resultColumns).toContainEqual(expect.objectContaining({ label, value, cprValue }));
  });
});
