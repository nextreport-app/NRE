"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Part 5 — client Manage page escape hatch: clears Client.campaignObjectiveCache so the Objective Confirmation step re-detects every campaign from scratch on the next report, for when a campaign's real objective has genuinely changed. */
export function ResetObjectiveMemoryButton({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleReset() {
    if (
      !confirm(
        "This will clear all remembered campaign objectives for this client. The system will re-detect objectives on your next report.",
      )
    ) {
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/clients/${clientId}/objective-cache`, { method: "DELETE" });
    setLoading(false);
    if (res.ok) router.refresh();
  }

  return (
    <button
      onClick={handleReset}
      disabled={loading}
      className="text-[13px] text-dash-ink-secondary hover:text-dash-ink hover:underline disabled:opacity-60"
    >
      {loading ? "Resetting…" : "Reset campaign objective memory"}
    </button>
  );
}
