import { beforeEach, it, expect, vi } from "vitest";
const m = vi.hoisted(() => ({
  create: vi.fn(),
  dispatch: vi.fn(),
  client: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({
  auth: async () => ({ user: { id: "owner" } }),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { client: { findUnique: m.client } },
}));
vi.mock("@/lib/subscription-guard", () => ({
  requireActiveSubscription: async () => null,
}));
vi.mock("@/lib/usage-rate-limit", () => ({
  enforceWizardLimits: async () => null,
}));
vi.mock("@/lib/quality-agents/generation-guard", () => ({
  guardReportGeneration: async () => null,
}));
vi.mock("@/lib/report-capacity", () => ({
  createReportWithinCapacity: m.create,
}));
vi.mock("@/lib/nre/dispatch-report-generation-job", () => ({
  scheduleReportGenerationJob: m.dispatch,
  dispatchReportGenerationJob: vi.fn(),
}));
vi.mock("@/lib/nre/resolve-wizard-upload", () => ({
  resolveWizardMtdFromFormData: async () => ({
    ok: true,
    data: {
      parsed: { platform: "META", rows: [], headers: [] },
      uploadSessionId: "upload",
    },
  }),
}));
vi.mock("@/lib/nre/report-engine/build-standard-from-wizard", () => ({
  resolveStandardReportForGenerate: async () => ({
    data: {
      reportType: "WEEKLY",
      fileDateRange: "2026-11-21 to 2026-11-27",
      isPaused: false,
      cover: { healthScore: 70, healthBadge: "" },
      campaignSlides: [],
      adSetSlides: [],
    },
  }),
}));
import { POST } from "../clients/[id]/reports/route";
beforeEach(() => {
  vi.clearAllMocks();
  m.client.mockResolvedValue({
    id: "client",
    userId: "owner",
    accountName: "Example",
    timezone: "UTC",
    currency: "USD",
  });
  m.create.mockResolvedValue({ id: "sample" });
});
it.each([false, true])(
  "marks automation samples private before dispatch and leaves ordinary reports unchanged (%s)",
  async (sample) => {
    const form = new FormData();
    form.set("reportType", JSON.stringify("WEEKLY"));
    if (sample) form.set("automationSample", "true");
    const response = await POST(
      new Request("http://localhost/api/clients/client/reports", {
        method: "POST",
        body: form,
      }),
      { params: Promise.resolve({ id: "client" }) },
    );
    expect(response.status).toBe(200);
    expect(m.create).toHaveBeenCalled();
    const data = m.create.mock.calls[0][1].data;
    if (sample) {
      expect(data.requiresApproval).toBe(true);
      expect(data.displayName).toContain("Automation sample");
    } else expect(data.requiresApproval).toBeUndefined();
    expect(m.dispatch).toHaveBeenCalledWith("sample");
    expect(m.create.mock.invocationCallOrder[0]).toBeLessThan(
      m.dispatch.mock.invocationCallOrder[0],
    );
  },
);
