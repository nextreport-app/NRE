import { beforeEach, it, expect, vi } from "vitest";
const m = vi.hoisted(() => ({
  email: vi.fn(),
  reminder: vi.fn(),
  update: vi.fn(),
  send: vi.fn(),
  blocked: false,
}));
vi.mock("../../prisma", () => ({
  prisma: {
    emailDelivery: { findUnique: m.email, update: m.update },
    reportReminder: { findUnique: m.reminder },
  },
}));
vi.mock("../../email", () => ({
  FROM_ADDRESS: "test@example.test",
  getResendClient: () => ({ emails: { send: m.send } }),
}));
vi.mock("../../subscription", () => ({
  getSubscriptionStatus: () => ({ isBlocked: m.blocked }),
}));
import { deliverQueuedEmail } from "../../email-delivery";
import { buildReminderEmail } from "../email";
const now = new Date("2026-11-27T15:00Z"),
  key = "report-reminder:c:token:due";
const reminder = {
  enabled: true,
  emailEnabled: true,
  cycleToken: "token",
  timezone: "UTC",
  time: "09:00",
  nextDueAt: new Date("2026-11-27T09:00Z"),
  leadDays: 2,
  lastCompletedAt: null,
  client: {
    userId: "owner",
    lastReportSentAt: null,
    user: { email: "owner@example.test", emailVerified: now },
  },
};
beforeEach(() => {
  vi.clearAllMocks();
  m.blocked = false;
  m.email.mockResolvedValue({
    key,
    kind: "REPORT_REMINDER",
    userId: "owner",
    status: "PENDING",
    payloadJson: JSON.stringify({ to: ["owner@example.test"] }),
  });
});
it.each([
  "deleted",
  "paused",
  "email off",
  "new cycle",
  "new recipient",
  "unverified",
  "blocked",
  "sent",
  "wrong stage",
])(
  "cancels stale reminder emails before provider calls: %s",
  async (reason) => {
    const row = structuredClone(reminder);
    if (reason === "paused") row.enabled = false;
    if (reason === "email off") row.emailEnabled = false;
    if (reason === "new cycle") row.cycleToken = "new";
    if (reason === "new recipient") row.client.user.email = "new@example.test";
    if (reason === "unverified")
      row.client.user.emailVerified = null as unknown as Date;
    if (reason === "blocked") m.blocked = true;
    if (reason === "sent") row.client.lastReportSentAt = now as unknown as null;
    if (reason === "wrong stage") row.nextDueAt = new Date("2026-12-30T09:00Z");
    m.reminder.mockResolvedValue(reason === "deleted" ? null : row);
    expect((await deliverQueuedEmail(key, now)).cancelled).toBe(true);
    expect(m.send).not.toHaveBeenCalled();
  },
);
it("escapes account names and sends reminders only to the owner, with manage/generate links", () => {
  const email = buildReminderEmail(
    { id: "c", accountName: '<img src=x> "Account"' },
    reminder as never,
    "owner@example.test",
    now,
  );
  expect(email.to).toEqual(["owner@example.test"]);
  expect(email.html).not.toContain("<img src=x>");
  expect(email.html).toContain("&lt;img src=x&gt;");
  expect(email.text).toContain("/clients/c/reminders");
  expect(email.text).toContain("/clients/c/reports/new");
});
