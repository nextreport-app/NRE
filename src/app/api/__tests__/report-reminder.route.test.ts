import { beforeEach, it, expect, vi } from "vitest";
const m = vi.hoisted(() => ({
  auth: vi.fn(),
  owned: vi.fn(),
  save: vi.fn(),
  sent: vi.fn(),
  toggle: vi.fn(),
  run: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ auth: m.auth }));
vi.mock("@/lib/prisma", () => ({
  prisma: { reportReminder: { updateMany: m.toggle } },
}));
vi.mock("@/lib/report-reminders/service", () => ({
  ownedReminderClient: m.owned,
  saveReminder: m.save,
  markReminderSent: m.sent,
  runReportReminders: m.run,
}));
import { POST } from "../clients/[id]/report-reminder/route";
import { GET } from "../cron/report-reminders/route";
import { ServiceError } from "@/lib/service-error";
const request = (body: unknown) =>
  new Request("https://nextreport.in/api/clients/c/report-reminder", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
const params = { params: Promise.resolve({ id: "c" }) };
beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ user: { id: "owner" } });
  m.owned.mockResolvedValue({ id: "c" });
});
it("rejects unauthenticated writes", async () => {
  m.auth.mockResolvedValue(null);
  expect((await POST(request({ action: "sent" }), params)).status).toBe(401);
  expect(m.sent).not.toHaveBeenCalled();
});
it("records explicit completion for the authenticated owner", async () => {
  expect((await POST(request({ action: "sent" }), params)).status).toBe(200);
  expect(m.sent).toHaveBeenCalledWith("c", "owner");
});
it("does not toggle another owner's reminder", async () => {
  m.owned.mockRejectedValue(new ServiceError("Not found", 404));
  expect(
    (await POST(request({ action: "toggle", enabled: false }), params)).status,
  ).toBe(404);
  expect(m.toggle).not.toHaveBeenCalled();
});
it("validates cadence and forbids arbitrary recipients", async () => {
  const response = await POST(
    request({
      action: "save",
      settings: {
        cadence: "CUSTOM",
        intervalDays: 0,
        firstDate: "2026-11-30",
        timezone: "UTC",
        time: "09:00",
        recipients: ["other@example.com"],
      },
    }),
    params,
  );
  expect(response.status).toBe(400);
  expect(m.save).not.toHaveBeenCalled();
});
it("requires the cron secret before any reminder processing", async () => {
  vi.stubEnv("CRON_SECRET", "secret");
  expect(
    (await GET(new Request("https://nextreport.in/api/cron/report-reminders")))
      .status,
  ).toBe(401);
  expect(m.run).not.toHaveBeenCalled();
  vi.unstubAllEnvs();
});
it("runs reminders only with a valid cron bearer", async () => {
  vi.stubEnv("CRON_SECRET", "secret");
  m.run.mockResolvedValue({ checked: 1, failed: 0 });
  expect(
    (
      await GET(
        new Request("https://nextreport.in/api/cron/report-reminders", {
          headers: { authorization: "Bearer secret" },
        }),
      )
    ).status,
  ).toBe(200);
  expect(m.run).toHaveBeenCalledTimes(1);
  vi.unstubAllEnvs();
});
