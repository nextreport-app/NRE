import { describe, expect, it } from "vitest";
import { aggregateRows, splitMtdDaily } from "../aggregate";
import { getResultLabels } from "../objective";
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

  it("trusts an explicit 'Reach' result_type as Step 1 (priority 1) — no longer overridden by link-click proximity heuristics", () => {
    // Step 1 (result_type text) is the top of the priority chain and, once
    // matched, is trusted outright — the old "reach ≈ results, so it's
    // really Traffic" heuristic was a Step-3-era guess that the new
    // column-presence/data-value chain (Steps 2-4) replaces; it no longer
    // applies when Step 1 already resolved the objective.
    const rows: NreRow[] = [
      dailyRow({
        day: "01-07-2026",
        result_type: "Reach",
        reach: "1000",
        results: "990", // previously "close enough to reach" to trigger the old override
        link_clicks: "500",
        spend: "250",
      }),
    ];
    const [g] = aggregateRows(rows);
    expect(g.result_type).toBe("Reach");
    expect(g.results).toBe(990);
  });

  it("infers LINK CLICKS (Step 3, data values) when no result_type/objective column exists, link clicks are non-zero, and reach differs from results", () => {
    const rows: NreRow[] = [
      dailyRow({
        day: "01-07-2026",
        result_type: "",
        results: "0",
        reach: "1200", // non-zero and different from results — Meta always tracks reach
        link_clicks: "300",
        spend: "150",
      }),
    ];
    const [g] = aggregateRows(rows);
    expect(getResultLabels(g.result_type).resultLabel).toBe("LINK CLICKS");
    expect(g.results).toBe(300);
    expect(g.cpr).toBeCloseTo(0.5);
  });

  it("does NOT infer LINK CLICKS when reach equals results (both genuinely zero — no signal at all, falls to generic RESULTS)", () => {
    const rows: NreRow[] = [
      dailyRow({ day: "01-07-2026", result_type: "", results: "0", reach: "0", link_clicks: "300", spend: "150" }),
    ];
    const [g] = aggregateRows(rows);
    expect(getResultLabels(g.result_type).resultLabel).toBe("RESULTS");
  });

  it("computes REACH cpr as cost-per-1K-reach", () => {
    const rows: NreRow[] = [
      dailyRow({ day: "01-07-2026", result_type: "Reach", reach: "1000", results: "0", spend: "50" }),
    ];
    const [g] = aggregateRows(rows);
    expect(g.result_type).toBe("Reach");
    expect(g.cpr).toBeCloseTo(50); // (50 * 1000) / 1000
  });

  describe("column-presence objective detection (priority 2, above data-value fallbacks)", () => {
    /**
     * Builds a row the way a real parsed CSV would: every header present as
     * a _raw key regardless of value (see columns.ts's readRowsWithAutoMap),
     * so detectObjectiveFromColumns can see which columns the agency's
     * export actually included.
     */
    function csvRow(overrides: {
      day: string;
      linkClicks?: string;
      websiteLeads?: string;
      purchases?: string;
      spend?: string;
    }): NreRow {
      const { day, linkClicks = "0", websiteLeads, purchases, spend = "150" } = overrides;
      const raw: Record<string, string> = {
        Day: day,
        "Campaign name": "New Leads Campaign",
        "Ad set name": "Ad Set 1",
        "Result type": "",
        "Link clicks": linkClicks,
        "Landing page views": "0",
        "Amount spent": spend,
      };
      if (websiteLeads !== undefined) raw["Website leads"] = websiteLeads;
      if (purchases !== undefined) raw["Purchases"] = purchases;

      // results binds to whichever objective-specific column exists, same
      // as buildColumnMap would (both "Website leads" and "Purchases" carry
      // the count for their own objective).
      const resultsValue = websiteLeads ?? purchases ?? "0";

      return {
        _raw: raw,
        campaign_name: "New Leads Campaign",
        ad_set_name: "Ad Set 1",
        result_type: "",
        spend,
        reach: "0",
        impressions: "0",
        results: resultsValue,
        link_clicks: linkClicks,
        ctr: "0",
        cpc: "0",
        frequency: "0",
        date_start: day,
        date_end: day,
      };
    }

    it("detects WEBSITE LEADS for a brand new campaign with zero results — a Website leads column exists, even with no link clicks at all", () => {
      const rows: NreRow[] = [csvRow({ day: "18-07-2026", websiteLeads: "0", linkClicks: "0" })];
      const [g] = aggregateRows(rows);
      expect(getResultLabels(g.result_type).resultLabel).toBe("WEBSITE LEADS");
      expect(g.results).toBe(0); // zero results shown as 0, not hidden/miscounted
      expect(g.objectiveConfident).toBe(true); // Step 2 (column presence) is a confident signal
    });

    it("detects PURCHASES for a brand new campaign with zero results — a Purchases column exists", () => {
      const rows: NreRow[] = [csvRow({ day: "18-07-2026", purchases: "0", linkClicks: "0" })];
      const [g] = aggregateRows(rows);
      expect(getResultLabels(g.result_type).resultLabel).toBe("PURCHASES");
      expect(g.results).toBe(0);
    });

    it("still detects WEBSITE LEADS, not LINK CLICKS, when link clicks are non-zero — column presence beats data values", () => {
      // The exact reported scenario: result_type empty, Website leads column
      // present but 0 so far, Link clicks non-zero (Meta always tracks
      // clicks regardless of objective) — must not fall through to Traffic.
      const rows: NreRow[] = [
        csvRow({ day: "18-07-2026", websiteLeads: "0", linkClicks: "10" }),
        csvRow({ day: "19-07-2026", websiteLeads: "0", linkClicks: "10" }),
      ];
      const [g] = aggregateRows(rows);
      expect(getResultLabels(g.result_type).resultLabel).toBe("WEBSITE LEADS");
      expect(g.results).toBe(0);
      expect(g.link_clicks).toBe(20); // link clicks still tracked, just not used as the objective
      expect(g.cpr).toBe(0); // no results yet → cost-per-result not computable
    });

    it("falls back to Step 3's data-value Link Clicks detection when no objective column is present at all", () => {
      // Regression guard: a genuine Traffic campaign (no recognizable
      // objective column, just link clicks and reach) must keep working.
      const rows: NreRow[] = [
        {
          _raw: { Day: "18-07-2026", "Campaign name": "Traffic Campaign", "Link clicks": "300", Reach: "1200" },
          campaign_name: "Traffic Campaign",
          ad_set_name: "Ad Set 1",
          result_type: "",
          spend: "150",
          reach: "1200",
          impressions: "0",
          results: "0",
          link_clicks: "300",
          ctr: "0",
          cpc: "0",
          frequency: "0",
          date_start: "18-07-2026",
          date_end: "18-07-2026",
        },
      ];
      const [g] = aggregateRows(rows);
      expect(getResultLabels(g.result_type).resultLabel).toBe("LINK CLICKS");
      expect(g.results).toBe(300);
      expect(g.objectiveConfident).toBe(false); // Step 3 (data values) is not a confident signal
    });
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

  it("MTD is bounded to day 1 of the month through yesterday, even if the CSV has earlier rows", () => {
    // A CSV that (unusually) includes a few trailing days from the previous
    // month must not have them bleed into MTD — MTD is always exactly the
    // reporting month, not "every valid row in the file".
    const rows: NreRow[] = [
      dailyRow({ day: "29-06-2026", spend: "999" }), // previous month — must be excluded from MTD
      dailyRow({ day: "30-06-2026", spend: "999" }), // previous month — must be excluded from MTD
      dailyRow({ day: "01-07-2026", spend: "10" }),
      dailyRow({ day: "19-07-2026", spend: "20" }),
    ];
    const result = splitMtdDaily(rows, now);
    expect(result).not.toBeNull();
    expect(result!.mtdRows[0].date_start).toBe("01-07-2026");
    const mtdSpend = result!.mtdRows.reduce((s, r) => s + r.spend, 0);
    expect(mtdSpend).toBe(30);
  });

  it("uses an explicit weeklyRange instead of the default trailing-7-days window when given", () => {
    const rows: NreRow[] = [];
    for (let day = 1; day <= 19; day++) {
      rows.push(dailyRow({ day: `${String(day).padStart(2, "0")}-07-2026`, spend: "1" }));
    }
    const result = splitMtdDaily(rows, now, {
      weeklyRange: { startIso: "2026-07-05", endIso: "2026-07-11" },
    });
    expect(result).not.toBeNull();
    expect(result!.weeklyRows[0].date_start).toBe("05-07-2026");
    expect(result!.weeklyRows[0].date_end).toBe("11-07-2026");
    const weeklySpend = result!.weeklyRows.reduce((s, r) => s + r.spend, 0);
    expect(weeklySpend).toBe(7); // 7 days at spend "1" each
  });

  it("an explicit weeklyRange never affects MTD, which still covers the full month", () => {
    const rows: NreRow[] = [];
    for (let day = 1; day <= 19; day++) {
      rows.push(dailyRow({ day: `${String(day).padStart(2, "0")}-07-2026`, spend: "1" }));
    }
    const result = splitMtdDaily(rows, now, {
      weeklyRange: { startIso: "2026-07-05", endIso: "2026-07-11" },
    });
    expect(result).not.toBeNull();
    expect(result!.mtdRows[0].date_start).toBe("01-07-2026");
    expect(result!.mtdRows[0].date_end).toBe("19-07-2026");
    const mtdSpend = result!.mtdRows.reduce((s, r) => s + r.spend, 0);
    expect(mtdSpend).toBe(19);
  });

  it("supports a weeklyRange that lands in a 'previous 7 days' window before the default one", () => {
    const rows: NreRow[] = [];
    for (let day = 1; day <= 19; day++) {
      rows.push(dailyRow({ day: `${String(day).padStart(2, "0")}-07-2026`, spend: "1" }));
    }
    // Default last7 would be 13-19 July; "previous 7 days" is 6-12 July.
    const result = splitMtdDaily(rows, now, {
      weeklyRange: { startIso: "2026-07-06", endIso: "2026-07-12" },
    });
    expect(result!.weeklyRows[0].date_start).toBe("06-07-2026");
    expect(result!.weeklyRows[0].date_end).toBe("12-07-2026");
  });
});
