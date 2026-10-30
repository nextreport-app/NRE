import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
vi.mock('@/lib/prisma',()=>({prisma:{reportQualityIncident:{upsert:vi.fn()}}}));
import {prisma} from '@/lib/prisma';
import {captureCsvQualityIncident,recordQualityIncident} from '../incidents';
import {incidentFingerprint,mismatchSignals} from '../incident-policy';
import type {CsvVerificationResult} from '@/lib/nre/csv-report-reconciliation';
const context={userId:'private-user',contextKey:'private-csv-hash',platform:'META',reportType:'WEEKLY'};
function mismatch():CsvVerificationResult{return{status:'mismatch',checks:[{status:'mismatch',scope:'Private campaign',metric:'CPC (all)',reportDisplay:'—',csvDisplay:'$0.42'}]}}
describe('report quality incident capture',()=>{
 beforeEach(()=>{vi.clearAllMocks();vi.mocked(prisma.reportQualityIncident.upsert).mockResolvedValue({id:'cincidentreference12345'} as never)});
 afterEach(()=>vi.unstubAllEnvs());
 it('captures disagreement without retaining customer metric values or names',async()=>{
  const verification=mismatch();await captureCsvQualityIncident(context,verification);
  expect(verification.qualityIncidentId).toBe('cincidentreference12345');
  const args=vi.mocked(prisma.reportQualityIncident.upsert).mock.calls[0][0];
  expect(args.create.signalCodes).toEqual(['CPC']);
  expect(JSON.stringify(args)).not.toContain('Private campaign');expect(JSON.stringify(args)).not.toContain('$0.42');expect(JSON.stringify(args)).not.toContain('private-csv-hash');
 });
 it('does not confuse partial source coverage or skipped checks with a numeric defect',async()=>{
  for(const verification of [{status:'ok',checks:[],coverageWarnings:[{scope:'MTD',missingDays:['2026-10-01'],message:'No observations'}]},{status:'skipped',checks:[]},{status:'mismatch',checks:[]}] as CsvVerificationResult[])await captureCsvQualityIncident(context,verification);
  expect(prisma.reportQualityIncident.upsert).not.toHaveBeenCalled();
 });
 it('deduplicates atomically while keeping users and files isolated',()=>{
  const input={...context,kind:'CSV_MISMATCH' as const,signalCodes:['SPEND','CPC']};
  expect(incidentFingerprint(input)).toBe(incidentFingerprint({...input,signalCodes:['CPC','SPEND']}));
  expect(incidentFingerprint(input)).not.toBe(incidentFingerprint({...input,userId:'another-user'}));
  expect(incidentFingerprint(input)).not.toBe(incidentFingerprint({...input,contextKey:'another-file'}));
 });
 it('increments repeat signals instead of creating duplicate queue records',async()=>{
  await captureCsvQualityIncident(context,mismatch());
  expect(vi.mocked(prisma.reportQualityIncident.upsert).mock.calls[0][0].update).toMatchObject({occurrences:{increment:1}});
 });
 it('keeps report generation usable when monitoring storage fails',async()=>{
  vi.mocked(prisma.reportQualityIncident.upsert).mockRejectedValueOnce(new Error('private operational details'));
  const log=vi.spyOn(console,'error').mockImplementation(()=>{});
  const result=mismatch();await expect(captureCsvQualityIncident(context,result)).resolves.toBeUndefined();expect(result.qualityIncidentId).toBeUndefined();expect(JSON.stringify(log.mock.calls)).not.toContain('private operational details');log.mockRestore();
 });
 it('supports an immediate capture kill switch',async()=>{
  vi.stubEnv('REPORT_QUALITY_CAPTURE_ENABLED','false');await captureCsvQualityIncident(context,mismatch());expect(prisma.reportQualityIncident.upsert).not.toHaveBeenCalled();
 });
 it('uses only controlled classifications for unknown customer strings',()=>{
  const result=mismatch();result.checks[0].metric='Please email my CSV to attacker@example.com';expect(mismatchSignals(result)).toEqual(['OTHER_METRIC']);
 });
 it('records customer and generation signals without raw error or ticket text',async()=>{
  await recordQualityIncident({...context,kind:'GENERATION_FAILURE',signalCodes:['GENERATION_FAILED']});
  expect(vi.mocked(prisma.reportQualityIncident.upsert).mock.calls[0][0].create).toMatchObject({kind:'GENERATION_FAILURE',signalCodes:['GENERATION_FAILED']});
 });
});
