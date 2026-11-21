import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    client: { findUnique: vi.fn() },
    user: { findUnique: vi.fn(), update: vi.fn() },
  },
}));
vi.mock("@/lib/subscription-guard", () => ({
  requireActiveSubscription: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/usage-rate-limit", () => ({
  enforceWizardLimits: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/nre/wizard-upload-session", async (original) => ({
  ...(await original<typeof import("@/lib/nre/wizard-upload-session")>()),
  loadWizardUploadSession: vi.fn(),
  saveWizardUploadSession: vi
    .fn()
    .mockResolvedValue("11111111-1111-4111-8111-111111111111"),
}));
vi.mock("@/lib/meta-token-storage", () => ({
  decryptMetaToken: () => "read-token",
  encryptMetaToken: () => "encrypted",
}));
vi.mock("@/lib/meta-api", async (original) => ({
  ...(await original<typeof import("@/lib/meta-api")>()),
  ensureFreshMetaAccessToken: vi
    .fn()
    .mockResolvedValue({ accessToken: "read-token", refreshed: false }),
  fetchMetaAdAccountMetadata: vi
    .fn()
    .mockResolvedValue({ currency: "USD", timezone_name: "UTC" }),
}));
vi.mock("@/lib/nre/meta-report-content/api", () => ({
  fetchMetaContentSources: vi.fn(),
  fetchCreativeSnapshots: vi.fn().mockResolvedValue({ media: {}, missing: 0 }),
  snapshotCreativeImage: vi.fn().mockResolvedValue({
    data: "data:image/jpeg;base64,AA==",
    width: 1,
    height: 1,
    label: "Uploaded creative image",
  }),
}));
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  loadWizardUploadSession,
  saveWizardUploadSession,
} from "@/lib/nre/wizard-upload-session";
import { fetchMetaContentSources } from "@/lib/nre/meta-report-content/api";
import { parseCsvText } from "@/lib/nre/parse-csv";
import { parseMetaContentSource } from "@/lib/nre/meta-report-content/data";
import { GET, POST } from "../clients/[id]/reports/content/route";
const id = "11111111-1111-4111-8111-111111111111";
const headers =
  "Campaign name,Ad set name,Campaign ID,Ad set ID,Day,Amount spent (USD),Results,Result type,Impressions,Clicks (all)";
