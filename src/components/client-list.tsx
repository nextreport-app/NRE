"use client";

import { useState } from "react";
import Link from "next/link";
import type { Currency } from "@/generated/prisma/enums";
import { CURRENCY_SYMBOLS } from "@/lib/nre/format";
import { formatClientTimezone, getPreviousMonthListStatus } from "@/lib/client-display";

const PAGE_SIZE = 12;
const MAX_PAGE_BUTTONS = 5;

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
      className={`rounded-lg px-3.5 py-2 text-[15px] font-semibold transition-colors ${
        disabled
          ? "cursor-not-allowed bg-dash-card text-dash-ink-secondary/50"
          : active
            ? "bg-dash-accent text-dash-ink"
            : "bg-dash-card text-dash-ink hover:bg-dash-border"
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
            <span key={`ellipsis-${i}`} className="px-1 text-[15px] text-dash-ink-secondary">
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
      <p className="text-[14px] text-dash-ink-secondary">
        Showing {rangeStart}–{rangeEnd} of {totalCount} clients
      </p>
    </nav>
  );
}

interface ClientListItem {
  id: string;
  accountName: string;
  currency: Currency;
  timezone: string;
  hasPreviousMonthData: boolean;
  previousMonthDataUpdatedAt: string | null;
}

function SearchIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3-3" strokeLinecap="round" />
    </svg>
  );
}

function formatClientMeta(currency: Currency, timezone: string): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? "";
  const currencyLabel = symbol ? `${symbol} ${currency}` : currency;
  return `${currencyLabel} · ${formatClientTimezone(timezone)}`;
}

function ClientCard({ client }: { client: ClientListItem }) {
  const prevMonth = getPreviousMonthListStatus(
    client.hasPreviousMonthData,
    client.previousMonthDataUpdatedAt,
    client.timezone,
  );
  const needsAttention = prevMonth.status !== "current";

  return (
    <article className="group flex flex-col rounded-xl border border-dash-border bg-dash-card p-5 transition-colors hover:border-dash-accent/40">
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-[17px] font-semibold text-dash-ink" title={client.accountName}>
          {client.accountName}
        </h3>
        <p className="mt-0.5 text-[14px] text-dash-ink-secondary">{formatClientMeta(client.currency, client.timezone)}</p>
        {needsAttention ? (
          <p className="mt-2.5 text-[13px] leading-snug text-amber-200/90" title={prevMonth.title}>
            {prevMonth.label}
          </p>
        ) : null}
      </div>

      <div className="mt-5 flex items-center gap-2">
        <Link
          href={`/clients/${client.id}/reports/new`}
          className="flex-1 rounded-md bg-dash-accent px-4 py-2.5 text-center text-[14px] font-semibold text-dash-ink hover:bg-dash-accent-hover"
        >
          Generate Report
        </Link>
        <Link
          href={`/clients/${client.id}`}
          className="rounded-md px-3 py-2.5 text-[14px] font-semibold text-dash-ink-secondary transition-colors hover:bg-dash-bg hover:text-dash-ink"
        >
          Manage
        </Link>
      </div>
    </article>
  );
}

export function ClientList({ clients, totalCount }: { clients: ClientListItem[]; totalCount: number }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const filtered = clients.filter((client) =>
    client.accountName.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const [prevTotalPages, setPrevTotalPages] = useState(totalPages);
  if (totalPages !== prevTotalPages) {
    setPrevTotalPages(totalPages);
    setPage((p) => Math.min(p, totalPages));
  }

  const [prevSearch, setPrevSearch] = useState(search);
  if (search !== prevSearch) {
    setPrevSearch(search);
    setPage(1);
  }

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      <div className="relative mb-6 max-w-md">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-dash-ink-secondary">
          <SearchIcon />
        </span>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by client name…"
          aria-label="Search clients"
          className="w-full rounded-lg border border-dash-border bg-dash-card py-2.5 pl-10 pr-10 text-[15px] text-dash-ink placeholder:text-dash-ink-secondary outline-none focus:border-dash-accent"
        />
        {search ? (
          <button
            type="button"
            onClick={() => setSearch("")}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-dash-ink-secondary hover:bg-dash-border hover:text-dash-ink"
          >
            ×
          </button>
        ) : null}
      </div>

      {search && filtered.length > 0 ? (
        <p className="mb-4 text-[14px] text-dash-ink-secondary">
          {filtered.length} of {totalCount} client{totalCount === 1 ? "" : "s"} match &ldquo;{search.trim()}&rdquo;
        </p>
      ) : null}

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-dash-border bg-dash-card/40 p-10 text-center">
          <p className="text-[16px] text-dash-ink-secondary">No clients match your search.</p>
          <button
            type="button"
            onClick={() => setSearch("")}
            className="mt-3 text-[15px] font-medium text-dash-accent underline hover:no-underline"
          >
            Clear search
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {paginated.map((client) => (
              <ClientCard key={client.id} client={client} />
            ))}
          </div>
          {totalPages > 1 ? (
            <Pagination page={page} totalPages={totalPages} totalCount={filtered.length} onPageChange={setPage} />
          ) : null}
        </>
      )}
    </div>
  );
}
