import { parseCsvText } from "../nre/parse-csv";
import { buildReportData } from "../nre/report-data";
import { renderPptx } from "../pptx/render";
export async function renderAgencyTemplatePreview(
  templateBuffer: Buffer,
  variant: "DARK" | "LIGHT",
) {
  const rows: string[] = [];
  for (
    let d = new Date("2026-10-01T12:00Z");
    d <= new Date("2026-11-21T12:00Z");
    d = new Date(d.getTime() + 86400000)
  )
    for (const [campaign, type, results] of [
      ["Sample lead campaign", "On-Facebook leads", 4],
      ["Sample traffic campaign", "Link clicks", 30],
    ])
      rows.push(
        `${campaign},${d.toISOString().slice(0, 10)},20,${results},${type},1000,2000,50,30`,
      );
  const parsed = parseCsvText(
    "Campaign name,Day,Amount spent (USD),Results,Result type,Reach,Impressions,Clicks (all),Link clicks\n" +
      rows.join("\n"),
  );
  const data = buildReportData({
    accountName: "Sample client · template preview",
    currencySymbol: "$",
    timezone: "UTC",
    monthlyBudget: 1500,
    showBudgetPacingOnCover: true,
    mtdDailyRows: parsed.rows,
    reportType: "WEEKLY",
    selectedAdSets: [],
    now: new Date("2026-11-22T12:00Z"),
  });
  return renderPptx({
    templateBuffer,
    data,
    currencySymbol: "$",
    agencyName: "Sample agency",
    reportTitle: "SAMPLE REPORT — DESIGN REVIEW",
    isLightTemplate: variant === "LIGHT",
  });
}
