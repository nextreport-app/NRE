"use client";
import { useState } from "react";
import { MetaClientAccountSelector } from "./meta-client-account-selector";
import type { OverviewRow } from "@/lib/agency-overview";
export function MetaMonitoringSetup({
  client,
  busy,
  onEnable,
  onLinked,
  onActivity,
}: {
  client: OverviewRow;
  busy: boolean;
  onEnable: (emailEnabled: boolean) => void;
  onLinked: () => Promise<void>;
  onActivity: (busy: boolean) => void;
}) {
  const [emails, setEmails] = useState(client.emailEnabled);
  if (!client.linked)
    return (
      <MetaClientAccountSelector
        clientId={client.id}
        clientName={client.name}
        busy={busy}
        onLinked={onLinked}
        onActivity={onActivity}
      />
    );
  return (
    <div className="mt-4 rounded-xl border border-dash-border bg-dash-bg p-5">
      <h3 className="font-semibold">Load your first performance comparison</h3>
      <p className="mt-2 max-w-2xl text-sm text-dash-ink-secondary">
        Compare campaign results with the previous period. This only reads your
        ad data; it does not change your campaigns. Critical alerts are emailed
        automatically while monitoring is enabled.
      </p>
      <>
        <label className="mt-4 flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-dash-accent"
            disabled={busy}
            checked={emails}
            onChange={(e) => setEmails(e.target.checked)}
          />
          Also email me about review warnings
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={() => onEnable(emails)}
          className="mt-4 min-h-11 rounded-xl bg-dash-accent px-5 py-2.5 text-sm font-semibold text-[#102033] disabled:opacity-50"
        >
          {busy ? "Loading performance…" : "Enable & load performance"}
        </button>
      </>
    </div>
  );
}
