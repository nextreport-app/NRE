import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/auth", () => ({
  auth: async () => ({ user: { id: "owner" } }),
}));
vi.mock("@/lib/subscription-guard", () => ({
  requireActiveSubscription: async () => null,
}));
vi.mock("@/lib/usage-rate-limit", () => ({
  enforceWizardLimits: async () => null,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    client: {
      findUnique: async () => ({
        id: "client",
        userId: "owner",
        currency: "USD",
        timezone: "UTC",
        previousMonthDataUrl: null,
      }),
    },
  },
}));
vi.mock("@/lib/nre/meta-custom-conversion-catalog", () => ({
  tryFetchMetaCustomConversionResultTypesForUser: async () => undefined,
}));
vi.mock("@/lib/nre/previous-month-data", () => ({
  loadPreviousMonthDataRowsForCampaigns: async () => undefined,
}));
const saved = vi.hoisted(() =>
  vi.fn().mockResolvedValue("11111111-1111-4111-8111-111111111111"),
);
vi.mock("@/lib/nre/wizard-upload-session", () => ({
  saveWizardUploadSession: saved,
  hashUploadBuffer: () => "original",
}));
import { POST } from "../clients/[id]/reports/analyze/route";
function req(type = "WEEKLY") {
  const csv =
    "Campaign name,Ad set name,Day,Amount spent (USD),Impressions,Results,Result type,Age\nExample,Set,2026-11-10,10,100,1,Leads (form),18-24\nExample,Set,2026-11-10,20,200,2,Leads (form),25-34";
  const form = new FormData();
  form.set("mtdDailyCsv", new File([csv], "age.csv"));
  form.set("reportType", JSON.stringify(type));
  return new Request("http://localhost/analyze", {
    method: "POST",
    body: form,
  });
}
describe("audience-only wizard entry", () => {
  it("detects the audience source and persists it alongside safe date/campaign routing facts", async () => {
    const response = await POST(req(), {
      params: Promise.resolve({ id: "client" }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      valid: true,
      sourceContentOnly: true,
    });
    const payload = saved.mock.calls[0][0];
    expect(payload.metaReportContent).toMatchObject({
      sourceOnly: true,
      options: { includeStandard: false, audience: ["age"] },
    });
    expect(payload.rows).toHaveLength(1);
    expect(payload.headers).not.toContain("Age");
  });
  it("does not silently turn a comparison into an audience-only report", async () => {
    const response = await POST(req("COMPARISON"), {
      params: Promise.resolve({ id: "client" }),
    });
    expect(await response.json()).toMatchObject({
      valid: false,
      errors: [
        {
          field: "reportType",
          message: expect.stringContaining("Weekly or Monthly"),
        },
      ],
    });
  });
});
