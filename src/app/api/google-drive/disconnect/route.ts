import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiErrorResponse } from "@/lib/api-error";

/** Clears the connected Google Drive account so the user can connect a different one. */
export async function POST() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        googleDriveEnabled: false,
        googleAccessToken: null,
        googleRefreshToken: null,
        googleConnectedEmail: null,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err, "google-drive:disconnect");
  }
}
