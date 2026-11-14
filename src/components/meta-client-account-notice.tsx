"use client";
import Link from "next/link";
import { metaClientAccountStatus, normalizeMetaAccountId } from "@/lib/meta-client-account";

export function MetaClientAccountNotice({ clientName, linkedId, linkedName, selectedId, selectedName, confirmed, onConfirm, onUseLinked }: {
  clientName: string; linkedId?: string | null; linkedName?: string | null;
  selectedId: string; selectedName: string; confirmed: boolean;
  onConfirm: (value: boolean) => void; onUseLinked?: () => void;
}) {
  const status = metaClientAccountStatus(linkedId, selectedId);
  if (status === "matched" || status === "unselected") return null;
  const mismatch = status === "mismatch";
  return <section role="alert" className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm nre-wizard-confidence--warn">
    <h3 className="font-semibold">{mismatch ? "This ad account differs from the client’s linked account" : "Confirm the ad account for this client"}</h3>
    <p className="mt-2">Reporting for <strong>{clientName}</strong></p>
    {mismatch && <p className="mt-1">Linked account: {linkedName || "Meta ad account"} · ID {normalizeMetaAccountId(linkedId)}</p>}
    <p className="mt-1">Selected account: <strong>{selectedName}</strong> · ID {normalizeMetaAccountId(selectedId)}</p>
    <p className="mt-2 text-xs">{mismatch ? "Check the client or change the selected ad account before syncing. Continuing will not replace the client’s linked account." : "No Meta ad account is linked yet. The first successful sync will remember this confirmed account for this client."}</p>
    <div className="mt-3 flex flex-wrap gap-4">
      {onUseLinked && <button type="button" className="font-medium underline" onClick={onUseLinked}>Use linked account</button>}
      <Link href="/clients" className="font-medium underline">Change client</Link>
    </div>
    <label className="mt-3 flex cursor-pointer items-start gap-2">
      <input type="checkbox" checked={confirmed} onChange={event => onConfirm(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-amber-400" />
      <span>{mismatch ? `Use ${selectedName} for this report under ${clientName}.` : `This ad account belongs to ${clientName}.`}</span>
    </label>
  </section>;
}
