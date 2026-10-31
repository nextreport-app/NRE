import {createHash} from 'node:crypto';
import {NRE_METRIC_KEYS,type ColumnMap,type NreRow} from '@/lib/nre/columns';
import {mismatchSignals} from './incident-policy';
import type {CsvVerificationResult} from '@/lib/nre/csv-report-reconciliation';
const CONFIG_FIELDS=['reportType','platform','dateSelection','comparisonMetricKeys','comparisonPeriodA','comparisonPeriodB','historicalMonthCount','selectedCampaigns','selectedAdSets','selectedMetrics','campaignObjectives','campaignMetricOverrides','includePreviousMonthComparison','csvAlignResults'];
function canonical(value:unknown):unknown {if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,v])=>[key,canonical(v)]));return value;}
export function recoveryContextKey(sourceKey:string,form:FormData|null,timezone="UTC",client?:{currency?:string;previousMonthDataUrl?:string|null;previousMonthDataUpdatedAt?:Date|null}):string {
  const settings=CONFIG_FIELDS.map(key=>{const raw=form?.get(key);if(typeof raw!=='string')return [key,null];try{return[key,canonical(JSON.parse(raw))]}catch{return[key,raw]}});
  let type="WEEKLY",mode="last7";try{type=JSON.parse(String(form?.get('reportType')??'"WEEKLY"'));mode=JSON.parse(String(form?.get('dateSelection')??'{}')).mode??"last7"}catch{/* invalid input cannot become a stable custom period */}
  const asOf=type!=="COMPARISON"&&mode!=="custom"?new Intl.DateTimeFormat("en-CA",{timeZone:timezone,year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date()):null;
  return createHash('sha256').update(JSON.stringify([sourceKey,settings,asOf,timezone,client?.currency,form?.get("includePreviousMonthComparison")==="true"?[client?.previousMonthDataUrl,client?.previousMonthDataUpdatedAt]:null])).digest('hex');
}
export type SafeDiagnosticProfile={version:1;rowCount:number;sourceColumns:string[];missingReportValues:boolean;missingCsvValues:boolean;signalCount:number};
export function buildPrivateDiagnostics(rows:NreRow[],columns:ColumnMap,verification:CsvVerificationResult){
 const failures=verification.checks.filter(c=>c.status==='mismatch');
 const missing=(v:string)=>/^(?:\s*|—|–|-|NA|N\/A)$/i.test(v.trim());
 const profile:SafeDiagnosticProfile={version:1,rowCount:Math.min(rows.length,1_000_000),sourceColumns:NRE_METRIC_KEYS.filter(key=>!!columns[key]),missingReportValues:failures.some(c=>missing(c.reportDisplay)),missingCsvValues:failures.some(c=>missing(c.csvDisplay)),signalCount:mismatchSignals(verification).length};
 // Numbers remain private. Names, free-text metric labels and CSV rows are not retained.
 const checks=failures.slice(0,64).map((c,index)=>({index,reportDisplay:c.reportDisplay.slice(0,100),csvDisplay:c.csvDisplay.slice(0,100)}));
 return {profile,checks};
}
/** Parse and rebuild a field allowlist; never export the private check values. */
export function safeDiagnosticProfile(raw:string|null|undefined):SafeDiagnosticProfile|null {
 try {const value=JSON.parse(raw??'null')?.profile;if(value?.version!==1||!Number.isInteger(value.rowCount)||value.rowCount<1||value.rowCount>1_000_000||!Number.isInteger(value.signalCount)||value.signalCount<1||value.signalCount>16)return null;
 return{version:1,rowCount:value.rowCount,sourceColumns:NRE_METRIC_KEYS.filter(key=>Array.isArray(value.sourceColumns)&&value.sourceColumns.includes(key)),missingReportValues:value.missingReportValues===true,missingCsvValues:value.missingCsvValues===true,signalCount:value.signalCount};
 }catch{return null}
}
