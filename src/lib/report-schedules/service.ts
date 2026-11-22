import { prisma } from "../prisma";
import { ServiceError } from "../service-error";
import {
  scheduleSettingsSchema,
  nextScheduledAt,
  periodForOccurrence,
  type ScheduleSettings,
} from "./calendar";
import { getSubscriptionStatus } from "../subscription";
import { schedulerHealth } from "./health";
import {
  ensureFreshMetaAccessToken,
  fetchMetaAdAccountMetadata,
} from "../meta-api";
import { decryptMetaToken, encryptMetaToken } from "../meta-token-storage";
import { fetchMetaReportCsv } from "../nre/meta-api-sync";
import { metaApiImportRange } from "../nre/meta-api-import-range";
import { collectReportReachDateRanges } from "../nre/resolve-meta-campaign-reach-for-wizard";
import {
  fetchMetaCampaignPeriodReachMaps,
  mergeMetaCampaignPeriodReachMaps,
} from "../nre/meta-api-sync/fetch-campaign-period-reach";
import { parseCsvText } from "../nre/parse-csv";
import { buildStandardReportForWizard } from "../nre/report-engine/build-standard-from-wizard";
import { verifyStandardWizardReportAgainstCsv } from "../nre/wizard-csv-verification";
import { createReportWithinCapacity } from "../report-capacity";
import { serializeReportGenerationJob } from "../nre/report-generation-job-payload";
import { dispatchReportGenerationJob } from "../nre/dispatch-report-generation-job";
import {
  saveWizardUploadSession,
  hashUploadBuffer,
} from "../nre/wizard-upload-session";
import { generateShareToken } from "../share-token";
import { queueEmail, deliverQueuedEmail } from "../email-delivery";
import { reportApprovalDigest } from "./approval";
const escape = (text: string) =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

