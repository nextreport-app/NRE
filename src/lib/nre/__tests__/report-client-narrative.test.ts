import {describe, expect, it} from "vitest";
import {metaClientNarrative, comparisonClientNarrative} from "../report-client-narrative";
import type {MetaPerformanceRow, MetaContentOptions} from "../meta-report-content/types";
import type {ComparisonCampaignData} from "../report-data";
const row = (name: string, spend: number, results: number | null): MetaPerformanceRow => ({key:name,name,spend,results,impressions:1000,ctr:1,cpr:results ? spend/results : null,cpc:1,cpm:spend,roas:null,websiteCvr:null,eligible:true});
const options: MetaContentOptions={audience:['age'],creatives:false,includeStandard:false,ranking:'cpr',minSpend:0,minResults:5};
const run = (rows: MetaPerformanceRow[], overrides: Partial<Parameters<typeof metaClientNarrative>[0]> = {}) => metaClientNarrative({rows,total:{...row('Total',rows.reduce((n,r)=>n+r.spend,0),rows.every(r=>r.results!==null)?rows.reduce((n,r)=>n+r.results!,0):null),impressions:rows.reduce((n,r)=>n+r.impressions,0)},objective:'META FORM LEADS',costLabel:'COST PER LEAD',dimension:'Age',currency:'$',creative:false,options,...overrides});
describe('shared client narrative facts',()=>{
 it('distinguishes a known subtotal from incomplete results without inventing a total or overall cost',()=>{
  const n=run([row('Feed',50,10),row('Search',5,null)],{dimension:'Placement'});
  expect(n.summary).toContain('Available segments report 10 meta form leads; 1 segment has unavailable results');
  expect(n.summary).toContain('Overall results and cost per lead are unavailable');
  expect(n.summary).not.toContain('Cost per lead:');
  expect(n.insights.join(' ')).not.toContain('recorded the most meta form leads');
  expect(n.insights.join(' ')).toContain('Among segments with available results and at least 5 results');
  const zero=run([row('Feed',50,0),row('Search',5,null)]);
  expect(zero.summary).toContain('Available segments report 0 meta form leads');
  expect(zero.insights.join(' ')).not.toContain('No meta form leads were recorded');
  const reach=run([row('A',10,100),row('B',20,null)],{objective:'REACH'});
  expect(reach.summary).not.toContain('Available segments report');
  const creative=run([row('Ad 1',50,10),row('Ad 2',5,null)],{creative:true});
  expect(creative.summary).toContain('Available ads report 10 meta form leads; 1 ad has unavailable results');
 });
 it('uses weighted total cost and never promotes a one-result segment as best',()=>{
  const n=run([row('High delivery',100,10),row('Low cost',50,10),row('One result',1,1)]);
  expect(n.summary).toContain('$151.00');expect(n.summary).toContain('21 meta form leads');expect(n.summary).toContain('$7.19');
  expect(n.insights.join(' ')).toContain('Low cost had the lowest cost per lead');expect(n.insights.join(' ')).not.toContain('One result had the lowest');
  expect(n.insights[0]).toContain('66.2%');expect(n.insights[1]).toContain('tied across 2');
 });
 it.each(['Age','Location','Placement','Platform'])('keeps the %s narrative scoped to its own view',dimension=>{
  const n=run([row('Segment',12,6)],{dimension});expect(n.summary).toContain(`The ${dimension.toLowerCase()} breakdown`);expect(n.summary).toContain('6 meta form leads');
 });
 it('preserves unavailable results and zero-result spend without inventing efficiency',()=>{
  const missing=run([row('Missing',10,null)]);expect(missing.summary).toContain('totals are unavailable');expect(missing.insights.join(' ')).not.toContain('No meta form leads');
  const zero=run([row('Zero',10,0)]);expect(zero.summary).toContain('0 meta form leads');expect(zero.insights.join(' ')).toContain('No meta form leads');expect(zero.insights.join(' ')).not.toContain('lowest cost');
 });
 it('honors creative ranking eligibility and avoids claiming click-through means conversion quality',()=>{
  const n=run([{...row('Eligible',30,2),rank:1},{...row('Unranked',5,0),eligible:false}],{creative:true,options:{...options,ranking:'ctr'}});
  expect(n.summary).toContain('Selected ads');expect(n.insights.join(' ')).toContain('Top eligible ad by CTR (all): Eligible');expect(n.insights.join(' ')).toContain('does not establish conversion quality');
  const tied=run([{...row('Eligible',30,2),rank:1},{...row('Tied',30,2),rank:2}],{creative:true,options:{...options,ranking:'ctr'}});expect(tied.insights.join(' ')).toContain('Eligible (tied across 2)');
  const none=run([{...row('Unranked',5,0),eligible:false}],{creative:true});expect(none.insights.join(' ')).toContain('No ads meet');
 });
 const metric=(value:number,formatted=String(value))=>({value,formatted});
 const campaign=(a:number,b:number):ComparisonCampaignData=>({campaignName:'Any account campaign',objective:'LEADS',costLabel:'COST PER LEAD',metricsA:{spend:metric(100,'$100.00'),reach:metric(100),results:metric(a),cpr:metric(a?100/a:0,a?'$10.00':'N/A')},metricsB:{spend:metric(50,'$50.00'),reach:metric(100),results:metric(b),cpr:metric(b?50/b:0,b?'$5.00':'N/A')},changes:{spend:{percent:100,direction:'up'},reach:{percent:0,direction:'flat'},results:{percent:null,direction:'new'},cpr:{percent:null,direction:'flat'}}});
 it('handles zero baselines and unavailable costs without infinity or unsupported uplift',()=>{
  const n=comparisonClientNarrative(campaign(10,0));expect(n.summary).toContain('10 leads');expect(n.insights.join(' ')).toContain('percentage change is unavailable');expect(n.insights.join(' ')).toContain('cannot be compared');expect(n.insights.join(' ')).not.toMatch(/Infinity|NaN|1000%/);
 });
 it('identifies estimated reach rather than presenting it as measured unique people',()=>{
  const c=campaign(100,80);c.objective='REACH';c.costLabel='COST PER 1K REACHED';c.metricsA.reach.estimated=true;
  const n=comparisonClientNarrative(c);expect(n.summary).toContain('reach (estimated)');expect(n.insights.join(' ')).toContain('REACH (estimated)');
 });
 it('describes raw metric changes and explicitly names both periods',()=>{
  const n=comparisonClientNarrative(campaign(10,20));expect(n.summary).toContain('Period B');expect(n.insights.join(' ')).toContain('LEADS decreased by 50%');expect(n.insights.join(' ')).toContain('COST PER LEAD increased by 300%');
 });
});
