import { beforeEach, it, expect, vi } from "vitest";
const m = vi.hoisted(() => ({ user: "owner", find: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  auth: async () => (m.user ? { user: { id: m.user } } : null),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { client: { findUnique: m.find, update: m.update } },
}));
vi.mock("@/lib/blob-deletion-outbox", () => ({
  queueBlobDeletions: vi.fn(),
  drainBlobDeletionQueue: vi.fn(),
}));
import { PATCH } from "../clients/[id]/route";
const ctx = { params: Promise.resolve({ id: "c" }) };
const request = (monthlyBudget: number) =>
  new Request("https://nextreport.in/api/clients/c", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ monthlyBudget }),
  });
beforeEach(() => {
  vi.clearAllMocks();
  m.user = "owner";
  m.find.mockResolvedValue({
    id: "c",
    userId: "owner",
    accountName: "A",
    currency: "USD",
  });
  m.update.mockResolvedValue({ id: "c", monthlyBudget: 750 });
});
it("changes only the approved budget on the owned client", async () => {
  expect((await PATCH(request(750), ctx)).status).toBe(200);
  expect(m.update).toHaveBeenCalledWith({
    where: { id: "c" },
    data: { monthlyBudget: 750 },
  });
});
it("rejects unauthenticated or cross-owner budget updates", async () => {
  m.user = "";
  expect((await PATCH(request(750), ctx)).status).toBe(401);
  expect(m.find).not.toHaveBeenCalled();
  m.user = "other";
  expect((await PATCH(request(750), ctx)).status).toBe(404);
  expect(m.update).not.toHaveBeenCalled();
});
it("rejects non-positive amounts without changing the saved budget", async () => {
  expect((await PATCH(request(0), ctx)).status).toBe(400);
  expect((await PATCH(request(-1), ctx)).status).toBe(400);
  expect(m.update).not.toHaveBeenCalled();
});
