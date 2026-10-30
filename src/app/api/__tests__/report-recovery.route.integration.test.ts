import {describe,it,expect,vi,beforeEach,afterEach} from 'vitest';
vi.mock('@/lib/auth',()=>({auth:vi.fn()}));vi.mock('@/lib/prisma',()=>({prisma:{reportQualityIncident:{findFirst:vi.fn()}}}));
vi.mock('@/lib/quality-agents/recovery-worker',()=>({reserveRepairAttempt:vi.fn(),finishRepairAttempt:vi.fn(),markProductionUpdate:vi.fn(),RecoveryWorkerError:class extends Error{status=409}}));
import {auth} from '@/lib/auth';import {prisma} from '@/lib/prisma';
import {GET as customerStatus} from '../clients/[id]/recovery/[incidentId]/route';
import {POST as worker} from '../internal/quality-recovery/route';
import {reserveRepairAttempt} from '@/lib/quality-agents/recovery-worker';
const token='synthetic-worker-secret-32-characters';const request=(body:unknown,authorization?:string)=>new Request('https://example.test',{method:'POST',headers:{'Content-Type':'application/json',...(authorization?{Authorization:authorization}:{})},body:JSON.stringify(body)});
describe('customer recovery authorization',()=>{
 beforeEach(()=>{vi.clearAllMocks();vi.mocked(auth).mockResolvedValue({user:{id:'owner'}} as never)});afterEach(()=>vi.unstubAllEnvs());
 it('rejects signed-out requests and cross-owner or cross-client references',async()=>{
  vi.mocked(auth).mockResolvedValueOnce(null as never);expect((await customerStatus(new Request('https://example.test'),{params:Promise.resolve({id:'client',incidentId:'case'})})).status).toBe(401);
  vi.mocked(prisma.reportQualityIncident.findFirst).mockResolvedValue(null);expect((await customerStatus(new Request('https://example.test'),{params:Promise.resolve({id:'client',incidentId:'case'})})).status).toBe(404);
  expect(prisma.reportQualityIncident.findFirst).toHaveBeenCalledWith(expect.objectContaining({where:{id:'case',clientId:'client',userId:'owner'}}));
 });
 it('returns only lifecycle status, no private diagnostics or developer URLs',async()=>{
  vi.mocked(prisma.reportQualityIncident.findFirst).mockResolvedValue({id:'case',state:'FIX_PROPOSED',stateUpdatedAt:new Date()} as never);const response=await customerStatus(new Request('https://example.test'),{params:Promise.resolve({id:'client',incidentId:'case'})});expect(response.headers.get('cache-control')).toContain('no-store');expect(await response.json()).toMatchObject({state:'FIX_PROPOSED',id:'case'});const select=vi.mocked(prisma.reportQualityIncident.findFirst).mock.calls[0][0]?.select;expect(select).not.toHaveProperty('diagnosticsJson');expect(select).not.toHaveProperty('fixPrNumber');
 });
 it('does not let a read-feed credential mutate repair state',async()=>{
  vi.stubEnv('QUALITY_AGENT_WORKER_TOKEN',token);expect((await worker(request({action:'reserve',runId:'1',runAttempt:1,issueNumber:1},'Bearer feed-token'))).status).toBe(401);expect(reserveRepairAttempt).not.toHaveBeenCalled();
 });
 it('rejects worker attempts to assert VERIFIED or send arbitrary deployment URLs',async()=>{
  vi.stubEnv('QUALITY_AGENT_WORKER_TOKEN',token);for(const body of [{action:'result',runId:'1',runAttempt:1,state:'VERIFIED'},{action:'deployed',incidentId:'case',prNumber:1,revision:'https://evil.test'}])expect((await worker(request(body,`Bearer ${token}`))).status).toBe(400);expect(reserveRepairAttempt).not.toHaveBeenCalled();
 });
});
