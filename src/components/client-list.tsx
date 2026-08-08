"use client";

import { useState } from "react";
import Link from "next/link";
import { CURRENCY_SYMBOLS } from "@/lib/nre/format";
import type { Currency } from "@/generated/prisma/enums";

const PAGE_SIZE = 12;
const MAX_PAGE_BUTTONS = 5;

/** A sliding window of up to MAX_PAGE_BUTTONS page numbers centred on the current page, with "ellipsis" markers standing in for the gap to page 1 / the last page when the window doesn't reach them. */
function getPageWindow(current: number, total: number): (number | "ellipsis")[] {
  if (total <= MAX_PAGE_BUTTONS) return Array.from({ length: total }, (_, i) => i + 1);

  const half = Math.floor(MAX_PAGE_BUTTONS / 2);
  let start = Math.max(1, current - half);
  let end = start + MAX_PAGE_BUTTONS - 1;
  if (end > total) {
    end = total;
    start = end - MAX_PAGE_BUTTONS + 1;
  }

  const window: (number | "ellipsis")[] = [];
  if (start > 1) {
    window.push(1);
    if (start > 2) window.push("ellipsis");
  }
  for (let p = start; p <= end; p++) window.push(p);
  if (end < total) {
    if (end < total - 1) window.push("ellipsis");
    window.push(total);
  }
  return window;
}

function PageButton({
  children,
  active,
  disabled,
  onClick,
  ariaLabel,
}: {
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-current={active ? "page" : undefined}
      className={`rounded-lg px-3.5 py-2 text-[14px] font-semibold transition-colors ${
        disabled
          ? "cursor-not-allowed bg-dash-card text-dash-ink-secondary/50"
          : active
            ? "bg-[#f6ad55] text-[#0d1b2e]"
            : "bg-dash-card text-white hover:bg-[#1e3a5f]"
      }`}
    >
      {children}
    </button>
  );
}

function Pagination({
  page,
  totalPages,
  totalCount,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  totalCount: number;
  onPageChange: (page: number) => void;
}) {
  const rangeStart = (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, totalCount);

  return (
    <nav aria-label="Client list pagination" className="mt-8 flex flex-col items-center gap-3">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <PageButton disabled={page === 1} onClick={() => onPageChange(page - 1)} ariaLabel="Previous page">
          ← Previous
        </PageButton>
        {getPageWindow(page, totalPages).map((item, i) =>
          item === "ellipsis" ? (
            <span key={`ellipsis-${i}`} className="px-1 text-[14px] text-dash-ink-secondary">
              …
            </span>
          ) : (
            <PageButton key={item} active={item === page} onClick={() => onPageChange(item)} ariaLabel={`Page ${item}`}>
              {item}
            </PageButton>
          ),
        )}
        <PageButton disabled={page === totalPages} onClick={() => onPageChange(page + 1)} ariaLabel="Next page">
          Next →
        </PageButton>
      </div>
      <p className="text-[13px] text-dash-ink-secondary">
        Showing {rangeStart}-{rangeEnd} of {totalCount} clients
      </p>
    </nav>
  );
}

interface ClientListItem {
  id: string;
  accountName: string;
  currency: Currency;
  timezone: string;
  monthlyBudget: number | null;
  /** ISO timestamp of the most recent report generated for this client, or null if none yet. */
  lastReportAt: string | null;
  /** Whether Client.previousMonthDataUrl is set — drives Fix 2's status dot below the last-report line. */
  hasPreviousMonthData: boolean;
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

/** Fix 2 — at-a-glance Previous Month Data status, most useful at the start of each new month when last month's upload needs replacing. */
function PreviousMonthDataStatus({ uploaded }: { uploaded: boolean }) {
  return (
    <p className={`mt-1 flex items-center gap-1.5 text-[11px] ${uploaded ? "text-dash-ink-secondary" : "text-dash-accent"}`}>
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${uploaded ? "bg-emerald-500" : "bg-dash-accent"}`}
      />
      {uploaded ? "Prev. month data ✓" : "Prev. month data missing"}
    </p>
  );
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
  const [page, setPage] = useState(1);

  const filtered = clients.filter((client) =>
    client.accountName.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  // Adjust state during render (React's recommended alternative to an
  // effect for this) rather than after commit, so the page never briefly
  // renders out of range. Keeps `page` in range whenever the filtered
  // count shrinks — e.g. a client is deleted (the list refreshes with one
  // fewer item) and the current page no longer exists, so we fall back to
  // the new last page rather than showing an empty grid.
  const [prevTotalPages, setPrevTotalPages] = useState(totalPages);
  if (totalPages !== prevTotalPages) {
    setPrevTotalPages(totalPages);
    setPage((p) => Math.min(p, totalPages));
  }

  // Runs after the clamp above (statement order also decides precedence
  // here), so a search keystroke always wins and resets to page 1 rather
  // than just clamping into range.
  const [prevSearch, setPrevSearch] = useState(search);
  if (search !== prevSearch) {
    setPrevSearch(search);
    setPage(1);
  }

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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
        <>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {paginated.map((client) => (
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
                  <PreviousMonthDataStatus uploaded={client.hasPreviousMonthData} />
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
          {totalPages > 1 && (
            <Pagination page={page} totalPages={totalPages} totalCount={filtered.length} onPageChange={setPage} />
          )}
        </>
      )}
    </div>
  );
}
