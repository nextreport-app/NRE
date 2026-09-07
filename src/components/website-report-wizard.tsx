"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { WebsiteClientKindSetting, WebsiteDatePreset, WebsiteGeoDimension, WebsiteReportConfig } from "@/lib/nre/website-report-config";
import {
  DEFAULT_WEBSITE_REPORT_CONFIG,
  countSelectedBreakdowns,
  estimateWebsiteSlideCount,
  MAX_WEBSITE_BREAKDOWN_SLIDES,
  websiteConfigToQueryString,
} from "@/lib/nre/website-report-data";
import type { WebsiteReportData } from "@/lib/nre/website-report-data";
import { useToast } from "@/components/toast";

import type { WebsiteDataSource } from "@/lib/nre/website-report-resolve";

type PreviewStatus = "idle" | "loading" | "error" | "ready";
type GenerateStatus = "idle" | "loading" | "done" | "error";
type AnalyzeStatus = "idle" | "loading" | "error" | "ready";

const DATE_PRESETS: Array<{ value: WebsiteDatePreset; label: string; description: string }> = [
  { value: "month_to_date", label: "Month to date", description: "Current calendar month through yesterday" },
  { value: "last_30_days", label: "Last 30 days", description: "Rolling 30-day window ending yesterday" },
  { value: "last_7_days", label: "Last 7 days", description: "Rolling 7-day window ending yesterday" },
  { value: "custom", label: "Custom range", description: "Pick your own start and end dates" },
];

const CLIENT_KIND_OPTIONS: Array<{ value: WebsiteClientKindSetting; label: string; description: string }> = [
  { value: "auto", label: "Auto-detect", description: "Infer from revenue, conversions, or content signals in GA4" },
  { value: "lead_gen", label: "Lead generation", description: "Form submissions and conversions are primary" },
  { value: "ecommerce", label: "Ecommerce", description: "Revenue, transactions, and AOV are primary" },
  { value: "content", label: "Content / media", description: "Page views and engagement time are primary" },
  { value: "saas", label: "SaaS / app", description: "Sign-ups, trials, and product engagement are primary" },
];

const GEO_DIMENSIONS: Array<{ value: WebsiteGeoDimension; label: string }> = [
  { value: "city", label: "Top cities" },
  { value: "region", label: "States / regions" },
  { value: "country", label: "Countries" },
];

type BreakdownKey = keyof WebsiteReportConfig["breakdowns"];

const BREAKDOWN_OPTIONS: Array<{
  key: BreakdownKey;
  label: string;
  description: string;
  recommended?: boolean;
  warning?: string;
  geoSelector?: boolean;
}> = [
  {
    key: "device",
    label: "Device category",
    description: "Mobile, desktop, and tablet sessions with engagement and conversions.",
    recommended: true,
  },
  {
    key: "channels",
    label: "Traffic sources (channel groups)",
    description: "Organic, paid, direct, social, referral, and other default channel groups.",
    recommended: true,
  },
  {
    key: "geo",
    label: "Geographic breakdown",
    description: "Top locations by sessions with share of total and conversion rate.",
    recommended: true,
    geoSelector: true,
  },
  {
    key: "campaigns",
    label: "Campaigns (UTM)",
    description: "Sessions and conversions per session campaign name from GA4.",
  },
  {
    key: "sources",
    label: "Source / medium",
    description: "Granular traffic sources — google/organic, facebook/cpc, etc.",
  },
  {
    key: "demographics",
    label: "Age & gender",
    description: "Audience age brackets and gender split.",
    warning: "Requires Google Signals enabled in GA4. Small sites often show mostly Unknown.",
  },
  {
    key: "operatingSystem",
    label: "Operating system",
    description: "Android, iOS, Windows, macOS, and other OS splits.",
  },
  {
    key: "browser",
    label: "Browser",
    description: "Chrome, Safari, Firefox, Edge, and other browser splits.",
  },
  {
    key: "topPages",
    label: "Top landing pages",
    description: "Top 10 landing pages by sessions and engagement rate.",
    recommended: true,
  },
  {
    key: "newVsReturning",
    label: "New vs returning visitors",
    description: "Audience health — first-time vs returning session split.",
  },
  {
    key: "dayOfWeek",
    label: "Day of week",
    description: "Which days drive the most sessions and conversions.",
  },
  {
    key: "hourOfDay",
    label: "Hour of day",
    description: "Peak traffic hours — useful for ad scheduling and support staffing.",
  },
  {
    key: "conversionEvents",
    label: "Conversion events",
    description: "Individual GA4 events (form_submit, purchase, sign_up, etc.) with counts.",
  },
];

