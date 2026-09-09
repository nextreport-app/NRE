"use client";

import { useState } from "react";
import Link from "next/link";
import type { Currency } from "@/generated/prisma/enums";
import { formatClientCurrency, getPreviousMonthListStatus } from "@/lib/client-display";

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
  hasGa4Property: boolean;
  ga4PropertyName: string | null;
}

function SearchIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3-3" strokeLinecap="round" />
    </svg>
  );
}

function StatusChip({
  tone,
  label,
  title,
}: {
  tone: "neutral" | "good" | "warn" | "info";
  label: string;
  title?: string;
}) {
  const toneClass =
    tone === "good"
      ? "border-emerald-800/50 bg-emerald-950/40 text-emerald-200"
      : tone === "warn"
        ? "border-amber-800/50 bg-amber-950/40 text-amber-200"
        : tone === "info"
          ? "border-sky-800/50 bg-sky-950/40 text-sky-200"
          : "border-dash-border bg-dash-bg text-dash-ink-secondary";

  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[13px] font-medium ${toneClass}`}
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${
          tone === "good" ? "bg-emerald-400" : tone === "warn" ? "bg-amber-400" : tone === "info" ? "bg-sky-400" : "bg-dash-ink-secondary"
        }`}
      />
      {label}
    </span>
  );
}

function ClientCard({ client }: { client: ClientListItem }) {
  const prevMonth = getPreviousMonthListStatus(
    client.hasPreviousMonthData,
    client.previousMonthDataUpdatedAt,
    client.timezone,
  );

  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-dash-border bg-dash-card transition-colors hover:border-dash-accent/50">
      <div className="border-b border-dash-border px-5 py-4">
        <h3 className="truncate text-[18px] font-bold text-dash-ink" title={client.accountName}>
          {client.accountName}
        </h3>
        <p className="mt-0.5 text-[15px] text-dash-ink-secondary">{formatClientCurrency(client.currency)}</p>
      </div>

      <div className="flex flex-wrap gap-2 px-5 py-3">
        <StatusChip
          tone={prevMonth.status === "current" ? "good" : "warn"}
          label={prevMonth.label}
          title={prevMonth.title}
        />
        <StatusChip
          tone={client.hasGa4Property ? "info" : "neutral"}
          label={client.hasGa4Property ? "GA4 linked" : "GA4 not linked"}
          title={
            client.hasGa4Property
              ? client.ga4PropertyName ?? "Google Analytics property linked on Manage."
              : "Link Google Analytics on Manage for website reports."
          }
        />
      </div>

      <div className="mt-auto flex gap-3 border-t border-dash-border px-5 py-4">
        <Link
          href={`/clients/${client.id}/reports/new`}
          className="flex-1 rounded-md bg-dash-accent px-4 py-2.5 text-center text-[15px] font-semibold text-dash-ink hover:bg-dash-accent-hover"
        >
          Generate Report
        </Link>
        <Link
          href={`/clients/${client.id}`}
          className="flex-1 rounded-md border border-dash-border bg-dash-bg px-4 py-2.5 text-center text-[15px] font-semibold text-dash-ink hover:bg-dash-border/40"
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
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
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
