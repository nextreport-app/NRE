import {describe,expect,it,vi,beforeEach} from "vitest";
import {readFileSync,mkdirSync,writeFileSync} from "node:fs";
import JSZip from "jszip";
vi.mock("@/lib/prisma",()=>({prisma:{user:{findUnique:vi.fn().mockResolvedValue(null)}}}));
vi.mock("@/lib/meta-api",async original=>({...await original<typeof import("@/lib/meta-api")>(),fetchMetaAdSetReportingConfigs:vi.fn().mockResolvedValue([{id:"10",optimization_goal:"LEAD_GENERATION",promoted_object:{}}]),fetchMetaAdAccountInsights:vi.fn(),fetchMetaAdAccountCampaignPeriodInsights:vi.fn()}));
import {fetchMetaAdAccountInsights,fetchMetaAdAccountCampaignPeriodInsights,type MetaInsightRow} from "@/lib/meta-api";
import {fetchMetaReportCsv} from "../meta-api-sync";
import {metaApiImportRange,type MetaApiReportSelection} from "../meta-api-import-range";
import {parseCsvText} from "../parse-csv";
import {buildStandardReportForWizard} from "../report-engine/build-standard-from-wizard";
import {buildComparisonReportData} from "../report-data";
import {buildDayBreakdownReportData} from "../day-breakdown-report-data";
import {renderPptx,renderComparisonPptx,renderDayBreakdownPptx} from "../../pptx/render";
import type {Client} from "@/generated/prisma/client";
const now=new Date("2026-11-05T12:00:00Z");
const all:MetaInsightRow[]=Array.from({length:65},(_,i)=>{
 const day=new Date(Date.UTC(2026,8,1+i)).toISOString().slice(0,10);const leads=day==="2026-11-04"?0:2;
 return {campaign_id:"1",campaign_name:"Example Instant Form",adset_id:"10",adset_name:"Main",date_start:day,date_stop:day,spend:"10",impressions:"2000",reach:"1000",clicks:"10",ctr:"0.5",cpc:"1",inline_link_clicks:"5",optimization_goal:"LEAD_GENERATION",results:leads?[{indicator:"actions:onsite_conversion.lead_grouped",values:[{value:String(leads)}]}]:[],cost_per_result:leads?[{indicator:"actions:onsite_conversion.lead_grouped",values:[{value:"5"}]}]:[],actions:leads?[{action_type:"onsite_conversion.lead_grouped",value:String(leads)},{action_type:"lead",value:"99"}]:[]};
});
const client={id:"sample",userId:"owner",accountName:"API Review Sample",currency:"AUD",timezone:"UTC",monthlyBudget:null,campaignObjectiveCache:null,showBudgetPacingOnCover:false} as Client;
const templateBuffer=readFileSync("templates/dark.pptx");
beforeEach(()=>{
 vi.mocked(fetchMetaAdAccountInsights).mockImplementation(async request=>all.filter(row=>row.date_start!>=request.sinceIso&&row.date_start!<=request.untilIso));
 vi.mocked(fetchMetaAdAccountCampaignPeriodInsights).mockResolvedValue([{campaign_id:"1",campaign_name:"Example Instant Form",reach:"1200"}]);
});
const cases:{name:string;selection:MetaApiReportSelection;spend:number;results:number}[]=[
 {name:"weekly",selection:{reportType:"WEEKLY"},spend:70,results:12},
 {name:"monthly",selection:{reportType:"MONTHLY",dateSelection:{mode:"custom",customStart:"2026-10-01",customEnd:"2026-10-31"}},spend:310,results:62},
 {name:"comparison",selection:{reportType:"COMPARISON",comparisonPeriodA:{startIso:"2026-10-29",endIso:"2026-11-04"},comparisonPeriodB:{startIso:"2026-10-22",endIso:"2026-10-28"}},spend:70,results:12},
 {name:"daily",selection:{reportType:"DAY_BREAKDOWN",dateSelection:{mode:"custom",customStart:"2026-10-01",customEnd:"2026-10-10"}},spend:100,results:20},
];
describe("API data and independent CSV produce the same four report outcomes",()=>{
 it.each(cases)("$name uses actual conversion counts, account currency and shared PPT renderer",async({name,selection,spend,results})=>{
  const range=metaApiImportRange(selection,now,"UTC");
  const api=await fetchMetaReportCsv({accessToken:"fake",adAccountId:"act_123",timezone:"UTC",currency:"AUD",...range,requireDirectResultEvidence:true});
  expect(api.csvText).toContain("Amount spent (AUD)");expect(api.csvText).not.toContain("Amount spent (USD)");
  const apiRows=parseCsvText(api.csvText);
  const selected=all.filter(row=>row.date_start!>=range.sinceIso&&row.date_start!<=range.untilIso);
  const csv=parseCsvText("Campaign name,Ad set name,Day,Result type,Results,Amount spent (AUD),Cost per result,Impressions,Reach,Clicks (all),CTR (all),CPC (all),Link clicks\n"+selected.map(row=>`Example Instant Form,Main,${row.date_start},Leads (form),${row.date_start==="2026-11-04"?0:2},10,${row.date_start==="2026-11-04"?"":5},2000,1000,10,0.5,1,5`).join("\n"));
  const build=async(parsed:typeof apiRows)=>{
   const base={accountName:client.accountName,currencySymbol:"A$",timezone:"UTC",monthlyBudget:null,mtdDailyRows:parsed.rows,now};
   if(selection.reportType==="COMPARISON"){
    const data=buildComparisonReportData({...base,periodA:selection.comparisonPeriodA!,periodB:selection.comparisonPeriodB!});
    expect(data.totals.metricsA.spend.value).toBe(spend);expect(data.totals.metricsA.results.value).toBe(results);expect(data.totals.metricsA.cpr.value).toBeCloseTo(spend/results);
    return {data,ppt:await renderComparisonPptx({templateBuffer,data})};
   }
   if(selection.reportType==="DAY_BREAKDOWN"){
    const data=buildDayBreakdownReportData({...base,dateRange:{startIso:selection.dateSelection!.customStart!,endIso:selection.dateSelection!.customEnd!}});
    expect(data.dayRows).toHaveLength(10);expect(data.dayRows.reduce((sum,row)=>sum+Number(row.spend.replace(/[^0-9.]/g,"")),0)).toBe(spend);return {data,ppt:await renderDayBreakdownPptx({templateBuffer,data})};
   }
   const formData=new FormData();formData.set("reportType",JSON.stringify(selection.reportType));if(selection.dateSelection)formData.set("dateSelection",JSON.stringify(selection.dateSelection));
   const result=await buildStandardReportForWizard({client,platform:"META",mtdParsed:parsed,formData,now});if(!("data"in result))throw Error(result.error);
   expect(result.data.campaignSlides[0].metrics.spend).toBe(`A$${spend}`);expect(result.data.campaignSlides[0].metrics.results).toBe(String(results));
   expect(result.data.campaignSlides[0].metrics.cpr).toBe(`A$${(spend/results).toFixed(2)}`);
   return {data:result.data,ppt:await renderPptx({templateBuffer,data:result.data,currencySymbol:"A$"})};
  };
  const fromApi=await build(apiRows);const fromCsv=await build(csv);
  const text=async(bytes:Buffer)=>{const zip=await JSZip.loadAsync(bytes);return(await Promise.all(Object.keys(zip.files).filter(path=>/^ppt\/slides\/slide\d+\.xml$/.test(path)).map(async path=>[...(await zip.file(path)!.async("string")).matchAll(/<a:t>([^<]*)<\/a:t>/g)].map(match=>match[1]).join(" | ")))).join("\n");};
  const apiText=await text(fromApi.ppt),csvText=await text(fromCsv.ppt);
  expect(apiText).toContain("METRIC ABBREVIATION GUIDE");expect(apiText).not.toContain("{{");
  expect(apiText).toContain("A$");expect(apiText).not.toContain("₹");
  // Both sources independently pass the same monetary expectations; their rendered numbers agree.
  expect(apiText.match(/A\$[\d,.]+/g)).toEqual(csvText.match(/A\$[\d,.]+/g));
  if(process.env.META_API_REVIEW_ARTIFACT_DIR){mkdirSync(process.env.META_API_REVIEW_ARTIFACT_DIR,{recursive:true});writeFileSync(`${process.env.META_API_REVIEW_ARTIFACT_DIR}/${name}-api.pptx`,fromApi.ppt);}
 },30000);
});
