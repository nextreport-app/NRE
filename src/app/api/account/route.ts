import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { accountSettingsSchema, DEFAULT_GOOGLE_DRIVE_FOLDER_NAME } from "@/lib/validators/account";
import { normalizeDriveMode } from "@/lib/google-drive";
import { apiErrorResponse } from "@/lib/api-error";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const user = await prisma.user.findUnique({
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
    });
    return NextResponse.json({
      agencyName: user?.agencyName ?? null,
      googleDriveEnabled: user?.googleDriveEnabled ?? false,
      googleDriveFolderName: user?.googleDriveFolderName ?? DEFAULT_GOOGLE_DRIVE_FOLDER_NAME,
      googleDriveMode: normalizeDriveMode(user?.googleDriveMode),
      googleDriveRootFolderId: user?.googleDriveRootFolderId ?? null,
      googleDriveRootFolderName: user?.googleDriveRootFolderName ?? null,
      googleConnectedEmail: user?.googleConnectedEmail ?? null,
    });
  } catch (err) {
    return apiErrorResponse(err, "account:get");
  }
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = accountSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  // Partial update — this endpoint is shared by several independently-
  // saving account settings sections (agency branding, Google Drive
  // auto-save toggle, Drive Destination mode), so a field genuinely absent
  // from the request must be left untouched rather than overwritten with a
  // schema default.
  const data: {
    agencyName?: string | null;
    googleDriveEnabled?: boolean;
    googleDriveFolderName?: string;
    googleDriveMode?: string;
    googleDriveRootFolderId?: string | null;
    googleDriveRootFolderName?: string | null;
  } = {};
  if (parsed.data.agencyName !== undefined) data.agencyName = parsed.data.agencyName;
  if (parsed.data.googleDriveEnabled !== undefined) data.googleDriveEnabled = parsed.data.googleDriveEnabled;
  if (parsed.data.googleDriveFolderName !== undefined) data.googleDriveFolderName = parsed.data.googleDriveFolderName;
  if (parsed.data.googleDriveMode !== undefined) data.googleDriveMode = parsed.data.googleDriveMode;
  if (parsed.data.googleDriveRootFolderId !== undefined) data.googleDriveRootFolderId = parsed.data.googleDriveRootFolderId;
  if (parsed.data.googleDriveRootFolderName !== undefined) data.googleDriveRootFolderName = parsed.data.googleDriveRootFolderName;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ ok: true });
  }

  try {
    await prisma.user.update({ where: { id: session.user.id }, data });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err, "account:update");
  }
}
