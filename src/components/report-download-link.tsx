"use client";

import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import {
  fetchReportDownload,
  type DownloadProgress,
} from "@/lib/fetch-report-download";

export function ReportDownloadLink({
  href,
  children,
  className,
  containerClassName = "inline-flex min-w-0 flex-col",
  ariaLabel,
}: {
  href: string;
  children: ReactNode;
  className?: string;
  containerClassName?: string;
  ariaLabel?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const active = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      active.current?.abort();
    },
    [],
  );

  async function download(event: MouseEvent<HTMLAnchorElement>) {
    // Preserve normal browser behavior for modifier clicks and no-JS navigation.
    if (
      event.button !== 0 ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setProgress(null);
    setError(null);
    setStarted(false);
    try {
      const file = await fetchReportDownload(href, {
        signal: controller.signal,
        onProgress: setProgress,
      });
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(file.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      // Keep the URL alive long enough for the browser to consume the local file.
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setStarted(true);
    } catch (cause) {
      if (!controller.signal.aborted)
        setError(
          cause instanceof Error
            ? cause.message
            : "The download failed. Please retry.",
        );
    } finally {
      if (!controller.signal.aborted) {
        setBusy(false);
        active.current = null;
      }
    }
  }
  const percentage = progress?.total
    ? Math.min(99, Math.floor((progress.received / progress.total) * 100))
    : null;
  const transferred = progress?.received
    ? `${(progress.received / 1024 / 1024).toFixed(1)} MB`
    : null;
  const loadingLabel = progress?.reconnecting
    ? `Reconnecting…${percentage !== null ? ` ${percentage}%` : ""}`
    : percentage !== null
      ? `Downloading… ${percentage}%`
      : transferred
        ? `Downloading… ${transferred}`
        : "Preparing download…";
  const label = busy ? loadingLabel : error ? "Retry download" : children;
  return (
    <span className={containerClassName}>
      <a
        href={href}
        className={className}
        onClick={(event) => void download(event)}
        aria-label={ariaLabel}
        aria-busy={busy || undefined}
        aria-disabled={busy || undefined}
      >
        {label}
      </a>
      {error ? (
        <span role="alert" className="mt-1 max-w-sm text-[13px] leading-snug">
          {error}
        </span>
      ) : (
        <span role="status" aria-live="polite" className="sr-only">
          {busy ? loadingLabel : started ? "Download started" : ""}
        </span>
      )}
    </span>
  );
}
