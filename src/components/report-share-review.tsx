"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useToast } from "@/components/toast";
import { ShareReportView } from "@/components/share-report-view";
import type { ShareReportData, ShareVisibility, ShareChartData } from "@/lib/nre/share-report";
import { adSetVisibilityKey, defaultShareVisibility } from "@/lib/nre/share-report";
import { countVisibleSlides } from "@/lib/nre/share-visibility";
import { updateGenerateSnapshotAfterPublish } from "@/lib/nre/wizard-generate-snapshot";

interface CopySlide {
  campaignName: string;
  adSetName?: string;
  aiSummary: string;
  aiInsights: string;
  metrics: { key: string; label: string; value: string }[];
}

function mergeEditedMetrics<T extends { key: string; label: string; value: string }>(
  original: T[],
  edited: { key: string; value: string }[],
): T[] {
  const byKey = new Map(edited.map((m) => [m.key, m.value]));
  return original.map((m) => (byKey.has(m.key) ? { ...m, value: byKey.get(m.key)! } : m));
}

interface SlideListItem {
  id: string;
  label: string;
  sublabel?: string;
  kind: "campaign" | "adset" | "overview" | "combinedTotal" | "metricGuide";
  visible: boolean;
}

function buildSlideList(share: ShareReportData, visibility: ShareVisibility): SlideListItem[] {
  const items: SlideListItem[] = [];
  for (const c of share.campaigns) {
    items.push({
      id: `c:${c.campaignName}`,
      kind: "campaign",
      label: c.campaignName,
      sublabel: "Campaign",
      visible: visibility.campaigns[c.campaignName] !== false,
    });
  }
  for (const a of share.adSets) {
    const key = adSetVisibilityKey(a.campaignName, a.adSetName);
    items.push({
      id: `a:${key}`,
      kind: "adset",
      label: a.adSetName || a.campaignName,
      sublabel: a.adSetName ? a.campaignName : "Ad set",
      visible: visibility.adSets[key] !== false,
    });
  }
  if (share.chart?.donutSegments?.length) {
    items.push({
      id: "overview",
      kind: "overview",
      label: "Month to date overview",
      sublabel: "KPI tiles + spend mix",
      visible: visibility.overview !== false,
    });
  }
  items.push({
    id: "combinedTotal",
    kind: "combinedTotal",
    label: "Monthly Performance Overview",
    sublabel: "Combined Total table",
    visible: visibility.combinedTotal !== false,
  });
  if ((share.metricGuide?.length ?? 0) > 0) {
    items.push({
      id: "metricGuide",
      kind: "metricGuide",
      label: "Metric Abbreviation Guide",
      visible: visibility.metricGuide !== false,
    });
  }
  return items;
}

function applyVisibilityToShare(share: ShareReportData, visibility: ShareVisibility): ShareReportData {
  return { ...share, visibility };
}

/**
 * Pre-share editor — toggle slides, edit copy, publish to live link + sync PPT.
 */
