import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiErrorResponse } from "@/lib/api-error";

/**
 * Clears the connected Google Drive account so the user can connect a
 * different one — leaves googleDriveEnabled/googleDriveFolderName alone
 * (disconnecting isn't the same as turning auto-save off; the next report
 * generation attempt will just fail gracefully with a "not connected" error
 * until they reconnect, per the auto-save route's own fallback handling).
 */
export async function POST() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { googleAccessToken: null, googleRefreshToken: null, googleConnectedEmail: null },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err, "google-drive:disconnect");
  }
}
