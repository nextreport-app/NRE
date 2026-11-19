import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../wizard-upload-session", async (original) => ({
  ...(await original<typeof import("../wizard-upload-session")>()),
  loadWizardUploadSession: vi.fn(),
}));
import { loadWizardUploadSession } from "../wizard-upload-session";
import { resolveWizardMtdFromFormData } from "../resolve-wizard-upload";
import { parseCsvText } from "../parse-csv";
const id = "11111111-1111-4111-8111-111111111111";
const selection = { kind: "BREAKDOWN", dimension: "age" };
const parsed = parseCsvText(
  "Campaign name,Ad set name,Day,Amount spent (USD),Impressions,Results,Result type\nExample,Set,2026-11-10,10,100,1,Leads (form)",
);
const upload = {
  ...parsed,
  platform: "META",
  reportSelection: selection,
  fileHash: "immutable",
};
const context = { userId: "owner", clientId: "client" };
function form() {
  const data = new FormData();
  data.set("uploadSessionId", JSON.stringify(id));
  data.set("reportType", '"WEEKLY"');
  return data;
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(loadWizardUploadSession).mockResolvedValue(
    structuredClone(upload) as never,
  );
});
describe("owned standalone upload selection", () => {
  it("restores canonical intent when a downstream request omits it", async () => {
    const data = form();
    const result = await resolveWizardMtdFromFormData(data, context);
    expect(result.ok).toBe(true);
    expect(JSON.parse(String(data.get("reportSelection")))).toEqual(selection);
    if (result.ok)
      expect(result.data.parsed.reportSelection).toEqual(selection);
    expect(loadWizardUploadSession).toHaveBeenCalledWith("owner", "client", id);
  });
  it("rejects a report choice changed after Import", async () => {
    const data = form();
    data.set("reportSelection", JSON.stringify({ kind: "CREATIVE" }));
    const result = await resolveWizardMtdFromFormData(data, context);
    expect(result).toMatchObject({
      ok: false,
      status: 400,
      body: { error: expect.stringContaining("choice changed") },
    });
  });
  it("requires a fresh analysis rather than allowing direct-file generation", async () => {
    const data = new FormData();
    data.set("reportSelection", JSON.stringify(selection));
    expect(await resolveWizardMtdFromFormData(data, context)).toMatchObject({
      ok: false,
      status: 400,
      body: { error: expect.stringContaining("analyze") },
    });
  });
  it("rejects expired or unowned imports", async () => {
    vi.mocked(loadWizardUploadSession).mockResolvedValue(null);
    expect(await resolveWizardMtdFromFormData(form(), context)).toMatchObject({
      ok: false,
      status: 400,
      body: { uploadSessionExpired: true },
    });
  });
});
