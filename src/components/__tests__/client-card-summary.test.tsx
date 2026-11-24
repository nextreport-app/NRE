import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ClientList } from "../client-list";
import ClientsPage from "@/app/(dashboard)/clients/page";
import { clientActivityDate, clientConnectionState } from "@/lib/client-card-summary";
const m = vi.hoisted(() => ({ auth: vi.fn(), owner: vi.fn(), clients: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: m.auth }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: m.owner }, client: { findMany: m.clients } } }));
vi.mock("../clients-page-chrome", () => ({ ClientsPageHeader: () => <header>Clients</header>, ClientsPageSupportLine: () => null }));
vi.mock("../clients-getting-started", () => ({ ClientsGettingStarted: () => <p>Start here</p> }));
const card = { id: "one", accountName: "Example", currency: "USD" as const, timezone: "America/Los_Angeles", hasGa4Property: true, ga4PropertyName: "Website", hasPreviousMonthData: false, previousMonthDataUpdatedAt: null };
beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ user: { id: "owner" } });
  m.owner.mockResolvedValue({ emailVerified: new Date(), metaAdsEnabled: true, metaAccessToken: "SECRET_META", ga4Enabled: false, ga4RefreshToken: null });
  m.clients.mockResolvedValue([{ ...card, metaAdAccountId: "123", metaAdAccountName: "Ads", ga4PropertyId: "456", previousMonthDataUrl: null, reports: [{ completedAt: new Date("2026-11-20T20:00:00Z"), createdAt: new Date("2026-11-20T19:50:00Z") }], reportSchedules: [{ nextRunAt: new Date("2026-12-01T17:00:00Z"), timezone: "America/Los_Angeles" }] }]);
});
describe("client card summary", () => {
  it("distinguishes linked connections, reconnect requirements and absent links", () => {
    expect(clientConnectionState(true, true)).toBe("connected");
    expect(clientConnectionState(true, false)).toBe("reconnect");
    expect(clientConnectionState(false, true)).toBe("not-linked");
  });
  it("formats actual dates in the displayed timezone with legacy invalid-zone fallback", () => {
    expect(clientActivityDate("2026-11-24T01:00:00Z", "America/Los_Angeles")).toBe("Nov 23, 2026");
    expect(clientActivityDate("2026-11-24T01:00:00Z", "UTC", true)).toContain("1:00 AM");
    expect(clientActivityDate("2026-11-24T01:00:00Z", "invalid")).toBe("Nov 24, 2026");
  });
  it("removes the optional-data boilerplate and handles clients without reports or schedules", () => {
    const html = renderToStaticMarkup(<ClientList clients={[{ ...card, metaConnection: "not-linked", ga4Connection: "not-linked" }]} totalCount={1} />);
    expect(html).not.toContain("Previous-month totals optional");
    expect(html).toContain("No reports yet");
    expect(html).not.toContain("Next scheduled:");
    expect(html).toContain("Meta not linked");
    expect(html).toContain("GA4 not linked");
  });
  it("loads owner-scoped completed reports and enabled schedules with bounded relation selections", async () => {
    const html = renderToStaticMarkup(await ClientsPage({ searchParams: Promise.resolve({}) }));
    expect(m.clients).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "owner" }, select: expect.objectContaining({ reports: expect.objectContaining({ where: { status: "COMPLETE" }, take: 1 }), reportSchedules: expect.objectContaining({ where: { enabled: true }, orderBy: { nextRunAt: "asc" }, take: 1 }) }) }));
    expect(html).toContain("Meta connected");
    expect(html).toContain("GA4 reconnect");
    expect(html).toContain("Nov 20, 2026");
    expect(html).toContain("Dec 1, 2026, 9:00 AM");
    expect(html).not.toContain("SECRET_META");
    expect(html).not.toContain("Previous-month totals optional");
  });
  it("does not query private clients when signed out", async () => {
    m.auth.mockResolvedValue(null);
    await ClientsPage({ searchParams: Promise.resolve({}) });
    expect(m.clients).not.toHaveBeenCalled();
    expect(m.owner).not.toHaveBeenCalled();
  });
});
