import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AccountSettingsForm } from "@/components/account-settings-form";

export default async function AccountSettingsPage() {
  const session = await auth();
  if (!session?.user) notFound();

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { agencyName: true },
  });

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-2 text-xl font-semibold text-white">Account settings</h1>
      <p className="mb-6 text-sm text-ink-muted">
        Agency branding shown on every report you generate for any client.
      </p>
      <section>
        <h2 className="mb-3 text-lg font-medium text-white">Agency branding</h2>
        <AccountSettingsForm initialAgencyName={user?.agencyName ?? null} />
      </section>
    </div>
  );
}