/**
 * Full Website Traffic (GA4) wizard — date range, website type, breakdowns, preview, generate.
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
  const [dataSource, setDataSource] = useState<WebsiteDataSource>(ga4Connected && hasGa4Property ? "api" : "csv");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [analyzeStatus, setAnalyzeStatus] = useState<AnalyzeStatus>("idle");
  const [analyzeMessage, setAnalyzeMessage] = useState<string | null>(null);
  const [config, setConfig] = useState<WebsiteReportConfig>(DEFAULT_WEBSITE_REPORT_CONFIG);
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>("idle");
  const [generateStatus, setGenerateStatus] = useState<GenerateStatus>("idle");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [preview, setPreview] = useState<WebsiteReportData | null>(null);
  const [slideCount, setSlideCount] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [shareToken, setShareToken] = useState<string | null>(null);

  const selectedBreakdownCount = countSelectedBreakdowns(config.breakdowns);
  const tooManyBreakdowns = selectedBreakdownCount > MAX_WEBSITE_BREAKDOWN_SLIDES;

  const estimatedSlides = useMemo(
    () =>
      estimateWebsiteSlideCount(config.breakdowns, {
        hasConversionSlide: true,
        hasTopPagesData: config.breakdowns.topPages,
      }),
    [config.breakdowns],
  );

  const canUseApi = ga4Connected && hasGa4Property;
  const canPreview =
    !tooManyBreakdowns &&
    selectedBreakdownCount > 0 &&
    (dataSource === "csv" ? csvFile !== null && analyzeStatus === "ready" : canUseApi);

  const fetchPreview = useCallback(async () => {
    if (!canPreview) return;
    setPreviewStatus("loading");
    setPreviewError(null);
    try {
      if (dataSource === "csv" && csvFile) {
        const form = new FormData();
        form.append("ga4Csv", csvFile);
        form.append("config", JSON.stringify(config));
        const res = await fetch(`/api/clients/${clientId}/website-report/preview`, { method: "POST", body: form });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Preview failed");
        setPreview(json.data as WebsiteReportData);
        setSlideCount(json.slideCount ?? 0);
      } else {
        const res = await fetch(`/api/clients/${clientId}/website-report/preview${websiteConfigToQueryString(config)}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Preview failed");
        setPreview(json.data as WebsiteReportData);
        setSlideCount(json.slideCount ?? 0);
      }
      setPreviewStatus("ready");
    } catch (err) {
      setPreviewStatus("error");
      setPreviewError(err instanceof Error ? err.message : "Preview failed");
      setPreview(null);
    }
  }, [clientId, config, canPreview, dataSource, csvFile]);

  useEffect(() => {
    if (canPreview) void fetchPreview();
    if (!canPreview) {
      setPreviewStatus("idle");
      setPreview(null);
    }
  }, [canPreview, fetchPreview]);

  async function analyzeCsv(file: File) {
    setAnalyzeStatus("loading");
    setAnalyzeMessage(null);
    setCsvFile(file);
    resetGenerateState();
    try {
      const form = new FormData();
      form.append("ga4Csv", file);
      const res = await fetch(`/api/clients/${clientId}/website-report/analyze`, { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok || !json.valid) {
        throw new Error(json.errors?.[0]?.message ?? json.error ?? "CSV validation failed");
      }
      const dims = (json.detectedDimensions as string[]) ?? [];
      setAnalyzeMessage(
        `CSV OK — ${json.rowCount} rows${dims.length ? `, dimensions: ${dims.join(", ")}` : ""}${
          json.dateBounds ? `, dates ${json.dateBounds.startIso} – ${json.dateBounds.endIso}` : ""
        }`,
      );
      if (json.dateBounds && config.datePreset === "custom") {
        setConfig((prev) => ({
          ...prev,
          startIso: json.dateBounds.startIso,
          endIso: json.dateBounds.endIso,
        }));
      }
      setAnalyzeStatus("ready");
    } catch (err) {
      setAnalyzeStatus("error");
      setAnalyzeMessage(err instanceof Error ? err.message : "CSV analysis failed");
      setCsvFile(null);
    }
  }

  function resetGenerateState() {
    setGenerateStatus("idle");
    setDownloadUrl(null);
    setShareToken(null);
  }

  function toggleBreakdown(key: BreakdownKey) {
    if (key === "geoDimension") return;
    setConfig((prev) => ({
      ...prev,
      breakdowns: { ...prev.breakdowns, [key]: !prev.breakdowns[key] },
    }));
    resetGenerateState();
  }

  function setGeoDimension(dimension: WebsiteGeoDimension) {
    setConfig((prev) => ({
      ...prev,
      breakdowns: { ...prev.breakdowns, geoDimension: dimension, geo: true },
    }));
    resetGenerateState();
  }

  async function handleGenerate() {
    if (!canPreview) return;
    setGenerateStatus("loading");
    setGenerateError(null);
    setDownloadUrl(null);
    setShareToken(null);
    try {
      let res: Response;
      if (dataSource === "csv" && csvFile) {
        const form = new FormData();
        form.append("ga4Csv", csvFile);
        form.append("config", JSON.stringify(config));
        form.append("dataSource", "csv");
        res = await fetch(`/api/clients/${clientId}/website-report`, { method: "POST", body: form });
      } else {
        res = await fetch(`/api/clients/${clientId}/website-report`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...config, dataSource: "api" }),
        });
      }
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

  if (dataSource === "api" && !ga4Connected) {
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
        <button
          type="button"
          onClick={() => setDataSource("csv")}
          className="mt-3 block text-[13px] text-dash-accent underline"
        >
          Or upload a GA4 CSV export instead
        </button>
      </div>
    );
  }

  if (dataSource === "api" && !hasGa4Property) {
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
        <button
          type="button"
          onClick={() => setDataSource("csv")}
          className="mt-3 block text-[13px] text-dash-accent underline"
        >
          Or upload a GA4 CSV export instead
        </button>
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
          Configure date range, website type, and breakdown slides — then generate a client-ready PPT, share link, and PDF.
        </p>
      </div>

      <div className="rounded-lg border border-[#4285f4]/30 bg-dash-card px-4 py-3.5">
        <p className="text-[14px] font-semibold text-dash-ink">Website traffic — different from ad reports</p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-dash-ink-secondary">
          This wizard builds a GA4 deck (sessions, channels, landing pages, breakdowns you choose). Meta, Google Ads,
          and TikTok campaign reports use the separate ad wizard from the client page.
        </p>
      </div>

      {/* Data source */}
      <div className="rounded-lg border border-dash-border bg-dash-card p-5">
        <h2 className="text-[16px] font-semibold text-dash-ink">Data source</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={!canUseApi}
            onClick={() => {
              setDataSource("api");
              resetGenerateState();
            }}
            className={`rounded-md px-4 py-2 text-[13px] font-semibold ${
              dataSource === "api"
                ? "bg-dash-accent text-dash-ink"
                : "border border-dash-border bg-dash-bg text-dash-ink-secondary hover:text-dash-ink disabled:opacity-40"
            }`}
          >
            Sync from GA4 API
          </button>
          <button
            type="button"
            onClick={() => {
              setDataSource("csv");
              resetGenerateState();
            }}
            className={`rounded-md px-4 py-2 text-[13px] font-semibold ${
              dataSource === "csv"
                ? "bg-dash-accent text-dash-ink"
                : "border border-dash-border bg-dash-bg text-dash-ink-secondary hover:text-dash-ink"
            }`}
          >
            Upload GA4 CSV
          </button>
        </div>
        {dataSource === "csv" ? (
          <div className="mt-4 space-y-2">
            <p className="text-[13px] text-dash-ink-secondary">
              Export from GA4 Reports or Explore with Sessions plus any breakdown dimensions you want (channel, device,
              city, campaign, etc.).
            </p>
            <input
              type="file"
              accept=".csv,.tsv,.txt,.xlsx,.xls,.ods"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void analyzeCsv(file);
              }}
              className="block w-full text-[13px] text-dash-ink-secondary file:mr-3 file:rounded-md file:border-0 file:bg-dash-accent file:px-3 file:py-2 file:text-[13px] file:font-semibold file:text-dash-ink"
            />
            {analyzeStatus === "loading" ? (
              <p className="text-[13px] text-dash-ink-secondary">Analyzing CSV…</p>
            ) : analyzeMessage ? (
              <p className={`text-[13px] ${analyzeStatus === "error" ? "text-red-300" : "text-dash-accent"}`}>
                {analyzeMessage}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="mt-3 text-[13px] text-dash-ink-secondary">Pulls live data from the GA4 property linked to this client.</p>
        )}
      </div>

      {/* Date range */}
      <div className="rounded-lg border border-dash-border bg-dash-card p-5">
        <h2 className="text-[16px] font-semibold text-dash-ink">Report period</h2>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {DATE_PRESETS.map((preset) => (
            <label
              key={preset.value}
              className={`flex cursor-pointer items-start gap-3 rounded-md border px-4 py-3 ${
                config.datePreset === preset.value
                  ? "border-dash-accent bg-dash-accent/10"
                  : "border-dash-border bg-dash-bg hover:border-dash-accent/40"
              }`}
            >
              <input
                type="radio"
                name="datePreset"
                checked={config.datePreset === preset.value}
                onChange={() => {
                  setConfig((prev) => ({ ...prev, datePreset: preset.value }));
                  resetGenerateState();
                }}
                className="mt-1 accent-dash-accent"
              />
              <span>
                <span className="text-[14px] font-medium text-dash-ink">{preset.label}</span>
                <span className="mt-0.5 block text-[13px] text-dash-ink-secondary">{preset.description}</span>
              </span>
            </label>
          ))}
        </div>
        {config.datePreset === "custom" ? (
          <div className="mt-4 flex flex-wrap gap-4">
            <label className="text-[13px] text-dash-ink-secondary">
              Start
              <input
                type="date"
                value={config.startIso ?? ""}
                onChange={(e) => {
                  setConfig((prev) => ({ ...prev, startIso: e.target.value }));
                  resetGenerateState();
                }}
                className="mt-1 block rounded-md border border-dash-border bg-dash-bg px-3 py-2 text-[14px] text-dash-ink"
              />
            </label>
            <label className="text-[13px] text-dash-ink-secondary">
              End
              <input
                type="date"
                value={config.endIso ?? ""}
                onChange={(e) => {
                  setConfig((prev) => ({ ...prev, endIso: e.target.value }));
                  resetGenerateState();
                }}
                className="mt-1 block rounded-md border border-dash-border bg-dash-bg px-3 py-2 text-[14px] text-dash-ink"
              />
            </label>
          </div>
        ) : null}
        <label className="mt-4 flex cursor-pointer items-center gap-2 text-[14px] text-dash-ink">
          <input
            type="checkbox"
            checked={config.comparePreviousPeriod}
            onChange={(e) => {
              setConfig((prev) => ({ ...prev, comparePreviousPeriod: e.target.checked }));
              resetGenerateState();
            }}
            className="h-4 w-4 accent-dash-accent"
          />
          Compare to previous period (same length, immediately before)
        </label>
      </div>

      {/* Website type */}
      <div className="rounded-lg border border-dash-border bg-dash-card p-5">
        <h2 className="text-[16px] font-semibold text-dash-ink">Website type</h2>
        <p className="mt-1 text-[13px] text-dash-ink-secondary">
          Controls which metrics appear on the conversions slide. Auto-detect works for most clients.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {CLIENT_KIND_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex cursor-pointer items-start gap-3 rounded-md border px-4 py-3 ${
                config.clientKind === opt.value
                  ? "border-dash-accent bg-dash-accent/10"
                  : "border-dash-border bg-dash-bg hover:border-dash-accent/40"
              }`}
            >
              <input
                type="radio"
                name="clientKind"
                checked={config.clientKind === opt.value}
                onChange={() => {
                  setConfig((prev) => ({ ...prev, clientKind: opt.value }));
                  resetGenerateState();
                }}
                className="mt-1 accent-dash-accent"
              />
              <span>
                <span className="text-[14px] font-medium text-dash-ink">{opt.label}</span>
                <span className="mt-0.5 block text-[13px] text-dash-ink-secondary">{opt.description}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Breakdowns */}
      <div className="rounded-lg border border-dash-border bg-dash-card p-5">
        <h2 className="text-[16px] font-semibold text-dash-ink">Breakdown slides</h2>
        <p className="mt-1 text-[13px] text-dash-ink-secondary">
          Estimated deck: <span className="font-medium text-dash-ink">{estimatedSlides} slides</span> (cover + overview +
          conversions + selected breakdowns). Max {MAX_WEBSITE_BREAKDOWN_SLIDES} breakdown slides.
        </p>
        <div className="mt-4 space-y-3">
          {BREAKDOWN_OPTIONS.map((opt) => (
            <div key={opt.key}>
              <label className="flex cursor-pointer items-start gap-3 rounded-md border border-dash-border bg-dash-bg px-4 py-3 hover:border-dash-accent/40">
                <input
                  type="checkbox"
                  checked={Boolean(config.breakdowns[opt.key])}
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
                  {opt.warning ? <span className="mt-1 block text-[12px] text-amber-400">{opt.warning}</span> : null}
                </span>
              </label>
              {opt.geoSelector && config.breakdowns.geo ? (
                <div className="ml-10 mt-2 flex flex-wrap gap-2">
                  {GEO_DIMENSIONS.map((g) => (
                    <button
                      key={g.value}
                      type="button"
                      onClick={() => setGeoDimension(g.value)}
                      className={`rounded-full px-3 py-1 text-[12px] font-medium ${
                        config.breakdowns.geoDimension === g.value
                          ? "bg-dash-accent text-dash-ink"
                          : "border border-dash-border bg-dash-card text-dash-ink-secondary hover:text-dash-ink"
                      }`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
        {selectedBreakdownCount === 0 ? (
          <p className="mt-3 text-[13px] text-amber-400">Select at least one breakdown to generate a report.</p>
        ) : null}
        {tooManyBreakdowns ? (
          <p className="mt-3 text-[13px] text-red-300">
            Maximum {MAX_WEBSITE_BREAKDOWN_SLIDES} breakdown slides. Deselect{" "}
            {selectedBreakdownCount - MAX_WEBSITE_BREAKDOWN_SLIDES} to continue.
          </p>
        ) : null}
      </div>

      {/* Preview */}
      <div className="rounded-lg border border-dash-border bg-dash-card p-5">
        <h2 className="text-[16px] font-semibold text-dash-ink">Preview</h2>
        {tooManyBreakdowns || selectedBreakdownCount === 0 || (dataSource === "csv" && analyzeStatus !== "ready") ? (
          <p className="mt-3 text-[14px] text-dash-ink-secondary">Complete the steps above to load a preview.</p>
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
            <p className="text-[13px] text-dash-ink-secondary">
              Deck includes {slideCount} slides · website type: {preview.clientKind.replace("_", " ")}
            </p>
            <p className="text-[12px] text-dash-ink-muted">{preview.attributionNote}</p>
          </div>
        ) : null}
      </div>

      {/* Generate */}
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
            disabled={previewStatus !== "ready" || generateStatus === "loading" || !canPreview}
            className="mt-4 h-12 w-full rounded-md bg-dash-accent text-[15px] font-semibold text-dash-ink hover:bg-dash-accent-hover disabled:opacity-40 sm:w-auto sm:px-8"
          >
            {generateStatus === "loading" ? "Generating…" : "Generate Website Traffic Report"}
          </button>
        )}
      </div>
    </div>
  );
}
