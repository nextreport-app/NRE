"use client";
import { useState } from "react";

/** Agency-only source controls. Kept out of the published client report. */
export function ApiSourceDownload({
  clientId,
  uploadSessionId,
}: {
  clientId: string;
  uploadSessionId: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function download(format: "csv" | "details") {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/clients/${encodeURIComponent(clientId)}/reports/source?uploadSessionId=${encodeURIComponent(uploadSessionId)}&format=${format}`,
        { cache: "no-store", credentials: "same-origin" },
      );
      if (!response.ok) {
        const json = await response.json().catch(() => null);
        throw Error(
          response.status === 401
            ? "Sign in again to download the source."
            : (json?.error ?? "Source download failed. Please retry."),
        );
      }
      const type = response.headers.get("content-type") ?? "";
      if (!type.includes(format === "csv" ? "text/csv" : "application/json"))
        throw Error("Source download failed. Refresh and try again.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download =
        format === "csv" ? "meta-synced-source.csv" : "meta-sync-details.json";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Source download failed. Please retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-3 text-xs text-dash-ink-secondary">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void download("csv")}
          className="font-medium text-dash-accent hover:underline disabled:opacity-50"
        >
          {busy ? "Preparing source…" : "Download synced CSV"}
        </button>
        <details>
          <summary className="cursor-pointer">Sync details</summary>
          <div className="mt-2 max-w-sm space-y-2 leading-relaxed">
            <p>
              The imported source snapshot is available for 24 hours after sync.
              Daily reach cannot be added to obtain unique period reach.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => void download("details")}
              className="text-dash-accent hover:underline disabled:opacity-50"
            >
              Download sync details
            </button>
          </div>
        </details>
      </div>
      {error && (
        <p role="alert" className="mt-2">
          {error}
        </p>
      )}
    </div>
  );
}
