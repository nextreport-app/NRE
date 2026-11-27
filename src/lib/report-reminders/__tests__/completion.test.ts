import { beforeEach, it, expect, vi } from "vitest";
import { recordReportSent } from "../completion";
import type { Prisma } from "@/generated/prisma/client";
const tx = {
  client: { updateMany: vi.fn() },
  reportReminder: { findUnique: vi.fn(), updateMany: vi.fn() },
};
const now = new Date("2026-11-27T15:00Z");
const reminder = {
  enabled: true,
  cadence: "WEEKLY",
  intervalDays: 7,
  monthDay: 27,
  time: "09:00",
  timezone: "UTC",
  nextDueAt: new Date("2026-11-27T09:00Z"),
  cycleToken: "old",
  lastCompletedAt: null,
};
beforeEach(() => {
  vi.clearAllMocks();
  tx.reportReminder.findUnique.mockResolvedValue(reminder);
});
it("records a successful send and advances the next due date with an optimistic cycle check", async () => {
  await recordReportSent(
    tx as unknown as Prisma.TransactionClient,
    "client",
    now,
  );
  expect(tx.client.updateMany).toHaveBeenCalledWith(
    expect.objectContaining({ data: { lastReportSentAt: now } }),
  );
  expect(tx.reportReminder.updateMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({ clientId: "client", cycleToken: "old" }),
      data: expect.objectContaining({
        nextDueAt: new Date("2026-12-04T09:00Z"),
        lastCompletedAt: now,
      }),
    }),
  );
});
it.each([
  null,
  { ...reminder, enabled: false },
  { ...reminder, lastCompletedAt: now },
])(
  "does not advance an absent/paused/already-completed or same-day repeat reminder",
  async (row) => {
    tx.reportReminder.findUnique.mockResolvedValue(row);
    await recordReportSent(
      tx as unknown as Prisma.TransactionClient,
      "client",
      now,
    );
    expect(tx.reportReminder.updateMany).not.toHaveBeenCalled();
  },
);

it.each([false, true])(
  "consumes repeated/old send evidence without advancing the next cycle (%s)",
  async (old) => {
    tx.reportReminder.findUnique.mockResolvedValue({
      ...reminder,
      configuredAt: old
        ? new Date("2026-11-28T00:00Z")
        : new Date("2026-11-01T00:00Z"),
      lastCompletedAt: old ? null : new Date("2026-11-27T14:00Z"),
      nextDueAt: new Date("2026-12-04T09:00Z"),
    });
    await recordReportSent(
      tx as unknown as Prisma.TransactionClient,
      "client",
      now,
    );
    expect(tx.reportReminder.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { lastCompletedAt: now } }),
    );
  },
);
