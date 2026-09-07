"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { WebsiteBreakdownOptions } from "@/lib/nre/website-report-data";
import {
  DEFAULT_WEBSITE_BREAKDOWNS,
  countSelectedBreakdowns,
  estimateWebsiteSlideCount,
  MAX_WEBSITE_BREAKDOWN_SLIDES,
} from "@/lib/nre/website-report-data";
import type { WebsiteReportData } from "@/lib/nre/website-report-data";
import { useToast } from "@/components/toast";

type PreviewStatus = "idle" | "loading" | "error" | "ready";
type GenerateStatus = "idle" | "loading" | "done" | "error";

function breakdownQueryString(options: WebsiteBreakdownOptions): string {
  const params = new URLSearchParams();
  if (!options.device) params.set("device", "0");
  if (!options.geoCities) params.set("geo", "0");
  if (!options.channels) params.set("channels", "0");
  if (!options.topPages) params.set("topPages", "0");
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

const BREAKDOWN_OPTIONS: Array<{
  key: keyof WebsiteBreakdownOptions;
  label: string;
  description: string;
  recommended?: boolean;
}> = [
  {
    key: "device",
    label: "Device category",
    description: "Mobile, desktop, and tablet sessions with engagement and conversions.",
    recommended: true,
  },
  {
    key: "channels",
    label: "Traffic sources",
    description: "Organic, paid, direct, social, referral, and other channel groups.",
    recommended: true,
  },
  {
    key: "geoCities",
    label: "Top cities",
    description: "Top 10 cities by sessions with share of total and conversion rate.",
    recommended: true,
  },
  {
    key: "topPages",
    label: "Top landing pages",
    description: "Top 10 landing pages by sessions and engagement rate.",
    recommended: true,
  },
];

/**
 * Website Traffic (GA4) wizard — choose breakdowns, preview, then generate.
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
  const [breakdowns, setBreakdowns] = useState<WebsiteBreakdownOptions>(DEFAULT_WEBSITE_BREAKDOWNS);
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>("idle");
  const [generateStatus, setGenerateStatus] = useState<GenerateStatus>("idle");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [preview, setPreview] = useState<WebsiteReportData | null>(null);
  const [slideCount, setSlideCount] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [shareToken, setShareToken] = useState<string | null>(null);

  const selectedBreakdownCount = countSelectedBreakdowns(breakdowns);
  const tooManyBreakdowns = selectedBreakdownCount > MAX_WEBSITE_BREAKDOWN_SLIDES;

  const estimatedSlides = useMemo(
    () =>
      estimateWebsiteSlideCount(breakdowns, {
        hasConversionSlide: true,
        hasTopPagesData: breakdowns.topPages,
      }),
    [breakdowns],
  );

  const fetchPreview = useCallback(async () => {
    if (tooManyBreakdowns) return;
    setPreviewStatus("loading");
    setPreviewError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/website-report/preview${breakdownQueryString(breakdowns)}`);
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
  }, [clientId, breakdowns, tooManyBreakdowns]);

  useEffect(() => {
    if (hasGa4Property && ga4Connected && !tooManyBreakdowns) void fetchPreview();
    if (tooManyBreakdowns) {
      setPreviewStatus("idle");
      setPreview(null);
    }
  }, [hasGa4Property, ga4Connected, fetchPreview, tooManyBreakdowns]);

  function toggleBreakdown(key: keyof WebsiteBreakdownOptions) {
    setBreakdowns((prev) => ({ ...prev, [key]: !prev[key] }));
    setGenerateStatus("idle");
    setDownloadUrl(null);
    setShareToken(null);
  }

  async function handleGenerate() {
    if (tooManyBreakdowns || selectedBreakdownCount === 0) return;
    setGenerateStatus("loading");
    setGenerateError(null);
    setDownloadUrl(null);
    setShareToken(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/website-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(breakdowns),
      });
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
          Pulls sessions, engagement, channels, device, and location data from GA4 — month-to-date vs previous month.
        </p>
      </div>

      <div className="rounded-lg border border-dash-border bg-dash-card p-5">
        <h2 className="text-[16px] font-semibold text-dash-ink">Breakdowns to include</h2>
        <p className="mt-1 text-[13px] text-dash-ink-secondary">
          Choose which breakdown slides appear after the traffic overview. Estimated deck:{" "}
          <span className="font-medium text-dash-ink">{estimatedSlides} slides</span> (cover + overview + conversions
          + selected breakdowns).
        </p>
        <div className="mt-4 space-y-3">
          {BREAKDOWN_OPTIONS.map((opt) => (
            <label
              key={opt.key}
              className="flex cursor-pointer items-start gap-3 rounded-md border border-dash-border bg-dash-bg px-4 py-3 hover:border-dash-accent/40"
            >
              <input
                type="checkbox"
                checked={breakdowns[opt.key]}
                onChange={() => toggleBreakdown(opt.key)}
                className="mt-1 h-4 w-4 rounded border-dash-border accent-dash-accent"
              />
              <span>
                <span className="text-[14px] font-medium text-dash-ink">
                  {opt.label}
                  {opt.recommended ? (
                    <span className="ml-2 text-[11px] font-normal uppercase tracking-wide text-dash-accent">
                      Recommended
                    </span>
                  ) : null}
                </span>
                <span className="mt-0.5 block text-[13px] text-dash-ink-secondary">{opt.description}</span>
              </span>
            </label>
          ))}
        </div>
        {selectedBreakdownCount === 0 ? (
          <p className="mt-3 text-[13px] text-amber-400">Select at least one breakdown to generate a report.</p>
        ) : null}
        {tooManyBreakdowns ? (
          <p className="mt-3 text-[13px] text-red-300">
            Maximum {MAX_WEBSITE_BREAKDOWN_SLIDES} breakdown slides for readability. Deselect{" "}
            {selectedBreakdownCount - MAX_WEBSITE_BREAKDOWN_SLIDES} to continue.
          </p>
        ) : null}
      </div>

      <div className="rounded-lg border border-dash-border bg-dash-card p-5">
        <h2 className="text-[16px] font-semibold text-dash-ink">Preview</h2>
        {tooManyBreakdowns ? (
          <p className="mt-3 text-[14px] text-dash-ink-secondary">Adjust breakdown selections to load a preview.</p>
        ) : previewStatus === "loading" ? (
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
            <div className="grid gap-2 sm:grid-cols-2">
              {breakdowns.device && preview.devices.length > 0 ? (
                <div className="rounded-md border border-dash-border bg-dash-bg px-3 py-2">
                  <p className="text-[11px] uppercase text-dash-ink-secondary">Top device</p>
                  <p className="text-[14px] font-medium text-dash-ink">
                    {preview.devices[0]?.device} · {preview.devices[0]?.sessionsLabel} sessions
                  </p>
                </div>
              ) : null}
              {breakdowns.channels && preview.channels.length > 0 ? (
                <div className="rounded-md border border-dash-border bg-dash-bg px-3 py-2">
                  <p className="text-[11px] uppercase text-dash-ink-secondary">Top channel</p>
                  <p className="text-[14px] font-medium text-dash-ink">
                    {preview.channels[0]?.channel} · {preview.channels[0]?.sessionsLabel} sessions
                  </p>
                </div>
              ) : null}
              {breakdowns.geoCities && preview.geoCities.length > 0 ? (
                <div className="rounded-md border border-dash-border bg-dash-bg px-3 py-2">
                  <p className="text-[11px] uppercase text-dash-ink-secondary">Top city</p>
                  <p className="text-[14px] font-medium text-dash-ink">
                    {preview.geoCities[0]?.location} · {preview.geoCities[0]?.sessionsLabel} sessions
                  </p>
                </div>
              ) : null}
            </div>
            <p className="text-[13px] text-dash-ink-secondary">
              Deck includes {slideCount} slides based on your breakdown selections.
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
            disabled={
              previewStatus !== "ready" ||
              generateStatus === "loading" ||
              tooManyBreakdowns ||
              selectedBreakdownCount === 0
            }
            className="mt-4 h-12 w-full rounded-md bg-dash-accent text-[15px] font-semibold text-dash-ink hover:bg-dash-accent-hover disabled:opacity-40 sm:w-auto sm:px-8"
          >
            {generateStatus === "loading" ? "Generating…" : "Generate Website Traffic Report"}
          </button>
        )}
      </div>
    </div>
  );
}
