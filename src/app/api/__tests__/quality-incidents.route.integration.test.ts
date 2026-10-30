import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
vi.mock('@/lib/prisma',()=>({prisma:{reportQualityIncident:{findMany:vi.fn()}}}));
import {prisma} from '@/lib/prisma';
import {GET} from '../internal/quality-incidents/route';
const secret='test-only-read-token-32-characters-long';
describe('redacted quality agent feed',()=>{
 beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('QUALITY_AGENT_READ_TOKEN',secret);vi.mocked(prisma.reportQualityIncident.findMany).mockResolvedValue([])});
 afterEach(()=>vi.unstubAllEnvs());
 it('is disabled without a strong configured credential',async()=>{
  vi.stubEnv('QUALITY_AGENT_READ_TOKEN','');expect((await GET(new Request('https://example.test'))).status).toBe(503);
  vi.stubEnv('QUALITY_AGENT_READ_TOKEN','short');expect((await GET(new Request('https://example.test'))).status).toBe(503);expect(prisma.reportQualityIncident.findMany).not.toHaveBeenCalled();
 });
 it('rejects missing/wrong credentials without accessing any incidents',async()=>{
  for(const authorization of ['',`Bearer wrong`])expect((await GET(new Request('https://example.test',{headers:{authorization}}))).status).toBe(401);
  expect(prisma.reportQualityIncident.findMany).not.toHaveBeenCalled();
 });
 it('returns no-store bounded metadata using an explicit field allowlist',async()=>{
  const response=await GET(new Request('https://example.test',{headers:{authorization:`Bearer ${secret}`}}));expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toContain('no-store');
  const query=vi.mocked(prisma.reportQualityIncident.findMany).mock.calls[0][0]!;
  expect(query.take).toBe(100);expect(query.select).not.toHaveProperty('userId');expect(query.select).not.toHaveProperty('fingerprint');expect(query.select).not.toHaveProperty('attachmentUrl');expect(query.select).not.toHaveProperty('message');
 });
});
