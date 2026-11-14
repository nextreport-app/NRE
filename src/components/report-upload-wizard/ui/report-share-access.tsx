"use client";
import {useState} from "react";

export function ReportShareAccess({reportId,enabled,onChanged}:{reportId:string;enabled:boolean;onChanged:(token:string|null)=>void}) {
  const [pending,setPending]=useState(false),[error,setError]=useState<string|null>(null);
  async function update(action:"reset"|"disable") {
    setPending(true);setError(null);
    try {
      const res=await fetch(`/api/reports/${reportId}/share-link`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action})});
      const data=await res.json();
      if(!res.ok) throw new Error(data.error || "Could not update link access. Try again.");
      onChanged(data.shareToken);
    } catch(e) {setError(e instanceof Error?e.message:"Could not update link access.");}
    finally {setPending(false);}
  }
  return <section aria-label="Report link access" className="rounded-lg border border-dash-border p-4">
    <p className="text-sm font-medium text-dash-ink">{enabled?"Public link enabled":"Public link disabled"}</p>
    <p className="mt-1 text-xs text-dash-ink-secondary">{enabled?"Anyone with the link can view this report. Resetting or disabling it stops access through the old link.":"Previously shared links no longer open this report. You can create a new link when ready."}</p>
    <div className="mt-3 flex flex-wrap gap-3">
      <button disabled={pending} type="button" onClick={()=>void update("reset")} className="min-h-10 rounded-md border border-dash-border px-3 text-sm text-dash-ink disabled:opacity-50">{pending?"Updating…":enabled?"Reset link":"Enable new link"}</button>
      {enabled&&<button disabled={pending} type="button" onClick={()=>void update("disable")} className="min-h-10 px-3 text-sm text-dash-ink-secondary disabled:opacity-50">Disable link</button>}
    </div>
    {error&&<p role="alert" className="mt-2 text-sm text-dash-error">{error}</p>}
  </section>;
}
