import { describe, expect, it } from "vitest";
import { parseMtdCsvForAdPlatform } from "../tiktok-columns";
import { buildHistoricalReportData } from "../historical-report-data";
import { getRowDate } from "../columns";
import { parseDate } from "../dates";
import { parseCellNum } from "../format";

// Self-contained public synthetic data; never depend on an uploaded customer file.
function fixtureBuffer() {
 const lines=["Campaign name,Ad set name,Day,Amount spent (USD),Results,Result type,Reach,Impressions,Landing page views"];
 for(let month=5;month<=8;month++) for(let day=1;day<=new Date(2026,month,0).getDate();day++) {
  const date=`2026-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
  lines.push(`Grade School | Leads,Main,${date},7.01,1,Website leads,100,200,2`);
  lines.push(`Secondary,Main,${date},1,1,Website leads,20,40,1`);
 }
 return Buffer.from(lines.join("\n"));
}

function sumMayGradeSchool(rows: ReturnType<typeof parseMtdCsvForAdPlatform>["rows"]) {
  let spend = 0;
  let lpv = 0;
  let results = 0;
  let days = 0;
  for (const row of rows) {
    if (!row.campaign_name?.includes("Grade School")) continue;
    const d = parseDate(getRowDate(row));
    if (!d || d.month !== 5 || d.year !== 2026) continue;
    days += 1;
    spend += parseCellNum(row.spend);
    lpv += parseCellNum(row._raw?.["Landing page views"]);
    results += parseCellNum(row.results);
  }
  return { spend, lpv, results, days };
}

describe("Gravity 4-month CSV historical accuracy", () => {
  it("matches full-month CSV totals for May Grade School", () => {
    const buf = fixtureBuffer();
    const parsed = parseMtdCsvForAdPlatform(buf, "META");
    const now = new Date("2026-09-07T12:00:00Z");
    const manual = sumMayGradeSchool(parsed.rows);

    const data = buildHistoricalReportData({
      accountName: "Gravity",
      currencySymbol: "$",
      timezone: "UTC",
      monthlyBudget: null,
      mtdDailyRows: parsed.rows,
      monthCount: 4,
      now,
    });

    const mayGrade = data.slides.find(
      (s) =>
        !s.isMonthTotal &&
        s.performanceHeader === "YOUR MAY PERFORMANCE REPORT" &&
        s.campaignName === "Grade School | Leads",
    );
    expect(mayGrade).toBeDefined();

    const slideSpend = parseCellNum(mayGrade!.metrics.spend.replace("$", ""));
    expect(manual.spend).toBeGreaterThan(215);
    expect(slideSpend).toBeCloseTo(manual.spend, 1);
    expect(parseCellNum(mayGrade!.metrics.results)).toBeGreaterThanOrEqual(manual.results);
  });

  it("retains positive-spend campaigns and includes month totals + comparison rows", () => {
    const buf = fixtureBuffer();
    const parsed = parseMtdCsvForAdPlatform(buf, "META");
    const data = buildHistoricalReportData({
      accountName: "Gravity",
      currencySymbol: "$",
      timezone: "UTC",
      monthlyBudget: null,
      mtdDailyRows: parsed.rows,
      monthCount: 4,
      now: new Date("2026-09-07T12:00:00Z"),
    });

    const mayCampaignSlides = data.slides.filter(
      (s) => !s.isMonthTotal && s.performanceHeader === "YOUR MAY PERFORMANCE REPORT",
    );
    for (const slide of mayCampaignSlides) {
      expect(slide.ai.spendNum ?? 0).toBeGreaterThan(0);
    }

    expect(data.slides.some((s) => s.isMonthTotal && s.performanceHeader === "YOUR MAY MONTH TOTAL")).toBe(true);
    expect(data.comparisonRows).toHaveLength(4);
  });
});