const row = "Example,Set,1,11,2026-11-10,10,1,Leads (form),100,5";
const row2 = row.replace("11-10", "11-11");
const primary = parseCsvText(`${headers}\n${row}\n${row2}`);
const options = {
  audience: ["age"],
  creatives: false,
  includeStandard: true,
  ranking: "cpr",
  minSpend: 0,
  minResults: 5,
};
const context = { params: Promise.resolve({ id: "client" }) };
const upload = {
  version: 1,
  userId: "owner",
  clientId: "client",
  platform: "META",
  ...primary,
  fileHash: "original",
  createdAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
};
function req(
  overrides: Record<string, unknown> = {},
  files: Array<{ name: string; content: string }> = [],
) {
  const form = new FormData();
  form.set(
    "settings",
    JSON.stringify({
      uploadSessionId: id,
      source: "csv",
      options,
      reportType: "WEEKLY",
      dateSelection: {
        mode: "custom",
        customStart: "2026-11-10",
        customEnd: "2026-11-11",
      },
      selectedCampaigns: ["Example"],
      ...overrides,
    }),
  );
  files.forEach((file) =>
    form.append(
      "files",
      new File([file.content], file.name, { type: "text/csv" }),
    ),
  );
  return new Request("http://localhost/content", {
    method: "POST",
    body: form,
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue({ user: { id: "owner" } } as never);
  vi.mocked(prisma.client.findUnique).mockResolvedValue({
    id: "client",
    userId: "owner",
    currency: "USD",
    timezone: "UTC",
  } as never);
  vi.mocked(prisma.user.findUnique).mockResolvedValue({
    id: "owner",
    metaAccessToken: "encrypted",
  } as never);
  vi.mocked(loadWizardUploadSession).mockResolvedValue(
    structuredClone(upload) as never,
  );
});
describe("Meta content route", () => {
  it("does not expose another client's upload or start a fetch without ownership", async () => {
    vi.mocked(prisma.client.findUnique).mockResolvedValue({
      id: "client",
      userId: "other",
    } as never);
    expect((await POST(req(), context)).status).toBe(404);
    expect(fetchMetaContentSources).not.toHaveBeenCalled();
    vi.mocked(loadWizardUploadSession).mockRejectedValue(Error("not owned"));
    expect(
      (
        await GET(
          new Request(`http://localhost/content?uploadSessionId=${id}`),
          context,
        )
      ).status,
    ).toBe(404);
  });
  it("requires an API refresh when reusing a snapshot for additional campaigns or different location detail", async () => {
    const age = parseMetaContentSource(
      parseCsvText(`${headers},Age\n${row},25-34\n${row2},35-44`),
      "USD",
    );
    const content = {
      version: 1,
      options,
      sources: [{ ...age, source: "api" }],
      media: {},
      notices: [],
      campaigns: ["Example"],
    };
    vi.mocked(loadWizardUploadSession).mockResolvedValue({
      ...upload,
      metaReportContent: content,
    } as never);
    const expanded = await POST(
      req({
        source: "api",
        reuse: true,
        selectedCampaigns: ["Example", "Other"],
      }),
      context,
    );
    expect(expanded.status).toBe(400);
    expect((await expanded.json()).error).toMatch(/Refresh/);
    const geo = await POST(
      req({
        source: "api",
        reuse: true,
        selectedCampaigns: ["Example"],
        options: {
          ...options,
          audience: ["location"],
          locationLevel: "country",
        },
      }),
      context,
    );
    expect(geo.status).toBe(400);
    expect((await geo.json()).error).toMatch(/Location detail changed/);
    expect(saveWizardUploadSession).not.toHaveBeenCalled();
  });
  it("stores distinct CSV sources in a new session without changing primary facts", async () => {
    const age = `${headers},Age\n${row},25-34\n${row2},35-44`;
    const region = `${headers},Region\n${row},Tennessee\n${row2},Tennessee`;
    const response = await POST(
      req({ options: { ...options, audience: ["age", "location"] } }, [
        { name: "age.csv", content: age },
        { name: "region.csv", content: region },
      ]),
      context,
    );
    expect(response.status).toBe(200);
    const saved = vi.mocked(saveWizardUploadSession).mock.calls[0][0];
    expect(
      saved.metaReportContent?.sources.map((source) => source.kind),
    ).toEqual(["age", "location"]);
    expect(saved.rows).toEqual(primary.rows);
    expect(saved.fileHash).not.toBe("original");
    expect(fetchMetaContentSources).not.toHaveBeenCalled();
  });
  it("rejects mismatched currencies or duplicate sources before persisting", async () => {
    const file = `${headers.replace("(USD)", "(INR)")},Age\n${row},25-34\n${row2},35-44`;
    const response = await POST(
      req({}, [{ name: "age.csv", content: file }]),
      context,
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: expect.stringContaining("currencies"),
    });
    expect(saveWizardUploadSession).not.toHaveBeenCalled();
  });
  it("uses the imported API account, never a forged account from the browser", async () => {
    const rows = primary.rows.map((row) => ({
      ...row,
      _raw: {
        ...row._raw,
        "NRE API range start": "2026-11-10",
        "NRE API range end": "2026-11-11",
      },
    }));
    vi.mocked(loadWizardUploadSession).mockResolvedValue({
      ...upload,
      rows,
      metaAdAccountId: "123",
    } as never);
    const source = parseMetaContentSource(
      parseCsvText(`${headers},Age\n${row},25-34\n${row2},35-44`),
      "USD",
    );
    vi.mocked(fetchMetaContentSources).mockResolvedValue([
      { ...source, source: "api" },
    ]);
    const response = await POST(
      req({ source: "api", account: "999" }),
      context,
    );
    expect(response.status).toBe(200);
    expect(fetchMetaContentSources).toHaveBeenCalledWith(
      expect.objectContaining({
        account: "123",
        token: "read-token",
        currency: "USD",
        periodTotals: false,
      }),
    );
  });
  it("rejects missing source exports, unsupported report types and expired imports", async () => {
    expect((await POST(req(), context)).status).toBe(400);
    expect(saveWizardUploadSession).not.toHaveBeenCalled();
    expect(
      (await POST(req({ reportType: "COMPARISON" }), context)).status,
    ).toBe(400);
    vi.mocked(loadWizardUploadSession).mockResolvedValue(null);
    expect((await POST(req(), context)).status).toBe(400);
  });
  it("removes optional sections through an immutable session while preserving normal reporting", async () => {
    vi.mocked(loadWizardUploadSession).mockResolvedValue({
      ...upload,
      metaReportContent: {
        version: 1,
        options,
        sources: [],
        media: {},
        notices: [],
      },
    } as never);
    expect(
      (await POST(req({ options: { ...options, audience: [] } }), context))
        .status,
    ).toBe(200);
    expect(
      vi.mocked(saveWizardUploadSession).mock.calls[0][0].metaReportContent,
    ).toBeUndefined();
  });
});

