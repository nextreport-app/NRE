"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast";

/**
 * Feature 3 — a confirmation modal (not a native confirm(), since the spec
 * needs an editable "new client name" field inside it) that copies the
 * current client's settings (currency/timezone/budget/template) into a
 * brand-new client via POST /api/clients/[id]/duplicate, then navigates
 * straight to the new client's own Manage page.
 */
export function DuplicateClientButton({ clientId, clientName }: { clientId: string; clientName: string }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(`${clientName} (Copy)`);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openModal() {
    setName(`${clientName} (Copy)`);
    setError(null);
    setOpen(true);
  }

  async function handleDuplicate() {
    setError(null);
    setLoading(true);
    const res = await fetch(`/api/clients/${clientId}/duplicate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountName: name }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Could not duplicate this client. Please try again.");
      return;
    }

    setOpen(false);
    showToast("Client duplicated successfully");
    router.push(`/clients/${data.client.id}`);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="text-[13px] font-semibold text-dash-accent hover:underline"
      >
        Duplicate Client
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-lg border border-dash-border bg-dash-card p-5">
            <h2 className="text-[16px] font-semibold text-dash-ink">Duplicate {clientName}?</h2>
            <p className="mt-2 text-[13px] text-dash-ink-secondary">
              This will create a new client with the same settings (currency, timezone, budget, template). Campaign
              history and reports will not be copied.
            </p>

            <div className="mt-4">
              <label className="mb-1 block text-sm text-dash-ink-secondary">New client name</label>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md border border-dash-border bg-dash-bg px-3 py-2 text-sm text-dash-ink outline-none focus:border-dash-accent"
              />
            </div>

            {error && <p className="mt-2 text-[13px] text-dash-error">{error}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={loading}
                className="rounded-md border border-dash-border px-4 py-2 text-[13px] text-dash-ink-secondary hover:bg-dash-bg disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDuplicate}
                disabled={loading || !name.trim()}
                className="rounded-md bg-dash-accent px-4 py-2 text-[13px] font-semibold text-dash-ink hover:bg-dash-accent-hover disabled:opacity-60"
              >
                {loading ? "Duplicating…" : "Duplicate Client"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
