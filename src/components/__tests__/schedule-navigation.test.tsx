import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { clientCardActions } from "../client-card-actions";
import { ClientList } from "../client-list";
import ClientSchedulesPage from "@/app/(dashboard)/clients/[id]/schedules/page";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(), findFirst: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({ prisma: { client: { findFirst: mocks.findFirst } } }));
vi.mock("next/navigation", () => ({ notFound: () => { throw Error("NOT_FOUND"); } }));
vi.mock("../scheduled-reports-card", () => ({ ScheduledReportsCard: ({ clientId }: { clientId: string }) => <section data-client={clientId}>Schedule form</section> }));
const client = { id: "client-1", accountName: "Example", currency: "USD" as const, timezone: "UTC", hasGa4Property: false, ga4PropertyName: null, hasPreviousMonthData: false, previousMonthDataUpdatedAt: null };
beforeEach(() => { vi.clearAllMocks(); mocks.auth.mockResolvedValue({ user: { id: "owner-1" } }); mocks.findFirst.mockResolvedValue(client); });
describe("Scheduling navigation and ownership", () => {
  it.each([false, true])("client chooser exposes a direct schedule destination (schedule mode %s)", (scheduling) => {
    const html = renderToStaticMarkup(<ClientList clients={[client]} totalCount={1} scheduling={scheduling} />);
    expect(html).toContain(`href="/clients/client-1/${scheduling ? "schedules" : "reports/new"}"`);
    expect(html).toContain('aria-label="Client actions for Example"');
    expect(clientCardActions(client.id, scheduling)).toContainEqual(expect.objectContaining({ href: scheduling ? "/clients/client-1/reports/new" : "/clients/client-1/schedules" }));
  });
  it("loads only the signed-in owner's client and returns to the client chooser without a cross-task toolbar", async () => {
    const html = renderToStaticMarkup(await ClientSchedulesPage({ params: Promise.resolve({ id: client.id }) }));
    expect(mocks.findFirst).toHaveBeenCalledWith({ where: { id: client.id, userId: "owner-1" }, select: { id: true, accountName: true } });
    expect(html).toContain('data-client="client-1"');
    expect(html).toContain('href="/clients"');
    expect(html).toContain("← Back to My Clients");
    expect(html).toContain("Automate reporting");
    expect(html).toContain('href="/reports?tab=scheduled"');
    expect(html).not.toContain('aria-label="Client workspace"');
    expect(html).not.toContain('/clients/client-1/reports/new');

  });
  it("rejects an unauthenticated request without querying clients", async () => {
    mocks.auth.mockResolvedValue(null);
    await expect(ClientSchedulesPage({ params: Promise.resolve({ id: client.id }) })).rejects.toThrow("NOT_FOUND");
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });
  it("does not expose another owner's or missing client", async () => {
    mocks.findFirst.mockResolvedValue(null);
    await expect(ClientSchedulesPage({ params: Promise.resolve({ id: "other-client" }) })).rejects.toThrow("NOT_FOUND");
  });
});
