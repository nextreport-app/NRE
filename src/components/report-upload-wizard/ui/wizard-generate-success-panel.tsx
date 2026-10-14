"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { CopyIcon, MailIcon } from "./icons";
import type { DriveView } from "../types";
import {
  buildClientReportSlackShareUrl,
  buildClientReportTeamsShareUrl,
  buildClientReportWhatsAppShareUrl,
  buildMailtoShareUrl,
  buildShareReportUrl,
  buildTelegramShareUrl,
} from "../utils";
import { formatRelativeReportDate } from "@/lib/client-display";

const chipClass =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-dash-border bg-dash-sidebar/60 px-3 py-2.5 text-[14px] font-medium text-dash-ink transition-colors hover:bg-dash-border/80";

type WizardGenerateSuccessPanelProps = {
  clientName: string;
  clientId: string;
  reportId: string | null;
  reportTypeLabel: string;
  wizardSharePlatformLabel: string;
  slideCount: number;
  dateRangeLabel: string;
  downloadUrl: string;
  shareToken: string | null;
  publishedAt: string | null;
  clientShareMessageCopied: boolean;
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
  children?: ReactNode;
};

export function WizardGenerateSuccessPanel({
  clientName,
  clientId,
  reportId,
  reportTypeLabel,
  wizardSharePlatformLabel,
  slideCount,
  dateRangeLabel,
  downloadUrl,
  shareToken,
  publishedAt,
  clientShareMessageCopied,
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
  children,
}: WizardGenerateSuccessPanelProps) {
  const reportUrl = shareToken ? `https://${buildShareReportUrl(shareToken)}` : null;
  const shareDateLabel = dateRangeLabel || "this period";
  const showDrive = !!(hasGoogleDriveConnected && (driveView === "collapsed" || driveView === "success"));

  return (
    <div className="overflow-hidden rounded-xl border border-emerald-800/40 bg-dash-card nre-dash-surface">
      <div className="border-b border-dash-border bg-emerald-950/20 px-5 py-5 text-center">
        <div
          className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-2xl text-emerald-300"
          aria-hidden
        >
          ✓
        </div>
        <p className="text-[18px] font-bold text-emerald-300">Report generated</p>
        <p className="mt-1 text-[15px] font-semibold text-dash-ink">
          {clientName} · {reportTypeLabel}
        </p>
        <p className="mt-1 text-[14px] text-dash-ink-secondary">
          {slideCount} slide{slideCount === 1 ? "" : "s"}
          {dateRangeLabel ? ` · ${dateRangeLabel}` : ""}
        </p>
      </div>

      <div className="space-y-5 p-5">
        {shareToken && reportUrl ? (
          <>
            <a
              href={reportUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center rounded-lg bg-dash-accent px-4 py-3.5 text-[16px] font-semibold text-dash-ink shadow-sm hover:bg-dash-accent-hover"
            >
              View report in browser
            </a>

            {reportId ? (
              <p className="text-center text-[14px] leading-relaxed text-dash-ink-secondary">
                <Link
                  href={`/clients/${clientId}/reports/${reportId}/copy?from=generate`}
                  className="font-medium text-dash-accent hover:underline"
                  onClick={() => {
                    persistGenerateSnapshot({ reportId, downloadUrl, shareToken });
                  }}
                >
                  {publishedAt ? "Edit review" : "Review slides and edit"}
                </Link>{" "}
                before you share.
              </p>
            ) : null}

            <div className="flex items-center gap-2 rounded-lg border border-dash-border bg-dash-sidebar px-3 py-2.5">
              <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-dash-ink-secondary">
                {buildShareReportUrl(shareToken)}
              </span>
              <button
                type="button"
                onClick={onCopyShareLink}
                className="shrink-0 rounded-md px-2.5 py-1 text-[13px] font-medium text-dash-accent hover:bg-dash-border"
              >
                Copy link
              </button>
            </div>

            <div>
              <p className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-dash-ink-muted">Share with client</p>
              <div className="flex flex-wrap gap-2">
                <a
                  href={buildClientReportWhatsAppShareUrl({
                    clientName,
                    reportTypeLabel,
                    platformLabel: wizardSharePlatformLabel,
                    dateRangeLabel: shareDateLabel,
                    reportUrl,
                  })}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={chipClass}
                >
                  <span className="text-[#25D366]" aria-hidden>
                    ●
                  </span>
                  WhatsApp
                </a>
                <a
                  href={buildClientReportSlackShareUrl({
                    clientName,
                    reportTypeLabel,
                    platformLabel: wizardSharePlatformLabel,
                    dateRangeLabel: shareDateLabel,
                    reportUrl,
                  })}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={chipClass}
                >
                  <span className="text-[#e9d8fd]" aria-hidden>
                    ●
                  </span>
                  Slack
                </a>
                <button type="button" onClick={() => void onCopyClientShareMessage()} className={chipClass}>
                  <CopyIcon />
                  {clientShareMessageCopied ? "Copied!" : "Copy message"}
                </button>
              </div>
            </div>

            <details className="group rounded-lg border border-dash-border bg-dash-sidebar/40">
              <summary className="cursor-pointer list-none px-4 py-2.5 text-[13px] font-medium text-dash-ink-secondary marker:content-none [&::-webkit-details-marker]:hidden">
                <span className="flex items-center justify-between gap-2">
                  More share options
                  <span className="text-[14px] leading-none transition-transform group-open:rotate-180">▾</span>
                </span>
              </summary>
              <div className="border-t border-dash-border px-4 py-3">
                <div className="flex flex-wrap gap-2">
                  <a href={buildMailtoShareUrl(reportUrl, clientName)} className={chipClass}>
                    <MailIcon />
                    Email
                  </a>
                  <a
                    href={buildTelegramShareUrl(reportUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={chipClass}
                  >
                    Telegram
                  </a>
                  <a
                    href={buildClientReportTeamsShareUrl({
                      clientName,
                      reportTypeLabel,
                      platformLabel: wizardSharePlatformLabel,
                      dateRangeLabel: shareDateLabel,
                      reportUrl,
                    })}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={chipClass}
                  >
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
          </>
        ) : null}

        {publishedAt ? (
          <div className="rounded-lg border border-emerald-800/50 bg-emerald-950/30 px-4 py-3 text-[14px] text-emerald-200">
            Published {formatRelativeReportDate(publishedAt)} — the live link reflects your published copy.
            {driveSaveUrl ? " Re-save to Google Drive manually if you updated the PPT." : null}
          </div>
        ) : null}

        <div>
          <p className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-dash-ink-muted">Download</p>
          <div className={showDrive ? "grid grid-cols-2 gap-2" : "grid grid-cols-1 gap-2"}>
            <a
              href={downloadUrl}
              className="flex items-center justify-center rounded-lg border border-dash-border bg-dash-sidebar/60 px-3 py-3 text-[14px] font-semibold text-dash-ink transition-colors hover:bg-dash-border/80"
            >
              Download PPTX
            </a>
            {showDrive ? (
              <button
                type="button"
                onClick={handleSaveButtonClick}
                disabled={driveSaving}
                className="flex items-center justify-center rounded-lg border border-dash-border bg-dash-sidebar/60 px-3 py-3 text-[14px] font-semibold text-dash-ink transition-colors hover:bg-dash-border/80 disabled:opacity-50"
              >
                {driveSaving ? "Saving…" : "Save to Drive"}
              </button>
            ) : null}
          </div>
          {hasGoogleDriveConnected && rememberedFolder && (driveView === "collapsed" || driveView === "success") ? (
            <p className="mt-2 text-[13px] text-dash-ink-secondary">
              Drive folder: <span className="text-dash-ink">{rememberedFolder.name}</span>{" "}
              <button
                type="button"
                onClick={() => (onEditDriveFolder ? onEditDriveFolder() : setDriveView("editing"))}
                className="text-dash-accent hover:underline"
              >
                Change
              </button>
            </p>
          ) : null}
        </div>

        {children}

        <div className="border-t border-dash-border pt-4">
          <button
            type="button"
            onClick={handleGenerateAnother}
            className="w-full text-center text-[14px] font-medium text-dash-accent hover:underline"
          >
            Generate another report for {clientName}
          </button>
        </div>
      </div>
    </div>
  );
}
