import { beforeEach, it, expect, vi } from "vitest";
const m = vi.hoisted(() => ({
  client: vi.fn(),
  owner: vi.fn(),
  upsert: vi.fn(),
  findMany: vi.fn(),
  updateMany: vi.fn(),
  queue: vi.fn(),
  deliver: vi.fn(),
  transaction: vi.fn(),
}));
vi.mock("../../prisma", () => ({
  prisma: {
    client: { findFirst: m.client },
    user: { findUnique: m.owner },
    reportReminder: {
      upsert: m.upsert,
      findMany: m.findMany,
      updateMany: m.updateMany,
    },
    $transaction: m.transaction,
  },
}));
vi.mock("../../email-delivery", () => ({
  queueEmail: m.queue,
  deliverQueuedEmail: m.deliver,
}));
vi.mock("../../subscription", () => ({
  getSubscriptionStatus: () => ({ isBlocked: false }),
}));
import {
  saveReminder,
  runReportReminders,
  ownedReminderClient,
} from "../service";
import { reminderSettingsSchema } from "../model";
const now = new Date("2026-11-27T15:00Z");
const settings = reminderSettingsSchema.parse({
  cadence: "WEEKLY",
  firstDate: "2026-11-27",
  time: "09:00",
  timezone: "UTC",
  emailEnabled: true,
});
beforeEach(() => {
  vi.clearAllMocks();
  m.client.mockResolvedValue({
    id: "c",
    userId: "u",
    lastReportSentAt: null,
    reportReminder: null,
  });
  m.owner.mockResolvedValue({ emailVerified: now });
  m.deliver.mockResolvedValue({ accepted: true, alreadyAccepted: true });
});
it("does not create another user's reminder", async () => {
  m.client.mockResolvedValue(null);
  await expect(saveReminder("c", "other", settings)).rejects.toThrow(
    "Not found",
  );
  expect(m.upsert).not.toHaveBeenCalled();
});
it("requires verified email for email reminders and initializes past-send reconciliation correctly", async () => {
  m.owner.mockResolvedValue({ emailVerified: null });
  await expect(saveReminder("c", "u", settings)).rejects.toThrow(
    "Verify your account email",
  );
  m.owner.mockResolvedValue({ emailVerified: now });
  m.client.mockResolvedValue({ lastReportSentAt: now, reportReminder: null });
  await saveReminder("c", "u", settings);
  expect(m.upsert).toHaveBeenCalledWith(
    expect.objectContaining({
      create: expect.objectContaining({
        clientId: "c",
        lastCompletedAt: now,
        nextDueAt: new Date("2026-11-27T09:00Z"),
      }),
    }),
  );
});
it("uses one immutable email key per cycle and stage across repeated hourly checks", async () => {
  const row = {
    ...settings,
    clientId: "c",
    monthDay: 27,
    nextDueAt: new Date("2026-11-27T09:00Z"),
    cycleToken: "cycle",
    lastCompletedAt: null,
    client: {
      id: "c",
      accountName: "Client",
      userId: "u",
      lastReportSentAt: null,
      user: { email: "owner@example.test", emailVerified: now },
    },
  };
  m.findMany.mockResolvedValue([row]);
  await runReportReminders(now);
  await runReportReminders(now);
  expect(m.queue).toHaveBeenCalledTimes(2);
  for (const call of m.queue.mock.calls)
    expect(call[0]).toMatchObject({
      key: "report-reminder:c:cycle:due",
      kind: "REPORT_REMINDER",
      userId: "u",
      payload: { to: ["owner@example.test"] },
    });
});
it("looks up clients within the authenticated owner's scope", async () => {
  await ownedReminderClient("c", "u");
  expect(m.client).toHaveBeenCalledWith(
    expect.objectContaining({ where: { id: "c", userId: "u" } }),
  );
});

it("stores a fixed monthly day independently of a short month's first reminder date", async () => {
  await saveReminder("c", "u", {
    ...settings,
    cadence: "MONTHLY_FIXED",
    monthDay: 31,
    firstDate: "2027-02-28",
  });
  expect(m.upsert).toHaveBeenCalledWith(
    expect.objectContaining({
      create: expect.objectContaining({
        cadence: "MONTHLY_FIXED",
        monthDay: 31,
        nextDueAt: new Date("2027-02-28T09:00Z"),
      }),
    }),
  );
});
