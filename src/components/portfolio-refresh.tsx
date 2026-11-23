"use client";
import { useEffect, useRef, useState } from "react";
import type { OverviewRow } from "@/lib/agency-overview";
import {
  dueChecks,
  runDueChecks,
} from "@/lib/performance-monitor/refresh-queue";
export function PortfolioRefresh({
  clients,
  disabled,
  onActivity,
  onComplete,
}: {
  clients: OverviewRow[];
  disabled: boolean;
  onActivity: (busy: boolean) => void;
  onComplete: () => Promise<void>;
}) {
  const [running, setRunning] = useState(false),
    [progress, setProgress] = useState(0),
    [total, setTotal] = useState(0),
    [result, setResult] = useState<Awaited<
      ReturnType<typeof runDueChecks>
    > | null>(null),
    [reloadError, setReloadError] = useState("");
  const cancelled = useRef(false),
    mounted = useRef(true),
    active = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cancelled.current = true;
    };
  }, []);
  const jobs = dueChecks(clients);
  async function refresh() {
    if (active.current || disabled || !jobs.length) return;
    active.current = true;
    cancelled.current = false;
    setRunning(true);
    setProgress(0);
    setTotal(jobs.length);
    setResult(null);
    setReloadError("");
    onActivity(true);
    try {
      const outcome = await runDueChecks(
        jobs,
        async (job) => {
          const response = await fetch(
            `/api/clients/${encodeURIComponent(job.id)}/${job.kind}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "check" }),
            },
          );
          const data = await response.json();
          if (!response.ok || data.snapshot?.error)
            throw Error(data.error ?? data.snapshot?.error ?? "Check failed.");
        },
        () => cancelled.current,
        (n) => {
          if (mounted.current) setProgress(n);
        },
      );
      if (mounted.current) {
        setResult(outcome);
        try {
          await onComplete();
        } catch {
          setReloadError(
            "Checks finished, but the overview could not reload. Reload before acting.",
          );
        }
      }
    } finally {
      active.current = false;
      if (mounted.current) {
        setRunning(false);
        onActivity(false);
      }
    }
  }
  return (
    <div className="mt-4 rounded-lg border border-dash-border p-3 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <button
          className="rounded-lg border border-dash-border px-3 py-2 disabled:opacity-50"
          disabled={disabled || running || !jobs.length}
          onClick={() => void refresh()}
        >
          {running
            ? `Checking ${progress} of ${total}…`
            : "Refresh due accounts"}
        </button>
        {running && (
          <button
            className="underline"
            onClick={() => {
              cancelled.current = true;
            }}
          >
            Stop after current checks
          </button>
        )}
        <span className="text-xs text-dash-ink-secondary">
          {running
            ? "Up to two checks at a time. You can keep browsing this overview."
            : jobs.length ? `${jobs.length} account checks ready to refresh.` : "Enabled accounts are up to date."}
        </span>
      </div>
      <p className="mt-2 text-xs text-dash-ink-secondary">
        Refreshes enabled accounts using your saved email preferences. Custom dates are refreshed from the account view.
      </p>
      {result && (
        <p role="status" className="mt-2">
          {result.finished - result.failed.length} succeeded ·{" "}
          {result.failed.length} need attention
          {result.unstarted ? ` · ${result.unstarted} not started` : ""}.
        </p>
      )}
      {!!result?.failed.length && (
        <details className="mt-2">
          <summary className="cursor-pointer">Checks needing attention</summary>
          <ul className="mt-2 space-y-2">
            {result.failed.map(({ job, error }) => (
              <li key={`${job.id}:${job.kind}`} className="break-words text-xs">
                {job.name} ·{" "}
                {job.kind === "budget-monitor" ? "Budget" : "Performance"}:{" "}
                {error}
              </li>
            ))}
          </ul>
        </details>
      )}
      {reloadError && (
        <p role="alert" className="mt-2 text-amber-400">
          {reloadError}
        </p>
      )}
    </div>
  );
}
