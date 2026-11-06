import { expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import JSZip from "jszip";
vi.mock("@/lib/meta-api", async original => ({ ...await original<typeof import("@/lib/meta-api")>(), fetchMetaAdAccountInsights: vi.fn(), fetchMetaAdSetReportingConfigs: vi.fn(), fetchMetaAdAccountCampaignPeriodInsights: vi.fn().mockResolvedValue([]) }));
import { fetchMetaAdAccountInsights, fetchMetaAdSetReportingConfigs } from "@/lib/meta-api";
import { fetchMetaReportCsv } from "../meta-api-sync";
import { parseCsvText } from "../parse-csv";
import { buildCampaignMetricBundle } from "../wizard-campaign-metrics";
import { buildCampaignObjectiveMapWithConfidence } from "../objective";
import { buildReportData } from "../report-data";
import { renderPptx } from "../../pptx/render";

it("keeps computed CPLC in CSV/API defaults and the generated PPT when only all-click CPC is supplied", async () => {
  vi.mocked(fetchMetaAdAccountInsights).mockResolvedValue([{campaign_id:"1",campaign_name:"Traffic",adset_id:"2",adset_name:"Traffic set",date_start:"2026-11-05",date_stop:"2026-11-05",spend:"90",reach:"10574",impressions:"17673",clicks:"557",ctr:"3.15",cpc:String(90/557),inline_link_clicks:"473",optimization_goal:"LINK_CLICKS",actions:[{action_type:"link_click",value:"473"},{action_type:"landing_page_view",value:"370"}]}]);
  vi.mocked(fetchMetaAdSetReportingConfigs).mockResolvedValue([{id:"2",optimization_goal:"LINK_CLICKS",promoted_object:{}}]);
  const api = await fetchMetaReportCsv({accessToken:"fixture",adAccountId:"123",currency:"USD",timezone:"UTC",sinceIso:"2026-10-07",untilIso:"2026-11-05",requireDirectResultEvidence:true});
  const manual = 'Campaign name,Ad set name,Day,Amount spent (USD),Reach,Impressions,CTR (all),CPC (all),Link clicks,Landing page views,Cost per landing page view,Result type,Results\nTraffic,Traffic set,2026-11-05,90,10574,17673,3.15,0.1615798923,473,370,0.243243,Link clicks,473';
  const selections = [];
  for (const text of [manual,api.csvText]) {
    const parsed = parseCsvText(text);
    const objective = buildCampaignObjectiveMapWithConfidence(parsed.rows).get("traffic")!;
    expect(objective.resultLabel).toBe("LINK CLICKS");
    const bundle = buildCampaignMetricBundle("META",parsed.headers,objective.resultLabel,objective.costLabel);
    expect(bundle.selection.find(metric=>metric.key==="cpc_link_click")?.label).toBe("CPLC");
    expect(bundle.selection.map(metric=>metric.key)).not.toContain("cpc_all");
    selections.push(bundle.selection.map(metric=>({key:metric.key,label:metric.label})));
    const report = buildReportData({accountName:"Fixture",currencySymbol:"$",timezone:"UTC",monthlyBudget:null,mtdDailyRows:parsed.rows,weeklyRange:{startIso:"2026-10-30",endIso:"2026-11-05"},now:new Date("2026-11-06T12:00:00Z"),reportType:"WEEKLY",selectedCampaigns:["Traffic"],selectedMetrics:[...bundle.selection,{key:"cpc_all",label:"CPC (ALL)",format:"currency",csvName:"cpc (all)"}]});
    expect(report.campaignSlides[0].dynamicMetrics.find(metric=>metric?.key==="cpc_link_click")).toMatchObject({label:"CPLC",value:"$0.19"});
    expect(report.campaignSlides[0].dynamicMetrics.some(metric=>metric?.key==="cpc_all")).toBe(false);
    const zip = await JSZip.loadAsync(await renderPptx({templateBuffer:readFileSync("templates/dark.pptx"),data:report,currencySymbol:"$"}));
    const xml = await zip.file("ppt/slides/slide2.xml")!.async("string");
    expect(xml).toContain("CPLC"); expect(xml).toContain("$0.19"); expect(xml).not.toContain("CPC (ALL)");
  }
  expect(selections[0]).toEqual(selections[1]);
},30000);
