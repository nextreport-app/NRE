import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiErrorResponse } from "@/lib/api-error";
import { ServiceError } from "@/lib/service-error";
import { checkClientPerformance } from "@/lib/performance-monitor/service";
export const maxDuration = 300;
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("check") }),
  z.object({
    action: z.literal("settings"),
    enabled: z.boolean(),
    emailEnabled: z.boolean(),
  }),
]);
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const client = await prisma.client.findUnique({ where: { id } });
    if (!client || client.userId !== session.user.id)
      throw new ServiceError("Not found", 404);
    const input = schema.safeParse(await req.json().catch(() => null));
    if (!input.success)
      throw new ServiceError("Choose valid monitoring settings.");
    if (input.data.action === "settings") {
      if (input.data.enabled && !client.metaAdAccountId)
        throw new ServiceError(
          "Link this client's Meta ad account in Client settings first.",
        );
      await prisma.client.update({
        where: { id },
        data: {
          performanceMonitorEnabled: input.data.enabled,
          performanceMonitorEmailEnabled: input.data.emailEnabled,
        },
      });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json(
      { snapshot: await checkClientPerformance(id, session.user.id) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiErrorResponse(error, "performance:check");
  }
}
