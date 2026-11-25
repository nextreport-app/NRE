import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/api-error";
import { customWebsiteRangeSchema } from "@/lib/website-dashboard/range";
import { refreshGscDashboard } from "@/lib/search-console/service";
export const maxDuration = 120;
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = z
    .union([
      z.object({ days: z.union([z.literal(7), z.literal(30)]) }).strict(),
      z.object({ customRange: customWebsiteRangeSchema }).strict(),
    ])
    .safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Choose 7, 30 or a custom range of up to 90 days." },
      { status: 400 },
    );
  try {
    const { id } = await params;
    return NextResponse.json(
      {
        ok: true,
        ...(await refreshGscDashboard(
          session.user.id,
          id,
          "days" in parsed.data ? parsed.data.days : parsed.data.customRange,
        )),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return apiErrorResponse(e, "gsc:refresh");
  }
}
