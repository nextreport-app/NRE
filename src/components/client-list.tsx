"use client";

import { useState } from "react";
import Link from "next/link";
import { ReminderLabel } from "./report-reminder-dashboard";
import type { ReminderView } from "@/lib/report-reminders/model";
import { ClientCardActions } from "./client-card-actions";
import { clientActivityDate, type ClientConnectionState } from "@/lib/client-card-summary";
import type { Currency } from "@/generated/prisma/enums";

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
      className={`rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors ${
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
  metaConnection?: ClientConnectionState;
  ga4Connection?: ClientConnectionState;
  gscConnection?: ClientConnectionState;
  gscSiteName?: string | null;
  metaAccountName?: string | null;
  lastReportAt?: string | null;
  nextScheduleAt?: string | null;
  nextScheduleTimezone?: string;
  lastReportSentAt?: string | null;
  reminder?: ReminderView | null;
  reminderNow?: string;
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
      ? "nre-dash-status nre-dash-status--good"
      : tone === "warn"
        ? "nre-dash-status nre-dash-status--warn"
        : tone === "info"
          ? "nre-dash-status nre-dash-status--info"
          : "nre-dash-status nre-dash-status--neutral";

  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${toneClass}`}
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

function ClientCard({ client, scheduling = false, actionsOpen, onActionsToggle, onActionsClose }: { client: ClientListItem; scheduling?: boolean; actionsOpen: boolean; onActionsToggle: () => void; onActionsClose: () => void }) {

  return (
    <article className="nre-client-card flex flex-col overflow-hidden rounded-xl border border-dash-border bg-dash-card transition-colors hover:border-dash-accent/70">
      <div className="space-y-2.5 px-4 py-3 sm:px-5 sm:py-4">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="break-words text-[17px] font-semibold leading-snug text-dash-ink">
              <Link href={`/clients/${client.id}`} className="hover:underline focus-visible:outline-dash-accent">{client.accountName}</Link>
            </h3>
          </div>
          <ClientCardActions clientId={client.id} clientName={client.accountName} scheduling={scheduling} open={actionsOpen} onToggle={onActionsToggle} onClose={onActionsClose} />
        </div>
        <div className="flex flex-wrap gap-1.5" aria-label="Platform connections">
          {([ ["Meta", client.metaConnection, client.metaAccountName], ["GA4", client.ga4Connection, client.ga4PropertyName], ["Search Console", client.gscConnection ?? "not-linked", client.gscSiteName] ] as const).map(([platform, status, name]) => status ? (
            <StatusChip key={platform} tone={status === "connected" ? "good" : status === "reconnect" ? "warn" : "neutral"} label={`${platform} ${status === "connected" ? "connected" : status === "reconnect" ? "reconnect" : "not linked"}`} title={status === "connected" ? name ?? `${platform} linked` : status === "reconnect" ? `Reconnect ${platform} in Account settings` : `Link ${platform} to this client`} />
          ) : null)}
        </div>
        <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-dash-ink-secondary">
          <div className="inline-flex flex-wrap gap-x-1"><dt>Last generated:</dt><dd>{client.lastReportAt ? <time dateTime={client.lastReportAt} title={client.timezone}>{clientActivityDate(client.lastReportAt, client.timezone)}</time> : "No reports yet"}</dd></div>
          {client.nextScheduleAt && <div className="inline-flex flex-wrap gap-x-1"><dt>Next scheduled:</dt><dd><time dateTime={client.nextScheduleAt} title={`Scheduled draft · ${client.nextScheduleTimezone ?? client.timezone}`}>{clientActivityDate(client.nextScheduleAt, client.nextScheduleTimezone ?? client.timezone, true)}</time></dd></div>}
          {client.lastReportSentAt && <div className="inline-flex flex-wrap gap-x-1"><dt>Last sent:</dt><dd>{clientActivityDate(client.lastReportSentAt,client.timezone)}</dd></div>}
        </dl>
        <p className="text-xs">{client.reminder ? <Link href={`/clients/${client.id}/reminders`} className="hover:underline"><ReminderLabel reminder={client.reminder} now={client.reminderNow??new Date().toISOString()}/></Link> : <Link href={`/clients/${client.id}/reminders`} className="text-dash-accent hover:underline">Set report reminder →</Link>}</p>
      </div>
      <div className="nre-client-card__divider mt-auto grid grid-cols-2 gap-2 border-t border-dash-border px-4 py-2.5 sm:px-5">
        <Link href={scheduling ? `/clients/${client.id}/schedules` : `/clients/${client.id}/reports/new`} aria-label={`${scheduling ? "Schedule reports" : "Generate report"} for ${client.accountName}`} className="col-span-2 inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-dash-accent px-4 py-3 text-center text-[13px] font-semibold text-[#102033] shadow-sm transition hover:bg-dash-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dash-accent">{scheduling ? "Schedule reports" : "Generate report"} <span aria-hidden="true">→</span></Link>

      </div>
    </article>
  );
}