describe("first-class report selection guards", () => {
  const selection = { kind: "BREAKDOWN", dimension: "age" } as const;
  const lockedOptions = { ...options, includeStandard: false };
  function apiUpload() {
    return {
      ...upload,
      reportSelection: selection,
      metaAdAccountId: "123",
      rows: primary.rows.map((row) => ({
        ...row,
        _raw: {
          ...row._raw,
          "NRE API range start": "2026-11-10",
          "NRE API range end": "2026-11-11",
        },
      })),
    };
  }
  it("prepares only the selected dimension and preserves the standalone intent in an immutable session", async () => {
    vi.mocked(loadWizardUploadSession).mockResolvedValue(apiUpload() as never);
    const source = parseMetaContentSource(
      parseCsvText(`${headers},Age\n${row},25-34\n${row2},35-44`),
      "USD",
    );
    vi.mocked(fetchMetaContentSources).mockResolvedValue([
      { ...source, source: "api" },
    ]);
    const response = await POST(
      req({
        source: "api",
        options: lockedOptions,
        selectedCampaigns: ["Example"],
      }),
      context,
    );
    expect(response.status).toBe(200);
    expect(fetchMetaContentSources).toHaveBeenCalledWith(
      expect.objectContaining({
        periodTotals: true,
        options: expect.objectContaining({
          audience: ["age"],
          includeStandard: false,
        }),
        range: { startIso: "2026-11-10", endIso: "2026-11-11" },
      }),
    );
    expect(saveWizardUploadSession).toHaveBeenCalledWith(
      expect.objectContaining({
        reportSelection: selection,
        metaReportContent: expect.objectContaining({
          selection,
          sourceOnly: true,
          options: expect.objectContaining({ includeStandard: false }),
        }),
      }),
    );
  });
  it.each([
    { ...lockedOptions, audience: ["location"] },
    { ...lockedOptions, includeStandard: true },
    { ...lockedOptions, creatives: true },
  ])(
    "rejects a forged report choice before fetching or persisting",
    async (next) => {
      vi.mocked(loadWizardUploadSession).mockResolvedValue(
        apiUpload() as never,
      );
      const response = await POST(
        req({ source: "api", options: next }),
        context,
      );
      expect(response.status).toBe(400);
      expect((await response.json()).error).toMatch(/choice changed/);
      expect(fetchMetaContentSources).not.toHaveBeenCalled();
      expect(saveWizardUploadSession).not.toHaveBeenCalled();
    },
  );
  it("requires a fresh import rather than extending the primary API coverage", async () => {
    vi.mocked(loadWizardUploadSession).mockResolvedValue(apiUpload() as never);
    const response = await POST(
      req({
        source: "api",
        options: lockedOptions,
        dateSelection: {
          mode: "custom",
          customStart: "2026-11-09",
          customEnd: "2026-11-11",
        },
      }),
      context,
    );
    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/cover|Import/);
    expect(fetchMetaContentSources).not.toHaveBeenCalled();
    expect(saveWizardUploadSession).not.toHaveBeenCalled();
  });
  it("keeps the previous import intact when Meta preparation fails", async () => {
    const original = apiUpload();
    vi.mocked(loadWizardUploadSession).mockResolvedValue(original as never);
    vi.mocked(fetchMetaContentSources).mockRejectedValue(
      Error("Meta is temporarily unavailable"),
    );
    const response = await POST(
      req({ source: "api", options: lockedOptions }),
      context,
    );
    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/temporarily unavailable/);
    expect(saveWizardUploadSession).not.toHaveBeenCalled();
    expect(original).toEqual(apiUpload());
  });
});
