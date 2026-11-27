import { beforeEach, it, expect, vi } from "vitest";
const m = vi.hoisted(() => ({
  auth: vi.fn(),
  report: vi.fn(),
  owner: vi.fn(),
  send: vi.fn(),
  update: vi.fn(),
  complete: vi.fn(),
  transaction: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ auth: m.auth }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    report: { findUnique: m.report },
    user: { findUnique: m.owner },
    $transaction: m.transaction,
  },
}));
vi.mock("@/lib/email", () => ({ sendReportEmail: m.send }));
vi.mock("@/lib/report-reminders/completion", () => ({
  recordReportSent: m.complete,
}));
vi.mock("@/lib/report-delivery-summary", () => ({
  reportDeliverySummary: () => ({
    reportType: "Weekly",
    dateRange: "Nov 20–26",
  }),
}));
vi.mock("@/lib/report-branding", () => ({
  reportBrandingFromShareJson: () => ({}),
}));
import { POST } from "../reports/[id]/send-email/route";
const req = () =>
  new Request("https://nextreport.in/api/reports/r/send-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to: "client@example.com" }),
  });
const params = { params: Promise.resolve({ id: "r" }) };
beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ user: { id: "owner" } });
  m.report.mockResolvedValue({
    id: "r",
    client: { id: "c", userId: "owner", accountName: "Client" },
    requiresApproval: false,
    status: "COMPLETE",
    shareToken: "share",
    emailsSent: 0,
  });
  m.owner.mockResolvedValue({ email: "owner@example.com" });
  m.transaction.mockImplementation((fn) =>
    fn({ report: { update: m.update } }),
  );
});
it("advances the reminder only after an accepted report email", async () => {
  m.send.mockResolvedValue({ success: true });
  expect((await POST(req(), params)).status).toBe(200);
  expect(m.complete).toHaveBeenCalledWith(
    expect.anything(),
    "c",
    expect.any(Date),
  );
  expect(m.update).toHaveBeenCalledWith(
    expect.objectContaining({ where: { id: "r" } }),
  );
});
it("does not clear reminders after a failed delivery", async () => {
  m.send.mockResolvedValue({ success: false, error: "Unavailable" });
  expect((await POST(req(), params)).status).toBe(502);
  expect(m.complete).not.toHaveBeenCalled();
  expect(m.transaction).not.toHaveBeenCalled();
});
it("cannot acknowledge another owner's report", async () => {
  m.auth.mockResolvedValue({ user: { id: "other" } });
  expect((await POST(req(), params)).status).toBe(404);
  expect(m.send).not.toHaveBeenCalled();
  expect(m.complete).not.toHaveBeenCalled();
});
