"use client";
import { formatClientTimestamp } from "@/lib/client-date-format";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  CopyIcon,
  GoogleDriveIcon,
  LinkIcon,
  MailIcon,
  PptxDownloadIcon,
  SlackBrandIcon,
  TeamsBrandIcon,
  TelegramBrandIcon,
  WhatsAppBrandIcon,
} from "./icons";
import { useWizardCopy } from "@/hooks/use-wizard-copy";
import type { DriveView } from "../types";
import {
  buildClientReportMailtoShareUrl,
  buildClientReportSlackShareUrl,
  buildClientReportTeamsShareUrl,
  buildClientReportWhatsAppShareUrl,
  buildShareReportAbsoluteUrl,
  buildTelegramShareUrl,
  type ClientReportShareMessageInput,
} from "../utils";
import { formatRelativeReportDate } from "@/lib/client-display";
import type { ReportTypeValue } from "../types";

const chipClass =
  "nre-wizard-success-secondary inline-flex items-center justify-center gap-1.5 rounded-lg border border-dash-border bg-dash-sidebar/60 px-3 py-2.5 text-[14px] font-medium text-dash-ink transition-colors hover:bg-dash-border/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dash-accent disabled:pointer-events-none disabled:opacity-50";

const primaryActionClass =
  "nre-wizard-success-primary flex w-full items-center justify-center gap-2 rounded-lg border border-dash-accent/45 px-4 py-3 text-[15px] font-semibold text-dash-ink transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dash-accent";

const secondaryExportClass =
  "nre-wizard-success-secondary inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg border border-dash-border bg-dash-sidebar/60 px-3 py-2.5 text-[14px] font-medium text-dash-ink transition-colors hover:bg-dash-border/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dash-accent disabled:pointer-events-none disabled:opacity-50";

const sectionTitleClass =
  "text-sm font-semibold text-dash-ink";

function formatGeneratedAt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

type WizardGenerateSuccessPanelProps = {
  clientCurrency?: string;
  clientTimezone?: string;
  clientName: string;
  clientId: string;
  reportId: string | null;
  reportTitle: string;
  reportType: ReportTypeValue;
  reportTypeLabel: string;
  wizardSharePlatformLabel: string;
  slideCount: number;
  dateRangeLabel: string;
  downloadUrl: string;
  shareToken: string | null;
  publishedAt: string | null;
  generatedAt: string | null;
  clientShareMessageCopied: boolean;
  shareLinkCopied: boolean;
  onCopyClientShareMessage: () => void;
  onCopyShareLink: () => void;
  persistGenerateSnapshot: (args: { reportId: string; downloadUrl: string; shareToken: string }) => void;
  hasGoogleDriveConnected: boolean;
  driveView: DriveView;
  driveSaving: boolean;
  handleSaveButtonClick: () => void;
  rememberedFolder: { name: string } | null;
  setDriveView: (v: DriveView) => void;
  onEditDriveFolder?: () => void;
  copied: boolean;
  driveSaveUrl: string | null;
  handleCopyLink: () => void;
  handleGenerateAnother: () => void;
  generatedWithCsvMismatch?: boolean;
  generatedWithCsvVerifySkipped?: boolean;
  children?: ReactNode;
};

