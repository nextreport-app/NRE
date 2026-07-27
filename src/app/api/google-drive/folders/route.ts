import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiErrorResponse } from "@/lib/api-error";
import { getFreshGoogleAccessToken, listDriveFolders } from "@/lib/google-drive";

/**
 * Lists the immediate subfolders of `?parentId=` (or Drive's root if
 * omitted) in the current user's connected Google Drive — the one data
 * source behind every folder browser in the app: account settings'
 * "select an existing root folder" (Option 2), the client profile page's
 * per-client override (Option 3), and the download screen's per-report
 * picker ("ask" mode, Option 4).
 */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { googleRefreshToken: true },
    });
    if (!user?.googleRefreshToken) {
      return NextResponse.json({ error: "Google Drive is not connected." }, { status: 400 });
    }

    const parentId = new URL(req.url).searchParams.get("parentId") ?? undefined;
    const accessToken = await getFreshGoogleAccessToken(user.googleRefreshToken);
    const folders = await listDriveFolders(accessToken, parentId);

    return NextResponse.json({ folders });
  } catch (err) {
    return apiErrorResponse(err, "google-drive:folders");
  }
}
