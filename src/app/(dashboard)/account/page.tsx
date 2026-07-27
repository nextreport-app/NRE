import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AccountSettingsForm } from "@/components/account-settings-form";
import { GoogleDriveSettings } from "@/components/google-drive-settings";
import { DEFAULT_GOOGLE_DRIVE_FOLDER_NAME } from "@/lib/validators/account";
import { normalizeDriveMode } from "@/lib/google-drive";

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
      select: {
        agencyName: true,
        googleDriveEnabled: true,
        googleDriveFolderName: true,
        googleDriveMode: true,
        googleDriveRootFolderId: true,
        googleDriveRootFolderName: true,
        googleConnectedEmail: true,
      },
    }),
    searchParams,
  ]);

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-2 text-xl font-semibold text-white">Account settings</h1>
      <p className="mb-6 text-sm text-ink-muted">
        Agency branding shown on every report you generate for any client.
      </p>
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-medium text-white">Agency branding</h2>
        <AccountSettingsForm initialAgencyName={user?.agencyName ?? null} />
      </section>
      <section>
        <h2 className="mb-3 text-lg font-medium text-white">Google Drive auto-save</h2>
        <GoogleDriveSettings
          initialEnabled={user?.googleDriveEnabled ?? false}
          initialFolderName={user?.googleDriveFolderName ?? DEFAULT_GOOGLE_DRIVE_FOLDER_NAME}
          initialMode={normalizeDriveMode(user?.googleDriveMode)}
          initialRootFolderId={user?.googleDriveRootFolderId ?? null}
          initialRootFolderName={user?.googleDriveRootFolderName ?? null}
          initialConnectedEmail={user?.googleConnectedEmail ?? null}
          justConnected={google_drive_connected === "1"}
          connectError={google_drive_error ?? null}
        />
      </section>
    </div>
  );
}
