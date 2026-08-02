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

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-4 border-b border-dash-border pb-3 text-[16px] font-semibold text-dash-ink">{children}</h2>
  );
}

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
      select: { email: true, agencyName: true, googleConnectedEmail: true, planId: true, trialEndsAt: true },
    }),
    searchParams,
  ]);
  if (!user) notFound();

  const status = getSubscriptionStatus(user);

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-2 text-[24px] font-bold text-dash-ink">Account settings</h1>
      <p className="mb-8 text-[15px] text-dash-ink-secondary">
        Agency branding shown on every report you generate for any client.
      </p>

      <section className="mb-10">
        <SectionHeading>Agency Details</SectionHeading>
        <AccountSettingsForm initialAgencyName={user.agencyName} />
      </section>

      <section className="mb-10">
        <SectionHeading>Google Drive</SectionHeading>
        <GoogleDriveSettings
          initialConnectedEmail={user.googleConnectedEmail}
          justConnected={google_drive_connected === "1"}
          connectError={google_drive_error ?? null}
        />
      </section>

      <section>
        <SectionHeading>Billing</SectionHeading>
        <div className="flex items-center justify-between rounded-lg border border-dash-border bg-dash-card p-5">
          <div>
            <p className="text-[13px] uppercase tracking-wide text-dash-ink-secondary">Current plan</p>
            <p className="mt-1 text-[18px] font-semibold text-dash-ink">
              {PLAN_LABELS[status.planId]}
              {status.isAdminOverride && <span className="ml-1 text-[13px] font-normal text-dash-accent">(Admin access)</span>}
            </p>
          </div>
          <Link
            href="/billing"
            className="rounded-md border border-dash-border px-3 py-1.5 text-[13px] text-dash-ink-secondary hover:bg-dash-border"
          >
            Manage billing →
          </Link>
        </div>
      </section>
    </div>
  );
}
