import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import JSZip from "jszip";
import { parseCsvText } from "../parse-csv";
import { buildReportData } from "../report-data";
import { renderPptx } from "../../pptx/render";

const cases = [
  { name: "checkout", columns: "Initiate checkout,Cost per initiate checkout", values: "2,50", type: "Initiate checkout", results: 2, label: "INITIATE CHECKOUT", rate: "$50.00" },
  { name: "purchases with secondary leads", columns: "Purchases,Website leads", values: "2,1", type: "Website purchases", results: 2, label: "PURCHASES", rate: "$50.00" },
  { name: "impressions CPM", columns: "Purchases,Website leads", values: "0,0", type: "Impressions", results: 10000, label: "IMPRESSIONS", rate: "$10.00" },
];

describe.each(["dark.pptx", "meta-ads-light.pptx"])("source figures survive %s rendering", template => {
  it.each(cases)("writes the expected $name count and rate into actual table cells", async example => {
    const csv = `Campaign name,Ad set name,Day,Result type,Results,Amount spent (USD),Reach,Impressions,${example.columns}\nCampaign A,Set A,2026-10-01,${example.type},${example.results},100,100,10000,${example.values}`;
    const data = buildReportData({ accountName: "Accounting acceptance", currencySymbol: "$", timezone: "UTC", monthlyBudget: null, mtdDailyRows: parseCsvText(csv).rows, now: new Date("2026-10-03T12:00:00Z"), weeklyRange: { startIso: "2026-10-01", endIso: "2026-10-02" } });
    const buffer = await renderPptx({ templateBuffer: readFileSync(resolve(process.cwd(), "templates", template)), data, currencySymbol: "$", isLightTemplate: template.includes("light") });
    const zip = await JSZip.loadAsync(buffer);
    const tables: string[] = [];
    for (const path of Object.keys(zip.files).filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name))) {
      const xml = await zip.file(path)!.async("string");
      const table = xml.match(/<a:tbl>[\s\S]*?<\/a:tbl>/)?.[0];
      if (table) tables.push(table);
    }
    expect(tables).toHaveLength(1);
    const rows = [...tables[0].matchAll(/<a:tr\b[\s\S]*?<\/a:tr>/g)].map(match => [...match[0].matchAll(/<a:tc\b[\s\S]*?<\/a:tc>/g)].map(cell => [...cell[0].matchAll(/<a:t>([^<]*)<\/a:t>/g)].map(text => text[1]).join("")));
    expect(rows[0]).toContain(example.label);
    expect(rows[1]).toContain(example.results.toLocaleString("en-US"));
    expect(rows[1]).toContain(example.rate);
  }, 30_000);
});
