"use client";

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
import { reportingWeekLabel } from "@/lib/nre/weekly-report-labels";

const chipClass =
  "nre-wizard-success-secondary inline-flex items-center justify-center gap-1.5 rounded-lg border border-dash-border bg-dash-sidebar/60 px-3 py-2.5 text-[14px] font-medium text-dash-ink transition-colors hover:bg-dash-border/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dash-accent disabled:pointer-events-none disabled:opacity-50";

const primaryActionClass =
  "nre-wizard-success-primary flex w-full items-center justify-center gap-2 rounded-lg border border-dash-accent/45 px-4 py-3 text-[15px] font-semibold text-dash-ink transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dash-accent";

const secondaryExportClass =
  "nre-wizard-success-secondary inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg border border-dash-border bg-dash-sidebar/60 px-3 py-2.5 text-[14px] font-medium text-dash-ink transition-colors hover:bg-dash-border/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dash-accent disabled:pointer-events-none disabled:opacity-50";

const sectionTitleClass =
  "text-[13px] font-semibold uppercase tracking-wide text-dash-ink-muted";

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
  clientName,
  clientId,
  reportId,
  reportTitle,
  reportType,
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
  const isWeekly = reportType === "WEEKLY";
  const reportingPeriodLine =
    isWeekly && dateRangeLabel ? reportingWeekLabel(dateRangeLabel) : dateRangeLabel;

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
    <div className="nre-wizard-generate-success overflow-hidden rounded-2xl border bg-dash-card shadow-lg nre-dash-surface">
      {/* Section A — success header */}
      <div className="nre-wizard-generate-success__header relative isolate overflow-hidden border-b border-dash-border px-5 py-6 sm:px-7 sm:py-7" role="status">
        <div className="pointer-events-none absolute -top-12 -right-8 -z-10 h-48 w-48 rounded-full bg-dash-accent/10 blur-3xl" aria-hidden />
        <svg className="pointer-events-none absolute top-5 right-6 hidden h-14 w-14 text-dash-accent/65 sm:block" viewBox="0 0 64 64" fill="currentColor" aria-hidden="true">
          <path d="m30 4 4 13 13 4-13 4-4 13-4-13-13-4 13-4zM51 36l2 7 7 2-7 2-2 7-2-7-7-2 7-2zM10 40l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" />
        </svg>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
          <div className="nre-wizard-generate-success__check mx-auto flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-3xl ring-1 ring-emerald-400/30 sm:mx-0" aria-hidden>
            ✓
          </div>
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-dash-accent">Ready to review</p>
            <h2 className="nre-wizard-generate-success__title text-[22px] font-bold leading-tight sm:pr-12 sm:text-[26px]">
              Report generated successfully!
            </h2>
            <p className="nre-wizard-generate-success__meta mt-2 text-sm">One less report on your to-do list.</p>
            <p className="mt-4 text-[16px] font-semibold text-dash-ink">{clientName}</p>
            <dl className="nre-wizard-generate-success__meta mt-2 space-y-0.5 text-[13px] leading-snug sm:text-[14px]">
              <div className="flex flex-wrap justify-center sm:justify-start">
                <dt className="sr-only">Report title</dt>
                <dd className="font-medium text-dash-ink">{reportTitle}</dd>
              </div>
              {reportingPeriodLine ? (
                <div>
                  <dt className="sr-only">Reporting period</dt>
                  <dd>{reportingPeriodLine}</dd>
                </div>
              ) : null}
              {slideCount > 0 ? (
                <div>
                  <dt className="sr-only">Slides</dt>
                  <dd className="inline-flex rounded-full border border-dash-border bg-dash-card/60 px-2.5 py-1 text-xs font-medium text-dash-ink">
                    {slideCount} slide{slideCount === 1 ? "" : "s"}
                  </dd>
                </div>
              ) : null}
              {generatedAt ? (
                <div>
                  <dt className="sr-only">Generated</dt>
                  <dd>Generated {formatGeneratedAt(generatedAt)}</dd>
                </div>
              ) : null}
            </dl>
            {isWeekly ? (
              <p className="nre-wizard-generate-success__meta mt-2 text-[12px] leading-snug sm:text-[13px]">
                {copy.weeklyReportScopeLine}
              </p>
            ) : null}
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
          <p id="success-review-heading" className="text-[14px] leading-relaxed text-dash-ink-secondary">
            Review your slides before sharing with your client.
          </p>
          {previewHref && shareToken ? (
            <Link
              href={previewHref}
              className={`${primaryActionClass} mt-3`}
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
          <section aria-labelledby="success-share-heading" className="space-y-3">
            <h3 id="success-share-heading" className={sectionTitleClass}>
              Share with client
            </h3>
            <p className="text-[13px] text-dash-ink-secondary">Anyone with this link can view the report. Review it before sending.</p>
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
              <div className="flex w-full shrink-0 flex-col gap-1 sm:w-[10.5rem]">
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
                    className="flex shrink-0 items-center justify-center px-3.5 py-2.5 text-dash-ink-secondary transition-colors hover:bg-dash-border/80 hover:text-dash-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-dash-accent"
                    aria-label={shareLinkCopied ? "Link copied" : "Copy link"}
                  >
                    <LinkIcon />
                  </button>
                </div>
                {shareLinkCopied ? (
                  <p className="text-center text-[12px] font-medium text-emerald-400 sm:text-right" aria-live="polite">
                    Link copied
                  </p>
                ) : null}
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
            <p className="mb-2 text-[14px] text-dash-ink-secondary">Live link is still preparing — download the file below.</p>
            <a href={downloadUrl} className={secondaryExportClass}>
              <PptxDownloadIcon />
              Download PPTX
            </a>
          </section>
        )}

        {/* Section D — save and organize */}
        <section aria-labelledby="success-drive-heading" className="space-y-2">
          <h3 id="success-drive-heading" className={sectionTitleClass}>
            Save and organize
          </h3>
          {hasGoogleDriveConnected ? (
            <>
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
            <div className="rounded-lg border border-dash-border bg-dash-sidebar/40 px-4 py-3">
              <p className="text-[13px] leading-relaxed text-dash-ink-secondary">
                Google Drive is not connected yet.{" "}
                <Link
                  href="/account#google-drive"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-dash-accent hover:underline"
                >
                  Connect in Account settings
                </Link>{" "}
                (opens in a new tab). On your next report you can use{" "}
                <span className="font-medium text-dash-ink">Save to Drive</span> — pick a folder once and we&apos;ll
                remember it for future reports.
              </p>
            </div>
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
            Generate another report for {clientName}
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
