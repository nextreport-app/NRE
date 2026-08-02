"use client";

import { useState } from "react";
import Link from "next/link";
import { CURRENCY_SYMBOLS } from "@/lib/nre/format";
import type { Currency } from "@/generated/prisma/enums";

interface ClientListItem {
  id: string;
  accountName: string;
  currency: Currency;
  timezone: string;
  monthlyBudget: number | null;
  /** ISO timestamp of the most recent report generated for this client, or null if none yet. */
  lastReportAt: string | null;
}

function formatLastReport(iso: string | null): string {
  if (!iso) return "No reports yet";
  const date = new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  return `Last report: ${date}`;
}

function formatBudget(currency: Currency, budget: number | null): string {
  if (budget == null) return "No monthly ad spend budget set";
  return `Monthly Ad Spend Budget: ${CURRENCY_SYMBOLS[currency]}${budget.toLocaleString("en-US")}`;
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
      <div className="relative mb-6 max-w-md">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search clients..."
          aria-label="Search clients"
          className="w-full rounded-md border border-dash-border bg-dash-card px-3.5 py-2.5 text-[15px] text-dash-ink placeholder:text-dash-ink-secondary outline-none focus:border-dash-accent"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-dash-ink-secondary hover:text-dash-ink"
          >
            ×
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-dash-border p-10 text-center">
          <p className="text-[15px] text-dash-ink-secondary">No clients found matching your search.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {filtered.map((client) => (
            <div
              key={client.id}
              className="flex flex-col rounded-lg border border-dash-border bg-dash-card p-6 transition-colors hover:border-dash-accent/60"
            >
              <div>
                <h3 className="text-[18px] font-bold text-dash-ink">{client.accountName}</h3>
                <p className="mt-2 text-[13px] text-dash-ink-secondary">
                  {client.currency} · {client.timezone}
                </p>
                <p className="mt-1 text-[13px] text-dash-ink-secondary">{formatBudget(client.currency, client.monthlyBudget)}</p>
                <p className="mt-1 text-[13px] text-dash-ink-secondary">{formatLastReport(client.lastReportAt)}</p>
              </div>
              <div className="mt-5 flex gap-3">
                <Link
                  href={`/clients/${client.id}/reports/new`}
                  className="flex-1 rounded-md bg-[#f6ad55] px-4 py-2.5 text-center text-[14px] font-semibold text-white hover:bg-[#d97706]"
                >
                  Generate Report
                </Link>
                <Link
                  href={`/clients/${client.id}`}
                  className="flex-1 rounded-md bg-[#1e3a5f] px-4 py-2.5 text-center text-[14px] font-semibold text-white hover:bg-[#2d4f7c]"
                >
                  Manage
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
