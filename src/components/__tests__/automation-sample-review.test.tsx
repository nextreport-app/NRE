import { beforeEach, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const m = vi.hoisted(() => ({
  auth: vi.fn(),
  report: vi.fn(),
  editor: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ auth: m.auth }));
vi.mock("@/lib/prisma", () => ({
  prisma: { report: { findUnique: m.report } },
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw Error("NOT_FOUND");
  },
  redirect: (url: string) => {
    throw Error("REDIRECT:" + url);
  },
}));
vi.mock("@/components/report-share-review", () => ({
  ReportShareReview: m.editor,
}));
vi.mock("@/components/share-report-view", () => ({
  ShareReportView: ({
    mode,
    shareToken,
  }: {
    mode: string;
    shareToken?: string;
  }) => (
    <div data-mode={mode} data-share-token={shareToken}>
      Read-only sample
    </div>
  ),
}));
import Page from "@/app/(dashboard)/clients/[id]/reports/[reportId]/copy/page";
const report = {
  id: "sample",
  clientId: "client",
  platform: "META",
  reportType: "WEEKLY",
  status: "COMPLETE",
  requiresApproval: true,
  scheduleRunId: null,
  shareToken: "private-token",
  summaryJson: JSON.stringify({ version: 1, campaigns: [] }),
  client: { userId: "owner", currency: "USD", timezone: "UTC" },
};
const args = {
  params: Promise.resolve({ id: "client", reportId: "sample" }),
  searchParams: Promise.resolve({ from: "automation" }),
};
beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ user: { id: "owner" } });
  m.report.mockResolvedValue(report);
});
it("shows a private read-only automation preview without editor/publish controls or public tokens", async () => {
  const html = renderToStaticMarkup(await Page(args));
  expect(html).toContain('data-mode="preview"');
  expect(html).toContain("Return to the setup tab");
  expect(html).not.toContain("private-token");
  expect(m.editor).not.toHaveBeenCalled();
});
it("keeps the preview owner-scoped and never renders another client's report", async () => {
  m.auth.mockResolvedValueOnce(null);
  await expect(Page(args)).rejects.toThrow("REDIRECT:/login");
  m.report.mockResolvedValueOnce({
    ...report,
    client: { ...report.client, userId: "other" },
  });
  await expect(Page(args)).rejects.toThrow("NOT_FOUND");
  m.report.mockResolvedValueOnce({ ...report, clientId: "other" });
  await expect(Page(args)).rejects.toThrow("NOT_FOUND");
});
