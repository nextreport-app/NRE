import { beforeEach, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const m = vi.hoisted(() => ({
  auth: vi.fn(),
  user: vi.fn(),
  capacity: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ auth: m.auth }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: m.user } } }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw Error("NOT_FOUND");
  },
}));
vi.mock("@/lib/client-capacity", () => ({
  getClientCapacityUsage: m.capacity,
}));
vi.mock("@/lib/subscription", () => ({
  getSubscriptionStatus: () => ({ isBlocked: false, clientLimit: 10 }),
}));
vi.mock("../client-form", () => ({
  ClientForm: ({
    createTask,
    showTemplatePicker,
    submitLabel,
  }: {
    createTask: string;
    showTemplatePicker: boolean;
    submitLabel?: string;
  }) => (
    <form data-task={createTask} data-template={String(showTemplatePicker)}>
      {submitLabel ?? "Create report client"}
    </form>
  ),
}));
import NewClientPage from "@/app/(dashboard)/clients/new/page";
beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ user: { id: "owner" } });
  m.user.mockResolvedValue({ id: "owner", emailVerified: new Date() });
  m.capacity.mockResolvedValue({ activeClientCount: 0 });
});
it("continues SEO onboarding to site setup without presenting a report template", async () => {
  const html = renderToStaticMarkup(
    await NewClientPage({
      searchParams: Promise.resolve({ task: "search-console" }),
    }),
  );
  expect(html).toContain('data-task="search-console"');
  expect(html).toContain('data-template="false"');
  expect(html).toContain("Create client &amp; choose site");
  expect(html).toContain("No report import is needed");
});
it("preserves normal report creation and ignores arbitrary destination strings", async () => {
  const html = renderToStaticMarkup(
    await NewClientPage({
      searchParams: Promise.resolve({ task: "https://untrusted.test" }),
    }),
  );
  expect(html).toContain('data-task="report"');
  expect(html).toContain('data-template="true"');
  expect(html).not.toContain("untrusted.test");
});
it("does not bypass email verification for SEO onboarding", async () => {
  m.user.mockResolvedValue({ emailVerified: null });
  const html = renderToStaticMarkup(
    await NewClientPage({
      searchParams: Promise.resolve({ task: "search-console" }),
    }),
  );
  expect(html).toContain("Verify your email first");
  expect(html).not.toContain("data-task");
});
it("requires authentication before creating an SEO workspace", async () => {
  m.auth.mockResolvedValue(null);
  await expect(
    NewClientPage({
      searchParams: Promise.resolve({ task: "search-console" }),
    }),
  ).rejects.toThrow("NOT_FOUND");
  expect(m.user).not.toHaveBeenCalled();
});
