import { beforeEach, afterEach, expect, it, vi } from "vitest";
const m=vi.hoisted(()=>({owner:'owner',user:'owner',upload:vi.fn(),read:vi.fn(),save:vi.fn(),update:vi.fn(),url:null as string|null}));
vi.mock('@/lib/auth',()=>({auth:async()=>({user:{id:m.user}})}));
vi.mock('@/lib/prisma',()=>({prisma:{client:{findUnique:async()=>({id:'client',userId:m.owner,timezone:'America/Chicago',previousMonthDataUrl:m.url,previousMonthSelectedCampaigns:null,previousMonthDataUpdatedAt:null}),update:m.update}}}));
vi.mock('@/lib/subscription-guard',()=>({requireActiveSubscription:async()=>null}));
vi.mock('@/lib/usage-rate-limit',()=>({enforceWizardLimits:async()=>null}));
vi.mock('@/lib/nre/wizard-upload-session',()=>({loadWizardUploadSession:m.upload}));
vi.mock('@/lib/storage',()=>({readPreviousMonthDataFile:m.read,savePreviousMonthDataFile:m.save,deletePreviousMonthDataFile:vi.fn(),previousMonthDataFileName:()=> 'source.csv'}));
import {GET,POST,PATCH} from '../clients/[id]/previous-month-data/route';
import {parseCsvText} from '@/lib/nre/parse-csv';
const raw='Campaign name,Day,Amount spent (USD),Results,Result type,Reach,Impressions\nForms,2026-08-01,4000,1,Leads (form),10,20\nForms,2026-10-01,1000,100,Leads (form),10,20\nForms,2026-10-31,534.88,86,Leads (form),10,20\nTraffic,2026-10-01,500,2000,Link clicks,10,20\nTraffic,2026-10-31,46.38,55,Link clicks,10,20\nForms,2026-11-16,2000,5,Leads (form),10,20';
const context={params:Promise.resolve({id:'client'})};
const uploadId='12345678-1234-4234-8234-123456789abc';
beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-17T18:00:00Z'));vi.clearAllMocks();m.url=null;m.owner='owner';m.user='owner';m.upload.mockResolvedValue({rows:parseCsvText(raw).rows});m.read.mockResolvedValue(Buffer.from(raw));m.save.mockResolvedValue('stored.csv');m.update.mockResolvedValue({});});
afterEach(()=>vi.useRealTimers());
it('reads October totals from the owned active import without a stored upload',async()=>{
 const res=await GET(new Request(`http://localhost/api/clients/client/previous-month-data?uploadSessionId=${uploadId}`),context);expect(res.status).toBe(200);expect(await res.json()).toMatchObject({ready:true,source:'import',campaignSpend:{Forms:1534.88,Traffic:546.38}});expect(m.read).not.toHaveBeenCalled();expect(m.upload).toHaveBeenCalledWith('owner','client',uploadId);
});
it('returns an unavailable state for data that does not cover October',async()=>{
 m.upload.mockResolvedValue({rows:[]});const res=await GET(new Request(`http://localhost/?uploadSessionId=${uploadId}`),context);expect(await res.json()).toMatchObject({ready:false,campaignSpend:{}});
});
it('reads a changed stored upload when refreshed from the wizard',async()=>{
 m.url='stored.csv';const res=await GET(new Request('http://localhost/'),context);expect(await res.json()).toMatchObject({ready:true,source:'stored',campaignSpend:{Forms:1534.88,Traffic:546.38}});
});
it('scopes broad upload badges before returning or persisting campaign choices',async()=>{
 const data=new FormData();data.append('file',new File([raw],'source.csv',{type:'text/csv'}));const res=await POST(new Request('http://localhost/',{method:'POST',body:data}),context);expect(res.status).toBe(200);expect(await res.json()).toMatchObject({campaignSpend:{Forms:1534.88,Traffic:546.38}});
});
it('can save an import-backed previous-month selection without a separate file',async()=>{
 const res=await PATCH(new Request('http://localhost/',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({selectedCampaigns:['Traffic'],uploadSessionId:uploadId})}),context);expect(res.status).toBe(200);expect(m.update).toHaveBeenCalledWith(expect.objectContaining({data:{previousMonthSelectedCampaigns:'["Traffic"]'}}));
});
it('does not expose another client or its import',async()=>{
 m.owner='someone-else';const res=await GET(new Request(`http://localhost/?uploadSessionId=${uploadId}`),context);expect(res.status).toBe(404);expect(m.upload).not.toHaveBeenCalled();expect(m.read).not.toHaveBeenCalled();
});
