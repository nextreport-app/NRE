"use client";
import { useCallback, useEffect, useState } from "react";
import { BUDGET_LEVEL_LABELS, type BudgetSnapshot } from "@/lib/budget-monitor-facts";
interface View {tolerance:number;enabled:boolean;emailEnabled:boolean;budget:number|null;currency:string;timezone:string;linked:boolean;adsManagerUrl?:string|null;snapshot:BudgetSnapshot|null;asOf:number}
export function BudgetMonitorCard({clientId}:{clientId:string}) {
  const [toleranceDraft,setToleranceDraft]=useState<string|null>(null);
  const [view,setView]=useState<View|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const url=`/api/clients/${encodeURIComponent(clientId)}/budget-monitor`;
  const fetchView=useCallback(async ()=>{const r=await fetch(url,{cache:"no-store"});const data=await r.json();if(!r.ok)throw Error(data.error??"Could not load monitoring.");return data as View;},[url]);
  useEffect(()=>{void fetchView().then(setView).catch(()=>setError("Budget monitoring could not load. Refresh this page."));
    const refresh=()=>void fetchView().then(setView).catch(()=>setError("Budget monitoring could not refresh. Check your connection."));window.addEventListener("focus",refresh);return ()=>window.removeEventListener("focus",refresh);
  },[fetchView]);
  async function action(body:object){setBusy(true);setError("");try{const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});const data=await r.json();if(!r.ok)throw Error(data.error??"Monitoring update failed.");setView(await fetchView());if("tolerance" in body)setToleranceDraft(null);}catch(e){setError(e instanceof Error?e.message:"Monitoring update failed.");}finally{setBusy(false);}}
  const money=(n:number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:view?.currency??"USD"}).format(n);
  const snapshot=view?.snapshot,facts=snapshot?.facts;
  const stale=!!snapshot && (view?.asOf??0)-Date.parse(snapshot.checkedAt)>26*3600000;
  return <section id="budget-monitor" className="rounded-xl border border-dash-border bg-dash-card p-4 sm:p-5">
    <h2 className="text-[17px] font-semibold text-dash-ink">Approved budget monitoring</h2>
    <p className="mt-1 text-sm text-dash-ink-secondary">Whole Meta ad account · monthly ad spend excluding tax. Alerts are advisory; adjust spend in Ads Manager.</p>
    {!view && !error && <p role="status" className="mt-3 text-sm text-dash-ink-secondary">Loading monitoring…</p>}
    {view && <>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
        <button type="button" disabled={busy || (!view.enabled && (!view.budget || !view.linked))} onClick={()=>void action({action:"settings",enabled:!view.enabled,emailEnabled:view.emailEnabled})} className="rounded-lg border border-dash-border px-3 py-2 disabled:opacity-50">{view.enabled?"Turn off monitoring":"Enable monitoring"}</button>
        {view.enabled && <button type="button" disabled={busy} onClick={()=>void action({action:"check"})} className="rounded-lg bg-dash-accent px-3 py-2 text-black disabled:opacity-50">{busy?"Checking…":"Check now"}</button>}
        {view.enabled && view.adsManagerUrl && <a href={view.adsManagerUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-dash-border px-3 py-2">Open Ads Manager</a>}
        <label className="flex items-center gap-2"><input type="checkbox" disabled={busy} checked={view.emailEnabled} onChange={e=>void action({action:"settings",enabled:view.enabled,emailEnabled:e.target.checked})}/>Email agency owner</label>
      </div>
      {!!view.budget && <details className="mt-3 text-sm text-dash-ink-secondary">
        <summary className="cursor-pointer">Allowed spend variance · {money(view.tolerance)}</summary>
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label>Allowed month-end difference ({view.currency})<input aria-label="Allowed spend variance" type="number" min="0" max={view.budget} step="0.01" value={toleranceDraft??String(view.tolerance)} onChange={e=>setToleranceDraft(e.target.value)} className="mt-1 block w-36 rounded border border-dash-border bg-dash-bg px-2 py-1"/></label>
          <button type="button" disabled={busy||toleranceDraft===null} className="rounded border border-dash-border px-3 py-1.5 disabled:opacity-50" onClick={()=>{
            const value=Number(toleranceDraft);if(!toleranceDraft?.trim()||!Number.isFinite(value)||value<0){setError("Enter a non-negative variance amount.");return;}
            void action({action:"settings",enabled:view.enabled,emailEnabled:view.emailEnabled,tolerance:value});
          }}>Save variance</button>
        </div>
        <p className="mt-2 text-xs">Defaults to 1% of the approved budget. Small overages alone do not send emails within this allowance. A materially high forecast can still trigger a warning. Underspend forecasts start after seven completed days; the final week uses this tighter allowance.</p>
      </details>}
      {(!view.budget || !view.linked) && <p className="mt-3 text-sm text-dash-ink-secondary">Save a monthly budget in Client settings and link the Meta ad account to enable monitoring.</p>}
      {view.enabled && <>
        <p className="mt-3 text-sm font-semibold text-dash-ink">{snapshot?.error?"Spend check needs attention":stale?"Spend snapshot is stale":facts?BUDGET_LEVEL_LABELS[facts.level]:"Awaiting first spend check"}</p>
        {facts && <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">{[["Approved budget",money(view.budget!)],["Month-to-date spend",money(facts.spent)],["Remaining",money(facts.remaining)],["Projected month-end",facts.projected===null?"Not enough completed days":money(facts.projected)]].map(([label,value])=><div key={label}><dt className="text-dash-ink-secondary">{label}</dt><dd className="mt-1 font-semibold text-dash-ink">{value}</dd></div>)}</dl>}
        {facts && facts.over>0 && <p className={`mt-2 text-sm ${facts.over>view.tolerance?"text-amber-400":"text-dash-ink-secondary"}`}>{facts.over>view.tolerance?`Over approved budget by ${money(facts.over)}. Review your campaigns in Ads Manager.`:`Spend is ${money(facts.over)} above budget, within your ${money(view.tolerance)} allowance.`}</p>}
        {facts?.level==="underspend" && <p className="mt-2 text-sm text-amber-400">Projected month-end shortfall: {money(facts.projectedShortfall!)}. Review campaign delivery and budget pacing in Ads Manager.</p>}
        {snapshot && <p className="mt-2 text-xs text-dash-ink-secondary">{snapshot.month} · {snapshot.error?"Prior snapshot":"Last checked"}: {new Intl.DateTimeFormat("en-US",{dateStyle:"medium",timeStyle:"short",timeZone:view.timezone}).format(new Date(snapshot.checkedAt))} ({view.timezone})</p>}
        {snapshot?.error && <p role="alert" className="mt-2 text-sm text-amber-400">{snapshot.error}</p>}
        {snapshot?.emailError && <p role="alert" className="mt-2 text-sm text-amber-400">{snapshot.emailError}</p>}
        <p className="mt-2 text-xs text-dash-ink-secondary">Daily automatic check. Check now for a fresh snapshot. Meta data can be delayed; projections use completed days and are estimates.</p>
      </>}
    </>}
    {error && <p role="alert" className="mt-3 text-sm text-amber-400">{error}</p>}
  </section>;
}
