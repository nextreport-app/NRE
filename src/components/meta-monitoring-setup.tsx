"use client";
import { useState } from "react";
import Link from "next/link";
import type { OverviewRow } from "@/lib/agency-overview";
export function MetaMonitoringSetup({ client, busy, onEnable }: { client: OverviewRow; busy: boolean; onEnable: (emailEnabled: boolean) => void }) {
  const [emails, setEmails] = useState(client.emailEnabled);
  return <div className="mt-4 rounded-xl border border-dash-border bg-dash-bg p-5">
    <h3 className="font-semibold">{client.linked ? "Load your first performance comparison" : "Link a Meta ad account"}</h3>
    <p className="mt-2 max-w-2xl text-sm text-dash-ink-secondary">{client.linked ? "Compare campaign results with the previous period. This only reads your ad data; it does not change your campaigns." : "Connect Meta, then open Import and complete one Meta API sync for this client. You do not need to generate a report."}</p>
    {client.linked ? <>
      <label className="mt-4 flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 h-4 w-4 accent-dash-accent" disabled={busy} checked={emails} onChange={e=>setEmails(e.target.checked)} />Email me about new performance issues</label>
      <button type="button" disabled={busy} onClick={()=>onEnable(emails)} className="mt-4 min-h-11 rounded-xl bg-dash-accent px-5 py-2.5 text-sm font-semibold text-[#102033] disabled:opacity-50">{busy ? "Loading performance…" : "Enable & load performance"}</button>
    </> : <div className="mt-4 flex flex-wrap gap-3 text-sm"><Link href={`/clients/${client.id}/reports/new`} className="rounded-xl bg-dash-accent px-4 py-2.5 font-semibold text-[#102033]">Link account through Meta API</Link><Link href="/account#meta-ads" className="rounded-xl border border-dash-border px-4 py-2.5">Connect Meta</Link></div>}
  </div>;
}
