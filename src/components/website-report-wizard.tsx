"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { WebsiteReportData } from "@/lib/nre/website-report-data";
import { useToast } from "@/components/toast";

type PreviewStatus = "idle" | "loading" | "error" | "ready";
type GenerateStatus = "idle" | "loading" | "done" | "error";

/**
 * Simple 2-step wizard for Website Traffic (GA4) reports — preview then generate.
 */
export function WebsiteReportWizard({
  clientId,
  clientName,
  hasGa4Property,
  ga4Connected,
}: {
  clientId: string;
  clientName: string;
  hasGa4Property: boolean;
  ga4Connected: boolean;
}) {
  const { showToast } = useToast();
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>("idle");
  const [generateStatus, setGenerateStatus] = useState<GenerateStatus>("idle");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [preview, setPreview] = useState<WebsiteReportData | null>(null);
  const [slideCount, setSlideCount] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [shareToken, setShareToken] = useState<string | null>(null);

  const fetchPreview = useCallback(async () => {
    setPreviewStatus("loading");
    setPreviewError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/website-report/preview`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Preview failed");
      setPreview(json.data as WebsiteReportData);
      setSlideCount(json.slideCount ?? 0);
      setPreviewStatus("ready");
    } catch (err) {
      setPreviewStatus("error");
      setPreviewError(err instanceof Error ? err.message : "Preview failed");
      setPreview(null);
    }
  }, [clientId]);

  useEffect(() => {
    if (hasGa4Property && ga4Connected) void fetchPreview();
  }, [hasGa4Property, ga4Connected, fetchPreview]);

  async function handleGenerate() {
    setGenerateStatus("loading");
    setGenerateError(null);
    setDownloadUrl(null);
    setShareToken(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/website-report`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Generation failed");
      setDownloadUrl(json.downloadUrl ?? null);
      setShareToken(json.shareToken ?? null);
      setGenerateStatus("done");
      showToast("Website Traffic report ready");
    } catch (err) {
      setGenerateStatus("error");
      setGenerateError(err instanceof Error ? err.message : "Generation failed");
    }
  }

  if (!ga4Connected) {
    return (
      <div className="rounded-lg border border-dash-border bg-dash-card p-6">
        <h2 className="text-[18px] font-semibold text-dash-ink">Website Traffic Report</h2>
        <p className="mt-2 text-[14px] text-dash-ink-secondary">
          Connect Google Analytics 4 in Account Settings to generate website performance reports for {clientName}.
        </p>
        <Link
          href="/account#ga4"
          className="mt-4 inline-flex rounded-md bg-dash-accent px-4 py-2 text-[13px] font-semibold text-dash-ink hover:bg-dash-accent-hover"
        >
          Connect Google Analytics
        </Link>
      </div>
    );
  }

  if (!hasGa4Property) {
    return (
      <div className="rounded-lg border border-dash-border bg-dash-card p-6">
        <h2 className="text-[18px] font-semibold text-dash-ink">Website Traffic Report</h2>
        <p className="mt-2 text-[14px] text-dash-ink-secondary">
          Link a GA4 property to {clientName} before generating a Website Traffic report.
        </p>
        <Link
          href={`/clients/${clientId}#website-analytics`}
          className="mt-4 inline-flex rounded-md bg-dash-accent px-4 py-2 text-[13px] font-semibold text-dash-ink hover:bg-dash-accent-hover"
        >
          Link GA4 property
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/clients/${clientId}`} className="text-[13px] text-dash-ink-secondary hover:text-dash-ink">
          ← Back to {clientName}
        </Link>
        <h1 className="mt-2 text-[24px] font-bold text-dash-ink">Website Traffic Report</h1>
        <p className="mt-1 text-[15px] text-dash-ink-secondary">
          Pulls sessions, engagement, channels, and conversions from GA4 — month-to-date vs previous month.
        </p>
      </div>

      <div className="rounded-lg border border-dash-border bg-dash-card p-5">
        <h2 className="text-[16px] font-semibold text-dash-ink">Preview</h2>
        {previewStatus === "loading" ? (
          <p className="mt-3 text-[14px] text-dash-ink-secondary">Loading GA4 data…</p>
        ) : previewError ? (
          <div className="mt-3 space-y-2">
            <p className="text-[14px] text-red-300">{previewError}</p>
            <button
              type="button"
              onClick={() => void fetchPreview()}
              className="text-[13px] text-dash-accent underline"
            >
              Retry preview
            </button>
          </div>
        ) : preview ? (
          <div className="mt-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-[12px] uppercase tracking-wide text-dash-ink-secondary">Property</p>
                <p className="text-[14px] font-medium text-dash-ink">{preview.propertyName}</p>
              </div>
              <div>
                <p className="text-[12px] uppercase tracking-wide text-dash-ink-secondary">Date range</p>
                <p className="text-[14px] font-medium text-dash-ink">{preview.dateRangeLabel}</p>
                {preview.comparisonRangeLabel ? (
                  <p className="text-[12px] text-dash-ink-muted">vs {preview.comparisonRangeLabel}</p>
                ) : null}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {preview.overviewMetrics.slice(0, 4).map((m) => (
                <div key={m.key} className="rounded-md border border-dash-border bg-dash-bg px-3 py-2">
                  <p className="text-[11px] uppercase text-dash-ink-secondary">{m.label}</p>
                  <p className="text-[15px] font-semibold text-dash-ink">{m.value}</p>
                  {m.changeLabel ? <p className="text-[11px] text-dash-accent">{m.changeLabel}</p> : null}
                </div>
              ))}
            </div>
            <p className="text-[13px] text-dash-ink-secondary">
              Deck includes {slideCount} slides: traffic overview, conversions, traffic sources
              {preview.topPages.length > 0 ? ", and top pages" : ""}.
            </p>
            <p className="text-[12px] text-dash-ink-muted">{preview.attributionNote}</p>
          </div>
        ) : null}
      </div>

      <div className="rounded-lg border border-dash-border bg-dash-card p-5">
        <h2 className="text-[16px] font-semibold text-dash-ink">Generate</h2>
        <p className="mt-2 text-[14px] text-dash-ink-secondary">
          Creates a branded PPT, browser share link, and PDF — same delivery as Meta and Google Ads reports.
        </p>
        {generateError ? <p className="mt-3 text-[14px] text-red-300">{generateError}</p> : null}
        {generateStatus === "done" && downloadUrl ? (
          <div className="mt-4 space-y-3">
            <a
              href={downloadUrl}
              className="inline-flex rounded-md bg-dash-accent px-5 py-2.5 text-[14px] font-semibold text-dash-ink hover:bg-dash-accent-hover"
            >
              Download PPT
            </a>
            {shareToken ? (
              <p className="text-[13px] text-dash-ink-secondary">
                Browser link:{" "}
                <a href={`/r/${shareToken}`} className="text-dash-accent underline" target="_blank" rel="noreferrer">
                  Open share page
                </a>
              </p>
            ) : null}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={previewStatus !== "ready" || generateStatus === "loading"}
            className="mt-4 h-12 w-full rounded-md bg-dash-accent text-[15px] font-semibold text-dash-ink hover:bg-dash-accent-hover disabled:opacity-40 sm:w-auto sm:px-8"
          >
            {generateStatus === "loading" ? "Generating…" : "Generate Website Traffic Report"}
          </button>
        )}
      </div>
    </div>
  );
}
