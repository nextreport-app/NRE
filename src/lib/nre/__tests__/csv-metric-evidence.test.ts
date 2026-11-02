import { describe, expect, it } from "vitest";
import { parseCsvText } from "../parse-csv";
import { buildCsvMetricHeaderProfile, hasNumericCsvValue, numericMetricHeaders, selectedMetricHeaders } from "../csv-metric-evidence";
import { dailyOptionalMetrics, buildDailyExtraTables } from "../daily-extra-metrics";
import { comparisonOptionalMetrics, buildComparisonExtraMetrics } from "../comparison-extra-metrics";
import { buildCampaignMetricBundle } from "../wizard-campaign-metrics";
const source=parseCsvText("Campaign name,Day,Amount spent (USD),Results,Result type,Reach,Impressions,Clicks (all),Meta leads,Link clicks,Landing page views,Cost per landing page view,Results (initial)\nWebsite,2026-10-30,10,2,website submission,100,1000,40,,20,10,1,\nWebsite,2026-10-31,10,2,website submission,100,1000,40,,20,0,,");
const lead={resultLabel:"WEBSITE LEADS",costLabel:"COST PER WEBSITE LEAD"};
describe("CSV metric value evidence",()=>{
  it.each(["", " ", "—", "-", "N/A", "NaN", "unknown 0", null, undefined, NaN, Infinity])("does not treat %s as a numeric observation",value=>expect(hasNumericCsvValue(value)).toBe(false));
  it.each([0,"0","0.00","-0","1,234.50","0%","₹0.00","USD 0","EUR 0","0 GBP","(1,200.00)"]) ("preserves actual numeric cells including %s",value=>expect(hasNumericCsvValue(value)).toBe(true));
  it("excludes a completely blank Meta leads column from Daily and Comparison",()=>{
    const profile=buildCsvMetricHeaderProfile(source.headers,source.rows);
    expect(source.headers).toContain("Meta leads");
    expect(profile.all).not.toContain("Meta leads");
    expect(profile.all).not.toContain("Results (initial)");
    const headers=selectedMetricHeaders(profile,["Website"]);
    for(const metrics of [dailyOptionalMetrics(headers,[lead]),comparisonOptionalMetrics(headers,"META")]) {
      expect(metrics.map(metric=>metric.key)).not.toContain("meta_form_leads");
      expect(metrics.map(metric=>metric.key)).toContain("link_clicks");
      expect(metrics.map(metric=>metric.key)).toContain("landing_page_views");
    }
  });
  it("keeps an explicitly exported zero Meta leads column available",()=>{
    const rows=source.rows.map(row=>({...row,_raw:{...row._raw,"Meta leads":"0"}}));
    const profile=buildCsvMetricHeaderProfile(source.headers,rows);
    expect(dailyOptionalMetrics(profile.all,[lead]).map(metric=>metric.key)).toContain("meta_form_leads");
    const extras=buildComparisonExtraMetrics({rowsA:rows,rowsB:[],keys:["meta_form_leads"],headers:source.headers,platform:"META",currencySymbol:"$",objective:lead.resultLabel,costLabel:lead.costLabel});
    expect(extras[0]).toMatchObject({valueA:0,formattedA:"0"});
  });
  it("limits evidence to selected campaigns rather than borrowing observations from others",()=>{
    const other={...source.rows[0],campaign_name:"Forms",_raw:{...source.rows[0]._raw,"Meta leads":"4"}};
    const profile=buildCsvMetricHeaderProfile(source.headers,[...source.rows,other]);
    expect(profile.all).toContain("Meta leads");
    expect(selectedMetricHeaders(profile,["Website"])).not.toContain("Meta leads");
    expect(selectedMetricHeaders(profile,["Forms"])).toContain("Meta leads");
    expect(selectedMetricHeaders(profile,["Website","Forms"])).toContain("Meta leads");
  });
  it("does not offer blank columns in Weekly/Monthly campaign pickers or after objective changes",()=>{
    const headers=numericMetricHeaders(source.headers,source.rows);
    for(const labels of [lead,{resultLabel:"PURCHASES",costLabel:"COST PER PURCHASE"}]) {
      const bundle=buildCampaignMetricBundle("META",source.headers,labels.resultLabel,labels.costLabel,undefined,headers);
      expect(bundle.available.map(metric=>metric.key)).not.toContain("meta_form_leads");
    }
  });
  it("ignores a forced additional metric request when its entire CSV column is blank",()=>{
    const extras=buildComparisonExtraMetrics({rowsA:source.rows,rowsB:[],keys:["meta_form_leads","link_clicks"],headers:source.headers,platform:"META",currencySymbol:"$",objective:lead.resultLabel,costLabel:lead.costLabel});
    expect(extras.map(metric=>metric.key)).toEqual(["link_clicks"]);
    const tables=buildDailyExtraTables(new Map([["2026-10-30",source.rows]]),source.headers,["meta_form_leads","link_clicks"],[lead],"$");
    expect(tables[0].metrics.map(metric=>metric.key)).toEqual(["link_clicks"]);
  });
});
