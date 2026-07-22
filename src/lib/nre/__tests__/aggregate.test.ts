import { describe, expect, it } from "vitest";
import { aggregateRows, splitMtdDaily } from "../aggregate";
import type { NreRow } from "../columns";

function dailyRow(overrides: Partial<Record<string, string>> & { day: string }): NreRow {
  const { day, ...rest } = overrides;
  return {
    _raw: { Day: day },
    campaign_name: "Campaign A",
    ad_set_name: "Ad Set 1",
    result_type: "",
    spend: "0",
    reach: "0",
    impressions: "0",
    results: "0",
    link_clicks: "0",
    ctr: "0",
    cpc: "0",
    frequency: "0",
    date_start: day,
    date_end: day,
    ...rest,
  };
}

describe("aggregateRows", () => {
  it("groups by campaign_name + ad_set_name ONLY, never by result_type", () => {
    const rows: NreRow[] = [
      dailyRow({ day: "01-07-2026", result_type: "", results: "0", spend: "10" }),
      dailyRow({ day: "02-07-2026", result_type: "Leads (form)", results: "5", spend: "20" }),
    ];
    const agg = aggregateRows(rows);
    expect(agg).toHaveLength(1);
    expect(agg[0].result_type).toBe("Leads (form)"); // picked up from the non-empty row
    expect(agg[0].spend).toBe(30);
    expect(agg[0].results).toBe(5);
  });

  it("keeps different campaigns/ad sets in separate groups", () => {
    const rows: NreRow[] = [
      dailyRow({ day: "01-07-2026", campaign_name: "Campaign A", ad_set_name: "Set 1" }),
      dailyRow({ day: "01-07-2026", campaign_name: "Campaign A", ad_set_name: "Set 2" }),
      dailyRow({ day: "01-07-2026", campaign_name: "Campaign B", ad_set_name: "Set 1" }),
    ];
    expect(aggregateRows(rows)).toHaveLength(3);
  });

  it("averages CTR/frequency/CPC across rows, ignoring zero values", () => {
    const rows: NreRow[] = [
      dailyRow({ day: "01-07-2026", ctr: "2", frequency: "1.5", cpc: "4" }),
      dailyRow({ day: "02-07-2026", ctr: "0", frequency: "0", cpc: "0" }), // excluded from averages
      dailyRow({ day: "03-07-2026", ctr: "4", frequency: "2.5", cpc: "6" }),
    ];
    const [g] = aggregateRows(rows);
    expect(g.ctr).toBeCloseTo(3); // avg(2,4)
    expect(g.frequency).toBeCloseTo(2); // avg(1.5,2.5)
    expect(g.cpc).toBeCloseTo(5); // avg(4,6)
  });

  it("falls back to spend/link_clicks for CPC when no daily CPC values exist", () => {
    const rows: NreRow[] = [
      dailyRow({ day: "01-07-2026", cpc: "0", spend: "100", link_clicks: "20" }),
    ];
    expect(aggregateRows(rows)[0].cpc).toBeCloseTo(5);
  });

  it("applies the Reach-as-proxy correction (results ≈ reach, link clicks present → Link click)", () => {
    const rows: NreRow[] = [
      dailyRow({
        day: "01-07-2026",
        result_type: "Reach",
        reach: "1000",
        results: "990", // within 3% of reach
        link_clicks: "500",
        spend: "250",
      }),
    ];
    const [g] = aggregateRows(rows);
    expect(g.result_type).toBe("Link click");
    expect(g.results).toBe(500); // now = link_clicks
    expect(g.cpr).toBeCloseTo(250 / 500);
  });

  it("does NOT apply the Reach-as-proxy correction when results diverge from reach", () => {
    const rows: NreRow[] = [
      dailyRow({
        day: "01-07-2026",
        result_type: "Reach",
        reach: "1000",
        results: "50", // far from reach
        link_clicks: "500",
        spend: "250",
      }),
    ];
    const [g] = aggregateRows(rows);
    expect(g.result_type).toBe("Reach");
    expect(g.results).toBe(50);
  });

  it("infers Link click when no result_type is set but link clicks exist and results are 0", () => {
    const rows: NreRow[] = [
      dailyRow({ day: "01-07-2026", result_type: "", results: "0", link_clicks: "300", spend: "150" }),
    ];
    const [g] = aggregateRows(rows);
    expect(g.result_type).toBe("Link click");
    expect(g.results).toBe(300);
    expect(g.cpr).toBeCloseTo(0.5);
  });

  it("computes REACH cpr as cost-per-1K-reach when there is no correction to apply", () => {
    const rows: NreRow[] = [
      dailyRow({ day: "01-07-2026", result_type: "Reach", reach: "1000", results: "0", spend: "50" }),
    ];
    const [g] = aggregateRows(rows);
    expect(g.result_type).toBe("Reach");
    expect(g.cpr).toBeCloseTo(50); // (50 * 1000) / 1000
  });
});

describe("splitMtdDaily", () => {
  const now = new Date("2026-07-20T10:00:00Z"); // "today" per the script's UTC-date rule

  it("excludes today's rows entirely, even if present in the CSV", () => {
    const rows: NreRow[] = [
      dailyRow({ day: "18-07-2026", spend: "10" }),
      dailyRow({ day: "19-07-2026", spend: "20" }),
      dailyRow({ day: "20-07-2026", spend: "999" }), // "today" — must be excluded
    ];
    const result = splitMtdDaily(rows, now);
    expect(result).not.toBeNull();
    const mtdSpend = result!.mtdRows.reduce((s, r) => s + r.spend, 0);
    expect(mtdSpend).toBe(30);
  });

  it("returns null when there are no valid (non-today) rows", () => {
    const rows: NreRow[] = [dailyRow({ day: "20-07-2026" })];
    expect(splitMtdDaily(rows, now)).toBeNull();
  });

  it("builds a trailing 7-day weekly window ending on the latest valid day", () => {
    // Days 1-19 July, "today" = 20 July → latest valid = 19 July.
    // Weekly window = 13 July .. 19 July inclusive (7 days).
    const rows: NreRow[] = [];
    for (let day = 1; day <= 19; day++) {
      rows.push(dailyRow({ day: `${String(day).padStart(2, "0")}-07-2026`, spend: "1" }));
    }
    const result = splitMtdDaily(rows, now);
    expect(result).not.toBeNull();
    expect(result!.weeklyRows[0].date_start).toBe("13-07-2026");
    expect(result!.weeklyRows[0].date_end).toBe("19-07-2026");
    expect(result!.mtdRows[0].date_start).toBe("01-07-2026");
    expect(result!.mtdRows[0].date_end).toBe("19-07-2026");
  });

  it("caps the latest date at yesterday even if the CSV's max date is further in the future", () => {
    const rows: NreRow[] = [
      dailyRow({ day: "19-07-2026", spend: "5" }),
      dailyRow({ day: "25-07-2026", spend: "999" }), // future — must be excluded/capped
    ];
    const result = splitMtdDaily(rows, now);
    expect(result).not.toBeNull();
    const mtdSpend = result!.mtdRows.reduce((s, r) => s + r.spend, 0);
    expect(mtdSpend).toBe(5);
  });
});
