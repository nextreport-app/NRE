import { localDate } from "../report-schedules/calendar";
import { randomUUID } from "node:crypto";
import { prisma } from "../prisma";
import { ServiceError } from "../service-error";
import { queueEmail, deliverQueuedEmail } from "../email-delivery";
import { getSubscriptionStatus } from "../subscription";
import {
  reminderFirstDue,
  reminderEmailStage,
  type ReminderSettings,
} from "./model";
import { buildReminderEmail } from "./email";
import { recordReportSent } from "./completion";
export async function ownedReminderClient(clientId: string, userId: string) {
  const client = await prisma.client.findFirst({
    where: { id: clientId, userId },
    include: { reportReminder: true },
  });
  if (!client) throw new ServiceError("Not found", 404);
  return client;
}
export async function saveReminder(
  clientId: string,
  userId: string,
  settings: ReminderSettings,
) {
  const client = await ownedReminderClient(clientId, userId);
  const owner = await prisma.user.findUnique({
    where: { id: userId },
    select: { emailVerified: true },
  });
  if (settings.emailEnabled && !owner?.emailVerified)
    throw new ServiceError(
      "Verify your account email before enabling email reminders.",
      400,
    );
  const data = {
    enabled: settings.enabled,
    emailEnabled: settings.emailEnabled,
    cadence: settings.cadence,
    intervalDays:
      settings.cadence === "WEEKLY"
        ? 7
        : settings.cadence === "FORTNIGHTLY"
          ? 14
          : settings.intervalDays,
    monthDay:
      settings.cadence === "MONTHLY_FIXED"
        ? (settings.monthDay ?? Number(settings.firstDate.slice(-2)))
        : settings.cadence === "MONTHLY" &&
            client.reportReminder?.cadence === "MONTHLY" &&
            localDate(client.reportReminder.nextDueAt, settings.timezone) ===
              settings.firstDate
          ? client.reportReminder.monthDay
          : Number(settings.firstDate.slice(-2)),
    time: settings.time,
    timezone: settings.timezone,
    leadDays: settings.leadDays,
    nextDueAt: reminderFirstDue(settings),
    lastCompletedAt: client.lastReportSentAt,
    cycleToken: randomUUID(),
    configuredAt: new Date(),
    lastCheckedAt: null,
  };
  const existing = client.reportReminder;
  if (
    existing &&
    existing.enabled === data.enabled &&
    existing.emailEnabled === data.emailEnabled &&
    existing.cadence === data.cadence &&
    existing.intervalDays === data.intervalDays &&
    existing.monthDay === data.monthDay &&
    existing.time === data.time &&
    existing.timezone === data.timezone &&
    existing.leadDays === data.leadDays &&
    existing.nextDueAt.getTime() === data.nextDueAt.getTime()
  )
    return existing;
  return prisma.reportReminder.upsert({
    where: { clientId },
    create: { clientId, ...data },
    update: data,
  });
}
export async function markReminderSent(clientId: string, userId: string) {
  await ownedReminderClient(clientId, userId);
  await prisma.$transaction((tx) => recordReportSent(tx, clientId, new Date()));
}
export async function runReportReminders(now = new Date()) {
  const rows = await prisma.reportReminder.findMany({
    where: {
      enabled: true,
      OR: [
        { lastCheckedAt: null },
        { lastCheckedAt: { lte: new Date(now.getTime() - 55 * 60000) } },
      ],
    },
    include: { client: { include: { user: true } } },
    orderBy: { lastCheckedAt: { sort: "asc", nulls: "first" } },
    take: 100,
  });
  let checked = 0,
    failed = 0;
  const started = Date.now();
  for (const row of rows) {
    if (Date.now() - started > 140000) break;
    checked++;
    try {
      await prisma.reportReminder.updateMany({
        where: { clientId: row.clientId, cycleToken: row.cycleToken },
        data: { lastCheckedAt: now },
      });
      if (
        row.client.lastReportSentAt &&
        (!row.lastCompletedAt ||
          row.client.lastReportSentAt > row.lastCompletedAt)
      ) {
        await prisma.$transaction((tx) =>
          recordReportSent(tx, row.clientId, row.client.lastReportSentAt!),
        );
        continue;
      }
      if (
        !row.emailEnabled ||
        !row.client.user.emailVerified ||
        getSubscriptionStatus(row.client.user).isBlocked
      )
        continue;
      const stage = reminderEmailStage(row, now);
      if (!stage) continue;
      const key = `report-reminder:${row.clientId}:${row.cycleToken}:${stage}`;
      await queueEmail({
        key,
        kind: "REPORT_REMINDER",
        userId: row.client.userId,
        payload: buildReminderEmail(
          row.client,
          row,
          row.client.user.email,
          now,
        ),
      });
      const result = await deliverQueuedEmail(key, now);
      if (!result.accepted && !result.cancelled && !result.busy) failed++;
      if (!result.alreadyAccepted && !result.cancelled && !result.busy)
        await new Promise((resolve) => setTimeout(resolve, 550));
    } catch {
      failed++;
    }
  }
  return { checked, failed, remaining: Math.max(0, rows.length - checked) };
}
