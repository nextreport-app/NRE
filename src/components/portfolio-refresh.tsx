"use client";
import { useEffect, useRef, useState } from "react";
import type { OverviewRow } from "@/lib/agency-overview";
import {
  refreshableChecks,
  runDueChecks,
} from "@/lib/performance-monitor/refresh-queue";
export function PortfolioRefresh({
  clients,
  scopeId,
  disabled,
  onActivity,
  onComplete,
}: {
  clients: OverviewRow[];
  scopeId: string;
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
  const attempts = useRef(new Map<string, number>());
  const latest = useRef({ clients, disabled, scopeId, onComplete, onActivity });
  useEffect(() => {
    latest.current = { clients, disabled, scopeId, onComplete, onActivity };
  });
  const refreshRef = useRef<(manual?: boolean) => Promise<void>>(
    async () => {},
  );
  useEffect(() => {
    refreshRef.current = refresh;
  });
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") void refreshRef.current();
    };
    tick();
    const timer = window.setInterval(tick, 30_000);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);
  // The initial API load may finish after the scheduler mounts.
  useEffect(() => {
    if (document.visibilityState === "visible") void refreshRef.current();
  }, [clients, disabled, scopeId]);
  async function refresh(manual = false) {
    const { clients, disabled, scopeId, onComplete, onActivity } =
      latest.current;
    if (active.current || disabled) return;
    const jobs = refreshableChecks(
      clients,
      Date.now(),
      attempts.current,
      scopeId,
      manual,
    );
    if (!jobs.length && !manual) return;
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
          attempts.current.set(`${job.id}:${job.kind}`, Date.now());
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
    <div className="mt-4 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <button
          className="rounded-xl bg-dash-accent px-5 py-3 font-semibold text-[#102033] shadow-sm disabled:opacity-50"
          title="Fetch updated Meta data. Checks are limited to once every five minutes."
          disabled={disabled || running}
          onClick={() => void refresh(true)}
        >
          {running ? `Checking ${progress} of ${total}…` : "Refresh data"}
        </button>
        {!running && (
          <span className="text-xs text-dash-ink-secondary">
            Auto-refresh every 5 minutes · custom dates refresh manually
          </span>
        )}
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
      </div>
      {result && (
        <p role="status" className="mt-2">
          {result.finished === 0
            ? "Showing saved data. Meta checks are available every five minutes"
            : `${result.finished - result.failed.length} checks updated · ${result.failed.length} failed`}
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