export function WizardGenerateSuccessPanel({
  clientCurrency, clientTimezone,
  clientName,
  clientId,
  reportId,
  reportTitle,
  reportTypeLabel,
  wizardSharePlatformLabel,
  slideCount,
  dateRangeLabel,
  downloadUrl,
  shareToken,
  publishedAt,
  generatedAt,
  clientShareMessageCopied,
  shareLinkCopied,
  onCopyClientShareMessage,
  onCopyShareLink,
  persistGenerateSnapshot,
  hasGoogleDriveConnected,
  driveView,
  driveSaving,
  handleSaveButtonClick,
  rememberedFolder,
  setDriveView,
  onEditDriveFolder,
  copied,
  driveSaveUrl,
  handleCopyLink,
  handleGenerateAnother,
  generatedWithCsvMismatch = false,
  generatedWithCsvVerifySkipped = false,
  children,
}: WizardGenerateSuccessPanelProps) {
  const copy = useWizardCopy();
  const reportUrl = shareToken ? buildShareReportAbsoluteUrl(shareToken) : null;
  const shareDateLabel = dateRangeLabel || "this period";
  const showDriveCollapsed = !!(hasGoogleDriveConnected && (driveView === "collapsed" || driveView === "success"));
  const shareInput: ClientReportShareMessageInput | null = reportUrl
    ? {
        clientName,
        reportTitle,
        reportTypeLabel,
        platformLabel: wizardSharePlatformLabel,
        dateRangeLabel: shareDateLabel,
        reportUrl,
      }
    : null;

  const previewHref =
    reportId && shareToken
      ? `/clients/${clientId}/reports/${reportId}/copy?from=generate`
      : null;

  const allReportsHref =
    reportId != null
      ? `/clients/${clientId}/reports?return=generate&resumeReport=${encodeURIComponent(reportId)}`
      : `/clients/${clientId}/reports`;

  function persistSnapshotIfReady() {
    if (reportId && shareToken) {
      persistGenerateSnapshot({ reportId, downloadUrl, shareToken });
    }
  }

  /** Open in a new tab only — never navigate this tab (see noopener note below). */
  function openExitLink(href: string) {
    persistSnapshotIfReady();
    // With noopener/noreferrer, window.open often returns null even when the tab opened successfully.
    // A null check must not trigger same-tab navigation — that caused duplicate navigation (new tab + current tab).
    window.open(href, "_blank", "noopener,noreferrer");
  }

  const shareViewCopySplitClass =
    "nre-wizard-success-secondary inline-flex min-h-[44px] shrink-0 overflow-hidden rounded-lg border border-dash-border bg-dash-sidebar/60";

  return (
    <div className="nre-wizard-generate-success overflow-hidden rounded-xl border bg-dash-card shadow-sm nre-dash-surface">
      {/* Section A — success header */}
      <div className="nre-wizard-generate-success__header border-b border-dash-border px-4 py-5 sm:px-6" role="status">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="nre-wizard-generate-success__check flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" aria-hidden="true">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 6" /></svg>
          </div>
          <div className="min-w-0 flex-1 text-left">
            <h2 className="nre-wizard-generate-success__title text-[19px] font-semibold leading-tight sm:text-[22px]">
              Report ready
            </h2>
            <dl className="nre-wizard-generate-success__meta mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] leading-snug sm:text-[13px]">
              <div className="w-full">
                <dt className="sr-only">Report title</dt>
                <dd className="font-medium text-dash-ink">{reportTitle}</dd>
              </div>
              {dateRangeLabel ? (
                <div className="w-full">
                  <dt className="sr-only">Reporting period</dt>
                  <dd>{dateRangeLabel}</dd>
                </div>
              ) : null}
              {slideCount > 0 ? (
                <div>
                  <dt className="sr-only">Slides</dt>
                  <dd className="inline-flex rounded-full border border-dash-border bg-dash-card/60 px-2 py-0.5 text-xs font-medium text-dash-ink">
                    {slideCount} slide{slideCount === 1 ? "" : "s"}
                  </dd>
                </div>
              ) : null}
              {generatedAt ? (
                <div>
                  <dt className="sr-only">Generated</dt>
                  <dd>Generated {clientCurrency ? formatClientTimestamp(generatedAt, clientCurrency, clientTimezone) : formatGeneratedAt(generatedAt)}</dd>
                </div>
              ) : null}
            </dl>

          </div>
        </div>
      </div>

      <div className="space-y-5 p-4 sm:p-5">
        {generatedWithCsvMismatch ? (
          <div className="nre-wizard-callout-warn rounded-lg px-4 py-3.5">
            <p className="nre-wizard-callout-warn__title text-[14px] font-semibold">
              {copy.csvMismatchShareWarningTitle}
            </p>
            <p className="nre-wizard-callout-warn__body mt-1.5 text-[13px] leading-relaxed">
              {copy.csvMismatchShareWarningBody}
            </p>
          </div>
        ) : null}

        {!generatedWithCsvMismatch && generatedWithCsvVerifySkipped ? (
          <div className="nre-wizard-callout-neutral rounded-lg px-4 py-3.5">
            <p className="nre-wizard-callout-neutral__title text-[14px] font-semibold">
              {copy.csvSkippedShareWarningTitle}
            </p>
            <p className="nre-wizard-callout-neutral__body mt-1.5 text-[13px] leading-relaxed">
              {copy.csvSkippedShareWarningBody}
            </p>
          </div>
        ) : null}

        {publishedAt ? (
          <div className="nre-wizard-generate-success__published rounded-lg border px-4 py-3 text-[13px] sm:text-[14px]">
            Published {formatRelativeReportDate(publishedAt)} — the live link reflects your published copy.
            {driveSaveUrl ? " Re-save to Google Drive manually if you updated the PPT." : null}
          </div>
        ) : null}

        {/* Section B — review and export */}
        <section aria-labelledby="success-review-heading">
          <h3 id="success-review-heading" className="sr-only">Review and download</h3>
          {previewHref && shareToken ? (
            <Link
              href={previewHref}
              className={primaryActionClass}
              onClick={() => {
                persistGenerateSnapshot({ reportId: reportId!, downloadUrl, shareToken });
              }}
            >
              Preview &amp; edit report
            </Link>
          ) : null}
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <a href={downloadUrl} className={secondaryExportClass}>
              <PptxDownloadIcon />
              Download PPTX
            </a>
            {hasGoogleDriveConnected ? (
              <button
                type="button"
                onClick={handleSaveButtonClick}
                disabled={driveSaving}
                className={secondaryExportClass}
              >
                <GoogleDriveIcon />
                {driveSaving ? "Saving…" : "Save to Drive"}
              </button>
            ) : null}
          </div>
        </section>

        {/* Section C — share with client */}
        {shareToken && reportUrl && shareInput ? (
          <section aria-labelledby="success-share-heading" className="space-y-3 rounded-lg border border-dash-border bg-dash-bg/30 p-4">
            <h3 id="success-share-heading" className="text-sm font-semibold text-dash-ink">Share report</h3>
            <p className="text-xs leading-relaxed text-dash-ink-secondary">Anyone with this link can view the report.</p>
            <label className="sr-only" htmlFor="wizard-live-report-url">
              Live report URL
            </label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
              <div
                id="wizard-live-report-url"
                className="min-w-0 flex-1 break-all rounded-lg border border-dash-border bg-dash-sidebar px-3 py-2.5 font-mono text-[12px] text-dash-ink-secondary sm:text-[13px]"
              >
                {reportUrl.replace(/^https?:\/\//, "")}
              </div>
              <div className="flex w-full shrink-0 flex-col gap-1 sm:w-auto">
                <div className={shareViewCopySplitClass}>
                  <a
                    href={reportUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-w-0 flex-1 items-center justify-center px-4 py-2.5 text-[14px] font-semibold text-dash-ink transition-colors hover:bg-dash-border/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-dash-accent"
                  >
                    View
                  </a>
                  <div className="w-px self-stretch bg-dash-border" role="separator" aria-hidden />
                  <button
                    type="button"
                    onClick={() => void onCopyShareLink()}
                    className="flex shrink-0 items-center justify-center gap-2 px-3.5 py-2.5 text-sm text-dash-ink-secondary transition-colors hover:bg-dash-border/80 hover:text-dash-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-dash-accent"
                    aria-label={shareLinkCopied ? "Link copied" : "Copy link"}
                  >
                    <LinkIcon />
                    <span aria-live="polite">{shareLinkCopied ? "Copied" : "Copy link"}</span>
                  </button>
                </div>

              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href={buildClientReportWhatsAppShareUrl(shareInput)}
                target="_blank"
                rel="noopener noreferrer"
                className={chipClass}
              >
                <WhatsAppBrandIcon />
                WhatsApp
              </a>
              <a href={buildClientReportMailtoShareUrl(shareInput)} className={chipClass}>
                <MailIcon />
                Email
              </a>
              <button
                type="button"
                onClick={() => void onCopyClientShareMessage()}
                className={chipClass}
                aria-live="polite"
              >
                <CopyIcon />
                {clientShareMessageCopied ? "Copied!" : "Copy message"}
              </button>
            </div>
            <details className="group rounded-lg border border-dash-border bg-dash-sidebar/40">
              <summary className="cursor-pointer list-none px-4 py-2.5 text-[13px] font-medium text-dash-ink-secondary marker:content-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dash-accent [&::-webkit-details-marker]:hidden">
                <span className="flex items-center justify-between gap-2">
                  More sharing options
                  <span className="text-[14px] leading-none transition-transform group-open:rotate-180" aria-hidden>
                    ▾
                  </span>
                </span>
              </summary>
              <div className="border-t border-dash-border px-4 py-3">
                <div className="flex flex-wrap gap-2">
                  <a
                    href={buildClientReportSlackShareUrl(shareInput)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={chipClass}
                  >
                    <SlackBrandIcon />
                    Slack
                  </a>
                  <a href={buildTelegramShareUrl(reportUrl)} target="_blank" rel="noopener noreferrer" className={chipClass}>
                    <TelegramBrandIcon />
                    Telegram
                  </a>
                  <a
                    href={buildClientReportTeamsShareUrl(shareInput)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={chipClass}
                  >
                    <TeamsBrandIcon />
                    Teams
                  </a>
                  {driveSaveUrl ? (
                    <button type="button" onClick={handleCopyLink} className={chipClass}>
                      <CopyIcon />
                      {copied ? "Copied!" : "Copy Drive link"}
                    </button>
                  ) : null}
                </div>
              </div>
            </details>
          </section>
        ) : (
          <section>
            <p className="mb-2 text-[14px] text-dash-ink-secondary">Live link is still preparing. Your PPTX is ready to download.</p>

          </section>
        )}

        {/* Section D — save and organize */}
        <section aria-labelledby="success-drive-heading" className="space-y-2">
          {hasGoogleDriveConnected ? (
            <>
              <h3 id="success-drive-heading" className={sectionTitleClass}>Google Drive</h3>
              {showDriveCollapsed ? (
                <>
                  {rememberedFolder ? (
                    <p className="text-[13px] text-dash-ink-secondary">
                      Destination Google drive folder:{" "}
                      <span className="font-medium text-dash-ink">{rememberedFolder.name}</span>{" "}
                      <button
                        type="button"
                        onClick={() => (onEditDriveFolder ? onEditDriveFolder() : setDriveView("editing"))}
                        className="text-dash-accent hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dash-accent"
                      >
                        Change
                      </button>
                    </p>
                  ) : (
                    <p className="text-[13px] text-dash-ink-secondary">
                      Choose a Google Drive folder for this report.{" "}
                      <button
                        type="button"
                        onClick={() => (onEditDriveFolder ? onEditDriveFolder() : setDriveView("editing"))}
                        className="text-dash-accent hover:underline"
                      >
                        Set folder
                      </button>
                    </p>
                  )}
                </>
              ) : null}
              {children}
            </>
          ) : (
            <details className="rounded-lg border border-dash-border bg-dash-bg/30 px-4 py-3">
              <summary id="success-drive-heading" className="cursor-pointer text-sm font-medium text-dash-ink-secondary">Save to Google Drive · optional</summary>
              <p className="mt-3 text-sm leading-relaxed text-dash-ink-secondary">
                <Link href="/account#google-drive" target="_blank" rel="noopener noreferrer" className="font-medium text-dash-accent hover:underline">Connect Google Drive</Link> in Account settings to save reports directly.
              </p>
            </details>
          )}
        </section>

        {/* Section E — continue working */}
        <section
          aria-labelledby="success-continue-heading"
          className="flex flex-col gap-2 border-t border-dash-border pt-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
        >
          <h3 id="success-continue-heading" className="sr-only">
            Continue working
          </h3>
          <button
            type="button"
            onClick={handleGenerateAnother}
            className="text-left text-[14px] font-semibold text-dash-accent hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dash-accent"
          >
            Generate another report
          </button>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[14px]">
            <button
              type="button"
              onClick={() => openExitLink(allReportsHref)}
              className="font-medium text-dash-accent hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dash-accent"
            >
              View all reports
            </button>
            <button
              type="button"
              onClick={() => openExitLink("/clients")}
              className="font-medium text-dash-ink-secondary hover:text-dash-ink hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dash-accent"
            >
              All clients
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
