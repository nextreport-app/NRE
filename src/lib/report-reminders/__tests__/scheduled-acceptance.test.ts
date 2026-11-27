import { beforeEach, it, expect, vi } from "vitest";
const m = vi.hoisted(() => ({
  find: vi.fn(),
  claim: vi.fn(),
  accepted: vi.fn(),
  run: vi.fn(),
  send: vi.fn(),
  record: vi.fn(),
  valid: vi.fn(),
  transaction: vi.fn(),
}));
vi.mock("../../prisma", () => ({
  prisma: {
    emailDelivery: { findUnique: m.find, updateMany: m.claim },
    scheduledReportRun: { findUnique: m.run },
    $transaction: m.transaction,
  },
}));
vi.mock("../../email", () => ({
  FROM_ADDRESS: "test@example.com",
  getResendClient: () => ({ emails: { send: m.send } }),
}));
vi.mock("../completion", () => ({ recordReportSent: m.record }));
vi.mock("../../report-schedules/delivery-guard", () => ({
  scheduledDeliveryIsCurrent: m.valid,
}));
import { deliverQueuedEmail } from "../../email-delivery";
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("RESEND_API_KEY", "test");
  m.find.mockResolvedValue({
    key: "scheduled-client:run",
    kind: "SCHEDULE_CLIENT",
    userId: "u",
    status: "PENDING",
    payloadJson: JSON.stringify({
      to: ["client@example.com"],
      subject: "Report",
      text: "Report",
      html: "Report",
    }),
  });
  m.valid.mockReturnValue(true);
  m.claim.mockResolvedValue({ count: 1 });
  m.accepted.mockResolvedValue({ count: 1 });
  m.run.mockResolvedValue({ schedule: { clientId: "c" } });
  m.send.mockResolvedValue({ data: { id: "provider" } });
  m.transaction.mockImplementation((fn) =>
    fn({
      emailDelivery: { updateMany: m.accepted },
      scheduledReportRun: { findUnique: m.run },
    }),
  );
});
it("acknowledges scheduled sends in the same acceptance transaction, including background retries", async () => {
  expect((await deliverQueuedEmail("scheduled-client:run")).accepted).toBe(
    true,
  );
  expect(m.record).toHaveBeenCalledWith(
    expect.anything(),
    "c",
    expect.any(Date),
  );
  vi.unstubAllEnvs();
});
it("does not acknowledge a scheduled report when the provider refuses it", async () => {
  m.send.mockResolvedValue({ error: { message: "Unavailable" } });
  expect((await deliverQueuedEmail("scheduled-client:run")).accepted).toBe(
    false,
  );
  expect(m.record).not.toHaveBeenCalled();
  vi.unstubAllEnvs();
});
