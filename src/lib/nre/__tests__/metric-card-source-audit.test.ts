import { describe, expect, it } from "vitest";
import { CURRENCY_SYMBOLS } from "../format";
import { META_METRIC_DICTIONARY, autoClassifyUnknownColumn } from "../meta-dictionary";
import { GOOGLE_METRIC_DICTIONARY } from "../google-dictionary";
import { parseCsvText } from "../parse-csv";
import { buildReportData } from "../report-data";
import { listAvailableMetrics } from "../available-metrics";
import { aggregateDynamicMetrics, type MetricRef } from "../dynamic-metrics";

const row = (raw: Record<string, string>) => ({ _raw: raw });
const selectable = (d: typeof META_METRIC_DICTIONARY) => d.filter(m => (m.type === "primary" || m.type === "secondary") && m.format && m.format !== "text");
const meta = selectable(META_METRIC_DICTIONARY);
const google = selectable(GOOGLE_METRIC_DICTIONARY as typeof META_METRIC_DICTIONARY);

describe.each([["meta", meta], ["google", google]] as const)("%s full card source audit", (platform, entries) => {
  it.each(entries.map(m => [m.csvName, m] as const))("preserves a single exported %s without extra columns", (_name, entry) => {
    const metric = entry as MetricRef;
    expect(aggregateDynamicMetrics([row({ [entry.csvName]: "2" })], [metric], platform)[entry.key]).toBe(2);
  });
});

const costs = meta.filter(m => m.perUnitOf && !["reach", "__avg__"].includes(m.perUnitOf) && m.key !== "cpc_all");
describe("every additive-denominator Meta cost card", () => {
  it.each(costs.map(m => [m.csvName, m] as const))("blends %s from spend and exported rates when event counts are absent", (_name, entry) => {
    const rows = [row({ "amount spent": "12", [entry.csvName]: "0.6" }), row({ "amount spent": "18", [entry.csvName]: "0.9" })];
    expect(aggregateDynamicMetrics(rows, [entry as MetricRef], "meta")[entry.key]).toBeCloseTo(0.75);
  });
});

it("does not sum custom per-event costs or unknown currency averages", () => {
  for (const header of ["Cost per custom event", "Average custom order value", "Average custom session length", "Cost/custom event"]) {
    const entry = autoClassifyUnknownColumn(header)!;
    const value = aggregateDynamicMetrics([row({ [header]: "2" }), row({ [header]: "3" })], [entry as MetricRef], "meta")[entry.key];
    expect(value).toBeNaN();
  }
});

it("does not average ROAS: uses spend weights and retains explicit zero-return days", () => {
  const metric = meta.find(m => m.csvName === "purchase roas")! as MetricRef;
  expect(aggregateDynamicMetrics([row({ "amount spent": "100", "purchase roas": "4" }), row({ "amount spent": "300", "purchase roas": "0" })], [metric], "meta")[metric.key]).toBe(1);
});

it("does not invent missing daily weights or combine daily unique reach", () => {
  const metric = meta.find(m => m.key === "cost_per_1k_reached")! as MetricRef;
  expect(aggregateDynamicMetrics([row({ "amount spent": "10", [metric.csvName]: "2" }), row({ "amount spent": "20", [metric.csvName]: "3" })], [metric], "meta")[metric.key]).toBeNaN();
  const cost = meta.find(m => m.key === "cost_per_lpv")! as MetricRef;
  expect(aggregateDynamicMetrics([row({ "amount spent": "10", [cost.csvName]: "2" }), row({ "amount spent": "20", [cost.csvName]: "" })], [cost], "meta")[cost.key]).toBeNaN();
});

it("recognizes an ISO currency suffix outside the original hard-coded set", () => {
  const cost = meta.find(m => m.key === "cost_per_lpv")! as MetricRef;
  expect(aggregateDynamicMetrics([row({ "Amount spent (AED)": "20", "Landing page views": "10" })], [cost], "meta")[cost.key]).toBe(2);
});


it("weights average order value by purchases when conversion value is absent", () => {
  const metric = meta.find(m => m.key === "avg_purchase_value")! as MetricRef;
  expect(aggregateDynamicMetrics([row({ Purchases: "2", [metric.csvName]: "10" }), row({ Purchases: "6", [metric.csvName]: "30" })], [metric], "meta")[metric.key]).toBe(25);
});

it("preserves zero counts as authoritative instead of substituting a conflicting cost rate", () => {
  const metric = meta.find(m => m.key === "cost_per_lpv")! as MetricRef;
  expect(aggregateDynamicMetrics([row({ "amount spent": "20", "landing page views": "0", [metric.csvName]: "2" })], [metric], "meta")[metric.key]).toBeNaN();
});

it("recovers dictionary ratio semantics even when a saved metric omitted perUnitOf", () => {
  const metric = meta.find(m => m.key === "cost_per_lpv")! as MetricRef;
  const saved = { ...metric };
  delete saved.perUnitOf;
  expect(aggregateDynamicMetrics([row({ "amount spent": "20", "landing page views": "10" })], [saved], "meta")[metric.key]).toBe(2);
});


it("renders an optional cost card in the real weekly builder without requiring its count column", () => {
  const { rows, headers } = parseCsvText(`Campaign name,Ad set name,Day,Amount spent (USD),Impressions,Reach,CTR (all),Results,Result type,Cost per landing page view
Example,Set,2026-10-20,12,1000,800,4,1,Website leads,0.6
Example,Set,2026-10-21,18,1000,800,4,1,Website leads,0.9`);
  const report = buildReportData({ accountName: "Example", currencySymbol: "$", timezone: "UTC", monthlyBudget: null, mtdDailyRows: rows, weeklyRange: { startIso: "2026-10-20", endIso: "2026-10-21" }, now: new Date("2026-10-22T12:00:00Z"), reportType: "WEEKLY", selectedMetrics: listAvailableMetrics(headers, "META"), campaignMetricOverrides: { example: ["spend", "reach", "impressions", "website_leads", "cost_per_website_lead", "ctr", "cost_per_lpv"] } });
  expect(report.campaignSlides[0].dynamicMetrics.find(m => m?.key === "cost_per_lpv")).toMatchObject({ value: "$0.75" });
});


describe("all supported report currency suffixes", () => {
  it.each(Object.keys(CURRENCY_SYMBOLS))("retains %s metric identity in the picker and reader", currency => {
    const header = `Cost per landing page view (${currency})`;
    const metric = listAvailableMetrics([`Amount spent (${currency})`, header], "META").find(m => m.key === "cost_per_lpv");
    expect(metric).toBeDefined();
    expect(aggregateDynamicMetrics([row({ [`Amount spent (${currency})`]: "12", [header]: "0.6" }), row({ [`Amount spent (${currency})`]: "18", [header]: "0.9" })], [metric!], "meta").cost_per_lpv).toBeCloseTo(0.75);
  });
});
