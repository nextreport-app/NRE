"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast";

export function AccountSettingsForm({ initialAgencyName }: { initialAgencyName: string | null }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [agencyName, setAgencyName] = useState(initialAgencyName ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agencyName }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      const message = data.error || "Something went wrong.";
      setError(message);
      showToast(message, "error");
      return;
    }

    showToast("Agency details saved.");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="mb-1 block text-sm text-dash-ink-secondary">Agency name</label>
        <input
          value={agencyName}
          onChange={(e) => setAgencyName(e.target.value)}
          placeholder="e.g. Bright Path Marketing"
          maxLength={150}
          className="w-full rounded-md border border-dash-border bg-dash-card px-3 py-2 text-sm text-dash-ink outline-none focus:border-dash-accent"
        />
        <p className="mt-1 text-[13px] text-dash-ink-secondary">
          Shown as &quot;Prepared by {agencyName || "..."}&quot; on every report&apos;s cover slide. Leave blank to omit it.
        </p>
      </div>

      {error && <p className="text-sm text-dash-error">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-dash-accent px-4 py-2 text-sm font-medium text-dash-ink hover:bg-dash-accent-hover disabled:opacity-60"
      >
        {loading ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
