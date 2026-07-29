"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CancelSubscriptionButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCancel() {
    if (!confirm("Cancel your subscription? You will lose access to paid features immediately.")) return;

    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/billing/cancel", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not cancel your subscription. Please try again.");
        setLoading(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Could not reach the server. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleCancel}
        disabled={loading}
        className="rounded-md border border-navy-border px-4 py-2 text-sm font-medium text-red-300 hover:bg-navy disabled:opacity-60"
      >
        {loading ? "Cancelling…" : "Cancel subscription"}
      </button>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
