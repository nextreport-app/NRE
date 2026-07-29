import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AccountSettingsForm } from "@/components/account-settings-form";
import { GoogleDriveSettings } from "@/components/google-drive-settings";
import { getSubscriptionStatus } from "@/lib/subscription";

const PLAN_LABELS: Record<string, string> = {
  trial: "Free Trial",
  starter: "Starter",
  professional: "Professional",
  cancelled: "Cancelled",
};

export default async function AccountSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ google_drive_connected?: string; google_drive_error?: string }>;
}) {
  const session = await auth();
  if (!session?.user) notFound();

  const [user, { google_drive_connected, google_drive_error }] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { agencyName: true, googleConnectedEmail: true, planId: true, trialEndsAt: true },
    }),
    searchParams,
  ]);
  if (!user) notFound();

  const status = getSubscriptionStatus(user);

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-2 text-xl font-semibold text-white">Account settings</h1>
      <p className="mb-6 text-sm text-ink-muted">
        Agency branding shown on every report you generate for any client.
      </p>
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-medium text-white">Agency branding</h2>
        <AccountSettingsForm initialAgencyName={user.agencyName} />
      </section>
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-medium text-white">Google Drive</h2>
        <GoogleDriveSettings
          initialConnectedEmail={user.googleConnectedEmail}
          justConnected={google_drive_connected === "1"}
          connectError={google_drive_error ?? null}
        />
      </section>
      <section>
        <h2 className="mb-3 text-lg font-medium text-white">Billing</h2>
        <div className="flex items-center justify-between rounded-lg border border-navy-border bg-navy-panel p-5">
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-muted">Current plan</p>
            <p className="mt-1 text-lg font-medium text-white">{PLAN_LABELS[status.planId]}</p>
          </div>
          <Link
            href="/billing"
            className="rounded-md border border-navy-border px-3 py-1.5 text-xs text-ink-secondary hover:bg-navy-border"
          >
            Manage billing →
          </Link>
        </div>
      </section>
    </div>
  );
}
