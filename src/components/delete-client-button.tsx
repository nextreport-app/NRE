"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteClientButton({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm("Delete this client and all their reports? This cannot be undone.")) return;
    setLoading(true);
    const res = await fetch(`/api/clients/${clientId}`, { method: "DELETE" });
    setLoading(false);
    if (res.ok) {
      router.push("/clients");
      router.refresh();
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="text-[13px] font-semibold text-dash-error hover:underline disabled:opacity-60"
    >
      {loading ? "Deleting…" : "Delete client"}
    </button>
  );
}
