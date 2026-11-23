import { customWebsiteRangeSchema } from "@/lib/website-dashboard/range";
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
    .union([z.object({ days: z.union([z.literal(7), z.literal(30)]) }).strict(), z.object({ customRange: customWebsiteRangeSchema }).strict()])
    .safeParse(await req.json().catch(() => null));
  if (!input.success)
    return NextResponse.json(
      { error: "Choose last 7, last 30 days, or a valid custom range of up to 90 completed days." },
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
          "customRange" in input.data ? input.data.customRange : input.data.days,
        )),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiErrorResponse(error, "website:refresh");
  }
}
