"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteClientButton({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm("Delete this client and all its report history? This cannot be undone.")) return;
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
      className="rounded-md border border-red-900 px-3 py-1.5 text-sm text-red-400 hover:bg-red-950 disabled:opacity-60"
    >
      {loading ? "Deleting…" : "Delete client"}
    </button>
  );
}
