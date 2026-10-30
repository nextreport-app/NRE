import {describe,it,expect,vi,beforeEach} from 'vitest';
vi.mock('@/lib/prisma',()=>({prisma:{reportQualityIncident:{updateMany:vi.fn().mockResolvedValue({count:0}),upsert:vi.fn().mockResolvedValue({id:'cincidentreference123456789'})}}}));
vi.mock('@/lib/nre/previous-month-data',()=>({loadPreviousMonthDataRows:vi.fn()}));
import type {Client} from '@/generated/prisma/client';
import {parseCsvText} from '@/lib/nre/parse-csv';
import {buildReportData} from '@/lib/nre/report-data';
import {guardReportGeneration} from '../generation-guard';
const client={id:'client',userId:'owner',accountName:'Synthetic account',currency:'USD',timezone:'UTC',monthlyBudget:null} as Client;
function fixture(type:"MONTHLY"|"WEEKLY"="MONTHLY"){
 const source=parseCsvText('Campaign name,Day,Amount spent (USD),Results,Result type,Reach,Impressions,Clicks (all)\n'+Array.from({length:30},(_,i)=>`Example,2026-09-${String(i+1).padStart(2,'0')},10,2,Website leads,100,1000,20`).join('\n'));
 const data=buildReportData({accountName:'Synthetic account',currencySymbol:'$',timezone:'UTC',monthlyBudget:null,mtdDailyRows:source.rows,reportType:type,...(type==='WEEKLY'?{weeklyRange:{startIso:'2026-09-24',endIso:'2026-09-30'}}:{}),now:new Date('2026-10-01T12:00:00Z')});
 const formData=new FormData();formData.set('reportType',JSON.stringify(type));formData.set('dateSelection',JSON.stringify({mode:'custom',customStart:type==='WEEKLY'?'2026-09-24':'2026-09-01',customEnd:'2026-09-30'}));
 return{client,userId:'owner',parsed:{...source,platform:'META' as const},formData,sourceKey:'private-source',candidate:{kind:'STANDARD' as const,data}};
}
describe('server-side generation recovery gate',()=>{
 beforeEach(()=>vi.clearAllMocks());
 it('permits correctly reconciled reports',async()=>expect(await guardReportGeneration(fixture())).toBeNull());
 it('blocks a corrupted numeric total and saves an investigation rather than creating a report',async()=>{
  const input=fixture();input.candidate.data.mtdRow.spend='$9,999';const response=await guardReportGeneration(input);expect(response?.status).toBe(409);const body=await response!.json();expect(body).toMatchObject({ok:false,recoveryRequired:true,csvVerification:{status:'mismatch',qualityIncidentId:'cincidentreference123456789'}});expect(body.error).toContain('No report credit');
 });
 it('blocks a missing CPC card even when a cached preview otherwise looks valid',async()=>{
  const input=fixture('WEEKLY');input.candidate.data.campaignSlides[0].metrics.cpc='—';const response=await guardReportGeneration(input);expect(response?.status).toBe(409);
 });
});
