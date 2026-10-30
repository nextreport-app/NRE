import {NextResponse} from 'next/server';
import type {Client} from '@/generated/prisma/client';
import type {WizardParsedMtd} from '@/lib/nre/wizard-upload-session';
import {verifyStandardWizardReportAgainstCsv} from '@/lib/nre/wizard-csv-verification';
import {reconcileComparisonReportWithCsv,reconcileHistoricalReportWithCsv,reconcileDayBreakdownReportWithCsv} from '@/lib/nre/csv-report-reconciliation';
import type {ReportData,ComparisonReportData} from '@/lib/nre/report-data';
import type {HistoricalReportData} from '@/lib/nre/historical-report-data';
import type {DayBreakdownReportData} from '@/lib/nre/day-breakdown-report-data';
import type {NreRow} from '@/lib/nre/columns';
import {CURRENCY_SYMBOLS} from '@/lib/nre/format';
import {parseJsonFormField,selectedCampaignsSchema,campaignObjectivesSchema,comparisonPeriodSchema,resolveCsvAlignResults,resolveIncludePreviousMonthComparison} from '@/lib/validators/report-wizard';
import {loadPreviousMonthDataRows} from '@/lib/nre/previous-month-data';
import {captureCsvQualityIncident} from './incidents';
import {buildPrivateDiagnostics,recoveryContextKey} from './recovery-diagnostics';
type Candidate={kind:'STANDARD';data:ReportData}|{kind:'COMPARISON';data:ComparisonReportData;periodRows?:NreRow[]}|{kind:'HISTORICAL';data:HistoricalReportData}|{kind:'DAY_BREAKDOWN';data:DayBreakdownReportData};
/** Run before capacity/credit reservation. Never trust client-side verification or a cached preview. */
export async function guardReportGeneration(input:{client:Client;userId:string;parsed:WizardParsedMtd;formData:FormData|null;sourceKey:string;candidate:Candidate}){
 const {client,parsed,formData,candidate}=input;
 const common={report:candidate.data,mtdDailyRows:parsed.rows,selectedCampaigns:formData?parseJsonFormField(formData,'selectedCampaigns',selectedCampaignsSchema):undefined,campaignObjectives:formData?parseJsonFormField(formData,'campaignObjectives',campaignObjectivesSchema):undefined,currencySymbol:CURRENCY_SYMBOLS[client.currency],resultCountingMode:resolveCsvAlignResults(formData)?'meta-csv-export' as const:'standard' as const,platform:parsed.platform};
 let check;
 if(candidate.kind==='COMPARISON'){
  const periodA=formData?parseJsonFormField(formData,'comparisonPeriodA',comparisonPeriodSchema):undefined;const periodB=formData?parseJsonFormField(formData,'comparisonPeriodB',comparisonPeriodSchema):undefined;
  if(!periodA||!periodB)return NextResponse.json({error:'Choose both comparison periods.'},{status:400});
  check=reconcileComparisonReportWithCsv({...common,report:candidate.data,periodA,periodB,periodBSupplementalRows:candidate.periodRows});
 }else if(candidate.kind==='HISTORICAL')check=reconcileHistoricalReportWithCsv({...common,report:candidate.data});
 else if(candidate.kind==='DAY_BREAKDOWN')check=reconcileDayBreakdownReportWithCsv({...common,report:candidate.data});
 else check=verifyStandardWizardReportAgainstCsv({client,mtdRows:parsed.rows,report:candidate.data,reportType:candidate.data.reportType,formData,platform:parsed.platform,periodRows:candidate.data.reportType==='WEEKLY'&&resolveIncludePreviousMonthComparison(formData)?await loadPreviousMonthDataRows(client):undefined});
 if(check.status!=='mismatch')return null;
 await captureCsvQualityIncident({userId:input.userId,clientId:client.id,contextKey:recoveryContextKey(input.sourceKey,formData,client.timezone,client),platform:parsed.platform,reportType:candidate.kind==='STANDARD'?candidate.data.reportType:candidate.kind,diagnostics:buildPrivateDiagnostics(parsed.rows,parsed.colMap,check)},check);
 return NextResponse.json({ok:false,recoveryRequired:true,error:'The report does not match the listed CSV checks. Rebuild and recheck the preview before generating. No report credit was used.',csvVerification:check},{status:409});
}