export async function saveReportSchedule(
  clientId: string,
  userId: string,
  input: unknown,
  enabled: boolean,
) {
  const settings = scheduleSettingsSchema.parse(input);
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: { user: true },
  });
  if (!client || client.userId !== userId)
    throw new ServiceError("Not found", 404);
  if (!client.metaAdAccountId)
    throw new ServiceError("Link the client's Meta ad account first.");
  if (settings.timezone !== client.timezone)
    throw new ServiceError("Use the client account timezone.");
  if (getSubscriptionStatus(client.user).isBlocked)
    throw new ServiceError("An active trial or subscription is required.", 403);
  if (enabled && !(await schedulerHealth()).healthy)
    throw new ServiceError(
      "The recurring scheduler is not connected or its check is overdue. Save a paused schedule or contact support.",
      503,
    );
  const nextRunAt = nextScheduledAt(settings);
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(734019)`;
    return tx.reportSchedule.upsert({
      where: { clientId_cadence: { clientId, cadence: settings.cadence } },
      create: {
        clientId,
        cadence: settings.cadence,
        settingsJson: JSON.stringify(settings),
        accountId: client.metaAdAccountId!,
        currency: client.currency,
        timezone: client.timezone,
        enabled,
        nextRunAt,
      },
      update: {
        settingsJson: JSON.stringify(settings),
        accountId: client.metaAdAccountId!,
        currency: client.currency,
        timezone: client.timezone,
        enabled,
        nextRunAt,
      },
    });
  });
}
export async function createManualDraft(scheduleId: string, userId: string) {
  const schedule = await prisma.reportSchedule.findUnique({
    where: { id: scheduleId },
    include: { client: true },
  });
  if (!schedule || schedule.client.userId !== userId)
    throw new ServiceError("Not found", 404);
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(734019)`;
    const pending = await tx.scheduledReportRun.count({
      where: {
        scheduleId,
        status: { in: ["PENDING", "PREPARING", "GENERATING"] },
      },
    });
    if (pending)
      throw new ServiceError(
        "A draft is already being prepared. Wait for it to finish.",
        429,
      );
    return tx.scheduledReportRun.create({
      data: {
        scheduleId,
        dueAt: new Date(),
        manual: true,
        settingsJson: JSON.stringify({
          settings: JSON.parse(schedule.settingsJson),
          accountId: schedule.accountId,
          currency: schedule.currency,
          timezone: schedule.timezone,
        }),
      },
    });
  });
}
export async function enqueueDueSchedules(now = new Date()) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(734019)`;
    const schedules = await tx.reportSchedule.findMany({
      where: { enabled: true, nextRunAt: { lte: now } },
      orderBy: { nextRunAt: "asc" },
      take: 10,
    });
    for (const schedule of schedules) {
      const settings = scheduleSettingsSchema.parse(
        JSON.parse(schedule.settingsJson),
      );
      // Resume with the most recent due occurrence, without a storm of old drafts after downtime.
      let dueAt = schedule.nextRunAt;
      for (let i = 0; i < 400; i++) {
        const next = nextScheduledAt(settings, dueAt);
        if (next > now) break;
        dueAt = next;
      }
      await tx.scheduledReportRun.upsert({
        where: { scheduleId_dueAt: { scheduleId: schedule.id, dueAt } },
        create: {
          scheduleId: schedule.id,
          dueAt,
          settingsJson: JSON.stringify({
            settings,
            accountId: schedule.accountId,
            currency: schedule.currency,
            timezone: schedule.timezone,
          }),
        },
        update: {},
      });
      await tx.reportSchedule.update({
        where: { id: schedule.id },
        data: { nextRunAt: nextScheduledAt(settings, now) },
      });
    }
    return schedules.length;
  });
}
async function notifyOwner(runId: string) {
  const run = await prisma.scheduledReportRun.findUnique({
    where: { id: runId },
    include: { schedule: { include: { client: { include: { user: true } } } } },
  });
  if (!run || !["READY", "FAILED"].includes(run.status)) return;
  const client = run.schedule.client;
  const text = `${client.accountName}: ${run.status === "READY" ? "your scheduled report draft is ready for review" : "your scheduled report draft needs attention"}.\n${run.error ?? "Nothing has been sent to the client. Review and approve the report before delivery."}\nhttps://nextreport.in/clients/${client.id}#scheduled-reports`;
  const key = `schedule-notice:${run.id}:${run.status}`;
  await queueEmail({
    key,
    kind: "SCHEDULE_NOTICE",
    userId: client.userId,
    payload: {
      to: [client.user.email],
      subject: `NextReport draft — ${client.accountName}`,
      text,
      html: `<pre style="white-space:pre-wrap">${escape(text)}</pre>`,
    },
  });
  await deliverQueuedEmail(key);
}
export async function processScheduledRun(runId: string) {
  const run = await prisma.scheduledReportRun.findUnique({
    where: { id: runId },
    include: {
      report: true,
      schedule: { include: { client: { include: { user: true } } } },
    },
  });
  if (
    !run ||
    !["PENDING", "PREPARING", "GENERATING", "READY", "FAILED"].includes(
      run.status,
    )
  )
    return;
  if (["READY", "FAILED"].includes(run.status)) {
    await notifyOwner(run.id);
    return;
  }
  if (run.report?.status === "COMPLETE") {
    await prisma.scheduledReportRun.updateMany({
      where: {
        id: run.id,
        status: { in: ["PENDING", "PREPARING", "GENERATING"] },
      },
      data: { status: "READY", leaseUntil: null, error: null },
    });
    await notifyOwner(run.id);
    return;
  }
  if (run.report?.status === "FAILED") {
    await prisma.scheduledReportRun.updateMany({
      where: {
        id: run.id,
        status: { in: ["PENDING", "PREPARING", "GENERATING"] },
      },
      data: {
        status: "FAILED",
        leaseUntil: null,
        error:
          "Report generation failed. Review the report status and prepare a new draft when ready.",
      },
    });
    await notifyOwner(run.id);
    return;
  }
  const now = new Date();
  const claimed = await prisma.scheduledReportRun.updateMany({
    where: {
      id: run.id,
      status: { in: ["PENDING", "PREPARING", "GENERATING"] },
      OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }],
    },
    data: {
      status: run.report ? "GENERATING" : "PREPARING",
      leaseUntil: new Date(now.getTime() + 20 * 60000),
      attempts: { increment: 1 },
    },
  });
  if (!claimed.count) return;
  try {
    const client = run.schedule.client,
      user = client.user;
    if (getSubscriptionStatus(user).isBlocked || !user.emailVerified)
      throw new ServiceError(
        "An active account with a verified email is required.",
      );
    if (run.report) {
      await dispatchReportGenerationJob(run.report.id);
      await finishRun(run.id);
      return;
    }
    if (!run.manual && !run.schedule.enabled) {
      await prisma.scheduledReportRun.updateMany({
        where: {
          id: run.id,
          status: { in: ["PENDING", "PREPARING", "GENERATING"] },
        },
        data: {
          status: "SKIPPED",
          leaseUntil: null,
          error: "Schedule paused before preparation.",
        },
      });
      return;
    }
    const config = JSON.parse(run.settingsJson) as {
      settings: ScheduleSettings;
      accountId: string;
      currency: string;
      timezone: string;
    };
    const settings = scheduleSettingsSchema.parse(config.settings);
    if (
      client.metaAdAccountId !== config.accountId ||
      client.currency !== config.currency ||
      client.timezone !== config.timezone
    )
      throw new ServiceError(
        "The client's linked account, currency or timezone changed. Review and save the schedule again.",
      );
    if (!user.metaAdsEnabled || !user.metaAccessToken)
      throw new ServiceError(
        "Reconnect Meta Ads before preparing scheduled drafts.",
      );
    const fresh = await ensureFreshMetaAccessToken({
      accessToken: decryptMetaToken(user.metaAccessToken),
      tokenExpiresAt: user.metaTokenExpiresAt,
    });
    if (fresh.refreshed)
      await prisma.user.update({
        where: { id: user.id },
        data: {
          metaAccessToken: encryptMetaToken(fresh.accessToken),
          metaTokenExpiresAt: fresh.tokenExpiresAt,
        },
      });
    const account = await fetchMetaAdAccountMetadata(
      fresh.accessToken,
      config.accountId,
    );
    if (
      account.currency !== config.currency ||
      account.timezone_name !== config.timezone
    )
      throw new ServiceError(
        "Meta account currency/timezone no longer matches the schedule.",
      );
    const period = periodForOccurrence(settings, run.dueAt),
      type = settings.cadence;
    const dateSelection = {
      mode: "custom" as const,
      customStart: period.startIso,
      customEnd: period.endIso,
    };
    const range = metaApiImportRange(
      {
        reportType: type,
        dateSelection,
        includePreviousMonthComparison: false,
      },
      run.dueAt,
      settings.timezone,
    );
    const source = await fetchMetaReportCsv({
      accessToken: fresh.accessToken,
      adAccountId: config.accountId,
      timezone: config.timezone,
      currency: config.currency,
      ...range,
      requireDirectResultEvidence: true,
      now: run.dueAt,
    });
    if (!source.rowCount)
      throw new ServiceError(
        "Meta returned no delivery rows for this report window. Prepare a manual report or review the account/date selection.",
      );
    const parsed = parseCsvText(source.csvText);
    // Persist the same unique reach windows used by the report, anchored to its occurrence.
    const reachMaps = await fetchMetaCampaignPeriodReachMaps({
      accessToken: fresh.accessToken,
      adAccountId: config.accountId,
      ranges: collectReportReachDateRanges({
        mtdDailyRows: parsed.rows,
        timezone: config.timezone,
        dateSelection,
        now: run.dueAt,
      }),
    });
    source.campaignPeriodReachMaps = mergeMetaCampaignPeriodReachMaps(
      reachMaps,
      source.campaignPeriodReachMaps,
    )!;
    if (
      settings.campaignNames.length &&
      settings.campaignNames.some(
        (name) => !parsed.rows.some((row) => row.campaign_name === name),
      )
    )
      throw new ServiceError(
        "A selected campaign is missing from the fresh source. Review the schedule's campaign scope.",
      );
    const form = new FormData();
    form.set("reportType", JSON.stringify(type));
    form.set("dateSelection", JSON.stringify(dateSelection));
    form.set("includePreviousMonthComparison", "false");
    form.set("showBudgetPacingOnCover", String(settings.showBudget));
    form.set("selectedAdSets", "[]");
    if (settings.campaignNames.length)
      form.set("selectedCampaigns", JSON.stringify(settings.campaignNames));
    const built = await buildStandardReportForWizard({
      client,
      platform: "META",
      mtdParsed: parsed,
      formData: form,
      now: run.dueAt,
      metaAdAccountIdFromSession: config.accountId,
      metaCampaignPeriodReachFromSession: source.campaignPeriodReachMaps,
    });
    if ("error" in built) throw new ServiceError(built.error);
    const verification = verifyStandardWizardReportAgainstCsv({
      client,
      mtdRows: parsed.rows,
      report: built.data,
      reportType: type,
      formData: form,
      platform: "META",
      now: run.dueAt,
    });
    if (verification.status !== "ok")
      throw new ServiceError(
        "Source verification did not pass. Review this report manually before preparing another draft.",
      );
    const latest = await prisma.reportSchedule.findUnique({
      where: { id: run.scheduleId },
      include: { client: true },
    });
    if (
      !latest ||
      (!run.manual && !latest.enabled) ||
      latest.client.metaAdAccountId !== config.accountId ||
      latest.client.currency !== config.currency ||
      latest.client.timezone !== config.timezone
    )
      throw new ServiceError(
        "Schedule/account settings changed during preparation. Prepare a new draft after review.",
      );
    const sourceSessionId = await saveWizardUploadSession({
      userId: user.id,
      clientId: client.id,
      platform: "META",
      ...parsed,
      fileHash: hashUploadBuffer(Buffer.from(source.csvText)),
      metaAdAccountId: config.accountId,
      metaCampaignPeriodReach: source.campaignPeriodReachMaps,
    });
    await prisma.scheduledReportRun.updateMany({
      where: {
        id: run.id,
        status: { in: ["PENDING", "PREPARING", "GENERATING"] },
      },
      data: { sourceSessionId, verificationJson: JSON.stringify(verification) },
    });
    const reportId = `scheduled_${run.id}`;
    let report = await prisma.report.findUnique({ where: { id: reportId } });
    if (!report)
      report = await createReportWithinCapacity(user.id, {
        data: {
          id: reportId,
          clientId: client.id,
          status: "GENERATING",
          platform: "META",
          reportType: type,
          weekStart: period.startIso,
          weekEnd: period.endIso,
          fileName: `Meta Ads ${type.toLowerCase()} report - ${period.startIso} to ${period.endIso}.pptx`,
          displayName: `${type === "WEEKLY" ? "Weekly" : "Monthly"} — ${period.startIso}–${period.endIso}`,
          shareToken: generateShareToken(),
          requiresApproval: true,
          scheduleRunId: run.id,
          jobPayload: serializeReportGenerationJob({
            version: 1,
            kind: "STANDARD",
            userId: user.id,
            clientId: client.id,
            platform: "META",
            reportData: built.data,
          }),
        },
      });
    if (report.clientId !== client.id || report.scheduleRunId !== run.id)
      throw new ServiceError("Draft ownership could not be verified.");
    await prisma.scheduledReportRun.updateMany({
      where: {
        id: run.id,
        status: { in: ["PENDING", "PREPARING", "GENERATING"] },
      },
      data: { status: "GENERATING", error: null },
    });
    await dispatchReportGenerationJob(report.id);
    await finishRun(run.id);
  } catch (error) {
    const message =
      error instanceof ServiceError
        ? error.message
        : "Draft preparation failed. Check the Meta connection and prepare a new draft.";
    const retry =
      error instanceof ServiceError &&
      [429, 502, 503].includes(error.status) &&
      run.attempts < 2;
    await prisma.scheduledReportRun.updateMany({
      where: {
        id: run.id,
        status: { in: ["PENDING", "PREPARING", "GENERATING"] },
      },
      data: {
        status: retry ? "PENDING" : "FAILED",
        leaseUntil: retry ? new Date(Date.now() + 5 * 60000) : null,
        error: message,
      },
    });
    if (!retry) await notifyOwner(run.id);
  }
}
async function finishRun(runId: string) {
  const run = await prisma.scheduledReportRun.findUnique({
    where: { id: runId },
    include: { report: true },
  });
  if (run?.report?.status === "COMPLETE") {
    await prisma.scheduledReportRun.updateMany({
      where: {
        id: runId,
        status: { in: ["PENDING", "PREPARING", "GENERATING"] },
      },
      data: { status: "READY", leaseUntil: null, error: null },
    });
    await notifyOwner(runId);
  } else if (run?.report?.status === "FAILED") {
    await prisma.scheduledReportRun.updateMany({
      where: {
        id: runId,
        status: { in: ["PENDING", "PREPARING", "GENERATING"] },
      },
      data: {
        status: "FAILED",
        leaseUntil: null,
        error:
          "Report generation failed. Prepare a new draft after reviewing the account.",
      },
    });
    await notifyOwner(runId);
  } else
    await prisma.scheduledReportRun.updateMany({
      where: {
        id: runId,
        status: { in: ["PENDING", "PREPARING", "GENERATING"] },
      },
      data: { leaseUntil: new Date(Date.now() + 5 * 60000) },
    });
}
export async function approveScheduledDraft(
  runId: string,
  userId: string,
  digest: string,
) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(734020)`;
    const run = await tx.scheduledReportRun.findUnique({
      where: { id: runId },
      include: { report: true, schedule: { include: { client: true } } },
    });
    if (!run || run.schedule.client.userId !== userId)
      throw new ServiceError("Not found", 404);
    if (
      !run.report ||
      run.report.status !== "COMPLETE" ||
      !["READY", "APPROVED"].includes(run.status)
    )
      throw new ServiceError("This draft is not ready for approval.", 409);
    if (reportApprovalDigest(run.report) !== digest)
      throw new ServiceError(
        "The report changed. Reload and review it before approving.",
        409,
      );
    const saved = await tx.report.updateMany({
      where: {
        id: run.report.id,
        summaryJson: run.report.summaryJson,
        filePath: run.report.filePath,
      },
      data: { approvedAt: new Date() },
    });
    if (!saved.count)
      throw new ServiceError(
        "The report changed during approval. Review it again.",
        409,
      );
    return tx.scheduledReportRun.update({
      where: { id: run.id },
      data: {
        status: "APPROVED",
        approvalDigest: digest,
        approvedById: userId,
        approvedAt: new Date(),
        error: null,
      },
    });
  });
}
export async function sendApprovedDraft(runId: string, userId: string) {
  const run = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(734020)`;
    const current = await tx.scheduledReportRun.findUnique({
      where: { id: runId },
      include: { report: true, schedule: { include: { client: true } } },
    });
    if (!current || current.schedule.client.userId !== userId)
      throw new ServiceError("Not found", 404);
    if (current.status === "SENT") return current;
    if (
      !current.report?.approvedAt ||
      current.report.status !== "COMPLETE" ||
      !current.report.shareToken ||
      reportApprovalDigest(current.report) !== current.approvalDigest ||
      !["APPROVED", "SENDING"].includes(current.status)
    )
      throw new ServiceError(
        "Review and approve the current report before sending.",
        409,
      );
    await tx.scheduledReportRun.update({
      where: { id: runId },
      data: { status: "SENDING" },
    });
    return current;
  });
  if (run.status === "SENT") return { accepted: true, alreadyAccepted: true };
  return retryScheduledDelivery(runId);
}
export async function retryScheduledDelivery(runId: string) {
  const run = await prisma.scheduledReportRun.findUnique({
    where: { id: runId },
    include: { report: true, schedule: { include: { client: true } } },
  });
  if (!run || run.status !== "SENDING") return { accepted: false };
  if (
    !run.report?.approvedAt ||
    !run.report.shareToken ||
    reportApprovalDigest(run.report) !== run.approvalDigest
  ) {
    await prisma.scheduledReportRun.update({
      where: { id: runId },
      data: {
        status: "REVIEW",
        error:
          "The approved version changed. Contact support to verify delivery before retrying.",
      },
    });
    return { accepted: false };
  }
  const settings = scheduleSettingsSchema.parse(
    JSON.parse(run.settingsJson).settings,
  );
  const text = `${run.schedule.client.accountName} — ${run.report.displayName ?? "Performance report"}\nBrowser report: https://nextreport.in/r/${run.report.shareToken}\nPowerPoint: https://nextreport.in/api/r/${run.report.shareToken}/download\n${run.report.slidesUrl ? `Google Slides: ${run.report.slidesUrl}\n` : ""}`;
  const key = `scheduled-client:${run.id}`;
  // Reconstruct an intent after a crash between explicit send approval and queue creation. Never creates a new message key.
  await queueEmail({
    key,
    kind: "SCHEDULE_CLIENT",
    userId: run.schedule.client.userId,
    payload: {
      to: settings.recipients,
      subject: `${run.schedule.client.accountName} — performance report`,
      text,
      html: `<pre style="white-space:pre-wrap">${escape(text)}</pre>`,
    },
  });
  const result = await deliverQueuedEmail(key);
  const delivery = await prisma.emailDelivery.findUnique({
    where: { key },
    select: { status: true },
  });
  if (result.accepted)
    await prisma.scheduledReportRun.update({
      where: { id: runId },
      data: { status: "SENT", deliveredAt: new Date(), error: null },
    });
  else if (result.cancelled || delivery?.status === "REVIEW")
    await prisma.scheduledReportRun.update({
      where: { id: runId },
      data: {
        status: "REVIEW",
        error:
          "Delivery needs review. Contact support to verify provider acceptance before sending another copy.",
      },
    });
  else if (!result.busy)
    await prisma.scheduledReportRun.update({
      where: { id: runId },
      data: {
        error:
          "Email delivery is not confirmed. The same queued message will be retried safely.",
      },
    });
  return result;
}
export async function skipScheduledDraft(runId: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(734020)`;
    const run = await tx.scheduledReportRun.findUnique({
      where: { id: runId },
      include: { report: true, schedule: { include: { client: true } } },
    });
    if (!run || run.schedule.client.userId !== userId)
      throw new ServiceError("Not found", 404);
    if (["SENDING", "SENT", "REVIEW"].includes(run.status))
      throw new ServiceError(
        "Delivery cannot be safely cancelled here. Verify its status before taking further action.",
        409,
      );
    if (run.report)
      await tx.report.update({
        where: { id: run.report.id },
        data: { approvedAt: null },
      });
    return tx.scheduledReportRun.update({
      where: { id: runId },
      data: {
        status: "SKIPPED",
        leaseUntil: null,
        error: "Skipped by agency owner.",
      },
    });
  });
}
