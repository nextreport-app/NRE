"use client";

import { useState } from "react";
import Link from "next/link";
import { TEMPLATE_LABELS } from "@/lib/validators/client";

interface ClientListItem {
  id: string;
  accountName: string;
  currency: string;
  timezone: string;
  template: keyof typeof TEMPLATE_LABELS;
}

/**
 * Client-side name filter over the already-loaded client list — no server
 * request per keystroke, since the full list is already on the page (this
 * app's client counts are small, capped at 10 on Starter / unlimited on
 * Professional, so filtering in the browser is simpler than adding a
 * search API route for what's realistically a few dozen rows at most).
 */
export function ClientList({ clients }: { clients: ClientListItem[] }) {
  const [search, setSearch] = useState("");

  const filtered = clients.filter((client) =>
    client.accountName.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <div>
      <div className="relative mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search clients..."
          aria-label="Search clients"
          className="w-full rounded-md border border-navy-border bg-navy-panel px-3 py-2 pr-9 text-sm text-white placeholder:text-ink-muted focus:border-accent focus:outline-none"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-ink-muted hover:text-white"
          >
            ×
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-navy-border p-10 text-center">
          <p className="text-ink-muted">No clients found matching your search.</p>
        </div>
      ) : (
        <ul className="divide-y divide-navy-border rounded-lg border border-navy-border bg-navy-panel">
          {filtered.map((client) => (
            <li key={client.id}>
              <Link
                href={`/clients/${client.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-navy-border/60"
              >
                <div>
                  <p className="font-medium text-white">{client.accountName}</p>
                  <p className="text-xs text-ink-muted">
                    {client.currency} · {client.timezone} · {TEMPLATE_LABELS[client.template]}
                  </p>
                </div>
                <span className="text-sm text-ink-muted">Manage →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
