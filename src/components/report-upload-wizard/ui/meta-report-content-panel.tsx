"use client";
import { useEffect, useRef, useState } from "react";
import type { MetaContentOptions } from "@/lib/nre/meta-report-content/types";
import type { DateSelection } from "@/lib/validators/report-wizard";
const DEFAULTS: MetaContentOptions = {
  audience: [],
  creatives: false,
  includeStandard: true,
  ranking: "cpr",
  minSpend: 0,
  minResults: 5,
};
type Summary = {
  sourceOnly?: boolean;
  options: MetaContentOptions;
  campaigns?: string[];
  sources: Array<{
    kind: string;
    coverage: { startIso: string; endIso: string };
    rows: number;
  }>;
  ads: Array<{ id: string; name: string; hasImage: boolean }>;
  notices: string[];
};
export function MetaReportContentPanel({
  clientId,
  uploadSessionId,
  source,
  reportType,
  dateSelection,
  historicalMonthCount,
  selectedCampaigns,
  onSessionReady,
  onWorking,
  disabled = false,
}: {
  clientId: string;
  uploadSessionId: string;
  source: "api" | "csv";
  reportType: string;
  dateSelection: DateSelection;
  historicalMonthCount: number;
  selectedCampaigns: string[];
  onSessionReady: (id: string) => void;
  onWorking: (busy: boolean) => void;
  disabled?: boolean;
}) {
  const [options, setOptions] = useState<MetaContentOptions>(DEFAULTS);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [images, setImages] = useState<Record<string, File>>({});
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [fileGeneration, setFileGeneration] = useState(0);
  const callbacks = useRef({ onSessionReady, onWorking });
  useEffect(() => {
    callbacks.current = { onSessionReady, onWorking };
  }, [onSessionReady, onWorking]);
  const alive = useRef(true);
  const requestAbort = useRef<AbortController | null>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      requestAbort.current?.abort();
    };
  }, []);
  const dirty =
    JSON.stringify(options) !== JSON.stringify(summary?.options ?? DEFAULTS) ||
    files.length > 0 ||
    Object.keys(images).length > 0;
  useEffect(() => {
    callbacks.current.onWorking(busy || dirty);
    return () => callbacks.current.onWorking(false);
  }, [busy, dirty]);
  useEffect(() => {
    let cancelled = false;
    void fetch(
      `/api/clients/${clientId}/reports/content?uploadSessionId=${encodeURIComponent(uploadSessionId)}`,
      { cache: "no-store" },
    )
      .then(async (response) => {
        const json = await response.json();
        if (!response.ok)
          throw Error(json.error || "Could not load report sections.");
        if (!cancelled) {
          setSummary(json.content);
          setOptions(json.content?.options ?? DEFAULTS);
          setLoading(false);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setError(error.message);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, uploadSessionId]);
  async function apply(refresh = false) {
    setBusy(true);
    setError(null);
    requestAbort.current = new AbortController();
    try {
      const reuse =
        !!summary &&
        !refresh &&
        !files.length &&
        JSON.stringify(options.audience) ===
          JSON.stringify(summary.options.audience) &&
        options.creatives === summary.options.creatives &&
        options.locationLevel === summary.options.locationLevel &&
        (source === "csv" ||
          JSON.stringify(summary.campaigns) ===
            JSON.stringify(selectedCampaigns));
      const form = new FormData();
      form.set(
        "settings",
        JSON.stringify({
          uploadSessionId,
          source,
          options,
          reportType,
          dateSelection,
          historicalMonthCount,
          reuse,
          selectedCampaigns,
        }),
      );
      files.forEach((file) => form.append("files", file));
      Object.entries(images).forEach(([id, file]) =>
        form.append(`media:${id}`, file),
      );
      const response = await fetch(`/api/clients/${clientId}/reports/content`, {
        method: "POST",
        body: form,
        signal: requestAbort.current.signal,
      });
      const json = await response.json();
      if (!alive.current) return;
      if (!response.ok)
        throw Error(json.error || "Could not prepare report sections.");
      setSummary(json.content);
      setOptions(json.content?.options ?? DEFAULTS);
      setFiles([]);
      setImages({});
      setFileGeneration((value) => value + 1);
      callbacks.current.onSessionReady(json.uploadSessionId);
    } catch (error) {
      if (alive.current)
        setError(
          error instanceof Error
            ? error.message
            : "Could not prepare report sections. Your existing report setup is unchanged.",
        );
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  const enabled = options.audience.length > 0 || options.creatives;
  const ads = (summary?.ads ?? []).filter((ad) =>
    `${ad.name} ${ad.id}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <details
      className="rounded-xl border border-dash-border bg-dash-card p-4"
      aria-label="Audience and creative report sections"
    >
      <summary className="cursor-pointer text-sm font-semibold text-dash-ink">
        Audience &amp; creative sections{" "}
        <span className="font-normal text-dash-ink-secondary">
          · {dirty ? "Unsaved changes" : summary ? "Added" : "Optional"}
        </span>
      </summary>
      <p className="mt-3 text-sm leading-relaxed text-dash-ink-secondary">
        Add audience views or ad performance to this report. Each section uses
        your selected report dates and campaigns.
      </p>
      <fieldset
        disabled={disabled || busy || loading}
        className="mt-4 space-y-4 disabled:opacity-60"
      >
        <div>
          <p className="text-sm font-medium text-dash-ink">
            Audience breakdowns
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(
              [
                ["age", "Age"],
                ["location", "Location"],
                ["platform", "Platform"],
                ["placement", "Placement"],
              ] as const
            ).map(([value, label]) => (
              <label
                key={value}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-dash-border px-3 py-2 text-sm text-dash-ink"
              >
                <input
                  type="checkbox"
                  checked={options.audience.includes(value)}
                  onChange={(e) =>
                    setOptions({
                      ...options,
                      audience: e.target.checked
                        ? [...options.audience, value]
                        : options.audience.filter((d) => d !== value),
                    })
                  }
                  className="accent-accent"
                />
                {label}
              </label>
            ))}
          </div>
        </div>
        {source === "api" && options.audience.includes("location") && (
          <label className="block text-xs text-dash-ink-secondary">
            Location detail
            <select
              value={options.locationLevel ?? "region"}
              onChange={(e) =>
                setOptions({
                  ...options,
                  locationLevel: e.target.value as "region" | "country",
                })
              }
              className="ml-2 rounded border border-dash-border bg-dash-bg p-2 text-dash-ink"
            >
              <option value="region">Region / state</option>
              <option value="country">Country</option>
            </select>
          </label>
        )}
        <label className="flex cursor-pointer items-start gap-2 text-sm text-dash-ink">
          <input
            type="checkbox"
            checked={options.creatives}
            onChange={(e) =>
              setOptions({ ...options, creatives: e.target.checked })
            }
            className="mt-1 accent-accent"
          />
          <span>
            Creative performance
            <span className="mt-1 block text-xs text-dash-ink-secondary">
              Ad results, rates and available images. Video reports use poster
              images; dynamic/carousel previews are representative.
            </span>
          </span>
        </label>
        {enabled && (
          <>
            {source === "csv" ? (
              <div className="rounded-lg border border-dash-border bg-dash-bg/30 p-3">
                <label className="block text-sm font-medium text-dash-ink">
                  Add breakdown or Ads exports
                  <input
                    key={fileGeneration}
                    type="file"
                    multiple
                    accept=".csv,.tsv,.xlsx,.xls"
                    onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
                    className="mt-2 block w-full text-xs text-dash-ink-secondary"
                  />
                </label>
                <p className="mt-2 text-xs text-dash-ink-secondary">
                  Separate Age and Location exports; Platform + Placement may
                  share a file. Match the report dates.
                </p>
                <details className="mt-2 text-xs leading-relaxed text-dash-ink-secondary">
                  <summary className="cursor-pointer font-medium">
                    CSV requirements
                  </summary>
                  <p className="mt-2">
                    Use the same account, timezone and attribution setting, with
                    a Day breakdown. Include Spend, Impressions, Results and
                    Result type; add Clicks (all) for CTR. Creative CSV needs Ad
                    ID and Ad name; your primary file can be reused if it
                    includes them. Images are optional. Add matching purchase
                    value for ROAS and landing-page views for website CVR.
                  </p>
                </details>
                {files.length > 0 && (
                  <p className="mt-2 break-words text-xs text-dash-ink-secondary">
                    {files.map((f) => f.name).join(" · ")}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs leading-relaxed text-dash-ink-secondary">
                Meta will fetch these sections from the same ad account.
                Location uses your chosen region/state or country breakdown.
                Images are loaded for up to 12 ads with the highest spend; all
                selected ads stay in the performance tables.
              </p>
            )}
            {options.creatives && (
              <details className="rounded-lg border border-dash-border p-3">
                <summary className="cursor-pointer text-sm font-medium text-dash-ink">
                  Creative ranking
                </summary>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <label className="text-xs text-dash-ink-secondary">
                    Sort by
                    <select
                      value={options.ranking}
                      onChange={(e) =>
                        setOptions({
                          ...options,
                          ranking: e.target
                            .value as MetaContentOptions["ranking"],
                        })
                      }
                      className="mt-1 w-full rounded border border-dash-border bg-dash-bg px-2 py-2 text-dash-ink"
                    >
                      <option value="cpr">Cost per result</option>
                      <option value="roas">Purchase ROAS</option>
                      <option value="ctr">CTR (all)</option>
                      <option value="spend">Spend</option>
                    </select>
                  </label>
                  <label className="text-xs text-dash-ink-secondary">
                    Minimum spend
                    <input
                      type="number"
                      min="0"
                      value={options.minSpend}
                      onChange={(e) =>
                        setOptions({
                          ...options,
                          minSpend: Number(e.target.value),
                        })
                      }
                      className="mt-1 w-full rounded border border-dash-border bg-dash-bg px-2 py-2 text-dash-ink"
                    />
                  </label>
                  <label className="text-xs text-dash-ink-secondary">
                    Minimum results
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={options.minResults}
                      onChange={(e) =>
                        setOptions({
                          ...options,
                          minResults: Number(e.target.value),
                        })
                      }
                      className="mt-1 w-full rounded border border-dash-border bg-dash-bg px-2 py-2 text-dash-ink"
                    />
                  </label>
                </div>
                <p className="mt-2 text-xs text-dash-ink-secondary">
                  Ads are ranked within the same objective. Ads below these
                  thresholds stay in the tables without a rank. CTR ranking also
                  requires 100 impressions. ROAS needs purchase value; website
                  CVR needs landing-page views.
                </p>
              </details>
            )}
            <label className="flex items-center gap-2 text-sm text-dash-ink">
              <input
                type="checkbox"
                disabled={summary?.sourceOnly}
                checked={options.includeStandard}
                onChange={(e) =>
                  setOptions({ ...options, includeStandard: e.target.checked })
                }
                className="accent-accent"
              />
              Also include standard performance slides
            </label>
            {summary?.sourceOnly && (
              <p className="text-xs text-dash-ink-secondary">
                This file is an audience breakdown. To include standard slides,
                start a report with an unsegmented daily export.
              </p>
            )}
          </>
        )}
        {summary && (
          <div className="space-y-2 rounded-lg border border-dash-border p-3">
            <p className="text-sm font-medium text-dash-ink">
              Included sources
            </p>
            {summary.sources.map((s, i) => (
              <p key={i} className="text-xs text-dash-ink-secondary">
                {s.kind} · {s.coverage.startIso} – {s.coverage.endIso} ·{" "}
                {s.rows.toLocaleString()} rows
              </p>
            ))}
            {summary.notices.map((notice, i) => (
              <p key={i} className="text-xs text-dash-ink-secondary">
                {notice}
              </p>
            ))}
          </div>
        )}
        {summary && options.creatives && (
          <details className="rounded-lg border border-dash-border p-3">
            <summary className="cursor-pointer text-sm font-medium text-dash-ink">
              Choose ads &amp; add images{" "}
              <span className="font-normal text-dash-ink-secondary">
                ({summary.ads.length})
              </span>
            </summary>
            <input
              type="search"
              value={search}
              placeholder="Search ads"
              onChange={(e) => setSearch(e.target.value)}
              className="mt-3 w-full rounded border border-dash-border bg-dash-bg p-2 text-sm text-dash-ink"
            />
            {ads.length > 100 && (
              <p className="mt-2 text-xs text-dash-ink-secondary">
                Showing 100 of {ads.length} matching ads. Search by name or Ad
                ID to find others. All selected ads remain in the report.
              </p>
            )}
            <div className="mt-3 max-h-72 space-y-3 overflow-y-auto">
              {ads.slice(0, 100).map((ad) => (
                <div
                  key={ad.id}
                  className="rounded border border-dash-border p-2"
                >
                  <label className="flex items-start gap-2 text-sm text-dash-ink">
                    <input
                      type="checkbox"
                      checked={
                        !options.selectedAdIds ||
                        options.selectedAdIds.includes(ad.id)
                      }
                      onChange={(e) => {
                        const selected = new Set(
                          options.selectedAdIds ?? summary.ads.map((a) => a.id),
                        );
                        if (e.target.checked) selected.add(ad.id);
                        else selected.delete(ad.id);
                        setOptions({
                          ...options,
                          selectedAdIds: [...selected],
                        });
                      }}
                      className="mt-1 accent-accent"
                    />
                    <span className="min-w-0 break-words">
                      {ad.name}
                      <span className="block break-all text-xs text-dash-ink-secondary">
                        Ad ID: {ad.id} ·{" "}
                        {ad.hasImage ? "Preview ready" : "Metrics only"}
                      </span>
                    </span>
                  </label>
                  <label className="mt-2 block text-xs text-dash-ink-secondary">
                    {ad.hasImage
                      ? "Replace image (optional)"
                      : "Add image (optional)"}
                    <input
                      key={fileGeneration}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setImages({ ...images, [ad.id]: file });
                      }}
                      className="mt-1 block w-full text-xs"
                    />
                  </label>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-dash-ink-secondary">
              PNG/JPEG/WebP, below 2MB each; up to 24 previews. Each image is
              attached to its displayed Ad ID.
            </p>
          </details>
        )}
        {dirty && (
          <p className="text-xs text-dash-ink-secondary">
            Apply these section changes before generating your report, or
            discard them.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void apply()}
            disabled={!enabled && !options.includeStandard}
            className="rounded-lg border border-dash-border px-3 py-2 text-sm font-semibold text-dash-ink"
          >
            {busy
              ? "Preparing sections…"
              : source === "api" && !summary
                ? "Fetch sections from Meta"
                : "Apply sections"}
          </button>
          {source === "api" && summary && (
            <button
              type="button"
              onClick={() => void apply(true)}
              className="rounded-lg border border-dash-border px-3 py-2 text-sm text-dash-ink-secondary"
            >
              Refresh from Meta
            </button>
          )}
          {dirty && (
            <button
              type="button"
              onClick={() => {
                setOptions(summary?.options ?? DEFAULTS);
                setFiles([]);
                setImages({});
                setFileGeneration((value) => value + 1);
                setError(null);
              }}
              className="px-2 py-2 text-sm text-dash-ink-secondary"
            >
              Discard changes
            </button>
          )}
        </div>
      </fieldset>
      {error && (
        <p role="alert" className="mt-3 text-sm text-dash-error">
          {error}
        </p>
      )}
    </details>
  );
}
