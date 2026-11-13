import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { WizardMetricsStep } from "../steps/metrics-step";
const state = vi.hoisted(() => ({ count: 3, invalidCount: null as number | null }));
vi.mock("../wizard-context", () => ({ useWizardContext: () => {
  const campaigns = ["RV leads", "Retargeting", "Boat leads"].slice(0,state.count);
  return { step:3, reportType:"WEEKLY", platform:"META", dataSourceMode:"csv", campaigns, selectedCampaigns:new Set(campaigns), MIN_SELECTED_METRICS:2, MAX_TOTAL_METRICS:64, MAX_METRICS_PER_SLIDE:8, metricsStatus:"done", perCampaignMinWarning:null,
    perCampaignMetrics:new Map(campaigns.map(name=>[name.toLowerCase(),Array.from({length:name==='Retargeting' && state.invalidCount!==null ? state.invalidCount : 2},(_,i)=>({key:`metric${i}`,label:`METRIC ${i}`}))])),
    campaignObjectives:new Map(campaigns.map(name=>[name.toLowerCase(),{resultLabel:name==='Retargeting'?'REACH':'WEBSITE LEADS'}])),
    campaignAvailableMetrics:()=>[], addCampaignMetric:vi.fn(),removeCampaignMetric:vi.fn(),handleMetricsContinue:vi.fn(),setStep:vi.fn(),
  };
} }));
vi.mock("@/hooks/use-wizard-copy",()=>({useWizardCopy:()=>({back:"Back",continueToGenerate:"Continue to generate",stepOf:()=>"Metrics"})}));
vi.mock("@/components/site-theme-provider",()=>({useSiteTheme:()=>({locale:"en"})}));
vi.mock("../ui/wizard-step-help",()=>({WizardStepHelp:()=>null}));
vi.mock("../ui/wizard-sticky-footer",()=>({WizardStickyFooter:()=>null}));
beforeEach(()=>{state.count=3;state.invalidCount=null;});
const expansion = (html:string) => [...html.matchAll(/<button[^>]*aria-expanded="(true|false)"/g)].map(match=>match[1]);
describe("per-campaign metric overview",()=>{
  it("shows every campaign header and objective with just the first panel expanded",()=>{
    const html=renderToStaticMarkup(<WizardMetricsStep/>);
    for(const text of ["RV leads","Retargeting","Boat leads","WEBSITE LEADS","REACH"]) expect(html).toContain(text);
    expect(expansion(html)).toEqual(["true","false","false"]);
    expect(html).not.toContain("Show metrics for"); expect(html).not.toContain("Show fewer campaigns");
    expect(html.match(/2 metrics · 1 slide/g)).toHaveLength(3);
  });
  it("shows a single campaign directly without a redundant expansion control",()=>{
    state.count=1;const html=renderToStaticMarkup(<WizardMetricsStep/>);
    expect(expansion(html)).toEqual([]);
    expect(html).toContain('aria-label="Remove METRIC 0"');
    expect(html).not.toContain('hidden=""');
  });
  it.each([0,1,65])("opens an invalid campaign with %i metrics and blocks Continue",count=>{
    state.invalidCount=count;const html=renderToStaticMarkup(<WizardMetricsStep/>);
    expect(expansion(html)).toEqual(["true","true","false"]);
    expect(html).toContain("Review metrics"); expect(html).toContain('role="alert"');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Continue to generate<\/button>/);
  });
});
