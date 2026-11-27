import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { localDate } from "../report-schedules/calendar";
import { nextReminderAt, nextCycleMonthDay } from "./model";
/** Call only after a confirmed send (or explicit owner acknowledgement), never on generation/share clicks. */
export async function recordReportSent(
  tx: Prisma.TransactionClient,
  clientId: string,
  sentAt: Date,
) {
  await tx.client.updateMany({
    where: {
      id: clientId,
      OR: [{ lastReportSentAt: null }, { lastReportSentAt: { lt: sentAt } }],
    },
    data: { lastReportSentAt: sentAt },
  });
  const reminder = await tx.reportReminder.findUnique({ where: { clientId } });
  if (
    !reminder?.enabled ||
    (reminder.lastCompletedAt && reminder.lastCompletedAt >= sentAt)
  )
    return;
  if (
    sentAt < reminder.configuredAt ||
    (reminder.lastCompletedAt &&
      reminder.lastCompletedAt >= reminder.configuredAt &&
      localDate(reminder.lastCompletedAt, reminder.timezone) ===
        localDate(sentAt, reminder.timezone) &&
      reminder.nextDueAt > sentAt)
  ) {
    // Consume old/repeated send evidence without shifting the newly configured/current cycle.
    await tx.reportReminder.updateMany({
      where: {
        clientId,
        cycleToken: reminder.cycleToken,
        OR: [{ lastCompletedAt: null }, { lastCompletedAt: { lt: sentAt } }],
      },
      data: { lastCompletedAt: sentAt },
    });
    return;
  }
  await tx.reportReminder.updateMany({
    where: {
      clientId,
      cycleToken: reminder.cycleToken,
      OR: [{ lastCompletedAt: null }, { lastCompletedAt: { lt: sentAt } }],
    },
    data: {
      ...(reminder.cadence === "ONCE" ? { enabled: false } : {}),
      nextDueAt:
        reminder.cadence === "ONCE"
          ? reminder.nextDueAt
          : nextReminderAt(reminder, sentAt),
      monthDay:
        reminder.cadence === "MONTHLY"
          ? nextCycleMonthDay(reminder, sentAt)
          : reminder.monthDay,
      lastCompletedAt: sentAt,
      cycleToken: randomUUID(),
      lastCheckedAt: null,
    },
  });
}
