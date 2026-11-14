import {describe,it,expect} from "vitest";
import {metaApiImportRange} from "../meta-api-import-range";
import {computeMtdRangeIso} from "../date-range";
import {fmtCurrency} from "../format";
import {buildComparisonReportData} from "../report-data";
import {parseCsvText} from "../parse-csv";

describe("launch reporting contracts",()=>{
  it.each(["2026-11-01","2026-05-01","2026-03-01","2028-03-01"])("includes every MTD day on %s",day=>{
    const now=new Date(day+"T12:00:00Z");
    for(const timezone of ["UTC","Asia/Kolkata","America/Los_Angeles"]){
      const range=metaApiImportRange({reportType:"WEEKLY"},now,timezone),mtd=computeMtdRangeIso([],now,timezone);
      expect(range.sinceIso<=mtd.startIso).toBe(true);expect(range.untilIso>=mtd.endIso).toBe(true);
    }
  });
  it("retains cents and does not display positive sub-dollar spend as zero",()=>{
    expect(fmtCurrency(.2,"$")).toBe("$0.20");expect(fmtCurrency(547.64,"$")).toBe("$547.64");
  });
  it("does not claim an undefined cost improved by 100 percent",()=>{
    const rows=parseCsvText('Campaign name,Day,Amount spent (USD),Results,Result type,Reach,Impressions\nStopped,2026-11-12,0,0,Website leads,0,0\nStopped,2026-11-05,50,2,Website leads,100,200').rows;
    const data=buildComparisonReportData({accountName:"Test",currencySymbol:"$",timezone:"UTC",mtdDailyRows:rows,periodA:{startIso:"2026-11-06",endIso:"2026-11-12"},periodB:{startIso:"2026-10-30",endIso:"2026-11-05"},now:new Date("2026-11-13T12:00:00Z")});
    expect(data.campaigns[0].changes.cpr).toEqual({percent:null,direction:"flat"});
    expect(data.campaigns[0].metricsA.cpr.formatted).toBe("—");
    expect(data.totals.metricsB.spend.value).toBe(50);
  });
});
