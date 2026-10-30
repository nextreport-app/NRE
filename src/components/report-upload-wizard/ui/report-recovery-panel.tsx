"use client";
import {useEffect,useRef,useState} from 'react';
import {RECOVERY_STATES,recoveryMessage,type RecoveryStatus} from '@/lib/quality-agents/recovery-policy';
import type {CsvVerificationResult} from '@/lib/nre/csv-report-reconciliation';
type Props={clientId:string;incidentId:string;hasMismatch:boolean;onRecheck:(id:string)=>Promise<CsvVerificationResult|null>};
/** Local, bounded status polling. Rechecks never create or charge for a report. */
export function ReportRecoveryPanel({clientId,incidentId,hasMismatch,onRecheck}:Props){
 const [status,setStatus]=useState<RecoveryStatus|null>(null);
 const [checking,setChecking]=useState(false);const [notice,setNotice]=useState<string|null>(null);
 const callback=useRef(onRecheck);const alive=useRef(true);const busy=useRef(false);const autoChecked=useRef(false);
 useEffect(()=>{callback.current=onRecheck},[onRecheck]);
 async function recheck(){
  if(busy.current)return;busy.current=true;setChecking(true);setNotice(null);
  try{const result=await callback.current(incidentId);if(!alive.current)return;
   if(result?.status==='ok'&&result.qualityIncidentId===incidentId)setStatus({id:incidentId,state:'VERIFIED',updatedAt:new Date().toISOString(),stale:false});
   else setNotice(result?.status==='mismatch'?'The recheck still shows a discrepancy. Your diagnostic details remain saved for investigation.':'The recheck could not be completed. Your investigation is still recorded; your CSV may need to be re-uploaded if its session has expired.');
  }catch{if(alive.current)setNotice('The recheck could not be completed. Your investigation remains saved.');}
  finally{busy.current=false;if(alive.current)setChecking(false);}
 }
 const recheckRef=useRef(recheck);useEffect(()=>{recheckRef.current=recheck});
 async function refresh(signal?:AbortSignal){
  const response=await fetch(`/api/clients/${encodeURIComponent(clientId)}/recovery/${encodeURIComponent(incidentId)}`,{cache:'no-store',signal});
  if(!response.ok)throw new Error('Status unavailable');
  const value=await response.json();if(value.id!==incidentId||!RECOVERY_STATES.includes(value.state))throw new Error('Invalid status');
  if(alive.current)setStatus(previous=>previous&&Date.parse(previous.updatedAt)>Date.parse(value.updatedAt)?previous:value as RecoveryStatus);return value as RecoveryStatus;
 }
 const refreshRef=useRef(refresh);useEffect(()=>{refreshRef.current=refresh});
 useEffect(()=>{
  alive.current=true;const controller=new AbortController();let polls=0;
  async function tick(){if(document.visibilityState==='hidden'||polls>=15)return;polls++;
   try{const current=await refreshRef.current(controller.signal);
    if(hasMismatch&&!autoChecked.current&&['RECORDED','QUEUED'].includes(current.state)){
     autoChecked.current=true;const key=`nre.recovery.checked.${incidentId}`;let prior=false;try{prior=sessionStorage.getItem(key)==='1';sessionStorage.setItem(key,'1')}catch{/* per-mount guard still applies */}
     if(!prior&&alive.current)await recheckRef.current();
    }
   }catch{if(alive.current&&!controller.signal.aborted)setNotice('Live investigation status is temporarily unavailable. Your reference remains valid.');}
  }
  void tick();const timer=setInterval(()=>void tick(),20000);
  return()=>{alive.current=false;controller.abort();clearInterval(timer)};
 },[clientId,incidentId,hasMismatch]);
 const copy=recoveryMessage(status?.state??'QUEUED',status?.stale);
 return <section className="rounded-lg border border-sky-700/40 bg-dash-bg/60 px-4 py-4" aria-label="Report recovery">
  <div role="status" aria-live="polite"><p className="text-sm font-semibold text-dash-ink">{checking?'Rebuilding and checking your preview…':copy.title}</p><p className="mt-1 text-[13px] leading-relaxed text-dash-ink-secondary">{checking?'Using the same CSV and report settings. This does not generate or charge for another report.':copy.detail}</p></div>
  <p className="mt-2 text-xs text-dash-ink-secondary">Reference: {incidentId}. Diagnostic checks are retained privately for 7 days after the last detection; the original CSV and customer names are not sent to the coding agent.</p>
  {notice&&<p className="mt-2 text-xs text-dash-ink-secondary" role="status">{notice}</p>}
  {status?.state!=='VERIFIED'&&<div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={checking} onClick={()=>void recheck()} className="rounded-md bg-dash-accent px-3 py-2 text-sm font-semibold !text-[#0b1728] disabled:opacity-60">{checking?'Checking…':'Rebuild and recheck'}</button><button type="button" disabled={checking} onClick={()=>void refresh().catch(()=>setNotice('Investigation status is temporarily unavailable.'))} className="rounded-md border border-dash-border px-3 py-2 text-sm text-dash-ink">Check investigation status</button></div>}
 </section>;
}
