import {describe,expect,it} from "vitest";
import {collectLegendEntries} from "../legend-collect";
import type {ReportData} from "../../nre/report-data";
const tableHeaderLabels={} as ReportData["tableHeaderLabels"];
describe("overview metric glossary",()=>{
 it("defines CPC (all) shown in the overview even when only CPLC is selected on cards",()=>{
  const data={platform:"META" as const,tableHeaderLabels,campaignSlides:[{dynamicMetrics:[{key:"cpc_link",label:"CPLC",value:"$0.32"}]}],adSetSlides:[]} as unknown as ReportData;
  const entries=collectLegendEntries(data);
  expect(entries.find(entry=>entry.term==="CPC (ALL)")?.explanation).toContain("all ad clicks");
  expect(entries.filter(entry=>entry.term==="CPLC")).toHaveLength(1);
  expect(entries.filter(entry=>entry.term==="CTR (ALL)")).toHaveLength(1);
 });
 it("does not duplicate a metric already selected on a slide",()=>{
  const data={platform:"META" as const,tableHeaderLabels,campaignSlides:[{dynamicMetrics:[{key:"cpc_all",label:"CPC (ALL)",value:"$0.68"}]}],adSetSlides:[]} as unknown as ReportData;
  expect(collectLegendEntries(data).filter(entry=>entry.term==="CPC (ALL)")).toHaveLength(1);
 });
});
