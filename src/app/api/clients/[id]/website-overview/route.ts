import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/api-error";
import { refreshWebsiteDashboard } from "@/lib/website-dashboard/service";
export const maxDuration = 300;
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const input = z
    .object({ days: z.union([z.literal(7), z.literal(30)]) })
    .safeParse(await req.json().catch(() => null));
  if (!input.success)
    return NextResponse.json(
      { error: "Choose last 7 or 30 days." },
      { status: 400 },
    );
  try {
    const { id } = await params;
    return NextResponse.json(
      {
        ok: true,
        ...(await refreshWebsiteDashboard(
          id,
          session.user.id,
          input.data.days,
        )),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiErrorResponse(error, "website:refresh");
  }
}