export function ClientList({ clients, totalCount, scheduling = false }: { clients: ClientListItem[]; totalCount: number; scheduling?: boolean }) {
  const [search, setSearch] = useState("");
  const [openClientId, setOpenClientId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("recent");

  const filtered = clients.filter((client) =>
    client.accountName.toLowerCase().includes(search.trim().toLowerCase()),
  );
  if (sort !== "recent") {
    filtered.sort((a, b) => a.accountName.localeCompare(b.accountName, undefined, { sensitivity: "base", numeric: true }) * (sort === "name-desc" ? -1 : 1));
  }
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
      <div className="mb-5 flex flex-col gap-3 rounded-xl border border-dash-border bg-dash-card/50 p-3 sm:flex-row sm:items-center">
      <div className="relative min-w-0 flex-1">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-dash-ink-secondary">
          <SearchIcon />
        </span>
        <input
          type="search"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setOpenClientId(null); }}
          placeholder="Search clients…"
          aria-label="Search clients"
          className="nre-dash-surface w-full rounded-lg border border-dash-border bg-dash-bg py-2.5 pl-10 pr-10 text-[14px] text-dash-ink placeholder:text-dash-ink-secondary [&::-webkit-search-cancel-button]:appearance-none outline-none focus:border-dash-accent focus:ring-2 focus:ring-dash-accent/30"
        />
        {search ? (
          <button
            type="button"
            onClick={() => { setSearch(""); setOpenClientId(null); }}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-dash-ink-secondary hover:bg-dash-border hover:text-dash-ink"
          >
            ×
          </button>
        ) : null}
      </div>
      <label className="flex items-center gap-2 text-[12px] text-dash-ink-secondary"><span>Sort</span><select aria-label="Sort clients" value={sort} onChange={e => { setSort(e.target.value); setPage(1); setOpenClientId(null); }} className="min-w-0 flex-1 rounded-lg border border-dash-border bg-dash-bg px-3 py-2.5 text-[13px] text-dash-ink outline-none focus:border-dash-accent sm:w-44"><option value="recent">Recently added</option><option value="name-asc">Name: A–Z</option><option value="name-desc">Name: Z–A</option></select></label>
      </div>
      {search.trim() ? (
        <p className="mb-4 text-[14px] text-dash-ink-secondary">
          {filtered.length} of {totalCount} client{totalCount === 1 ? "" : "s"} match &ldquo;{search.trim()}&rdquo;
        </p>
      ) : null}

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-dash-border bg-dash-card/40 p-10 text-center">
          <p className="text-[16px] text-dash-ink-secondary">No clients match your search.</p>
          <button
            type="button"
            onClick={() => { setSearch(""); setOpenClientId(null); }}
            className="mt-3 text-[15px] font-medium text-dash-accent underline hover:no-underline"
          >
            Clear search
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {paginated.map((client) => (
              <ClientCard key={client.id} client={client} scheduling={scheduling} actionsOpen={openClientId === client.id} onActionsToggle={() => setOpenClientId(id => id === client.id ? null : client.id)} onActionsClose={() => setOpenClientId(null)} />
            ))}
          </div>
          {totalPages > 1 ? (
            <Pagination page={page} totalPages={totalPages} totalCount={filtered.length} onPageChange={page => { setPage(page); setOpenClientId(null); }} />
          ) : null}
        </>
      )}
    </div>
  );
}
