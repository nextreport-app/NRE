"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { InboxItem, InboxView } from "@/lib/report-schedules/inbox";
import { ApiSourceDownload } from "./report-upload-wizard/ui/api-source-download";
const button =
  "rounded-lg border border-dash-border px-3 py-2 text-sm disabled:opacity-50";
const views: { key: InboxView; label: string }[] = [
  { key: "todo", label: "To do" },
  { key: "ready", label: "Awaiting review" },
  { key: "approved", label: "Ready to send" },
  { key: "working", label: "In progress" },
  { key: "attention", label: "Needs attention" },
  { key: "history", label: "History" },
];
interface View {
  items: InboxItem[];
  counts: Record<InboxView, number>;
  total: number;
  page: number;
  pages: number;
  health: { configured: boolean; healthy: boolean; lastTickAt: string | null };
}
const labels: Record<string, string> = {
  READY: "Awaiting review",
  APPROVED: "Ready to send",
  PENDING: "Queued",
  PREPARING: "Preparing",
  GENERATING: "Generating",
  SENDING: "Delivery pending",
  SENT: "Email accepted",
  FAILED: "Preparation failed",
  REVIEW: "Verify delivery",
  SKIPPED: "Skipped",
};
export function ReportInbox() {
  const [data, setData] = useState<View | null>(null),
    [view, setView] = useState<InboxView>("todo"),
    [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    [page, setPage] = useState(1),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState<string | null>(null),
    [loading, setLoading] = useState(false),
    [reviewed, setReviewed] = useState<Record<string, string>>({});
  const requestVersion = useRef(0);
  const invalidateRequests = useCallback(() => {
    requestVersion.current++;
  }, []);
  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    try {
      const response = await fetch(
        `/api/report-inbox?${new URLSearchParams({ view, q: query, page: String(page) })}`,
        { cache: "no-store" },
      );
      const result = await response.json();
      if (!response.ok)
        throw Error(result.error ?? "Report inbox could not load.");
      if (version === requestVersion.current) {
        setData(result);
        setError("");
      }
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [view, query, page]);
  useEffect(() => {
    let active = true;
    const refresh = () =>
      void load().catch((e) => {
        if (active) setError(e.message);
      });
    refresh();
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      invalidateRequests();
      window.removeEventListener("focus", refresh);
    };
  }, [load, invalidateRequests]);
  const pending = data?.items.some((r) =>
    ["PENDING", "PREPARING", "GENERATING", "SENDING"].includes(r.status),
  );
  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible")
        void load().catch(() =>
          setError("Reload to check the latest draft status."),
        );
    }, 10000);
    return () => clearInterval(timer);
  }, [load, pending]);
  async function action(item: InboxItem, kind: "approve" | "send" | "skip") {
    if (busy) return;
    setBusy(item.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        `/api/clients/${encodeURIComponent(item.clientId)}/report-schedules`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: kind,
            runId: item.id,
            ...(kind === "approve"
              ? { digest: item.report?.digest, reviewed: true }
              : {}),
          }),
        },
      );
      const result = await response.json();
      if (!response.ok) throw Error(result.error ?? "Report update failed.");
      setReviewed((previous) => ({ ...previous, [item.id]: "" }));
      setNotice(
        kind === "approve"
          ? "Approved. Nothing has been emailed. Send when you are ready."
          : kind === "skip"
            ? "Draft skipped."
            : result.pending || !result.ok
              ? "Delivery is pending. Its status will update here."
              : "Email accepted by the provider; inbox delivery is not confirmed.",
      );
      await load();
    } catch (e) {
      await load().catch(() => {});
      setError(e instanceof Error ? e.message : "Report update failed.");
    } finally {
      setBusy(null);
    }
  }
  const date = (iso: string, timezone: string) =>
    new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: timezone,
    }).format(new Date(iso));
  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl text-dash-ink nre-report-inbox">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Report inbox</h1>
          <p className="mt-2 text-sm text-dash-ink-secondary">
            Review scheduled drafts across your clients. Approve first, then
            send.
          </p>
        </div>
        <Link className={button} href="/clients">
          Manage schedules
        </Link>
      </div>
      <nav
        aria-label="Report inbox views"
        className="mt-5 flex flex-wrap gap-2"
      >
        {views.map((v) => (
          <button
            key={v.key}
            aria-pressed={view === v.key}
            disabled={!!busy}
            className={`${button} ${view === v.key ? "border-dash-accent text-dash-accent font-semibold" : ""}`}
            onClick={() => {
              if (view === v.key && page === 1) {
                void load().catch((e) => setError(e.message));
                return;
              }
              setView(v.key);
              setPage(1);
              setData(null);
              setReviewed({});
            }}
          >
            {v.label}
            {data ? ` (${data.counts[v.key]})` : ""}
          </button>
        ))}
      </nav>
      <form
        className="mt-4 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (busy) return;
          if (query === search.trim() && page === 1) {
            void load().catch((e) => setError(e.message));
            return;
          }
          setQuery(search.trim());
          setPage(1);
          setData(null);
          setReviewed({});
        }}
      >
        <input
          disabled={!!busy}
          aria-label="Find client"
          placeholder="Find a client"
          maxLength={100}
          className="min-w-0 flex-1 rounded-lg border border-dash-border bg-dash-bg px-3 py-2 text-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className={button} disabled={!!busy}>
          Search
        </button>
        <button
          type="button"
          className={button}
          disabled={!!busy || loading}
          onClick={() => void load().catch((e) => setError(e.message))}
        >
          Reload
        </button>
      </form>
      {data && !data.health.healthy && (
        <p className="mt-3 rounded-lg border border-dash-border p-3 text-xs text-dash-ink-secondary">
          Automatic preparation is not active or its scheduler check is overdue.
          Paused schedules and Prepare now on the client page still work.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-amber-400">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mt-3 text-sm">
          {notice}
        </p>
      )}
      {loading && <p className="mt-4 text-sm">Loading reports…</p>}
      {!loading && data && !data.items.length && (
        <div className="mt-5 rounded-xl border border-dash-border bg-dash-card p-5">
          <h2 className="font-semibold">
            {query ? "No matching drafts" : "Nothing in this view"}
          </h2>
          <p className="mt-2 text-sm text-dash-ink-secondary">
            Save a Weekly or Monthly schedule on a client page, then use Prepare
            now or enable recurring preparation. Client emails always require
            approval and an explicit send.
          </p>
          <Link
            href="/clients"
            className="mt-3 inline-block text-sm text-dash-accent"
          >
            Choose a client →
          </Link>
        </div>
      )}
      <div className="mt-4 space-y-4" aria-label="Scheduled report drafts">
        {data?.items.map((item) => (
          <article
            key={item.id}
            className="min-w-0 rounded-xl border border-dash-border bg-dash-card p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="break-words font-semibold">{item.clientName}</h2>
                <p className="mt-1 break-words text-sm">
                  {item.report?.displayName ??
                    `${item.cadence === "MONTHLY" ? "Monthly" : "Weekly"} draft`}
                </p>
              </div>
              <span
                className={`rounded-full border px-2 py-1 text-xs ${["FAILED", "REVIEW"].includes(item.status) ? "border-amber-400 text-amber-400" : item.status === "APPROVED" ? "border-emerald-400 text-emerald-400" : "border-dash-border"}`}
              >
                {labels[item.status] ?? "Needs review"}
              </span>
            </div>
            {item.period && (
              <p className="mt-2 text-xs text-dash-ink-secondary">
                Report dates: {item.period.startIso} – {item.period.endIso}
              </p>
            )}
            <p className="mt-1 text-xs text-dash-ink-secondary">
              Scheduled occurrence: {date(item.dueAt, item.timezone)} ·{" "}
              {item.timezone}
            </p>
            <p className="mt-2 break-words text-sm">
              To: {item.recipients.join(", ") || "Unavailable"}
            </p>
            {(item.error || item.settingsError) && (
              <p className="mt-2 break-words text-sm text-amber-400">
                {item.settingsError ?? item.error}
              </p>
            )}
            {item.status === "REVIEW" && (
              <p className="mt-2 text-xs text-dash-ink-secondary">
                Provider acceptance is uncertain. Verify delivery with support
                before preparing or sending another copy.
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              {item.report?.status === "COMPLETE" && (
                <>
                  <a
                    className="text-dash-accent"
                    href={`/clients/${item.clientId}/reports/${item.report.id}/copy`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Review / edit report
                  </a>
                  <a href={`/api/reports/${item.report.id}/download`}>
                    Download PPTX
                  </a>
                </>
              )}
              {item.report?.shareToken && (
                <a
                  href={`/r/${item.report.shareToken}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Browser report
                </a>
              )}
              {item.report?.slidesUrl && (
                <a
                  href={item.report.slidesUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Google Slides
                </a>
              )}
              <Link href={`/clients/${item.clientId}#scheduled-reports`}>
                Client schedule →
              </Link>
            </div>
            {item.sourceSessionId && (
              <ApiSourceDownload
                clientId={item.clientId}
                uploadSessionId={item.sourceSessionId}
              />
            )}
            {item.canApprove && item.report?.digest && (
              <div className="mt-4 border-t border-dash-border pt-3">
                <label className="flex gap-2 text-sm">
                  <input
                    type="checkbox"
                    disabled={!!busy}
                    checked={reviewed[item.id] === item.report.digest}
                    onChange={(e) =>
                      setReviewed({
                        ...reviewed,
                        [item.id]: e.target.checked ? item.report!.digest! : "",
                      })
                    }
                  />
                  I reviewed this report and its recipients.
                </label>
                <button
                  className={`${button} mt-3`}
                  disabled={!!busy || reviewed[item.id] !== item.report.digest}
                  onClick={() => void action(item, "approve")}
                >
                  Approve report
                </button>
              </div>
            )}
            {item.canSend && (
              <div className="mt-4 border-t border-dash-border pt-3">
                <p className="text-xs text-dash-ink-secondary">
                  Email includes browser and PPTX links
                  {item.report?.slidesUrl ? ", plus Google Slides" : ""}. Add a
                  Slides copy from Client schedule before sending, if needed.
                </p>
                <button
                  className={`${button} mt-3 bg-dash-accent text-black`}
                  disabled={!!busy}
                  onClick={() => void action(item, "send")}
                >
                  Send approved report
                </button>
              </div>
            )}
            {item.canCheckDelivery && (
              <button
                className={`${button} mt-3`}
                disabled={!!busy}
                onClick={() => void action(item, "send")}
              >
                Check / retry same delivery
              </button>
            )}
            {item.canSkip && (
              <button
                className="mt-3 block text-xs text-dash-ink-secondary underline disabled:opacity-50"
                disabled={!!busy}
                onClick={() => void action(item, "skip")}
              >
                Skip draft
              </button>
            )}
            {item.deliveredAt && (
              <p className="mt-2 text-xs text-dash-ink-secondary">
                Email accepted: {date(item.deliveredAt, item.timezone)}. Inbox
                receipt is not confirmed.
              </p>
            )}
          </article>
        ))}
      </div>
      {data && data.total > 0 && (
        <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
          <button
            className={button}
            disabled={!!busy || loading || data.page <= 1}
            onClick={() => {
              setPage(data.page - 1);
              setReviewed({});
            }}
          >
            Previous
          </button>
          <span>
            Page {data.page} of {data.pages} · {data.total} reports · Oldest
            first
          </span>
          <button
            className={button}
            disabled={!!busy || loading || data.page >= data.pages}
            onClick={() => {
              setPage(data.page + 1);
              setReviewed({});
            }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