export function ReportShareReview({
  clientId,
  reportId,
  shareToken,
  returnToGenerateHref,
}: {
  clientId: string;
  reportId: string;
  shareToken: string | null;
  /** When set, show a post-publish link back to the wizard Generate screen. */
  returnToGenerateHref?: string | null;
}) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [share, setShare] = useState<ShareReportData | null>(null);
  const [campaigns, setCampaigns] = useState<CopySlide[]>([]);
  const [adSets, setAdSets] = useState<CopySlide[]>([]);
  const [visibility, setVisibility] = useState<ShareVisibility | null>(null);
  const [chartEdit, setChartEdit] = useState<ShareChartData | null>(null);
  const [selectedSlideId, setSelectedSlideId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [canSyncPpt, setCanSyncPpt] = useState(true);
  const [pdfAvailable, setPdfAvailable] = useState(false);
  const [justPublished, setJustPublished] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const res = await fetch(`/api/clients/${clientId}/reports/${reportId}`);
      const json = await res.json().catch(() => null);
      if (cancelled) return;
      if (!res.ok || !json?.ok || !json.share) {
        setError(json?.error || "Could not load this report for editing.");
        setLoading(false);
        return;
      }
      const loaded = json.share as ShareReportData;
      setShare(loaded);
      setCampaigns(json.campaigns ?? []);
      setAdSets(json.adSets ?? []);
      setVisibility(json.visibility ?? defaultShareVisibility(loaded));
      setChartEdit((json.chart as ShareChartData | null) ?? loaded.chart ?? null);
      setPublishedAt(json.publishedAt ?? loaded.publishedAt ?? null);
      setCanSyncPpt(json.canSyncPpt !== false);
      setPdfAvailable(!!(json.publishedAt ?? loaded.publishedAt));
      setSelectedSlideId(json.campaigns?.[0] ? `c:${json.campaigns[0].campaignName}` : null);
      setError(null);
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [clientId, reportId]);

  const draftShare = useMemo(() => {
    if (!share || !visibility) return null;
    const merged: ShareReportData = {
      ...share,
      visibility,
      chart: chartEdit ?? share.chart,
      campaigns: share.campaigns.map((c) => {
        const edited = campaigns.find((x) => x.campaignName === c.campaignName);
        return edited
          ? {
              ...c,
              aiSummary: edited.aiSummary,
              aiInsights: edited.aiInsights,
              metrics: mergeEditedMetrics(c.metrics, edited.metrics),
            }
          : c;
      }),
      adSets: share.adSets.map((a) => {
        const edited = adSets.find((x) => x.campaignName === a.campaignName && x.adSetName === a.adSetName);
        return edited
          ? {
              ...a,
              aiSummary: edited.aiSummary,
              aiInsights: edited.aiInsights,
              metrics: mergeEditedMetrics(a.metrics, edited.metrics),
            }
          : a;
      }),
    };
    return applyVisibilityToShare(merged, visibility);
  }, [share, visibility, campaigns, adSets, chartEdit]);

  const slideList = useMemo(
    () => (draftShare && visibility ? buildSlideList(draftShare, visibility) : []),
    [draftShare, visibility],
  );

  function toggleSlide(item: SlideListItem) {
    if (!visibility) return;
    const next = { ...visibility, campaigns: { ...visibility.campaigns }, adSets: { ...visibility.adSets } };
    if (item.kind === "campaign") {
      const name = item.label;
      next.campaigns[name] = !item.visible;
    } else if (item.kind === "adset") {
      const ad = share?.adSets.find((a) => (a.adSetName || a.campaignName) === item.label);
      if (ad) next.adSets[adSetVisibilityKey(ad.campaignName, ad.adSetName)] = !item.visible;
    } else if (item.kind === "overview") next.overview = !item.visible;
    else if (item.kind === "combinedTotal") next.combinedTotal = !item.visible;
    else if (item.kind === "metricGuide") next.metricGuide = !item.visible;
    setVisibility(next);
  }

  async function publish() {
    if (!visibility) return;
    setSaving(true);
    const res = await fetch(`/api/clients/${clientId}/reports/${reportId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shareReview: {
          publish: true,
          visibility,
          campaigns: campaigns.map((c) => ({
            campaignName: c.campaignName,
            aiSummary: c.aiSummary,
            aiInsights: c.aiInsights,
            metrics: c.metrics.map((m) => ({ key: m.key, value: m.value })),
          })),
          adSets: adSets.map((c) => ({
            campaignName: c.campaignName,
            adSetName: c.adSetName,
            aiSummary: c.aiSummary,
            aiInsights: c.aiInsights,
            metrics: c.metrics.map((m) => ({ key: m.key, value: m.value })),
          })),
          chart: chartEdit
            ? {
                title: chartEdit.title,
                subtitle: chartEdit.subtitle,
                totalSpendLabel: chartEdit.totalSpendLabel,
                footerInsight: chartEdit.footerInsight,
                snapshot: chartEdit.snapshot,
                donutSegments: chartEdit.donutSegments,
              }
            : undefined,
        },
      }),
    });
    setSaving(false);
    if (!res.ok) {
      showToast("Could not publish changes. Try again.", "error");
      return;
    }
    const json = await res.json().catch(() => ({}));
    const ts = (json.publishedAt as string | undefined) ?? new Date().toISOString();
    setPublishedAt(ts);
    setPdfAvailable(true);
    setJustPublished(true);
    setShare((prev) => (prev && draftShare ? { ...draftShare, publishedAt: ts } : prev));
    updateGenerateSnapshotAfterPublish(clientId, reportId, ts, true);
    showToast("Published — live link, PPTX, and PDF download are updated.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (loading) {
    return <p className="text-[13px] text-dash-ink-secondary">Loading report…</p>;
  }
  if (error || !draftShare || !visibility) {
    return <p className="text-[13px] text-amber-300">{error ?? "Report unavailable."}</p>;
  }

  const visibleCount = countVisibleSlides(draftShare);
  const selectedCampaign = selectedSlideId?.startsWith("c:")
    ? campaigns.find((c) => `c:${c.campaignName}` === selectedSlideId)
    : null;
  const selectedAdSet = selectedSlideId?.startsWith("a:")
    ? adSets.find((a) => `a:${adSetVisibilityKey(a.campaignName, a.adSetName ?? "")}` === selectedSlideId)
    : null;
  const overviewSelected = selectedSlideId === "overview";

  return (
    <div className="space-y-4">
      {(justPublished || publishedAt) && (
        <div className="rounded-lg border border-[#68d391]/40 bg-[#68d391]/10 px-4 py-3">
          <p className="text-[14px] font-semibold text-[#68d391]">
            {justPublished ? "✓ Published successfully" : "✓ Last published"}
          </p>
          <p className="mt-1 text-[12px] text-dash-ink-secondary">
            Your live browser link{canSyncPpt ? ", Download PPTX," : ""} and Download PDF now match this review.
            {canSyncPpt ? " A copy already saved in Google Drive is not updated automatically — re-save from the Generate screen if needed." : ""}
          </p>
          {returnToGenerateHref ? (
            <Link href={returnToGenerateHref} className="mt-2 inline-block text-[13px] font-semibold text-dash-accent hover:underline">
              Return to Generate screen →
            </Link>
          ) : null}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[15px] font-semibold text-dash-ink">Review before sharing</p>
          <p className="mt-1 text-[12px] text-dash-ink-secondary">
            {visibleCount} slides on the live link. <strong>Publish</strong> updates the browser report
            {canSyncPpt ? ", Download PPTX," : ""} and Download PDF (after review) — not a Google Slides file already in Drive.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {shareToken ? (
            <Link
              href={`https://nextreport.in/r/${shareToken}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border border-dash-border px-3 py-2 text-[13px] text-dash-ink hover:bg-dash-border"
            >
              Preview live link
            </Link>
          ) : null}
          {publishedAt ? (
            <a
              href={`/api/reports/${reportId}/download-pdf`}
              className="rounded-md border border-dash-border px-3 py-2 text-[13px] text-dash-ink hover:bg-dash-border"
            >
              Download PDF
            </a>
          ) : null}
          <button
            type="button"
            onClick={() => void publish()}
            disabled={saving}
            className="rounded-md bg-dash-accent px-4 py-2 text-[13px] font-semibold text-dash-ink hover:bg-dash-accent-hover disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-dash-accent"
          >
            {saving ? "Publishing…" : publishedAt ? "Publish again" : "Publish to live link"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_1fr]">
        <aside className="max-h-[70vh] overflow-y-auto rounded-lg border border-dash-border bg-dash-card p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-dash-ink-secondary">Slides</p>
          <ul className="space-y-1">
            {slideList.map((item) => (
              <li key={item.id}>
                <div className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-dash-bg">
                  <input
                    type="checkbox"
                    checked={item.visible}
                    onChange={() => toggleSlide(item)}
                    className="mt-1 h-3.5 w-3.5 accent-accent"
                    aria-label={`Include ${item.label}`}
                  />
                  <button
                    type="button"
                    onClick={() => setSelectedSlideId(item.id)}
                    className={`min-w-0 flex-1 text-left ${selectedSlideId === item.id ? "text-dash-accent" : "text-dash-ink"}`}
                  >
                    <p className="truncate text-[12px] font-medium">{item.label}</p>
                    {item.sublabel ? <p className="truncate text-[10px] text-dash-ink-secondary">{item.sublabel}</p> : null}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </aside>

        <div className="space-y-4">
          {(selectedCampaign || selectedAdSet) && (
            <div className="rounded-lg border border-dash-border bg-dash-card p-4">
              <p className="text-[13px] font-semibold text-dash-ink">
                {selectedCampaign?.campaignName ?? selectedAdSet?.adSetName}
              </p>
              {selectedAdSet ? (
                <p className="text-[11px] text-dash-ink-secondary">{selectedAdSet.campaignName}</p>
              ) : null}
              <label className="mt-3 block text-[11px] uppercase tracking-wide text-dash-ink-secondary">Summary</label>
              <textarea
                value={selectedCampaign?.aiSummary ?? selectedAdSet?.aiSummary ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  if (selectedCampaign) {
                    setCampaigns((prev) =>
                      prev.map((row) => (row.campaignName === selectedCampaign.campaignName ? { ...row, aiSummary: v } : row)),
                    );
                  } else if (selectedAdSet) {
                    setAdSets((prev) =>
                      prev.map((row) =>
                        row.campaignName === selectedAdSet.campaignName && row.adSetName === selectedAdSet.adSetName
                          ? { ...row, aiSummary: v }
                          : row,
                      ),
                    );
                  }
                }}
                rows={3}
                className="mt-1 w-full rounded-md border border-dash-border bg-dash-bg px-3 py-2 text-[13px] text-dash-ink"
              />
              <label className="mt-2 block text-[11px] uppercase tracking-wide text-dash-ink-secondary">Key insights</label>
              <textarea
                value={selectedCampaign?.aiInsights ?? selectedAdSet?.aiInsights ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  if (selectedCampaign) {
                    setCampaigns((prev) =>
                      prev.map((row) => (row.campaignName === selectedCampaign.campaignName ? { ...row, aiInsights: v } : row)),
                    );
                  } else if (selectedAdSet) {
                    setAdSets((prev) =>
                      prev.map((row) =>
                        row.campaignName === selectedAdSet.campaignName && row.adSetName === selectedAdSet.adSetName
                          ? { ...row, aiInsights: v }
                          : row,
                      ),
                    );
                  }
                }}
                rows={3}
                className="mt-1 w-full rounded-md border border-dash-border bg-dash-bg px-3 py-2 text-[13px] text-dash-ink"
              />
              {(selectedCampaign?.metrics.length ?? selectedAdSet?.metrics.length ?? 0) > 0 ? (
                <>
                  <p className="mt-4 text-[11px] uppercase tracking-wide text-dash-ink-secondary">Metric tiles</p>
                  <p className="mt-0.5 text-[11px] text-dash-ink-secondary">
                    Edits here update the live link, Download PPTX, and Google Drive after you publish and re-save.
                  </p>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {(selectedCampaign?.metrics ?? selectedAdSet?.metrics ?? []).map((metric) => (
                      <label key={metric.key} className="block">
                        <span className="text-[11px] font-medium text-dash-ink-secondary">{metric.label}</span>
                        <input
                          type="text"
                          value={metric.value}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (selectedCampaign) {
                              setCampaigns((prev) =>
                                prev.map((row) =>
                                  row.campaignName === selectedCampaign.campaignName
                                    ? {
                                        ...row,
                                        metrics: row.metrics.map((m) => (m.key === metric.key ? { ...m, value: v } : m)),
                                      }
                                    : row,
                                ),
                              );
                            } else if (selectedAdSet) {
                              setAdSets((prev) =>
                                prev.map((row) =>
                                  row.campaignName === selectedAdSet.campaignName && row.adSetName === selectedAdSet.adSetName
                                    ? {
                                        ...row,
                                        metrics: row.metrics.map((m) => (m.key === metric.key ? { ...m, value: v } : m)),
                                      }
                                    : row,
                                ),
                              );
                            }
                          }}
                          className="mt-0.5 w-full rounded-md border border-dash-border bg-dash-bg px-2.5 py-1.5 text-[13px] tabular-nums text-dash-ink"
                        />
                      </label>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          )}

          {overviewSelected && chartEdit ? (
            <div className="rounded-lg border border-dash-border bg-dash-card p-4">
              <p className="text-[13px] font-semibold text-dash-ink">Month to date overview</p>
              <p className="mt-0.5 text-[11px] text-dash-ink-secondary">
                Edit chart text here, then Publish — updates the live browser link and Download PPTX.
              </p>
              <label className="mt-3 block text-[11px] uppercase tracking-wide text-dash-ink-secondary">Title</label>
              <input
                type="text"
                value={chartEdit.title}
                onChange={(e) => setChartEdit((c) => (c ? { ...c, title: e.target.value } : c))}
                className="mt-1 w-full rounded-md border border-dash-border bg-dash-bg px-3 py-2 text-[13px] text-dash-ink"
              />
              <label className="mt-2 block text-[11px] uppercase tracking-wide text-dash-ink-secondary">Subtitle</label>
              <input
                type="text"
                value={chartEdit.subtitle}
                onChange={(e) => setChartEdit((c) => (c ? { ...c, subtitle: e.target.value } : c))}
                className="mt-1 w-full rounded-md border border-dash-border bg-dash-bg px-3 py-2 text-[13px] text-dash-ink"
              />
              <p className="mt-4 text-[11px] uppercase tracking-wide text-dash-ink-secondary">Metrics table</p>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {[
                  { key: "mtdSpendLabel", label: "Total ad spend this month" },
                  { key: "budgetPctUsed", label: "Budget used (%)" },
                ].map((field) => (
                  <label key={field.key} className="block">
                    <span className="text-[11px] font-medium text-dash-ink-secondary">{field.label}</span>
                    <input
                      type="text"
                      value={chartEdit.snapshot[field.key as keyof typeof chartEdit.snapshot] as string}
                      onChange={(e) =>
                        setChartEdit((c) =>
                          c ? { ...c, snapshot: { ...c.snapshot, [field.key]: e.target.value } } : c,
                        )
                      }
                      className="mt-0.5 w-full rounded-md border border-dash-border bg-dash-bg px-2.5 py-1.5 text-[13px] tabular-nums text-dash-ink"
                    />
                  </label>
                ))}
              </div>
              {(chartEdit.snapshot.objectives?.length ?? 0) > 0 ? (
                <div className="mt-3 space-y-3">
                  <p className="text-[11px] uppercase tracking-wide text-dash-ink-secondary">Objective blocks</p>
                  {chartEdit.snapshot.objectives!.map((obj, i) => (
                    <div key={`${obj.label}-${i}`} className="rounded-md border border-dash-border bg-dash-bg p-3">
                      <p className="text-[11px] font-semibold text-dash-ink">{obj.label}</p>
                      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                        {(
                          [
                            ["resultsValue", "Results"],
                            ["cprValue", obj.cprLabel],
                            ["spendFormatted", "Spend"],
                          ] as const
                        ).map(([key, label]) => (
                          <label key={key} className="block">
                            <span className="text-[11px] font-medium text-dash-ink-secondary">{label}</span>
                            <input
                              type="text"
                              value={obj[key]}
                              onChange={(e) =>
                                setChartEdit((c) => {
                                  if (!c) return c;
                                  const objectives = c.snapshot.objectives!.map((o, j) =>
                                    j === i ? { ...o, [key]: e.target.value } : o,
                                  );
                                  const primary = objectives[0];
                                  return {
                                    ...c,
                                    snapshot: {
                                      ...c.snapshot,
                                      objectives,
                                      ...(primary
                                        ? {
                                            primaryResultsValue: primary.resultsValue,
                                            primaryResultsLabel: primary.label,
                                            primaryCprValue: primary.cprValue,
                                            primaryCprLabel: primary.cprLabel,
                                            primarySpendFormatted: primary.spendFormatted,
                                          }
                                        : {}),
                                    },
                                  };
                                })
                              }
                              className="mt-0.5 w-full rounded-md border border-dash-border bg-dash-card px-2.5 py-1.5 text-[13px] tabular-nums text-dash-ink"
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {[
                    { key: "primarySpendFormatted", label: "Ad spend (objective)" },
                    { key: "primaryResultsValue", label: chartEdit.snapshot.primaryResultsLabel },
                    { key: "primaryCprValue", label: chartEdit.snapshot.primaryCprLabel },
                  ].map((field) => (
                    <label key={field.key} className="block">
                      <span className="text-[11px] font-medium text-dash-ink-secondary">{field.label}</span>
                      <input
                        type="text"
                        value={(chartEdit.snapshot[field.key as keyof typeof chartEdit.snapshot] as string) ?? ""}
                        onChange={(e) =>
                          setChartEdit((c) =>
                            c ? { ...c, snapshot: { ...c.snapshot, [field.key]: e.target.value } } : c,
                          )
                        }
                        className="mt-0.5 w-full rounded-md border border-dash-border bg-dash-bg px-2.5 py-1.5 text-[13px] tabular-nums text-dash-ink"
                      />
                    </label>
                  ))}
                </div>
              )}
              <label className="mt-3 block text-[11px] uppercase tracking-wide text-dash-ink-secondary">Total spend (donut center)</label>
              <input
                type="text"
                value={chartEdit.totalSpendLabel}
                onChange={(e) => setChartEdit((c) => (c ? { ...c, totalSpendLabel: e.target.value } : c))}
                className="mt-1 w-full rounded-md border border-dash-border bg-dash-bg px-3 py-2 text-[13px] tabular-nums text-dash-ink"
              />
              <p className="mt-4 text-[11px] uppercase tracking-wide text-dash-ink-secondary">Donut legend</p>
              <div className="mt-2 space-y-3">
                {chartEdit.donutSegments.map((seg, i) => (
                  <div key={`${seg.name}-${i}`} className="rounded-md border border-dash-border bg-dash-bg p-3">
                    <label className="block text-[11px] font-medium text-dash-ink-secondary">Campaign name</label>
                    <input
                      type="text"
                      value={seg.name}
                      onChange={(e) =>
                        setChartEdit((c) => {
                          if (!c) return c;
                          const donutSegments = c.donutSegments.map((s, j) =>
                            j === i ? { ...s, name: e.target.value } : s,
                          );
                          return { ...c, donutSegments };
                        })
                      }
                      className="mt-0.5 w-full rounded-md border border-dash-border bg-dash-card px-2.5 py-1.5 text-[13px] text-dash-ink"
                    />
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="text-[11px] font-medium text-dash-ink-secondary">% of spend</span>
                        <input
                          type="text"
                          value={String(seg.percentage)}
                          onChange={(e) =>
                            setChartEdit((c) => {
                              if (!c) return c;
                              const pct = parseFloat(e.target.value) || 0;
                              const donutSegments = c.donutSegments.map((s, j) =>
                                j === i ? { ...s, percentage: pct } : s,
                              );
                              return { ...c, donutSegments };
                            })
                          }
                          className="mt-0.5 w-full rounded-md border border-dash-border bg-dash-card px-2.5 py-1.5 text-[13px] tabular-nums text-dash-ink"
                        />
                      </label>
                      <label className="block">
                        <span className="text-[11px] font-medium text-dash-ink-secondary">Spend amount</span>
                        <input
                          type="text"
                          value={seg.spendLabel}
                          onChange={(e) =>
                            setChartEdit((c) => {
                              if (!c) return c;
                              const donutSegments = c.donutSegments.map((s, j) =>
                                j === i ? { ...s, spendLabel: e.target.value } : s,
                              );
                              return { ...c, donutSegments };
                            })
                          }
                          className="mt-0.5 w-full rounded-md border border-dash-border bg-dash-card px-2.5 py-1.5 text-[13px] tabular-nums text-dash-ink"
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
              <label className="mt-3 block text-[11px] uppercase tracking-wide text-dash-ink-secondary">Footer line</label>
              <input
                type="text"
                value={chartEdit.footerInsight ?? ""}
                placeholder={`e.g. 0 active campaigns currently`}
                onChange={(e) => setChartEdit((c) => (c ? { ...c, footerInsight: e.target.value } : c))}
                className="mt-1 w-full rounded-md border border-dash-border bg-dash-bg px-3 py-2 text-[13px] text-dash-ink"
              />
            </div>
          ) : null}

          <div className="overflow-hidden rounded-lg border border-dash-border">
            <ShareReportView data={draftShare} />
          </div>
        </div>
      </div>
    </div>
  );
}
