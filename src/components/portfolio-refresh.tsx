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
          // The server may already be refreshing this account in another tab or scheduled job.
          // Its cooldown is routine, not a failed data refresh.
          if (response.status === 429) return;
          const data = await response.json();
          if (!response.ok || data.snapshot?.error)
            throw Error(data.error ?? data.snapshot?.error ?? "Check failed.");
        },
        () => cancelled.current,
        () => {},
      );
      if (mounted.current) {
        if (outcome.failed.length)
          setReloadError("Some data couldn’t refresh. Showing saved data.");
        try {
          await onComplete();
        } catch {
          setReloadError("Couldn’t reload data. Please try again.");
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
          {running ? "Refreshing…" : "Refresh data"}
        </button>
        {running && (
          <button
            className="underline"
            onClick={() => {
              cancelled.current = true;
            }}
          >
            Cancel refresh
          </button>
        )}
      </div>
      {reloadError && (
        <p role="alert" className="mt-2 text-amber-400">
          {reloadError}
        </p>
      )}
    </div>
  );
}
