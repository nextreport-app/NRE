import { expect, it, vi } from "vitest";
vi.mock("@/lib/auth", () => ({ auth: async () => null }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`);
  },
  usePathname: () => "/clients",
}));
const lookup = vi.hoisted(() => vi.fn());
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: lookup } } }));
import DashboardLayout from "@/app/(dashboard)/layout";
it("requires authentication for every dashboard-group route before reading private data", async () => {
  await expect(DashboardLayout({ children: null })).rejects.toThrow(
    "redirect:/login",
  );
  expect(lookup).not.toHaveBeenCalled();
});
