import { describe, expect, it, vi } from "vitest";
import { gzipSync } from "node:zlib";

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
  loadPreviousMonthDataRowsForCampaigns: async () => null,
}));
const saved = vi.hoisted(() =>
  vi.fn<(input: unknown) => Promise<string>>(async () => "upload-session"),
);
vi.mock("@/lib/nre/wizard-upload-session", () => ({
  saveWizardUploadSession: saved,
  hashUploadBuffer: () => "original-hash",
}));
import { POST } from "../clients/[id]/reports/analyze/route";

describe("large multi-campaign Analyze request", () => {
  it("returns every campaign after bounded decompression and retains inactive rows in the session", async () => {
    const names = Array.from({ length: 1024 }, (_, i) => `Campaign ${i}`);
    const csv =
      "Campaign name,Ad set name,Day,Amount spent (USD),Results,Reach,Impressions\n" +
      names
        .map(
          (name, i) =>
            `${name},${"Set ".repeat(1500)},2026-11-02,${i < 3 ? 10 : 0},0,0,0`,
        )
        .join("\n") +
      "\nCampaign 10,Set,2026-11-02,0,0,0,0\nCampaign 10,Set,2026-11-02,0,0,0,0";
    const form = new FormData();
    form.set("mtdDailyCsv", new File([gzipSync(csv)], "report.csv"));
    form.set("mtdDailyCsvEncoding", "gzip");
    form.set("reportType", '"WEEKLY"');
    const response = await POST(
      new Request("https://example.test/analyze", {
        method: "POST",
        body: form,
      }),
      { params: Promise.resolve({ id: "client" }) },
    );
    const result = await response.json();
    expect(response.status).toBe(200);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
    expect(result.campaigns).toHaveLength(1024);
    expect(
      Object.values(result.campaignSpend).filter((value) => Number(value) > 0),
    ).toHaveLength(3);
    expect(result.selectedCampaigns).toHaveLength(3);
    expect(saved).toHaveBeenCalledOnce();
    const session = saved.mock.calls[0][0] as unknown as { rows: unknown[] };
    expect(session.rows).toHaveLength(1026);
  }, 60000);
});
