import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const m = vi.hoisted(() => ({
  auth: vi.fn(),
  count: vi.fn(),
  reports: vi.fn(),
  client: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ auth: m.auth }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    client: { findUnique: m.client },
    report: { count: m.count, findMany: m.reports, findUnique: m.client },
  },
}));
vi.mock("next/navigation", () => ({
  redirect: (href: string) => {
    throw Error(`REDIRECT:${href}`);
  },
  notFound: () => {
    throw Error("NOT_FOUND");
  },
}));
vi.mock("../report-inbox", () => ({
  ReportInbox: () => <section>Scheduled draft inbox</section>,
}));
vi.mock("../report-share-review", () => ({
  ReportShareReview: () => <section>Private report review</section>,
}));
import EditClientPage from "@/app/(dashboard)/clients/[id]/edit/page";
import ReportsPage from "@/app/(dashboard)/reports/page";
import ReportCopyPage from "@/app/(dashboard)/clients/[id]/reports/[reportId]/copy/page";
import {
  ClientWorkspaceNav,
  clientWorkspaceLinks,
} from "../client-workspace-nav";
const record = {
  id: "report",
  status: "COMPLETE",
  displayName: "Weekly report",
  reportType: "WEEKLY",
  createdAt: new Date("2026-11-20T12:00Z"),
  requiresApproval: false,
  approvedAt: null,
  weekStart: null,
  weekEnd: null,
  filePath: "PRIVATE_STORAGE_PATH",
  client: {
    id: "client",
    accountName: "Express Text",
    timezone: "UTC",
    userId: "owner",
  },
  clientId: "client",
};
beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ user: { id: "owner" } });
  m.count.mockResolvedValue(21);
  m.reports.mockResolvedValue([record]);
  m.client.mockResolvedValue({ ...record, summaryJson: null });
});
const renderPage = async (params = {}) =>
  renderToStaticMarkup(
    await ReportsPage({ searchParams: Promise.resolve(params) }),
  );
describe("Reports workflow and client navigation", () => {
  it("redirects legacy edit links to canonical settings only for the owner", async () => {
    const props = { params: Promise.resolve({ id: "client" }) };
    m.client.mockResolvedValue({ id: "client", userId: "owner" });
    await expect(EditClientPage(props)).rejects.toThrow("REDIRECT:/clients/client#client-settings");
    m.client.mockResolvedValue({ id: "client", userId: "other" });
    await expect(EditClientPage(props)).rejects.toThrow("NOT_FOUND");
  });
  it("shows one-off and scheduled report history with owner scoping and bounded pagination", async () => {
    const html = await renderPage({ page: "999999", q: "Express" });
    expect(m.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          client: { userId: "owner" },
          OR: expect.any(Array),
        }),
      }),
    );
    expect(m.reports).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 20,
        take: 20,
        where: expect.objectContaining({ client: { userId: "owner" } }),
      }),
    );
    expect(html).toContain("includes one-off and scheduled reports");
    expect(html).toContain(
      'href="/clients/client/reports/report/copy?from=reports"',
    );
    expect(html).toContain('href="/reports?tab=scheduled"');
    expect(html).not.toContain("PRIVATE_STORAGE_PATH");
  });
  it("keeps private scheduled drafts on the review/approval path", async () => {
    m.reports.mockResolvedValue([{ ...record, requiresApproval: true }]);
    const html = await renderPage();
    expect(html).toContain("Awaiting approval");
    expect(html).toContain(
      'href="/clients/client/reports/report/copy?from=scheduled"',
    );
    expect(html).not.toContain("/r/");
    expect(html).not.toContain("/api/reports/report/download");
  });
  it("retains the scheduled inbox at its explicit tab without querying all report files", async () => {
    const html = await renderPage({ tab: "scheduled" });
    expect(html).toContain("Scheduled draft inbox");
    expect(m.count).not.toHaveBeenCalled();
    expect(m.reports).not.toHaveBeenCalled();
  });
  it("does not query reports for signed-out visitors", async () => {
    m.auth.mockResolvedValue(null);
    await expect(renderPage()).rejects.toThrow("REDIRECT:/login");
    expect(m.count).not.toHaveBeenCalled();
  });
  it("keeps all workspace destinations scoped to the same client, including GA4", () => {
    const links = clientWorkspaceLinks("client");
    expect(links.map((l) => l.href)).toEqual([
      "/overview?client=client",
      "/clients/client/reports/new",
      "/clients/client/schedules",
      "/clients/client#client-settings",
    ]);
    const html = renderToStaticMarkup(
      <ClientWorkspaceNav
        clientId="client"
        current="performance"
        performanceView="website"
      />,
    );
    expect(html).toContain('href="/websites?client=client"');
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
  });
  it("returns report review to the correct Reports tab and preserves ownership enforcement", async () => {
    const props = {
      params: Promise.resolve({ id: "client", reportId: "report" }),
      searchParams: Promise.resolve({ from: "scheduled" }),
    };
    m.client.mockResolvedValue({
      ...record,
      requiresApproval: true,
      summaryJson: null,
    });
    const html = renderToStaticMarkup(await ReportCopyPage(props));
    expect(html).toContain('href="/reports?tab=scheduled"');
    expect(html).toContain("private until approval");
    m.client.mockResolvedValue({
      ...record,
      client: { ...record.client, userId: "someone-else" },
    });
    await expect(ReportCopyPage(props)).rejects.toThrow("NOT_FOUND");
  });
});
