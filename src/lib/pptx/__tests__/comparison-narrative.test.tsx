import {describe,expect,it}from'vitest';
import {readFileSync}from'node:fs';
import JSZip from'jszip';
import {renderToStaticMarkup}from'react-dom/server';
import {parseCsvText}from'@/lib/nre/parse-csv';
import {buildComparisonReportData}from'@/lib/nre/report-data';
import {buildShareComparisonReportData}from'@/lib/nre/share-comparison-report';
import {ShareComparisonReportView}from'@/components/share-comparison-report-view';
import {renderComparisonPptx}from'../render';
describe('comparison narrative output',()=>{
 it.each(['dark.pptx','meta-ads-light.pptx'])('preserves prior-period-only campaigns and shares the exact copy with the browser in %s',async template=>{
  const parsed=parseCsvText('Campaign name,Day,Amount spent (USD),Results,Result type,Reach,Impressions\nCurrent,2026-11-13,100,10,Website leads,100,1000\nCurrent,2026-11-12,50,5,Website leads,80,800\nPrevious only,2026-11-12,20,2,Website leads,40,400');
  const data=buildComparisonReportData({accountName:'Example',currencySymbol:'$',timezone:'UTC',mtdDailyRows:parsed.rows,csvHeaders:parsed.headers,periodA:{startIso:'2026-11-13',endIso:'2026-11-13'},periodB:{startIso:'2026-11-12',endIso:'2026-11-12'},now:new Date('2026-11-14T12:00:00Z')});
  const html=renderToStaticMarkup(<ShareComparisonReportView data={buildShareComparisonReportData(data,'META',{})} isPrint/>);
  const zip=await JSZip.loadAsync(await renderComparisonPptx({templateBuffer:readFileSync('templates/'+template),data,isLightTemplate:template.includes('light')}));
  const slides=await Promise.all(Object.keys(zip.files).filter(path=>/^ppt\/slides\/slide\d+\.xml$/.test(path)).map(path=>zip.file(path)!.async('string')));
  const narratives=slides.filter(xml=>xml.includes('CAMPAIGN SUMMARY'));expect(narratives).toHaveLength(2);
  expect(html).toContain('Previous only');expect(html).toContain('Key insights &amp; updates');
  for(const campaign of data.campaigns){expect(html).toContain(campaign.narrative!.summary);expect(narratives.some(xml=>xml.includes(campaign.narrative!.summary))).toBe(true)}
  const prior=data.campaigns.find(c=>c.campaignName==='Previous only')!;expect(prior.narrative!.summary).toContain('Period A recorded $0');expect(prior.narrative!.summary).toContain('Period B recorded $20');expect(prior.narrative!.insights.join(' ')).toContain('cannot be compared');
 });
});
